import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, UserRole, PlayerRole, RoundType } from "@prisma/client";
import { ScoringService } from "@/services/scoring.service";
import { createScoreSchema, updateScoreSchema } from "@/validation/score.schema";

const prisma = new PrismaClient();

describe("Consolidated Phase 3 — Scoring Engine & Volunteer System", () => {
  let adminUser: any;
  let volunteer1User: any;
  let volunteer2User: any;
  let participantUser: any;

  let prelimRound1: any;
  let prelimRound2: any;
  let lobbyA: any;
  let lobbyB: any;
  let lobbyC: any;

  let p001: any; // in Preliminary 1, Lobby A
  let p002: any; // in Preliminary 1, Lobby A
  let p011: any; // in Preliminary 1, Lobby B

  let testScoreEntryId: string | null = null;

  beforeAll(async () => {
    // 1. Ensure canonical rounds are active
    const canonicalRounds = [
      "Practice Round",
      "Preliminary Round 1",
      "Preliminary Round 2",
      "Preliminary Round 3",
      "Final Round 1",
    ];
    for (const name of canonicalRounds) {
      const active = await prisma.round.findFirst({
        where: { name, isArchived: false },
      });
      if (!active) {
        const latest = await prisma.round.findFirst({
          where: { name },
          orderBy: { createdAt: "desc" },
        });
        if (latest) {
          await prisma.round.update({
            where: { id: latest.id },
            data: { isArchived: false, scoreLocked: false },
          });
        }
      }
    }

    // 2. Fetch users
    adminUser = await prisma.user.findUnique({ where: { username: "admin" } });
    volunteer1User = await prisma.user.findUnique({
      where: { username: "volunteer1" },
      include: { volunteer: true },
    });
    volunteer2User = await prisma.user.findUnique({
      where: { username: "volunteer2" },
      include: { volunteer: true },
    });
    participantUser = await prisma.user.findUnique({
      where: { username: "P001" },
      include: { participant: true },
    });

    // 3. Fetch rounds and lobbies
    prelimRound1 = await prisma.round.findFirst({
      where: { name: "Preliminary Round 1", isArchived: false },
    });
    prelimRound2 = await prisma.round.findFirst({
      where: { name: "Preliminary Round 2", isArchived: false },
    });
    lobbyA = await prisma.lobby.findUnique({ where: { name: "Lobby A" } });
    lobbyB = await prisma.lobby.findUnique({ where: { name: "Lobby B" } });
    lobbyC = await prisma.lobby.findUnique({ where: { name: "Lobby C" } });

    // 4. Fetch participants
    p001 = await prisma.participant.findUnique({ where: { participantId: "P001" } });
    p002 = await prisma.participant.findUnique({ where: { participantId: "P002" } });
    p011 = await prisma.participant.findUnique({ where: { participantId: "P011" } });

    // 5. Ensure volunteer1 is assigned to (prelimRound1, lobbyA)
    await prisma.volunteerAssignment.upsert({
      where: {
        volunteerId_roundId_lobbyId: {
          volunteerId: volunteer1User.volunteer.id,
          roundId: prelimRound1.id,
          lobbyId: lobbyA.id,
        },
      },
      update: {},
      create: {
        volunteerId: volunteer1User.volunteer.id,
        roundId: prelimRound1.id,
        lobbyId: lobbyA.id,
        assignedById: adminUser.id,
      },
    });

    // Clean up any test score for p002 if exists
    const existing = await prisma.scoreEntry.findUnique({
      where: {
        roundId_participantId: {
          roundId: prelimRound1.id,
          participantId: p002.id,
        },
      },
    });
    if (existing) {
      testScoreEntryId = existing.id;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. Authoritative Scoring Calculations & Point Values
  // =========================================================================
  describe("1. Authoritative Scoring Calculations", () => {
    it("should calculate exact Canonical Crewmate score = 12 points (REQUIREMENTS.md §9)", async () => {
      const rules = await ScoringService.getActiveRules();

      // Canonical example from REQUIREMENTS.md §9 line 515:
      // Correct vote (+3) + Correct ID (+1) + 3 tasks (+3) + Survived (+2) + Won as Crewmate (+3) = 12
      const performance = {
        correctVote: true,
        correctIdentification: true,
        tasksCompleted: 3,
        survived: true,
        wonAsCrewmate: true,
        wonAsImposter: false,
        successfulElimination: 0,
        avoidedIdentification: false,
        votedOutAsImposter: false,
      };

      const total = ScoringService.calculateScore(performance, PlayerRole.CREWMATE, rules);
      expect(total).toBe(12);
    });

    it("should calculate exact Imposter score = 12 points (win +5, 2 eliminations +4, avoided ID +3)", async () => {
      const rules = await ScoringService.getActiveRules();

      const performance = {
        correctVote: false,
        correctIdentification: false,
        tasksCompleted: 0,
        survived: false,
        wonAsCrewmate: false,
        wonAsImposter: true, // +5
        successfulElimination: 2, // 2 * 2 = +4
        avoidedIdentification: true, // +3
        votedOutAsImposter: false,
      };

      const total = ScoringService.calculateScore(performance, PlayerRole.IMPOSTER, rules);
      expect(total).toBe(12);
    });

    it("should calculate negative score when voted out as Imposter (-2 points)", async () => {
      const rules = await ScoringService.getActiveRules();

      const performance = {
        correctVote: false,
        correctIdentification: false,
        tasksCompleted: 0,
        survived: false,
        wonAsCrewmate: false,
        wonAsImposter: false,
        successfulElimination: 0,
        avoidedIdentification: false,
        votedOutAsImposter: true, // -2
      };

      const total = ScoringService.calculateScore(performance, PlayerRole.IMPOSTER, rules);
      expect(total).toBe(-2);
    });

    it("should calculate 0 score when all performance inputs are zero/false", async () => {
      const rules = await ScoringService.getActiveRules();

      const performance = {
        correctVote: false,
        correctIdentification: false,
        tasksCompleted: 0,
        survived: false,
        wonAsCrewmate: false,
        wonAsImposter: false,
        successfulElimination: 0,
        avoidedIdentification: false,
        votedOutAsImposter: false,
      };

      expect(ScoringService.calculateScore(performance, PlayerRole.CREWMATE, rules)).toBe(0);
      expect(ScoringService.calculateScore(performance, PlayerRole.IMPOSTER, rules)).toBe(0);
    });

    it("should fail safely and throw when a canonical scoring rule is missing", async () => {
      // Temporarily deactivate a canonical rule
      const rule = await prisma.scoringRule.findUnique({ where: { ruleKey: "correct_vote" } });
      await prisma.scoringRule.update({
        where: { ruleKey: "correct_vote" },
        data: { isActive: false },
      });

      try {
        await expect(ScoringService.getActiveRules()).rejects.toThrow(
          "missing required canonical rule 'correct_vote'"
        );
      } finally {
        // Restore rule
        await prisma.scoringRule.update({
          where: { ruleKey: "correct_vote" },
          data: { isActive: true },
        });
      }
    });

    it("should ignore client-provided total_score and persist authoritative backend calculated score", async () => {
      // Use P002 in Preliminary 1, Lobby A
      const actor = {
        userId: adminUser.id,
        role: UserRole.ADMIN,
        username: "admin",
      };

      // Client sends fake totalScore: 999
      const clientPayload = {
        roundId: prelimRound1.id,
        participantId: p002.id,
        lobbyId: lobbyA.id,
        role: PlayerRole.CREWMATE,
        correctVote: true, // +3
        correctIdentification: false,
        tasksCompleted: 2, // +2
        survived: true, // +2
        wonAsCrewmate: false,
        wonAsImposter: false,
        successfulElimination: 0,
        avoidedIdentification: false,
        votedOutAsImposter: false,
        totalScore: 999, // Should be completely stripped and ignored!
      };

      // Validate schema strips totalScore
      const parsed = createScoreSchema.parse(clientPayload);
      expect((parsed as any).totalScore).toBeUndefined();

      if (!testScoreEntryId) {
        const score = await ScoringService.createScoreEntry(parsed, actor);
        testScoreEntryId = score.id;

        // Authoritative score must be 3 + 2 + 2 = 7, NOT 999!
        expect(score.totalScore).toBe(7);

        const fetched = await prisma.scoreEntry.findUnique({ where: { id: score.id } });
        expect(fetched?.totalScore).toBe(7);
      }
    });
  });

  // =========================================================================
  // 2. Input Validation & Role Consistency
  // =========================================================================
  describe("2. Input Validation & Role Constraints", () => {
    it("should reject negative tasks completed", () => {
      const result = createScoreSchema.safeParse({
        roundId: prelimRound1.id,
        participantId: p001.id,
        lobbyId: lobbyA.id,
        role: PlayerRole.CREWMATE,
        tasksCompleted: -1,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain("cannot be negative");
      }
    });

    it("should reject negative successful eliminations", () => {
      const result = createScoreSchema.safeParse({
        roundId: prelimRound1.id,
        participantId: p001.id,
        lobbyId: lobbyA.id,
        role: PlayerRole.IMPOSTER,
        successfulElimination: -5,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain("cannot be negative");
      }
    });

    it("should reject CREWMATE submitted with wonAsImposter = true", () => {
      const result = createScoreSchema.safeParse({
        roundId: prelimRound1.id,
        participantId: p001.id,
        lobbyId: lobbyA.id,
        role: PlayerRole.CREWMATE,
        wonAsImposter: true,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe("Crewmate cannot win as Imposter");
      }
    });

    it("should reject CREWMATE submitted with successfulElimination > 0", () => {
      const result = createScoreSchema.safeParse({
        roundId: prelimRound1.id,
        participantId: p001.id,
        lobbyId: lobbyA.id,
        role: PlayerRole.CREWMATE,
        successfulElimination: 2,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe("Crewmate cannot perform eliminations");
      }
    });

    it("should reject CREWMATE submitted with avoidedIdentification = true", () => {
      const result = createScoreSchema.safeParse({
        roundId: prelimRound1.id,
        participantId: p001.id,
        lobbyId: lobbyA.id,
        role: PlayerRole.CREWMATE,
        avoidedIdentification: true,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe("Only Imposters can avoid identification");
      }
    });

    it("should reject CREWMATE submitted with votedOutAsImposter = true", () => {
      const result = createScoreSchema.safeParse({
        roundId: prelimRound1.id,
        participantId: p001.id,
        lobbyId: lobbyA.id,
        role: PlayerRole.CREWMATE,
        votedOutAsImposter: true,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe("Only Imposters can be voted out as Imposter");
      }
    });

    it("should reject IMPOSTER submitted with wonAsCrewmate = true", () => {
      const result = createScoreSchema.safeParse({
        roundId: prelimRound1.id,
        participantId: p001.id,
        lobbyId: lobbyA.id,
        role: PlayerRole.IMPOSTER,
        wonAsCrewmate: true,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe("Imposter cannot win as Crewmate");
      }
    });

    it("should reject IMPOSTER submitted with tasksCompleted > 0", () => {
      const result = createScoreSchema.safeParse({
        roundId: prelimRound1.id,
        participantId: p001.id,
        lobbyId: lobbyA.id,
        role: PlayerRole.IMPOSTER,
        tasksCompleted: 3,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe("Imposters do not complete tasks for scoring");
      }
    });

    it("should reject votedOutAsImposter = true when survived = true", () => {
      const result = createScoreSchema.safeParse({
        roundId: prelimRound1.id,
        participantId: p001.id,
        lobbyId: lobbyA.id,
        role: PlayerRole.IMPOSTER,
        votedOutAsImposter: true,
        survived: true,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe("Cannot survive if voted out");
      }
    });
  });

  // =========================================================================
  // 3. Relationship Integrity & Mismatch Protection
  // =========================================================================
  describe("3. Relationship Integrity & Entity Mismatch Protection", () => {
    it("should reject score submission for a participant not registered in target round", async () => {
      const actor = {
        userId: adminUser.id,
        role: UserRole.ADMIN,
        username: "admin",
      };

      // P001 is in prelimRound1, NOT prelimRound2!
      await expect(
        ScoringService.createScoreEntry(
          {
            roundId: prelimRound2.id,
            participantId: p001.id,
            lobbyId: lobbyA.id,
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
      ).rejects.toThrow("Participant is not registered for this round.");
    });

    it("should reject score submission when participant's round lobby mismatches submitted lobbyId", async () => {
      const actor = {
        userId: adminUser.id,
        role: UserRole.ADMIN,
        username: "admin",
      };

      // P001 is in Preliminary 1 + Lobby A. Submitting with Lobby B must be rejected!
      await expect(
        ScoringService.createScoreEntry(
          {
            roundId: prelimRound1.id,
            participantId: p001.id,
            lobbyId: lobbyB.id, // Wrong lobby!
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
      ).rejects.toThrow("Participant is not assigned to the specified lobby in this round.");
    });

    it("should reject score submission for non-existent participant UUID", async () => {
      const actor = {
        userId: adminUser.id,
        role: UserRole.ADMIN,
        username: "admin",
      };

      await expect(
        ScoringService.createScoreEntry(
          {
            roundId: prelimRound1.id,
            participantId: "00000000-0000-0000-0000-000000000000",
            lobbyId: lobbyA.id,
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
      ).rejects.toThrow("Participant does not exist");
    });
  });

  // =========================================================================
  // 4. Volunteer Authorization & Scope Scoping
  // =========================================================================
  describe("4. Volunteer Authorization & Scope Restrictions", () => {
    it("should reject score creation from PARTICIPANT role with 403 Forbidden", async () => {
      const actor = {
        userId: participantUser.id,
        role: UserRole.PARTICIPANT,
        username: "P001",
      };

      await expect(
        ScoringService.createScoreEntry(
          {
            roundId: prelimRound1.id,
            participantId: p001.id,
            lobbyId: lobbyA.id,
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
      ).rejects.toThrow("Participants are not permitted to record scores.");
    });

    it("should reject volunteer scoring for an unassigned lobby with 403 Forbidden", async () => {
      // volunteer1 is assigned to (prelimRound1, lobbyA), NOT lobbyC!
      const actor = {
        userId: volunteer1User.id,
        role: UserRole.VOLUNTEER,
        username: volunteer1User.username,
        volunteerId: volunteer1User.volunteer.id,
      };

      // P011 is in Lobby B
      const pLobbyC = await prisma.participant.findFirst({
        where: { lobby: { name: "Lobby C" } },
      });

      await expect(
        ScoringService.createScoreEntry(
          {
            roundId: prelimRound1.id,
            participantId: pLobbyC!.id,
            lobbyId: lobbyC.id,
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
      ).rejects.toThrow("You are not assigned to score this round and lobby combination.");
    });

    it("should allow assigned volunteer to score for their exact assigned round and lobby", async () => {
      const actor = {
        userId: volunteer1User.id,
        role: UserRole.VOLUNTEER,
        username: volunteer1User.username,
        volunteerId: volunteer1User.volunteer.id,
      };

      // Volunteer1 is assigned to (prelimRound1, lobbyA).
      // Find a participant in Lobby A without score
      const unscoredInA = await prisma.roundParticipant.findFirst({
        where: {
          roundId: prelimRound1.id,
          lobbyId: lobbyA.id,
          participant: {
            scoreEntries: { none: { roundId: prelimRound1.id } },
          },
        },
        include: { participant: true },
      });

      if (unscoredInA) {
        const created = await ScoringService.createScoreEntry(
          {
            roundId: prelimRound1.id,
            participantId: unscoredInA.participantId,
            lobbyId: lobbyA.id,
            role: PlayerRole.CREWMATE,
            correctVote: true,
            correctIdentification: true,
            tasksCompleted: 1,
            survived: true,
            wonAsCrewmate: true,
            wonAsImposter: false,
            successfulElimination: 0,
            avoidedIdentification: false,
            votedOutAsImposter: false,
          },
          actor
        );

        expect(created).toBeDefined();
        expect(created.totalScore).toBe(3 + 1 + 1 + 2 + 3); // 10 pts
      }
    });
  });

  // =========================================================================
  // 5. Exact-Pair Dashboard Security (Zero Cartesian Leakage)
  // =========================================================================
  describe("5. Exact-Pair Dashboard Scoping (Correction 2)", () => {
    it("should strictly return only exact (roundId, lobbyId) assigned pairs and zero cross-combination data", async () => {
      // Clear any existing assignments for volunteer 2 so exactly 2 target pairs exist
      await prisma.volunteerAssignment.deleteMany({
        where: { volunteerId: volunteer2User.volunteer.id },
      });

      // Set up Volunteer 2 with assignments:
      // (prelimRound1, lobbyB) AND (prelimRound2, lobbyC)
      await prisma.volunteerAssignment.upsert({
        where: {
          volunteerId_roundId_lobbyId: {
            volunteerId: volunteer2User.volunteer.id,
            roundId: prelimRound1.id,
            lobbyId: lobbyB.id,
          },
        },
        update: {},
        create: {
          volunteerId: volunteer2User.volunteer.id,
          roundId: prelimRound1.id,
          lobbyId: lobbyB.id,
          assignedById: adminUser.id,
        },
      });

      await prisma.volunteerAssignment.upsert({
        where: {
          volunteerId_roundId_lobbyId: {
            volunteerId: volunteer2User.volunteer.id,
            roundId: prelimRound2.id,
            lobbyId: lobbyC.id,
          },
        },
        update: {},
        create: {
          volunteerId: volunteer2User.volunteer.id,
          roundId: prelimRound2.id,
          lobbyId: lobbyC.id,
          assignedById: adminUser.id,
        },
      });

      // Ensure roundParticipants exist for prelimRound2 + lobbyC
      const pInC = await prisma.participant.findFirst({ where: { lobbyId: lobbyC.id } });
      if (pInC) {
        await prisma.roundParticipant.upsert({
          where: {
            roundId_participantId: {
              roundId: prelimRound2.id,
              participantId: pInC.id,
            },
          },
          update: {},
          create: {
            roundId: prelimRound2.id,
            participantId: pInC.id,
            lobbyId: lobbyC.id,
          },
        });
      }

      // Fetch dashboard data for volunteer 2
      const dashboard = await ScoringService.getVolunteerDashboardData(volunteer2User.id);

      // Verify exact pairs: only (prelimRound1, lobbyB) and (prelimRound2, lobbyC)
      expect(dashboard.assignments.length).toBe(2);

      for (const p of dashboard.participantsWithStatus) {
        const isPair1 = p.roundId === prelimRound1.id && p.lobbyId === lobbyB.id;
        const isPair2 = p.roundId === prelimRound2.id && p.lobbyId === lobbyC.id;

        // Invariant: every single participant MUST belong to one of the exact pairs
        expect(isPair1 || isPair2).toBe(true);

        // Cross combinations MUST NEVER occur!
        const isCrossCombo1 = p.roundId === prelimRound1.id && p.lobbyId === lobbyC.id;
        const isCrossCombo2 = p.roundId === prelimRound2.id && p.lobbyId === lobbyB.id;
        expect(isCrossCombo1).toBe(false);
        expect(isCrossCombo2).toBe(false);
      }
    });
  });

  // =========================================================================
  // 6. Score Editing, Versioned History & Immutability
  // =========================================================================
  describe("6. Score Editing, Versioned History & Immutability", () => {
    it("should reject score edit without a valid reason", async () => {
      if (!testScoreEntryId) return;

      const actor = {
        userId: adminUser.id,
        role: UserRole.ADMIN,
        username: "admin",
      };

      const invalidInput = {
        role: PlayerRole.CREWMATE,
        correctVote: true,
        correctIdentification: true,
        tasksCompleted: 3,
        survived: true,
        wonAsCrewmate: true,
        wonAsImposter: false,
        successfulElimination: 0,
        avoidedIdentification: false,
        votedOutAsImposter: false,
        reason: "  ", // Missing/empty reason
      };

      const result = updateScoreSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain("at least 3 characters");
      }
    });

    it("should update score entry, append immutable history version, and write audit log", async () => {
      if (!testScoreEntryId) return;

      const actor = {
        userId: adminUser.id,
        role: UserRole.ADMIN,
        username: "admin",
      };

      const updateInput = {
        role: PlayerRole.CREWMATE,
        correctVote: true, // +3
        correctIdentification: true, // +1
        tasksCompleted: 4, // +4
        survived: true, // +2
        wonAsCrewmate: true, // +3
        wonAsImposter: false,
        successfulElimination: 0,
        avoidedIdentification: false,
        votedOutAsImposter: false,
        reason: "Verified full 4 tasks completed on game replay review",
      };

      const updated = await ScoringService.updateScoreEntry(
        testScoreEntryId,
        updateInput,
        actor
      );

      // Recalculated total = 3 + 1 + 4 + 2 + 3 = 13
      expect(updated.totalScore).toBe(13);
      expect(updated.tasksCompleted).toBe(4);

      // Check score_history
      const history = await prisma.scoreHistory.findMany({
        where: { scoreEntryId: testScoreEntryId },
        orderBy: { version: "asc" },
      });

      expect(history.length).toBeGreaterThanOrEqual(2);
      const latestHistory = history[history.length - 1];
      expect(latestHistory.newTotalScore).toBe(13);
      expect(latestHistory.reason).toBe("Verified full 4 tasks completed on game replay review");
      expect((latestHistory.newValues as any).tasksCompleted).toBe(4);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: "SCORE_UPDATED",
          entityId: testScoreEntryId,
        },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).not.toBeNull();
      expect(audit?.userId).toBe(adminUser.id);
    });

    it("should REJECT database-level UPDATE or DELETE on score_history via PostgreSQL triggers", async () => {
      const historyRow = await prisma.scoreHistory.findFirst();
      expect(historyRow).not.toBeNull();

      // Attempt UPDATE via raw SQL
      await expect(
        prisma.$executeRawUnsafe(
          `UPDATE score_history SET new_total_score = 999 WHERE id = $1::uuid;`,
          historyRow!.id
        )
      ).rejects.toThrow(/append-only/i);

      // Attempt DELETE via raw SQL
      await expect(
        prisma.$executeRawUnsafe(
          `DELETE FROM score_history WHERE id = $1::uuid;`,
          historyRow!.id
        )
      ).rejects.toThrow(/append-only/i);
    });
  });

  // =========================================================================
  // 7. Round Lifecycle & Concurrency
  // =========================================================================
  describe("7. Round Lifecycle & Concurrency Protection", () => {
    it("should reject score creation when round is score_locked = true", async () => {
      // Temporarily lock preliminary round 1
      await prisma.round.update({
        where: { id: prelimRound1.id },
        data: { scoreLocked: true },
      });

      const actor = {
        userId: adminUser.id,
        role: UserRole.ADMIN,
        username: "admin",
      };

      try {
        await expect(
          ScoringService.createScoreEntry(
            {
              roundId: prelimRound1.id,
              participantId: p001.id,
              lobbyId: lobbyA.id,
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
        ).rejects.toThrow("Round scoring is locked.");
      } finally {
        // Unlock round
        await prisma.round.update({
          where: { id: prelimRound1.id },
          data: { scoreLocked: false },
        });
      }
    });

    it("should reject score edit when round is score_locked = true", async () => {
      if (!testScoreEntryId) return;

      await prisma.round.update({
        where: { id: prelimRound1.id },
        data: { scoreLocked: true },
      });

      const actor = {
        userId: adminUser.id,
        role: UserRole.ADMIN,
        username: "admin",
      };

      try {
        await expect(
          ScoringService.updateScoreEntry(
            testScoreEntryId,
            {
              role: PlayerRole.CREWMATE,
              correctVote: true,
              correctIdentification: false,
              tasksCompleted: 1,
              survived: false,
              wonAsCrewmate: false,
              wonAsImposter: false,
              successfulElimination: 0,
              avoidedIdentification: false,
              votedOutAsImposter: false,
              reason: "Attempt edit while locked",
            },
            actor
          )
        ).rejects.toThrow("Round scoring is locked.");
      } finally {
        await prisma.round.update({
          where: { id: prelimRound1.id },
          data: { scoreLocked: false },
        });
      }
    });

    it("should serialize concurrent score edits without version collision", async () => {
      if (!testScoreEntryId) return;

      const actor = {
        userId: adminUser.id,
        role: UserRole.ADMIN,
        username: "admin",
      };

      // Launch two concurrent updates simultaneously
      const update1 = ScoringService.updateScoreEntry(
        testScoreEntryId,
        {
          role: PlayerRole.CREWMATE,
          correctVote: true,
          correctIdentification: false,
          tasksCompleted: 1,
          survived: false,
          wonAsCrewmate: false,
          wonAsImposter: false,
          successfulElimination: 0,
          avoidedIdentification: false,
          votedOutAsImposter: false,
          reason: "Concurrent edit #1",
        },
        actor
      );

      const update2 = ScoringService.updateScoreEntry(
        testScoreEntryId,
        {
          role: PlayerRole.CREWMATE,
          correctVote: true,
          correctIdentification: true,
          tasksCompleted: 2,
          survived: true,
          wonAsCrewmate: false,
          wonAsImposter: false,
          successfulElimination: 0,
          avoidedIdentification: false,
          votedOutAsImposter: false,
          reason: "Concurrent edit #2",
        },
        actor
      );

      const [res1, res2] = await Promise.all([update1, update2]);
      expect(res1).toBeDefined();
      expect(res2).toBeDefined();

      // Check that versions in score_history are unique and strictly monotonic
      const histories = await prisma.scoreHistory.findMany({
        where: { scoreEntryId: testScoreEntryId },
        orderBy: { version: "asc" },
      });

      const versions = histories.map((h) => h.version);
      const uniqueVersions = new Set(versions);
      expect(uniqueVersions.size).toBe(versions.length);
    });
  });
});
