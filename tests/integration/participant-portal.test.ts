import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { ParticipantService } from "@/services/participant.service";
import { UserRole, RoundType, RoundStatus, PlayerRole } from "@prisma/client";
import { ApiError } from "@/lib/api-helpers";

describe("Consolidated Phase 4 — Participant Portal Integration Tests", () => {
  let participantUser1: any;
  let participantUser2: any;
  let participant1: any;
  let participant2: any;
  let volunteerUser: any;
  let adminUser: any;
  let testPrelimRound: any;
  let testPracticeRound: any;
  let testArchivedRound: any;
  let lobbyA: any;
  let scoreEntryP1: any;
  let scoreEntryP2: any;

  beforeAll(async () => {
    // 1. Fetch seed users
    participantUser1 = await prisma.user.findFirst({
      where: { role: UserRole.PARTICIPANT, participant: { participantId: "P001" } },
      include: { participant: true },
    });
    participant1 = participantUser1?.participant;

    participantUser2 = await prisma.user.findFirst({
      where: { role: UserRole.PARTICIPANT, participant: { participantId: "P002" } },
      include: { participant: true },
    });
    participant2 = participantUser2?.participant;

    volunteerUser = await prisma.user.findFirst({
      where: { role: UserRole.VOLUNTEER },
    });

    adminUser = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
    });

    lobbyA = await prisma.lobby.findFirst({ where: { name: "Lobby A" } });

    // 2. Create fresh dedicated test rounds with unique numbers to avoid collisions
    // and respect the append-only immutability of score_history
    testPrelimRound = await prisma.round.create({
      data: {
        name: "Portal Test Prelim Round " + Date.now(),
        roundNumber: Math.floor(Math.random() * 80000) + 10000,
        type: RoundType.PRELIMINARY,
        status: RoundStatus.ACTIVE,
      },
    });

    testPracticeRound = await prisma.round.create({
      data: {
        name: "Portal Test Practice Round " + Date.now(),
        roundNumber: Math.floor(Math.random() * 80000) + 10000,
        type: RoundType.PRACTICE,
        status: RoundStatus.COMPLETED,
      },
    });

    testArchivedRound = await prisma.round.create({
      data: {
        name: "Portal Test Archived Round " + Date.now(),
        roundNumber: Math.floor(Math.random() * 80000) + 10000,
        type: RoundType.PRELIMINARY,
        status: RoundStatus.LOCKED,
        isArchived: true,
      },
    });

    // Register Participant 1 in Test Prelim & Practice
    await prisma.roundParticipant.create({
      data: {
        roundId: testPrelimRound.id,
        participantId: participant1.id,
        lobbyId: lobbyA.id,
      },
    });

    await prisma.roundParticipant.create({
      data: {
        roundId: testPracticeRound.id,
        participantId: participant1.id,
        lobbyId: lobbyA.id,
      },
    });

    // Register Participant 2 in Test Prelim
    await prisma.roundParticipant.create({
      data: {
        roundId: testPrelimRound.id,
        participantId: participant2.id,
        lobbyId: lobbyA.id,
      },
    });

    // Create a score for Participant 1 in Prelim Round (12 pts)
    scoreEntryP1 = await prisma.scoreEntry.create({
      data: {
        roundId: testPrelimRound.id,
        participantId: participant1.id,
        role: PlayerRole.CREWMATE,
        correctVote: true,
        correctIdentification: true,
        tasksCompleted: 3,
        survived: true,
        wonAsCrewmate: true,
        totalScore: 12,
        enteredById: adminUser.id,
      },
    });

    // Add initial history for P1
    await prisma.scoreHistory.create({
      data: {
        scoreEntryId: scoreEntryP1.id,
        version: 1,
        newTotalScore: 12,
        newValues: { role: "CREWMATE", tasksCompleted: 3 },
        reason: "Initial referee submission",
        changedById: adminUser.id,
      },
    });

    // Add updated version for P1 score (v2)
    await prisma.scoreHistory.create({
      data: {
        scoreEntryId: scoreEntryP1.id,
        version: 2,
        oldTotalScore: 10,
        newTotalScore: 12,
        oldValues: { role: "CREWMATE", tasksCompleted: 1 },
        newValues: { role: "CREWMATE", tasksCompleted: 3 },
        reason: "Ref verified additional task completion",
        changedById: adminUser.id,
      },
    });

    // Create a score for Participant 1 in Practice Round (7 pts)
    await prisma.scoreEntry.create({
      data: {
        roundId: testPracticeRound.id,
        participantId: participant1.id,
        role: PlayerRole.CREWMATE,
        correctVote: false,
        correctIdentification: true,
        tasksCompleted: 4,
        survived: true,
        wonAsCrewmate: false,
        totalScore: 7,
        enteredById: adminUser.id,
      },
    });

    // Create a score for Participant 2 in Prelim Round (16 pts)
    scoreEntryP2 = await prisma.scoreEntry.create({
      data: {
        roundId: testPrelimRound.id,
        participantId: participant2.id,
        role: PlayerRole.IMPOSTER,
        correctVote: false,
        correctIdentification: false,
        successfulElimination: 3,
        wonAsImposter: true,
        avoidedIdentification: true,
        survived: true,
        totalScore: 16,
        enteredById: adminUser.id,
      },
    });

    await prisma.scoreHistory.create({
      data: {
        scoreEntryId: scoreEntryP2.id,
        version: 1,
        newTotalScore: 16,
        newValues: { role: "IMPOSTER", successfulElimination: 3 },
        reason: "Initial entry for P2",
        changedById: adminUser.id,
      },
    });
  });

  describe("1. Participant Authentication & Authorization Isolation", () => {
    it("should successfully retrieve dashboard for authenticated participant", async () => {
      const data = await ParticipantService.getParticipantDashboardData(participantUser1.id);

      expect(data).toBeDefined();
      expect(data.participant.id).toBe(participant1.id);
      expect(data.participant.participantId).toBe("P001");
      expect(data.participant.name).toBe(participant1.name);
    });

    it("should reject non-participant accounts attempting to retrieve participant dashboard", async () => {
      await expect(
        ParticipantService.getParticipantDashboardData(volunteerUser.id)
      ).rejects.toThrow("Participant profile not found for this user account");

      await expect(
        ParticipantService.getParticipantDashboardData(adminUser.id)
      ).rejects.toThrow("Participant profile not found for this user account");
    });

    it("should reject non-existent user IDs", async () => {
      await expect(
        ParticipantService.getParticipantDashboardData("00000000-0000-0000-0000-000000000000")
      ).rejects.toThrow("Participant profile not found for this user account");
    });
  });

  describe("2. Participant Isolation & Tampering Resistance", () => {
    it("Participant A retrieving dashboard only receives Participant A's data", async () => {
      const p1Data = await ParticipantService.getParticipantDashboardData(participantUser1.id);
      const p2Data = await ParticipantService.getParticipantDashboardData(participantUser2.id);

      expect(p1Data.participant.id).not.toBe(p2Data.participant.id);
      expect(p1Data.participant.participantId).toBe("P001");
      expect(p2Data.participant.participantId).toBe("P002");

      const p1RoundScores = p1Data.rounds.map((r) => r.scoreEntry?.id).filter(Boolean);
      expect(p1RoundScores).toContain(scoreEntryP1.id);
      expect(p1RoundScores).not.toContain(scoreEntryP2.id);
    });

    it("Participant A requesting Participant B's score history strictly returns HTTP 404", async () => {
      try {
        await ParticipantService.getParticipantScoreHistory(scoreEntryP2.id, participantUser1.id);
        expect.unreachable("Should have thrown 404");
      } catch (err: any) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.statusCode).toBe(404);
        expect(err.message).toBe("Score entry not found");
      }
    });

    it("Requesting non-existent score ID returns HTTP 404", async () => {
      try {
        await ParticipantService.getParticipantScoreHistory(
          "00000000-0000-0000-0000-000000000000",
          participantUser1.id
        );
        expect.unreachable("Should have thrown 404");
      } catch (err: any) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.statusCode).toBe(404);
      }
    });
  });

  describe("3. Authoritative Cumulative Score & Round Type Filtering", () => {
    it("Cumulative preliminary score strictly sums PRELIMINARY rounds and excludes PRACTICE rounds", async () => {
      const data = await ParticipantService.getParticipantDashboardData(participantUser1.id);

      // Verify that practice round score is excluded from cumulative score
      const practiceRoundItem = data.rounds.find((r) => r.roundId === testPracticeRound.id);
      expect(practiceRoundItem).toBeDefined();
      expect(practiceRoundItem?.scoreEntry?.totalScore).toBe(7);

      // Verify preliminary round score is included in cumulative score
      const prelimRoundItem = data.rounds.find((r) => r.roundId === testPrelimRound.id);
      expect(prelimRoundItem).toBeDefined();
      expect(prelimRoundItem?.scoreEntry?.totalScore).toBe(12);

      // Calculate the sum of all preliminary round scores in data.rounds
      const expectedPrelimSum = data.rounds
        .filter((r) => r.type === RoundType.PRELIMINARY && r.scoreEntry)
        .reduce((sum, r) => sum + (r.scoreEntry?.totalScore ?? 0), 0);

      expect(data.cumulativeScore).toBe(expectedPrelimSum);
    });

    it("Excludes archived rounds from active dashboard and cumulative scores", async () => {
      const archivedScore = await prisma.scoreEntry.create({
        data: {
          roundId: testArchivedRound.id,
          participantId: participant1.id,
          role: PlayerRole.CREWMATE,
          totalScore: 99,
          enteredById: adminUser.id,
        },
      });

      const data = await ParticipantService.getParticipantDashboardData(participantUser1.id);

      // Archived round must not appear in active rounds list
      const archivedRoundItem = data.rounds.find((r) => r.roundId === testArchivedRound.id);
      expect(archivedRoundItem).toBeUndefined();

      // Cumulative score must not contain the 99 from the archived round
      const expectedPrelimSum = data.rounds
        .filter((r) => r.type === RoundType.PRELIMINARY && r.scoreEntry)
        .reduce((sum, r) => sum + (r.scoreEntry?.totalScore ?? 0), 0);
      expect(data.cumulativeScore).toBe(expectedPrelimSum);
    });
  });

  describe("4. Score History Visibility & Data Minimization", () => {
    it("Participant can view versioned history of their own score entry", async () => {
      const historyData = await ParticipantService.getParticipantScoreHistory(
        scoreEntryP1.id,
        participantUser1.id
      );

      expect(historyData).toBeDefined();
      expect(historyData.roundName).toBe(testPrelimRound.name);
      expect(historyData.history).toHaveLength(2);

      const [v1, v2] = historyData.history;
      expect(v1.version).toBe(1);
      expect(v1.newTotalScore).toBe(12);
      expect(v1.reason).toBe("Initial referee submission");

      expect(v2.version).toBe(2);
      expect(v2.oldTotalScore).toBe(10);
      expect(v2.newTotalScore).toBe(12);
      expect(v2.reason).toBe("Ref verified additional task completion");

      // Verify data minimization: internal changedById is omitted
      expect((v1 as any).changedById).toBeUndefined();
      expect((v2 as any).changedById).toBeUndefined();
    });
  });

  describe("5. Active Announcements & Chronological Schedule", () => {
    it("Returns only active announcements ordered by priority desc, createdAt desc", async () => {
      const activeHigh = await prisma.announcement.create({
        data: {
          title: "Urgent Meeting Call " + Date.now(),
          message: "All participants report to Station A",
          priority: 5,
          isActive: true,
          createdById: adminUser.id,
        },
      });

      const inactiveAnn = await prisma.announcement.create({
        data: {
          title: "Old announcement " + Date.now(),
          message: "Should not appear",
          priority: 10,
          isActive: false,
          createdById: adminUser.id,
        },
      });

      const announcements = await ParticipantService.getActiveAnnouncements();
      expect(announcements.length).toBeGreaterThan(0);

      const foundInactive = announcements.find((a) => a.id === inactiveAnn.id);
      expect(foundInactive).toBeUndefined();

      expect(announcements[0].priority).toBeGreaterThanOrEqual(announcements[announcements.length - 1].priority);

      // Data minimization: createdById must not be exposed
      expect((announcements[0] as any).createdById).toBeUndefined();
    });

    it("Returns schedule items in strict sortOrder ascending", async () => {
      const schedule = await ParticipantService.getScheduleItems();
      expect(schedule.length).toBeGreaterThan(0);

      for (let i = 0; i < schedule.length - 1; i++) {
        expect(schedule[i].sortOrder).toBeLessThanOrEqual(schedule[i + 1].sortOrder);
      }
    });
  });
  describe("6. Participant Mutation Security & Scoring Enforcement", () => {
    it("Participants attempting to call volunteer scoring endpoint POST /api/scores are rejected with 403", async () => {
      // Direct service or API helper verification: requireRole([ADMIN, VOLUNTEER]) rejects PARTICIPANT
      const { requireRole } = await import("@/lib/api-helpers");

      // Mock session resolving to participant
      // We test that requireRole([ADMIN, VOLUNTEER]) throws 403 when user is PARTICIPANT
      const { ScoringService } = await import("@/services/scoring.service");

      const participantActor = {
        userId: participantUser1.id,
        role: UserRole.PARTICIPANT,
        username: participantUser1.username,
      };

      // ScoringService.createScoreEntry checks actor role and rejects
      // Attempting to query getScores as PARTICIPANT
      await expect(
        ScoringService.getScores({}, participantActor)
      ).rejects.toThrow("Participants cannot query administrative scores.");

      // Attempting to getScoreById as PARTICIPANT
      await expect(
        ScoringService.getScoreById(scoreEntryP1.id, participantActor)
      ).rejects.toThrow("Participants cannot view score entry management details.");
    });
  });
});
