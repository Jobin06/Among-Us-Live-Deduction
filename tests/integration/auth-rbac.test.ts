import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth-options";
import { loginRateLimiter } from "@/lib/rate-limiter";
import { requireRole, requireVolunteerScope, ApiError } from "@/lib/api-helpers";
import * as authLib from "@/lib/auth";
import { vi } from "vitest";

const prisma = new PrismaClient();

// Get the credentials authorize function
const credentialsProvider = authOptions.providers.find(
  (p: any) => p.id === "credentials" || p.name === "Credentials"
) as any;

if (!credentialsProvider || !credentialsProvider.authorize) {
  throw new Error("CredentialsProvider.authorize is missing");
}

const authorize = credentialsProvider.options?.authorize || credentialsProvider.authorize;

describe("Phase 3 — Authentication & Authorization (RBAC)", () => {
  let adminUser: any;
  let volunteer1User: any;
  let volunteer3User: any;
  let participant1User: any;
  let deactivatedUser: any;
  let prelimRound1: any;
  let lobbyA: any;
  let lobbyC: any;
  let lobbyD: any;

  beforeAll(async () => {
    // 1. Fetch seed accounts
    adminUser = await prisma.user.findUnique({
      where: { username: "admin" },
    });
    volunteer1User = await prisma.user.findUnique({
      where: { username: "volunteer1" },
      include: { volunteer: true },
    });
    volunteer3User = await prisma.user.findUnique({
      where: { username: "volunteer3" },
      include: { volunteer: true },
    });
    participant1User = await prisma.user.findUnique({
      where: { username: "P001" },
      include: { participant: true },
    });

    // 2. Create a deactivated user for testing
    deactivatedUser = await prisma.user.upsert({
      where: { username: "deactivated_user" },
      update: { isActive: false },
      create: {
        username: "deactivated_user",
        passwordHash: adminUser.passwordHash,
        role: UserRole.PARTICIPANT,
        isActive: false,
      },
    });

    // 3. Fetch rounds and lobbies for assignment scoping tests
    prelimRound1 = await prisma.round.findFirst({
      where: { name: "Preliminary Round 1", isArchived: false },
    });
    if (!prelimRound1) {
      const latest = await prisma.round.findFirst({
        where: { name: "Preliminary Round 1" },
        orderBy: { createdAt: "desc" },
      });
      if (latest) {
        prelimRound1 = await prisma.round.update({
          where: { id: latest.id },
          data: { isArchived: false },
        });
      }
    }
    lobbyA = await prisma.lobby.findUnique({ where: { name: "Lobby A" } });
    lobbyC = await prisma.lobby.findUnique({ where: { name: "Lobby C" } });
    lobbyD = await prisma.lobby.findUnique({ where: { name: "Lobby D" } });
  });

  afterAll(async () => {
    // Clean up deactivated test user
    if (deactivatedUser) {
      await prisma.user.delete({ where: { id: deactivatedUser.id } });
    }
    await prisma.$disconnect();
  });

  describe("1. Credentials Authentication & CredentialsProvider.authorize", () => {
    it("should successfully authenticate an ADMIN with valid credentials", async () => {
      const user = await authorize(
        { username: "admin", password: "adminpassword123" },
        {} as any
      );

      expect(user).toBeDefined();
      expect(user.username).toBe("admin");
      expect(user.role).toBe(UserRole.ADMIN);
      expect(user.isActive).toBe(true);
    });

    it("should successfully authenticate a VOLUNTEER with valid credentials", async () => {
      const user = await authorize(
        { username: "volunteer1", password: "password123" },
        {} as any
      );

      expect(user).toBeDefined();
      expect(user.username).toBe("volunteer1");
      expect(user.role).toBe(UserRole.VOLUNTEER);
      expect(user.volunteerId).toBe(volunteer1User.volunteer.id);
      expect(user.isActive).toBe(true);
    });

    it("should successfully authenticate a PARTICIPANT by Participant ID (case-insensitive)", async () => {
      const user = await authorize(
        { username: "p001", password: "password123" },
        {} as any
      );

      expect(user).toBeDefined();
      expect(user.username).toBe("P001");
      expect(user.role).toBe(UserRole.PARTICIPANT);
      expect(user.participantId).toBe("P001");
      expect(user.isActive).toBe(true);
    });

    it("should REJECT authentication with an incorrect password", async () => {
      await expect(
        authorize({ username: "admin", password: "WRONG_PASSWORD" }, {} as any)
      ).rejects.toThrow("Invalid username or password.");
    });

    it("should REJECT authentication for a non-existent username", async () => {
      await expect(
        authorize({ username: "ghost_user_404", password: "password123" }, {} as any)
      ).rejects.toThrow("Invalid username or password.");
    });

    it("should REJECT authentication for a DEACTIVATED user account", async () => {
      await expect(
        authorize({ username: "deactivated_user", password: "adminpassword123" }, {} as any)
      ).rejects.toThrow("Account has been deactivated.");
    });

    it("should enforce rate limiting after 5 consecutive failed attempts", async () => {
      const targetUser = "rate_limit_test_target";
      loginRateLimiter.reset(targetUser);

      // 5 failed attempts
      for (let i = 1; i <= 5; i++) {
        try {
          await authorize({ username: targetUser, password: "bad_password" }, {} as any);
        } catch {
          // Expected error
        }
      }

      // 6th attempt must be rejected by rate limiter before password check
      await expect(
        authorize({ username: targetUser, password: "any_password" }, {} as any)
      ).rejects.toThrow("Too many failed attempts. Please try again in 15 minutes.");

      // Clean up rate limiter entry
      loginRateLimiter.reset(targetUser);
    });

    it("should enforce rate limiting per IP/username after 5 consecutive failed attempts", async () => {
      const spoofedIp = "192.168.1.150";
      const targetUser = "ip_rate_test_user";
      loginRateLimiter.resetAll();

      const mockReq = {
        headers: { "x-forwarded-for": spoofedIp },
      };

      // 5 failed attempts for this specific IP + username
      for (let i = 1; i <= 5; i++) {
        try {
          await authorize({ username: targetUser, password: "bad_password" }, mockReq as any);
        } catch {
          // Expected failure
        }
      }

      // 6th attempt for the same IP + username must be rejected by rate limiter
      await expect(
        authorize({ username: targetUser, password: "any_password" }, mockReq as any)
      ).rejects.toThrow("Too many failed attempts. Please try again in 15 minutes.");

      // A different username from the same IP should NOT be blocked (scoping is per IP/username)
      let differentUserBlocked = false;
      try {
        await authorize({ username: "different_user", password: "bad_password" }, mockReq as any);
      } catch (err: any) {
        if (err.message.includes("Too many failed attempts")) {
          differentUserBlocked = true;
        }
      }
      expect(differentUserBlocked).toBe(false);

      // The same username from a different IP should NOT be blocked
      const differentIpReq = { headers: { "x-forwarded-for": "192.168.1.151" } };
      let differentIpBlocked = false;
      try {
        await authorize({ username: targetUser, password: "bad_password" }, differentIpReq as any);
      } catch (err: any) {
        if (err.message.includes("Too many failed attempts")) {
          differentIpBlocked = true;
        }
      }
      expect(differentIpBlocked).toBe(false);

      loginRateLimiter.resetAll();
    });
  });

  describe("2. Server-Side Role-Based Access Control (requireRole)", () => {
    it("should ALLOW ADMIN when role required is ADMIN", async () => {
      vi.spyOn(authLib, "getServerAuthSession").mockResolvedValueOnce({
        user: {
          id: adminUser.id,
          username: "admin",
          role: UserRole.ADMIN,
          isActive: true,
        },
        expires: new Date(Date.now() + 3600000).toISOString(),
      });

      const user = await requireRole([UserRole.ADMIN]);
      expect(user.role).toBe(UserRole.ADMIN);
    });

    it("should REJECT VOLUNTEER with 403 when role required is ADMIN", async () => {
      vi.spyOn(authLib, "getServerAuthSession").mockResolvedValueOnce({
        user: {
          id: volunteer1User.id,
          username: "volunteer1",
          role: UserRole.VOLUNTEER,
          isActive: true,
        },
        expires: new Date(Date.now() + 3600000).toISOString(),
      });

      let error: any;
      try {
        await requireRole([UserRole.ADMIN]);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toMatch(/Access denied/);
    });

    it("should REJECT PARTICIPANT with 403 when role required is VOLUNTEER or ADMIN", async () => {
      vi.spyOn(authLib, "getServerAuthSession").mockResolvedValueOnce({
        user: {
          id: participant1User.id,
          username: "P001",
          role: UserRole.PARTICIPANT,
          isActive: true,
        },
        expires: new Date(Date.now() + 3600000).toISOString(),
      });

      let error: any;
      try {
        await requireRole([UserRole.VOLUNTEER, UserRole.ADMIN]);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toMatch(/Access denied/);
    });

    it("should REJECT unauthenticated request with 401", async () => {
      vi.spyOn(authLib, "getServerAuthSession").mockResolvedValueOnce(null);

      let error: any;
      try {
        await requireRole([UserRole.PARTICIPANT]);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe("Authentication required");
    });
  });

  describe("3. Volunteer Assignment Scope Authorization (requireVolunteerScope)", () => {
    it("should GRANT ADMIN full access across any round and lobby", async () => {
      vi.spyOn(authLib, "getServerAuthSession").mockResolvedValueOnce({
        user: {
          id: adminUser.id,
          username: "admin",
          role: UserRole.ADMIN,
          isActive: true,
        },
        expires: new Date(Date.now() + 3600000).toISOString(),
      });

      // Admin requests access to arbitrary round/lobby
      const res = await requireVolunteerScope(prelimRound1.id, lobbyA.id);
      expect(res.isExemptAdmin).toBe(true);
      expect(res.user.role).toBe(UserRole.ADMIN);
    });

    it("should ALLOW VOLUNTEER for an explicitly ASSIGNED round and lobby", async () => {
      // volunteer1 is assigned to (prelimRound1, lobbyA) in seed
      vi.spyOn(authLib, "getServerAuthSession").mockResolvedValueOnce({
        user: {
          id: volunteer1User.id,
          username: "volunteer1",
          role: UserRole.VOLUNTEER,
          volunteerId: volunteer1User.volunteer.id,
          isActive: true,
        },
        expires: new Date(Date.now() + 3600000).toISOString(),
      });

      const res = await requireVolunteerScope(prelimRound1.id, lobbyA.id);
      expect(res.isExemptAdmin).toBe(false);
      expect(res.assignment).toBeDefined();
      expect(res.assignment?.roundId).toBe(prelimRound1.id);
      expect(res.assignment?.lobbyId).toBe(lobbyA.id);
    });

    it("should REJECT VOLUNTEER with 403 for an UNASSIGNED round and lobby", async () => {
      // volunteer3 is assigned to Lobby D in seed, NOT Lobby C
      vi.spyOn(authLib, "getServerAuthSession").mockResolvedValueOnce({
        user: {
          id: volunteer3User.id,
          username: "volunteer3",
          role: UserRole.VOLUNTEER,
          volunteerId: volunteer3User.volunteer.id,
          isActive: true,
        },
        expires: new Date(Date.now() + 3600000).toISOString(),
      });

      let error: any;
      try {
        await requireVolunteerScope(prelimRound1.id, lobbyC.id);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toMatch(/Forbidden: You are not assigned to score this round and lobby/);
    });

    it("should REJECT PARTICIPANT with 403 when attempting volunteer scoring operations", async () => {
      vi.spyOn(authLib, "getServerAuthSession").mockResolvedValueOnce({
        user: {
          id: participant1User.id,
          username: "P001",
          role: UserRole.PARTICIPANT,
          participantId: "P001",
          isActive: true,
        },
        expires: new Date(Date.now() + 3600000).toISOString(),
      });

      let error: any;
      try {
        await requireVolunteerScope(prelimRound1.id, lobbyA.id);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toMatch(/Only volunteers and administrators may enter scores/);
    });
  });

  describe("4. NextAuth JWT & Session Callbacks", () => {
    it("should populate JWT token from authenticated user on sign in", async () => {
      const jwtCallback = authOptions.callbacks?.jwt;
      expect(jwtCallback).toBeDefined();

      const initialToken: any = {};
      const userPayload: any = {
        id: "user-uuid-1",
        username: "P001",
        role: UserRole.PARTICIPANT,
        name: "Cadet P001",
        participantId: "P001",
        volunteerId: null,
        isActive: true,
      };

      const updatedToken = await jwtCallback!({
        token: initialToken,
        user: userPayload,
      } as any);

      expect(updatedToken.id).toBe("user-uuid-1");
      expect(updatedToken.username).toBe("P001");
      expect(updatedToken.role).toBe(UserRole.PARTICIPANT);
      expect(updatedToken.participantId).toBe("P001");
      expect(updatedToken.isActive).toBe(true);
    });

    it("should populate Session user from JWT token", async () => {
      const sessionCallback = authOptions.callbacks?.session;
      expect(sessionCallback).toBeDefined();

      const sessionObj: any = {
        user: { name: "", email: "", image: "" },
        expires: "2026-10-01",
      };

      const tokenPayload: any = {
        id: "user-uuid-admin",
        username: "admin",
        role: UserRole.ADMIN,
        name: "Head Admin",
        participantId: null,
        volunteerId: null,
        isActive: true,
      };

      const finalSession = await sessionCallback!({
        session: sessionObj,
        token: tokenPayload,
      } as any);

      expect(finalSession.user.id).toBe("user-uuid-admin");
      expect(finalSession.user.username).toBe("admin");
      expect(finalSession.user.role).toBe(UserRole.ADMIN);
      expect(finalSession.user.isActive).toBe(true);
    });
  });
});
