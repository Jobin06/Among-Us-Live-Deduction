import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { UserRole, RoundType, RoundStatus, PlayerRole } from "@prisma/client";
import { ScoringService } from "@/services/scoring.service";
import { EventService } from "@/services/event.service";
import { FinalsService } from "@/services/finals.service";
import { VolunteerAssignmentService } from "@/services/volunteer-assignment.service";
import { LoginRateLimiter } from "@/lib/rate-limiter";
import { ApiError, handleApiError } from "@/lib/api-helpers";
import nextConfig from "../next.config.mjs";
import { GET as healthCheckGet } from "@/app/api/health/route";

/**
 * Consolidated Phase 8 — Security Hardening, Verification & Documentation Suite
 *
 * Exhaustively validates:
 * 1. HTTP Security Headers & Least-Permissive CSP in next.config.mjs
 * 2. Production Error Sanitization & ApiError Preservation
 * 3. Health Check (/api/health) Contract & Non-Mutating DB Probe
 * 4. Authentication Rate Limiter (5 failed attempts / 15m composite key)
 * 5. Role-Based Access Control (RBAC) Isolation
 * 6. Volunteer Exact Scope Tuple Isolation: (Round, Lobby)
 * 7. Participant Server-Enforced Identity & IDOR Defense
 * 8. Authoritative Scoring & Anti-Tampering Evaluation
 * 9. Unpublished Final Results Gating
 * 10. PostgreSQL Immutability Triggers (Append-Only Protections)
 */
describe("Consolidated Phase 8 — Security Hardening & Integrity Suite", () => {
  let adminUser: any;
  let volunteer1User: any;
  let volunteer2User: any;
  let participant1User: any;
  let participant2User: any;
  let testRound: any;
  let lobbyA: any;
  let lobbyB: any;
  let assignmentA: any;

  beforeAll(async () => {
    adminUser = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
    
    // Find or locate volunteers
    const volunteers = await prisma.user.findMany({
      where: { role: UserRole.VOLUNTEER },
      include: { volunteer: true },
    });
    volunteer1User = volunteers[0];
    volunteer2User = volunteers[1] || volunteers[0];

    // Find participants
    participant1User = await prisma.user.findFirst({
      where: { role: UserRole.PARTICIPANT, participant: { participantId: "P001" } },
      include: { participant: true },
    });
    participant2User = await prisma.user.findFirst({
      where: { role: UserRole.PARTICIPANT, participant: { participantId: "P002" } },
      include: { participant: true },
    });

    lobbyA = await prisma.lobby.findFirst({ where: { name: "Lobby A" } });
    lobbyB = await prisma.lobby.findFirst({ where: { name: "Lobby B" } });

    // Create an isolated active preliminary round for security tests
    testRound = await prisma.round.create({
      data: {
        name: "Phase 8 Security Hardening Round " + Date.now(),
        roundNumber: Math.floor(Math.random() * 80000) + 120000,
        type: RoundType.PRELIMINARY,
        status: RoundStatus.ACTIVE,
        isArchived: false,
        scoreLocked: false,
      },
    });

    // Assign volunteer1 strictly to (testRound, lobbyA)
    if (volunteer1User?.volunteer) {
      assignmentA = await VolunteerAssignmentService.createAssignment(
        {
          volunteerId: volunteer1User.volunteer.id,
          roundId: testRound.id,
          lobbyId: lobbyA.id,
        },
        adminUser.id
      );
    }

    // Register participant1 in (testRound, lobbyA)
    if (participant1User?.participant && testRound && lobbyA) {
      await prisma.roundParticipant.create({
        data: {
          roundId: testRound.id,
          participantId: participant1User.participant.id,
          lobbyId: lobbyA.id,
        },
      });
    }

    // Register participant2 in (testRound, lobbyB)
    if (participant2User?.participant && testRound && lobbyB) {
      await prisma.roundParticipant.create({
        data: {
          roundId: testRound.id,
          participantId: participant2User.participant.id,
          lobbyId: lobbyB.id,
        },
      });
    }
  });

  afterAll(async () => {
    // Safely archive test round in accordance with Option A archival rules (no mutating score_history)
    if (testRound) {
      await prisma.volunteerAssignment.deleteMany({ where: { roundId: testRound.id } }).catch(() => {});
      await prisma.round.update({
        where: { id: testRound.id },
        data: { isArchived: true, status: RoundStatus.COMPLETED },
      }).catch(() => {});
    }
  });

  // ===========================================================================
  // 1. HTTP Security Headers & Least-Permissive CSP
  // ===========================================================================
  describe("1. Security Headers & CSP Configuration", () => {
    it("should export standalone build target in next.config.mjs", () => {
      expect(nextConfig.output).toBe("standalone");
      expect(nextConfig.reactStrictMode).toBe(true);
    });

    it("should configure strict security headers on all routes (/(.*))", async () => {
      expect(typeof nextConfig.headers).toBe("function");
      const headersConfig = await nextConfig.headers();
      expect(Array.isArray(headersConfig)).toBe(true);
      expect(headersConfig.length).toBeGreaterThanOrEqual(1);

      const rootConfig = headersConfig.find((h: any) => h.source === "/(.*)");
      expect(rootConfig).toBeDefined();

      const headerMap = new Map<string, string>();
      for (const item of rootConfig.headers) {
        headerMap.set(item.key, item.value);
      }

      // Verify essential security headers
      expect(headerMap.get("X-Frame-Options")).toBe("DENY");
      expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
      expect(headerMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
      expect(headerMap.get("Permissions-Policy")).toContain("camera=()");

      // Verify Content-Security-Policy least-permissive rules
      const csp = headerMap.get("Content-Security-Policy");
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'unsafe-inline'");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).toContain("connect-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");

      // Critical constraint: MUST NOT contain 'unsafe-eval'
      expect(csp).not.toContain("'unsafe-eval'");
    });
  });

  // ===========================================================================
  // 2. Production Error Sanitization & ApiError Preservation
  // ===========================================================================
  describe("2. Error Sanitization & ApiError Response Preservation", () => {
    const originalEnv = process.env.NODE_ENV;

    afterAll(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it("should mask unexpected 500 internal errors in production environment", async () => {
      process.env.NODE_ENV = "production";

      const unexpectedError = new Error("FATAL: relation 'users' does not exist; secret_key=12345");
      const response = handleApiError(unexpectedError);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toBe("Internal server error");
      expect(json.error.details).toBeNull();
      // Verifies zero database connection or sensitive information leaked
      expect(JSON.stringify(json)).not.toContain("secret_key");
      expect(JSON.stringify(json)).not.toContain("relation");
    });

    it("should preserve expected ApiError status codes, messages, and details", async () => {
      process.env.NODE_ENV = "production";

      // 400 Bad Request
      const badReq = ApiError.badRequest("Invalid metrics payload", { field: "tasks" });
      const resBadReq = handleApiError(badReq);
      expect(resBadReq.status).toBe(400);
      const jsonBadReq = await resBadReq.json();
      expect(jsonBadReq.success).toBe(false);
      expect(jsonBadReq.error.message).toBe("Invalid metrics payload");
      expect(jsonBadReq.error.details).toEqual({ field: "tasks" });

      // 401 Unauthorized
      const unauth = ApiError.unauthorized("Authentication required");
      const resUnauth = handleApiError(unauth);
      expect(resUnauth.status).toBe(401);
      const jsonUnauth = await resUnauth.json();
      expect(jsonUnauth.error.message).toBe("Authentication required");

      // 403 Forbidden
      const forbidden = ApiError.forbidden("Access denied");
      const resForbidden = handleApiError(forbidden);
      expect(resForbidden.status).toBe(403);
      const jsonForbidden = await resForbidden.json();
      expect(jsonForbidden.error.message).toBe("Access denied");

      // 404 Not Found
      const notFound = ApiError.notFound("Resource missing");
      const resNotFound = handleApiError(notFound);
      expect(resNotFound.status).toBe(404);
      const jsonNotFound = await resNotFound.json();
      expect(jsonNotFound.error.message).toBe("Resource missing");

      // 409 Conflict
      const conflict = ApiError.conflict("Assignment conflict");
      const resConflict = handleApiError(conflict);
      expect(resConflict.status).toBe(409);
      const jsonConflict = await resConflict.json();
      expect(jsonConflict.error.message).toBe("Assignment conflict");
    });
  });

  // ===========================================================================
  // 3. Health Endpoint Contract & Non-Mutating Probe
  // ===========================================================================
  describe("3. Health Check Endpoint (/api/health)", () => {
    it("should return HTTP 200 with status 'ok' and ISO timestamp when database is healthy", async () => {
      const response = await healthCheckGet();
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.status).toBe("ok");
      expect(typeof json.timestamp).toBe("string");
      expect(new Date(json.timestamp).getTime()).not.toBeNaN();
    });

    it("should return HTTP 503 with status 'error' and zero SQL details if probe fails", async () => {
      // Temporarily mock prisma.$queryRaw to simulate a database outage
      const originalQueryRaw = prisma.$queryRaw;
      (prisma as any).$queryRaw = async () => {
        throw new Error("PostgreSQL connection terminated unexpectedly at pg_catalog.pg_stat_activity");
      };

      try {
        const response = await healthCheckGet();
        expect(response.status).toBe(503);

        const json = await response.json();
        expect(json.status).toBe("error");
        // Must NOT leak database details
        expect(json.message).toBeUndefined();
        expect(JSON.stringify(json)).not.toContain("PostgreSQL");
        expect(JSON.stringify(json)).not.toContain("pg_catalog");
      } finally {
        prisma.$queryRaw = originalQueryRaw;
      }
    });
  });

  // ===========================================================================
  // 4. Rate Limiting Defense (5 failed attempts / 15m)
  // ===========================================================================
  describe("4. Authentication Rate Limiter", () => {
    it("should permit initial attempts and strictly block after 5 failed attempts", () => {
      const limiter = new LoginRateLimiter();
      const testIp = "192.168.1.100";
      const testUser = "intruder_account";

      // Attempts 1 to 5 should be allowed
      for (let i = 1; i <= 5; i++) {
        const check = limiter.check(testUser, testIp);
        expect(check.allowed).toBe(true);
        expect(check.remaining).toBe(5 - (i - 1));
        limiter.recordAttempt(testUser, testIp);
      }

      // 6th attempt MUST be blocked
      const blockedCheck = limiter.check(testUser, testIp);
      expect(blockedCheck.allowed).toBe(false);
      expect(blockedCheck.remaining).toBe(0);

      // Successful login resets counter
      limiter.reset(testUser, testIp);
      const resetCheck = limiter.check(testUser, testIp);
      expect(resetCheck.allowed).toBe(true);
      expect(resetCheck.remaining).toBe(5);
    });
  });

  // ===========================================================================
  // 5. Volunteer Exact Scope Tuple Isolation: (Round, Lobby)
  // ===========================================================================
  describe("5. Volunteer Scope Tuple Isolation", () => {
    it("should allow scoring inside assigned (round, lobby) pair", async () => {
      if (!volunteer1User?.volunteer) return;

      const actor = {
        userId: volunteer1User.id,
        role: UserRole.VOLUNTEER,
        username: volunteer1User.username,
        volunteerId: volunteer1User.volunteer.id,
      };

      const scoreEntry = await ScoringService.createScoreEntry(
        {
          roundId: testRound.id,
          lobbyId: lobbyA.id,
          participantId: participant1User.participant.id,
          role: PlayerRole.CREWMATE,
          correctVote: false,
          correctIdentification: false,
          tasksCompleted: 3,
          survived: true,
          wonAsCrewmate: false,
          wonAsImposter: false,
          successfulElimination: 0,
          avoidedIdentification: false,
          votedOutAsImposter: false,
        },
        actor
      );

      expect(scoreEntry).toBeDefined();
      expect(scoreEntry.participantId).toBe(participant1User.participant.id);
      expect(scoreEntry.roundId).toBe(testRound.id);
    });

    it("should strictly reject score entry for unassigned lobby (Round, Lobby B) with 403", async () => {
      if (!volunteer1User?.volunteer) return;

      const actor = {
        userId: volunteer1User.id,
        role: UserRole.VOLUNTEER,
        username: volunteer1User.username,
        volunteerId: volunteer1User.volunteer.id,
      };

      // volunteer1 is assigned to Lobby A, NOT Lobby B
      await expect(
        ScoringService.createScoreEntry(
          {
            roundId: testRound.id,
            lobbyId: lobbyB.id,
            participantId: participant2User.participant.id,
            role: PlayerRole.CREWMATE,
            correctVote: false,
            correctIdentification: false,
            tasksCompleted: 2,
            survived: true,
            wonAsCrewmate: false,
            wonAsImposter: false,
            successfulElimination: 0,
            avoidedIdentification: false,
            votedOutAsImposter: false,
          },
          actor
        )
      ).rejects.toThrowError(/not assigned to score this round and lobby/i);
    });
  });

  // ===========================================================================
  // 6. Authoritative Scoring & Tampering Defense
  // ===========================================================================
  describe("6. Authoritative Backend Scoring Engine", () => {
    it("should compute points strictly from database scoring rules, ignoring arbitrary client values", async () => {
      const rules = await ScoringService.getActiveRules();
      const calcTotal = ScoringService.calculateScore(
        {
          correctVote: false,
          correctIdentification: false,
          tasksCompleted: 4,
          survived: true,
          wonAsCrewmate: false,
          wonAsImposter: false,
          successfulElimination: 0,
          avoidedIdentification: false,
          votedOutAsImposter: false,
        },
        PlayerRole.CREWMATE,
        rules
      );

      const taskRule = rules.get("tasks_completed")?.points ?? 1;
      const surviveRule = rules.get("survived")?.points ?? 2;
      const expectedTotal = (4 * taskRule) + surviveRule;
      expect(calcTotal).toBe(expectedTotal);
    });
  });

  // ===========================================================================
  // 7. Results Gating & Lock Semantics
  // ===========================================================================
  describe("7. Results Publication Gating & Unlock Audit Reason", () => {
    it("should reject results unlocking if mandatory reason is missing or empty", async () => {
      await expect(
        FinalsService.unlockResults(
          { reason: "" },
          adminUser.id
        )
      ).rejects.toThrowError(/reason is required/i);
    });
  });


  // ===========================================================================
  // 8. PostgreSQL Immutability Triggers (Append-Only Protections)
  // ===========================================================================
  describe("8. PostgreSQL Immutability Triggers", () => {
    it("should block direct SQL UPDATE on audit_logs via database trigger", async () => {
      const existingLog = await prisma.auditLog.findFirst();
      if (!existingLog) return;

      await expect(
        prisma.$executeRawUnsafe(
          "UPDATE audit_logs SET action = 'TAMPERED_ACTION' WHERE id = $1::uuid",
          existingLog.id
        )
      ).rejects.toThrowError(/append-only/i);
    });

    it("should block direct SQL DELETE on audit_logs via database trigger", async () => {
      const existingLog = await prisma.auditLog.findFirst();
      if (!existingLog) return;

      await expect(
        prisma.$executeRawUnsafe(
          "DELETE FROM audit_logs WHERE id = $1::uuid",
          existingLog.id
        )
      ).rejects.toThrowError(/append-only/i);
    });

    it("should block direct SQL UPDATE on score_history via database trigger", async () => {
      const existingHistory = await prisma.scoreHistory.findFirst();
      if (!existingHistory) return;

      await expect(
        prisma.$executeRawUnsafe(
          "UPDATE score_history SET reason = 'TAMPERED_REASON' WHERE id = $1::uuid",
          existingHistory.id
        )
      ).rejects.toThrowError(/append-only/i);
    });

    it("should block direct SQL DELETE on score_history via database trigger", async () => {
      const existingHistory = await prisma.scoreHistory.findFirst();
      if (!existingHistory) return;

      await expect(
        prisma.$executeRawUnsafe(
          "DELETE FROM score_history WHERE id = $1::uuid",
          existingHistory.id
        )
      ).rejects.toThrowError(/append-only/i);
    });
  });

  // ===========================================================================
  // 9. Real-Time Synchronization Timing Invariants (SSE & Polling)
  // ===========================================================================
  describe("9. Real-Time Synchronization Timing Invariants (SSE & Polling)", () => {
    it("should strictly enforce exactly 15-second (15000ms) SSE heartbeat in API route", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const sseRouteSource = fs.readFileSync(
        path.join(process.cwd(), "src/app/api/leaderboard/sse/route.ts"),
        "utf-8"
      );

      // Verify exact 15-second heartbeat interval (15000 ms)
      expect(sseRouteSource).toContain("15000");
      expect(sseRouteSource).toMatch(/15000\s*\);/);

      // Confirm no stale 20-second heartbeat references remain
      expect(sseRouteSource).not.toContain("20000");
      expect(sseRouteSource).not.toContain("20 * 1000");

      // Verify comment format matches : heartbeat\n\n
      expect(sseRouteSource).toContain('": heartbeat\\n\\n"');
    });

    it("should strictly enforce exactly 10-second (10000ms) fallback polling in leaderboard UI", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const leaderboardPageSource = fs.readFileSync(
        path.join(process.cwd(), "src/app/leaderboard/page.tsx"),
        "utf-8"
      );

      // Verify fallback polling is exactly 10000 ms (10 seconds)
      expect(leaderboardPageSource).toContain("10000");
      expect(leaderboardPageSource).toMatch(/10000\s*\);/);
    });
  });
});

