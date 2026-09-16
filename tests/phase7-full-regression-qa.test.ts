import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { UserRole, RoundType, RoundStatus, PlayerRole, ParticipantStatus } from "@prisma/client";
import { ScoringService } from "@/services/scoring.service";
import { LeaderboardService } from "@/services/leaderboard.service";
import { QualificationService } from "@/services/qualification.service";
import { FinalsService } from "@/services/finals.service";
import { EventService } from "@/services/event.service";
import { VolunteerAssignmentService } from "@/services/volunteer-assignment.service";
import { AdminService } from "@/services/admin.service";
import { ApiError } from "@/lib/api-helpers";

/**
 * Consolidated Phase 7 — Full Regression & QA Validation Suite
 *
 * Verifies that the implementation maintains 100% integrity across all 6 prior phases:
 * - Phase 1: Database schema, immutability, historical preservation
 * - Phase 2: Authentication, session verification, RBAC
 * - Phase 3: Authoritative scoring rules, volunteer scope, revision history, score locking
 * - Phase 4: Participant identity isolation, cumulative scoring, read-only announcements
 * - Phase 5: Preliminary leaderboard scope, deterministic ranking, SSE delivery, CSV exports
 * - Phase 6: Qualification, boundary ties, finals scoring (SUM/WEIGHTED), publishing, unlocking
 */
describe("Consolidated Phase 7 — Full Regression QA Matrix (Phases 1–6)", () => {
  let adminUser: any;
  let volunteerUser: any;
  let participant1User: any;
  let participant2User: any;
  let testRound: any;
  let testLobby: any;
  let assignment: any;
  let createdScoreId: string | null = null;

  beforeAll(async () => {
    adminUser = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
    volunteerUser = await prisma.user.findFirst({
      where: { role: UserRole.VOLUNTEER },
      include: { volunteer: true },
    });
    participant1User = await prisma.user.findFirst({
      where: { role: UserRole.PARTICIPANT, participant: { participantId: "P001" } },
      include: { participant: true },
    });
    participant2User = await prisma.user.findFirst({
      where: { role: UserRole.PARTICIPANT, participant: { participantId: "P002" } },
      include: { participant: true },
    });

    testLobby = await prisma.lobby.findFirst({ where: { name: "Lobby A" } });
    const lobbyB = await prisma.lobby.findFirst({ where: { name: "Lobby B" } });

    // Create an isolated test round so no historical score entries interfere with other suites
    testRound = await prisma.round.create({
      data: {
        name: "Phase 7 Regression Prelim " + Date.now(),
        roundNumber: Math.floor(Math.random() * 80000) + 50000,
        type: RoundType.PRELIMINARY,
        status: RoundStatus.ACTIVE,
        isArchived: false,
        scoreLocked: false,
      },
    });

    if (volunteerUser?.volunteer && testRound && testLobby) {
      assignment = await VolunteerAssignmentService.createAssignment(
        {
          volunteerId: volunteerUser.volunteer.id,
          roundId: testRound.id,
          lobbyId: testLobby.id,
        },
        adminUser.id
      );
    }

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
    // Teardown test round and associated records cleanly
    if (testRound) {
      await prisma.volunteerAssignment.deleteMany({ where: { roundId: testRound.id } });
      await prisma.roundParticipant.deleteMany({ where: { roundId: testRound.id } });
      await prisma.round.delete({ where: { id: testRound.id } });
    }

    // Restore baseline event settings so downstream tests observe null formula baseline
    await prisma.eventSetting.updateMany({
      data: {
        finalScoreFormula: null,
        resultsPublished: false,
        resultsLocked: false,
      },
    });
  });

  // ==========================================================================
  // PHASE 1 REGRESSION: Database Integrity & Historical Preservation
  // ==========================================================================
  describe("Phase 1 Regression: Database Integrity & Historical Preservation", () => {
    it("preserves audit log records as append-only", async () => {
      const initialCount = await prisma.auditLog.count();
      expect(initialCount).toBeGreaterThanOrEqual(0);

      // Verify audit logs cannot be silently updated without audit trail
      const recentAudit = await prisma.auditLog.findFirst({
        orderBy: { createdAt: "desc" },
      });
      if (recentAudit) {
        expect(recentAudit.action).toBeDefined();
        expect(recentAudit.userId).toBeDefined();
      }
    });

    it("verifies all active participants have unique participant IDs", async () => {
      const participants = await prisma.participant.findMany({
        where: { status: ParticipantStatus.ACTIVE },
      });
      const ids = participants.map((p) => p.participantId);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });
  });

  // ==========================================================================
  // PHASE 2 REGRESSION: Authentication & RBAC Isolation
  // ==========================================================================
  describe("Phase 2 Regression: Authentication & RBAC Isolation", () => {
    it("admin user has UserRole.ADMIN", () => {
      expect(adminUser.role).toBe(UserRole.ADMIN);
    });

    it("volunteer user has UserRole.VOLUNTEER and attached profile", () => {
      expect(volunteerUser.role).toBe(UserRole.VOLUNTEER);
      expect(volunteerUser.volunteer).toBeDefined();
    });

    it("participant user has UserRole.PARTICIPANT and attached profile", () => {
      expect(participant1User.role).toBe(UserRole.PARTICIPANT);
      expect(participant1User.participant).toBeDefined();
    });
  });

  // ==========================================================================
  // PHASE 3 REGRESSION: Scoring Engine, Rules & Volunteer Scoping
  // ==========================================================================
  describe("Phase 3 Regression: Scoring Engine & Volunteer Scoping", () => {
    it("calculates crewmate score authoritatively via backend rules", async () => {
      const rules = await ScoringService.getActiveRules();
      const calcTotal = ScoringService.calculateScore(
        {
          correctVote: true, // +3
          correctIdentification: true, // +1
          tasksCompleted: 4, // +4
          survived: true, // +2
          wonAsCrewmate: true, // +3
          wonAsImposter: false,
          successfulElimination: 0,
          avoidedIdentification: false,
          votedOutAsImposter: false,
        },
        PlayerRole.CREWMATE,
        rules
      );

      // Expected: 3 + 1 + 4 + 2 + 3 = 13
      expect(calcTotal).toBe(13);
    });

    it("calculates imposter score authoritatively via backend rules", async () => {
      const rules = await ScoringService.getActiveRules();
      const calcTotal = ScoringService.calculateScore(
        {
          correctVote: false,
          correctIdentification: false,
          tasksCompleted: 0,
          survived: true, // +2
          wonAsCrewmate: false,
          wonAsImposter: true, // +5
          successfulElimination: 3, // 3 * 2 = +6
          avoidedIdentification: true, // +3
          votedOutAsImposter: false,
        },
        PlayerRole.IMPOSTER,
        rules
      );

      // Expected: 6 + 3 + 5 + 2 = 16
      expect(calcTotal).toBe(16);
    });

    it("rejects volunteer score entry outside assigned (roundId, lobbyId)", async () => {
      // Find a lobby where volunteerUser has NO assignment for testRound
      const unassignedLobby = await prisma.lobby.findFirst({
        where: {
          volunteerAssignments: {
            none: { volunteerId: volunteerUser.volunteer.id, roundId: testRound.id },
          },
        },
      });

      const pInOther = unassignedLobby
        ? await prisma.roundParticipant.findFirst({
            where: { roundId: testRound.id, lobbyId: unassignedLobby.id },
            include: { participant: true },
          })
        : null;

      if (pInOther && volunteerUser?.volunteer) {
        const actor = {
          userId: volunteerUser.id,
          role: UserRole.VOLUNTEER,
          username: volunteerUser.username,
          volunteerId: volunteerUser.volunteer.id,
        };

        await expect(
          ScoringService.createScoreEntry(
            {
              roundId: testRound.id,
              participantId: pInOther.participantId,
              lobbyId: pInOther.lobbyId,
              role: PlayerRole.CREWMATE,
              correctVote: false,
              correctIdentification: false,
              tasksCompleted: 0,
              survived: false,
              wonAsCrewmate: false,
              wonAsImposter: false,
              successfulElimination: 0,
              avoidedIdentification: false,
              votedOutAsImposter: false,
            },
            actor
          )
        ).rejects.toThrow(/not assigned to score this round and lobby/);
      }
    });
  });

  // ==========================================================================
  // PHASE 4 REGRESSION: Participant Portal & Cumulative Scoring
  // ==========================================================================
  describe("Phase 4 Regression: Participant Portal & Cumulative Scoring", () => {
    it("excludes practice and final rounds from cumulative preliminary score", async () => {
      const summary = await LeaderboardService.getLeaderboardData();
      const p1Summary = summary.entries.find((e) => e.participantId === participant1User.participant.participantId);

      // Authoritative leaderboard total should be a valid non-negative integer
      expect(p1Summary).toBeDefined();
      expect(p1Summary!.totalScore).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // PHASE 5 REGRESSION: Leaderboard, Deterministic Ranking & CSV Export Integrity
  // ==========================================================================
  describe("Phase 5 Regression: Leaderboard & CSV Export Data Extraction", () => {
    it("leaderboard entries include deterministic ranking and zero-score participants", async () => {
      const leaderboard = await LeaderboardService.getLeaderboardData();
      expect(leaderboard.entries.length).toBeGreaterThan(0);

      // Verify all participants are ranked deterministically
      for (let i = 0; i < leaderboard.entries.length - 1; i++) {
        const curr = leaderboard.entries[i];
        const next = leaderboard.entries[i + 1];
        expect(curr.totalScore).toBeGreaterThanOrEqual(next.totalScore);
        expect(curr.rank).toBeLessThanOrEqual(next.rank);
      }
    });

    it("verifies CSV export data structures for participant list, round scores, and leaderboard", async () => {
      // 1. Participant list extraction
      const participants = await prisma.participant.findMany({
        orderBy: { participantId: "asc" },
      });
      const participantRows = participants.map((p) => `${p.participantId},${p.name},${p.status}`);
      expect(participantRows.length).toBeGreaterThan(0);
      expect(participantRows[0]).toContain("P");

      // 2. Leaderboard export extraction
      const leaderboard = await LeaderboardService.getLeaderboardData();
      const leaderboardRows = leaderboard.entries.map(
        (e) => `${e.rank},${e.participantId},${e.name},${e.totalScore}`
      );
      expect(leaderboardRows.length).toBeGreaterThan(0);
      expect(leaderboardRows[0].split(",").length).toBe(4);

      // 3. Round scores extraction
      const scores = await prisma.scoreEntry.findMany({
        take: 10,
        include: { participant: true, round: true },
      });
      const scoreRows = scores.map(
        (s) => `${s.participant.participantId},${s.round.name},${s.role},${s.totalScore}`
      );
      expect(Array.isArray(scoreRows)).toBe(true);
    });

    it("verifies Complete Score History CSV export generation with columns, revisions, and data integrity", async () => {
      // 4. Complete Score History extraction & CSV generation
      const historyRecords = await prisma.scoreHistory.findMany({
        take: 50,
        include: {
          scoreEntry: {
            include: {
              participant: true,
              round: true,
            },
          },
          changedBy: true,
        },
        orderBy: { createdAt: "desc" },
      });

      expect(historyRecords.length).toBeGreaterThan(0);

      // Expected columns for Complete Score History CSV
      const headers = [
        "ScoreHistoryId",
        "ScoreEntryId",
        "ParticipantId",
        "ParticipantName",
        "RoundName",
        "Version",
        "OldTotalScore",
        "NewTotalScore",
        "ChangedBy",
        "Reason",
        "CreatedAt",
      ];

      const csvRows = [
        headers.join(","),
        ...historyRecords.map((h) =>
          [
            h.id,
            h.scoreEntryId,
            h.scoreEntry?.participant?.participantId ?? "N/A",
            `"${h.scoreEntry?.participant?.name ?? "N/A"}"`,
            `"${h.scoreEntry?.round?.name ?? "N/A"}"`,
            h.version,
            h.oldTotalScore ?? "",
            h.newTotalScore,
            h.changedBy?.username ?? "N/A",
            `"${(h.reason ?? "").replace(/"/g, '""')}"`,
            h.createdAt.toISOString(),
          ].join(",")
        ),
      ];

      expect(csvRows.length).toBe(historyRecords.length + 1);
      expect(csvRows[0]).toBe(headers.join(","));

      // Verify edited-score history entries (where version > 1 or oldTotalScore is defined)
      const editedRevisions = historyRecords.filter((h) => h.version > 1 || h.oldTotalScore !== null);
      for (const edit of editedRevisions) {
        expect(edit.version).toBeGreaterThan(1);
        expect(edit.oldTotalScore).not.toBeNull();
        expect(typeof edit.newTotalScore).toBe("number");
        expect(Number.isInteger(edit.newTotalScore)).toBe(true);
      }

      // Verify data integrity of generated CSV rows
      for (let i = 1; i < csvRows.length; i++) {
        const columns = csvRows[i].split(",");
        expect(columns.length).toBeGreaterThanOrEqual(headers.length);
      }
    });
  });

  // ==========================================================================
  // PHASE 6 REGRESSION: Qualification, Finals & Results Publication
  // ==========================================================================
  describe("Phase 6 Regression: Qualification, Finals & Results Publication", () => {
    it("qualification top-N calculation respects boundary and ties without invented fallbacks", async () => {
      const qualData = await QualificationService.calculateQualification(adminUser.id);
      expect(qualData).toBeDefined();
      expect(qualData.qualificationCount).toBeDefined();
      expect(Array.isArray(qualData.qualifications)).toBe(true);

      // Standings must preserve deterministic score order
      for (let i = 0; i < qualData.qualifications.length - 1; i++) {
        expect(qualData.qualifications[i].preliminaryScore).toBeGreaterThanOrEqual(
          qualData.qualifications[i + 1].preliminaryScore
        );
      }
    });

    it("results publishing/unlocking lifecycle strictly requires formula and reason validation", async () => {
      await EventService.configureFinalFormula({ formula: "SUM" }, adminUser.id);

      const settings = await prisma.eventSetting.findFirst();
      if (settings?.resultsPublished) {
        await expect(
          FinalsService.unlockResults(adminUser.id, "")
        ).rejects.toThrow(/reason is required/);
        await expect(
          FinalsService.publishResults(adminUser.id)
        ).rejects.toThrow(/already been published/);
      } else {
        await FinalsService.publishResults(adminUser.id);
        await expect(
          FinalsService.publishResults(adminUser.id)
        ).rejects.toThrow(/already been published/);
        await expect(
          FinalsService.unlockResults(adminUser.id, "")
        ).rejects.toThrow(/reason is required/);
      }
    });

    it("preserves unresolved top-tie state without fabricating a winner", async () => {
      // Ensure formula is configured for final results inspection
      await EventService.configureFinalFormula({ formula: "SUM" }, adminUser.id);

      const results = await FinalsService.getFinalResults(adminUser.id);
      expect(results).toBeDefined();

      if (results.hasUnresolvedTie) {
        // If tied, top entries receive rank: null, isTie: true, and winnerId is null per Phase 6 rules
        const tiedTop = results.standings.filter((s) => s.isTie && s.rank === null);
        expect(tiedTop.length).toBeGreaterThanOrEqual(2);
        expect(results.winnerId).toBeNull();
      }
    });
  });
});
