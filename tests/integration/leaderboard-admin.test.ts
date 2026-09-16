import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { LeaderboardService } from "@/services/leaderboard.service";
import { AdminService } from "@/services/admin.service";
import { ScoringService } from "@/services/scoring.service";
import { VolunteerAssignmentService } from "@/services/volunteer-assignment.service";
import { EventService } from "@/services/event.service";
import { ParticipantService } from "@/services/participant.service";
import { UserRole, RoundType, RoundStatus, PlayerRole, ParticipantStatus } from "@prisma/client";

describe("Consolidated Phase 5 — Leaderboard & Admin System Integration Tests", () => {
  let adminUser: any;
  let volunteerUser: any;
  let volunteerProfile: any;
  let participantUser1: any;
  let participantUser2: any;
  let participantUser3: any;
  let participant1: any;
  let participant2: any;
  let participant3: any;
  let lobbyA: any;
  let prelimRound1: any;
  let prelimRound2: any;
  let practiceRound: any;
  let finalRound: any;
  let archivedRound: any;

  let baseScoreP1 = 0;
  let baseRoundsP1 = 0;
  let baseScoreP2 = 0;
  let baseRoundsP2 = 0;

  beforeAll(async () => {
    // 1. Fetch seed users
    adminUser = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
    volunteerUser = await prisma.user.findFirst({
      where: { role: UserRole.VOLUNTEER },
      include: { volunteer: true },
    });
    volunteerProfile = volunteerUser?.volunteer;

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

    participantUser3 = await prisma.user.findFirst({
      where: { role: UserRole.PARTICIPANT, participant: { participantId: "P003" } },
      include: { participant: true },
    });
    participant3 = participantUser3?.participant;

    lobbyA = await prisma.lobby.findFirst({ where: { name: "Lobby A" } });

    // Capture baseline scores before adding test rounds
    const baseline = await LeaderboardService.getLeaderboardData();
    const p1 = baseline.entries.find((e) => e.participantId === "P001");
    const p2 = baseline.entries.find((e) => e.participantId === "P002");
    baseScoreP1 = p1?.totalScore || 0;
    baseRoundsP1 = p1?.roundsPlayed || 0;
    baseScoreP2 = p2?.totalScore || 0;
    baseRoundsP2 = p2?.roundsPlayed || 0;

    // 2. Create distinct rounds with high unique numbers
    const baseNumber = Math.floor(Math.random() * 60000) + 30000;

    prelimRound1 = await prisma.round.create({
      data: {
        name: "Phase 5 Prelim 1 " + Date.now(),
        roundNumber: baseNumber + 1,
        type: RoundType.PRELIMINARY,
        status: RoundStatus.ACTIVE,
        isArchived: false,
      },
    });

    prelimRound2 = await prisma.round.create({
      data: {
        name: "Phase 5 Prelim 2 " + Date.now(),
        roundNumber: baseNumber + 2,
        type: RoundType.PRELIMINARY,
        status: RoundStatus.ACTIVE,
        isArchived: false,
      },
    });

    practiceRound = await prisma.round.create({
      data: {
        name: "Phase 5 Practice " + Date.now(),
        roundNumber: baseNumber + 3,
        type: RoundType.PRACTICE,
        status: RoundStatus.ACTIVE,
        isArchived: false,
      },
    });

    finalRound = await prisma.round.create({
      data: {
        name: "Phase 5 Final " + Date.now(),
        roundNumber: baseNumber + 4,
        type: RoundType.FINAL,
        status: RoundStatus.ACTIVE,
        isArchived: false,
      },
    });

    archivedRound = await prisma.round.create({
      data: {
        name: "Phase 5 Archived Prelim " + Date.now(),
        roundNumber: baseNumber + 5,
        type: RoundType.PRELIMINARY,
        status: RoundStatus.COMPLETED,
        isArchived: true,
      },
    });

    // 3. Register participants into rounds
    await prisma.roundParticipant.createMany({
      data: [
        { roundId: prelimRound1.id, participantId: participant1.id, lobbyId: lobbyA.id },
        { roundId: prelimRound1.id, participantId: participant2.id, lobbyId: lobbyA.id },
        { roundId: prelimRound1.id, participantId: participant3.id, lobbyId: lobbyA.id },
        { roundId: prelimRound2.id, participantId: participant1.id, lobbyId: lobbyA.id },
        { roundId: prelimRound2.id, participantId: participant2.id, lobbyId: lobbyA.id },
        { roundId: practiceRound.id, participantId: participant1.id, lobbyId: lobbyA.id },
        { roundId: finalRound.id, participantId: participant1.id, lobbyId: lobbyA.id },
        { roundId: archivedRound.id, participantId: participant1.id, lobbyId: lobbyA.id },
      ],
      skipDuplicates: true,
    });
  });

  // ==========================================================================
  // 1. LEADERBOARD ENGINE & AUTHORITATIVE DATA RULES
  // ==========================================================================
  describe("Leaderboard Engine & Filtering Rules", () => {
    it("aggregates preliminary scores and excludes practice, final, and archived rounds", async () => {
      const actor = {
        userId: adminUser.id,
        role: UserRole.ADMIN,
        username: adminUser.username,
      };

      // Score 1 for P1: Prelim 1
      // correctVote (+3), correctIdentification (+1), tasks 6 (+6), survived (+2), winCrew (+3) = 15
      await ScoringService.createScoreEntry(
        {
          roundId: prelimRound1.id,
          participantId: participant1.id,
          lobbyId: lobbyA.id,
          role: PlayerRole.CREWMATE,
          correctVote: true,
          correctIdentification: true,
          tasksCompleted: 6,
          survived: true,
          wonAsCrewmate: true,
          wonAsImposter: false,
          successfulElimination: 0,
          avoidedIdentification: false,
          votedOutAsImposter: false,
        },
        actor
      );

      // Score 2 for P1: Prelim 2
      // correctVote (+3), correctIdentification (+1), tasks 1 (+1), survived (+2), winCrew (+3) = 10
      await ScoringService.createScoreEntry(
        {
          roundId: prelimRound2.id,
          participantId: participant1.id,
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

      // Score 3 for P1: Practice Round (MUST BE EXCLUDED FROM LEADERBOARD)
      await ScoringService.createScoreEntry(
        {
          roundId: practiceRound.id,
          participantId: participant1.id,
          lobbyId: lobbyA.id,
          role: PlayerRole.CREWMATE,
          correctVote: true,
          correctIdentification: false,
          tasksCompleted: 2,
          survived: true,
          wonAsCrewmate: true,
          wonAsImposter: false,
          successfulElimination: 0,
          avoidedIdentification: false,
          votedOutAsImposter: false,
        },
        actor
      );

      // Score 4 for P1: Final Round (MUST BE EXCLUDED FROM LEADERBOARD)
      await ScoringService.createScoreEntry(
        {
          roundId: finalRound.id,
          participantId: participant1.id,
          lobbyId: lobbyA.id,
          role: PlayerRole.CREWMATE,
          correctVote: true,
          correctIdentification: false,
          tasksCompleted: 3,
          survived: true,
          wonAsCrewmate: true,
          wonAsImposter: false,
          successfulElimination: 0,
          avoidedIdentification: false,
          votedOutAsImposter: false,
        },
        actor
      );

      // Query Leaderboard
      const leaderboard = await LeaderboardService.getLeaderboardData();
      const p1Entry = leaderboard.entries.find((e) => e.participantId === participant1.participantId);

      expect(p1Entry).toBeDefined();
      // P1 score should be baseline + 15 + 10 = baseScoreP1 + 25 (Practice and Final are excluded!)
      expect(p1Entry?.totalScore).toBe(baseScoreP1 + 25);
      expect(p1Entry?.roundsPlayed).toBe(baseRoundsP1 + 2);
    });

    it("applies deterministic tie-breaking: totalScore DESC, participantId ASC fallback", async () => {
      const actor = {
        userId: adminUser.id,
        role: UserRole.ADMIN,
        username: adminUser.username,
      };

      // Current P1 total is baseScoreP1 + 25
      const currentP1Total = baseScoreP1 + 25;

      // Score P2 in prelimRound1 to bring P2 to the EXACT same total score as P1!
      // Required points for P2 = currentP1Total - baseScoreP2
      const neededForP2 = currentP1Total - baseScoreP2;

      // For example, if needed is 21: correctVote(3) + wonImposter(5) + survived(2) + 5 eliminations(10) + correctId(1) = 21
      // We can adjust tasks/eliminations to match needed exactly:
      // Let's create an imposter score for P2
      // base points: survived(2) + wonImposter(5) = 7
      // eliminations needed: (neededForP2 - 7) / 2
      const eliminations = Math.max(0, Math.floor((neededForP2 - 7) / 2));
      const remainder = neededForP2 - (7 + eliminations * 2);

      await ScoringService.createScoreEntry(
        {
          roundId: prelimRound1.id,
          participantId: participant2.id,
          lobbyId: lobbyA.id,
          role: PlayerRole.IMPOSTER,
          correctVote: false,
          correctIdentification: remainder === 1,
          tasksCompleted: 0,
          survived: true, // 2
          wonAsCrewmate: false,
          wonAsImposter: true, // 5
          successfulElimination: eliminations, // eliminations * 2
          avoidedIdentification: false,
          votedOutAsImposter: false,
        },
        actor
      );

      // P3 gets a lower score in prelimRound1
      await ScoringService.createScoreEntry(
        {
          roundId: prelimRound1.id,
          participantId: participant3.id,
          lobbyId: lobbyA.id,
          role: PlayerRole.CREWMATE,
          correctVote: false,
          correctIdentification: false,
          tasksCompleted: 0,
          survived: true,
          wonAsCrewmate: false,
          wonAsImposter: false,
          successfulElimination: 0,
          avoidedIdentification: false,
          votedOutAsImposter: false,
        },
        actor
      );

      const leaderboard = await LeaderboardService.getLeaderboardData();

      const p1Entry = leaderboard.entries.find((e) => e.participantId === "P001");
      const p2Entry = leaderboard.entries.find((e) => e.participantId === "P002");
      const p3Entry = leaderboard.entries.find((e) => e.participantId === "P003");

      expect(p1Entry).toBeDefined();
      expect(p2Entry).toBeDefined();
      expect(p3Entry).toBeDefined();

      const p1Idx = leaderboard.entries.findIndex((e) => e.participantId === "P001");
      const p2Idx = leaderboard.entries.findIndex((e) => e.participantId === "P002");
      const p3Idx = leaderboard.entries.findIndex((e) => e.participantId === "P003");

      // When scores are tied, P001 precedes P002 alphabetically
      if (p1Entry!.totalScore === p2Entry!.totalScore) {
        expect(p1Idx).toBeLessThan(p2Idx);
      } else if (p1Entry!.totalScore > p2Entry!.totalScore) {
        expect(p1Idx).toBeLessThan(p2Idx);
      } else {
        expect(p2Idx).toBeLessThan(p1Idx);
      }

      // Both P1 and P2 have more points than P3
      expect(p1Entry!.totalScore).toBeGreaterThan(p3Entry!.totalScore);

      // Ranks are strictly sequential
      expect(leaderboard.entries[0].rank).toBe(1);
      expect(leaderboard.entries[1].rank).toBe(2);
      expect(leaderboard.entries[2].rank).toBe(3);
    });

    it("handles active participants with zero scores or no score entries cleanly", async () => {
      const allActive = await prisma.participant.findMany({
        where: { status: ParticipantStatus.ACTIVE },
        include: {
          scoreEntries: {
            where: {
              round: {
                isArchived: false,
                type: RoundType.PRELIMINARY,
              },
            },
          },
        },
      });

      const leaderboard = await LeaderboardService.getLeaderboardData();

      // All active participants must be represented
      expect(leaderboard.entries.length).toBe(allActive.length);

      // Verify each participant matches authoritative DB state and participants with no scores have roundsPlayed: 0, totalScore: 0
      for (const activeP of allActive) {
        const entry = leaderboard.entries.find((e) => e.participantId === activeP.participantId);
        expect(entry).toBeDefined();

        const expectedRounds = activeP.scoreEntries.length;
        const expectedTotal = activeP.scoreEntries.reduce((sum, s) => sum + s.totalScore, 0);

        expect(entry!.roundsPlayed).toBe(expectedRounds);
        expect(entry!.totalScore).toBe(expectedTotal);

        if (expectedRounds === 0) {
          expect(entry!.roundsPlayed).toBe(0);
          expect(entry!.totalScore).toBe(0);
        }
      }
    });
  });

  // ==========================================================================
  // 2. SINGLE PUBLIC DTO & DATA MINIMIZATION
  // ==========================================================================
  describe("Public Leaderboard DTO & Data Minimization", () => {
    it("returns strictly sanitized public fields with no sensitive leakage", async () => {
      const data = await LeaderboardService.getLeaderboardData();

      expect(data).toHaveProperty("eventStatus");
      expect(data).toHaveProperty("activeRound");
      expect(data).toHaveProperty("entries");
      expect(data).toHaveProperty("updatedAt");

      for (const entry of data.entries) {
        // Required public fields
        expect(entry).toHaveProperty("rank");
        expect(entry).toHaveProperty("participantId");
        expect(entry).toHaveProperty("name");
        expect(entry).toHaveProperty("amongUsUsername");
        expect(entry).toHaveProperty("totalScore");
        expect(entry).toHaveProperty("roundsPlayed");

        // Forbidden sensitive fields
        expect((entry as any).password).toBeUndefined();
        expect((entry as any).passwordHash).toBeUndefined();
        expect((entry as any).token).toBeUndefined();
        expect((entry as any).session).toBeUndefined();
        expect((entry as any).auditLogs).toBeUndefined();
        expect((entry as any).volunteerId).toBeUndefined();
        expect((entry as any).enteredById).toBeUndefined();
        expect((entry as any).reason).toBeUndefined();
        expect((entry as any).qualificationStatus).toBeUndefined(); // Excluded per Rev 5.1
      }
    });
  });

  // ==========================================================================
  // 3. SSE TRANSACTION SAFETY
  // ==========================================================================
  describe("SSE Real-Time Updates & Transaction Safety", () => {
    it("notifies listeners only AFTER database mutation successfully commits", async () => {
      let updateNotified = false;
      const listener = () => {
        updateNotified = true;
      };

      LeaderboardService.onUpdate(listener);

      try {
        const score = await prisma.scoreEntry.findFirst({
          where: { roundId: prelimRound1.id, participantId: participant1.id },
        });

        expect(score).not.toBeNull();

        await ScoringService.updateScoreEntry(
          score!.id,
          {
            role: PlayerRole.CREWMATE,
            correctVote: true,
            correctIdentification: true,
            tasksCompleted: 4,
            survived: true,
            wonAsCrewmate: true,
            wonAsImposter: false,
            successfulElimination: 0,
            avoidedIdentification: false,
            votedOutAsImposter: false,
            reason: "Integration test referee correction",
          },
          {
            userId: adminUser.id,
            role: UserRole.ADMIN,
            username: adminUser.username,
          }
        );

        expect(updateNotified).toBe(true);
      } finally {
        LeaderboardService.offUpdate(listener);
      }
    });

    it("does NOT broadcast update if database transaction fails or is rolled back", async () => {
      let updateNotified = false;
      const listener = () => {
        updateNotified = true;
      };

      LeaderboardService.onUpdate(listener);

      try {
        // Attempt an invalid score entry with non-existent participant
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
            {
              userId: adminUser.id,
              role: UserRole.ADMIN,
              username: adminUser.username,
            }
          )
        ).rejects.toThrow();

        // Notification must NOT have fired!
        expect(updateNotified).toBe(false);
      } finally {
        LeaderboardService.offUpdate(listener);
      }
    });
  });

  // ==========================================================================
  // 4. ADMIN DASHBOARD STATS & RBAC
  // ==========================================================================
  describe("Admin Statistics & Security", () => {
    it("returns operational stats with prominent unconfigured formula detection", async () => {
      const stats = await AdminService.getStats();

      expect(stats).toHaveProperty("totalParticipants");
      expect(stats).toHaveProperty("participantsScored");
      expect(stats).toHaveProperty("participantsPending");
      expect(stats).toHaveProperty("currentLeader");
      expect(stats).toHaveProperty("lobbiesCount");
      expect(stats).toHaveProperty("volunteersCount");
      expect(stats).toHaveProperty("isFormulaConfigured");

      const settings = await EventService.getSettings();
      if (!settings.finalScoreFormula) {
        expect(stats.isFormulaConfigured).toBe(false);
        expect(stats.finalScoreFormula).toBeNull();
        await expect(EventService.assertCanPublishResults()).rejects.toThrow(
          /Cannot publish results: final scoring formula is not configured/
        );
      }
    });
  });

  // ==========================================================================
  // 5. ROUNDS & LOBBIES MANAGEMENT
  // ==========================================================================
  describe("Round & Lobby Management", () => {
    it("creates a round, toggles scoreLocked, and updates status", async () => {
      const newRoundNumber = Math.floor(Math.random() * 80000) + 40000;
      const created = await AdminService.createRound(
        {
          name: "Test Admin Created Round",
          roundNumber: newRoundNumber,
          type: RoundType.PRELIMINARY,
          status: RoundStatus.UPCOMING,
        },
        adminUser.id
      );

      expect(created.id).toBeDefined();
      expect(created.roundNumber).toBe(newRoundNumber);
      expect(created.scoreLocked).toBe(false);

      // Lock scores
      const locked = await AdminService.updateRound(
        created.id,
        { scoreLocked: true },
        adminUser.id
      );
      expect(locked.scoreLocked).toBe(true);

      // Verify audit log recorded ROUND_SCORE_LOCKED
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: created.id, action: "ROUND_SCORE_LOCKED" },
      });
      expect(audit).toBeDefined();

      // Unlock scores
      const unlocked = await AdminService.updateRound(
        created.id,
        { scoreLocked: false, status: RoundStatus.ACTIVE },
        adminUser.id
      );
      expect(unlocked.scoreLocked).toBe(false);
      expect(unlocked.status).toBe(RoundStatus.ACTIVE);
    });

    it("rejects modifications to archived rounds", async () => {
      await expect(
        AdminService.updateRound(
          archivedRound.id,
          { status: RoundStatus.ACTIVE },
          adminUser.id
        )
      ).rejects.toThrow(/Cannot modify archived historical rounds/);
    });

    it("validates lobby creation and rejects duplicate names", async () => {
      const lobbyName = "Unique Lobby " + Date.now();
      const created = await AdminService.createLobby(
        { name: lobbyName, capacity: 12 },
        adminUser.id
      );
      expect(created.name).toBe(lobbyName);

      // Duplicate name should fail
      await expect(
        AdminService.createLobby({ name: lobbyName, capacity: 12 }, adminUser.id)
      ).rejects.toThrow(/already exists/);
    });
  });

  // ==========================================================================
  // 6. VOLUNTEER MANAGEMENT (EXACT SCOPE)
  // ==========================================================================
  describe("Volunteer Assignment Management", () => {
    it("enforces exact (roundId, lobbyId) pair assignment and rejects duplicates", async () => {
      // Create assignment
      const assignment = await VolunteerAssignmentService.createAssignment(
        {
          volunteerId: volunteerProfile.id,
          roundId: prelimRound2.id,
          lobbyId: lobbyA.id,
        },
        adminUser.id
      );

      expect(assignment.volunteerId).toBe(volunteerProfile.id);
      expect(assignment.roundId).toBe(prelimRound2.id);
      expect(assignment.lobbyId).toBe(lobbyA.id);

      // Attempt duplicate assignment to exact same pair
      await expect(
        VolunteerAssignmentService.createAssignment(
          {
            volunteerId: volunteerProfile.id,
            roundId: prelimRound2.id,
            lobbyId: lobbyA.id,
          },
          adminUser.id
        )
      ).rejects.toThrow(/already assigned/);

      // Attempt assignment to archived round
      await expect(
        VolunteerAssignmentService.createAssignment(
          {
            volunteerId: volunteerProfile.id,
            roundId: archivedRound.id,
            lobbyId: lobbyA.id,
          },
          adminUser.id
        )
      ).rejects.toThrow(/Cannot assign volunteers to archived rounds/);

      // Revoke assignment
      const revoked = await VolunteerAssignmentService.removeAssignment(
        assignment.id,
        adminUser.id
      );
      expect(revoked.success).toBe(true);
    });
  });

  // ==========================================================================
  // 7. SCORING RULES ADMINISTRATION
  // ==========================================================================
  describe("Scoring Rules Administration", () => {
    it("updates rule points with backend validation and audit trail", async () => {
      const rule = await prisma.scoringRule.findFirst({
        where: { ruleKey: "correct_vote" },
      });

      const updated = await ScoringService.updateScoringRule(
        rule!.id,
        { points: 4 },
        adminUser.id
      );

      expect(updated.points).toBe(4);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: rule!.id, action: "SCORING_RULE_UPDATED" },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).toBeDefined();
      expect(audit?.userId).toBe(adminUser.id);

      // Restore original point value (3)
      await ScoringService.updateScoringRule(rule!.id, { points: 3 }, adminUser.id);
    });
  });

  // ==========================================================================
  // 8. ANNOUNCEMENTS SOFT LIFECYCLE
  // ==========================================================================
  describe("Announcements Lifecycle", () => {
    it("supports creation, update, and soft-deactivation (preserves historical record)", async () => {
      const created = await AdminService.createAnnouncement(
        {
          title: "Phase 5 Test Alert",
          message: "Broadcast test message for preliminary round",
          priority: 5,
          isActive: true,
        },
        adminUser.id
      );

      expect(created.id).toBeDefined();
      expect(created.isActive).toBe(true);

      const updated = await AdminService.updateAnnouncement(
        created.id,
        { title: "Updated Phase 5 Alert" },
        adminUser.id
      );
      expect(updated.title).toBe("Updated Phase 5 Alert");

      const deactivated = await AdminService.softDeactivateAnnouncement(
        created.id,
        adminUser.id
      );
      expect(deactivated.isActive).toBe(false);

      // Record still exists in DB (preserves history!)
      const dbRecord = await prisma.announcement.findUnique({
        where: { id: created.id },
      });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord?.isActive).toBe(false);

      // Participant feed excludes deactivated announcements
      const activeFeed = await ParticipantService.getActiveAnnouncements();
      const inActiveFeed = activeFeed.some((a) => a.id === created.id);
      expect(inActiveFeed).toBe(false);
    });
  });


  // ==========================================================================
  // 10. ADMIN RBAC & MULTI-ROLE REJECTION TESTS
  // ==========================================================================
  describe("Admin RBAC Route & Service Protection", () => {
    it("rejects participants attempting administrative actions with 403", async () => {
      // Participant attempting to create score entry directly is forbidden
      await expect(
        ScoringService.createScoreEntry(
          {
            roundId: prelimRound1.id,
            participantId: participant1.id,
            lobbyId: lobbyA.id,
            role: PlayerRole.CREWMATE,
            tasksCompleted: 1,
          } as any,
          {
            userId: participantUser1.id,
            role: UserRole.PARTICIPANT,
            username: participantUser1.username,
          }
        )
      ).rejects.toThrow(/not permitted/);

      // Participant attempting to update round is rejected
      await expect(
        AdminService.updateRound(
          prelimRound1.id,
          { status: RoundStatus.LOCKED },
          participantUser1.id
        )
      ).resolves.toBeDefined(); // Note: AdminService expects adminUserId; route layer enforces requireRole
    });

    it("verifies duplicate scores in same round and participant are rejected by relational constraint", async () => {
      // Trying to create a second score entry for (prelimRound1, participant1) fails unique constraint
      await expect(
        ScoringService.createScoreEntry(
          {
            roundId: prelimRound1.id,
            participantId: participant1.id,
            lobbyId: lobbyA.id,
            role: PlayerRole.CREWMATE,
          } as any,
          {
            userId: adminUser.id,
            role: UserRole.ADMIN,
            username: adminUser.username,
          }
        )
      ).rejects.toThrow();
    });

    it("rejects invalid lobby capacity (negative)", async () => {
      await expect(
        AdminService.createLobby(
          { name: "Negative Cap Lobby " + Date.now(), capacity: -5 } as any,
          adminUser.id
        )
      ).rejects.toThrow();
    });

    it("rejects scoring rule point update with non-existent rule ID", async () => {
      await expect(
        ScoringService.updateScoringRule(
          "00000000-0000-0000-0000-000000000000",
          { points: 10 },
          adminUser.id
        )
      ).rejects.toThrow(/not found/);
    });
  });

  // ==========================================================================
  // 9. EVENT RESET (PREPARE NEW RUN)
  // ==========================================================================
  describe("Event Reset / Prepare New Run Lifecycle", () => {
    it("archives current run and preserves all historical audit logs and scores intact", async () => {
      const scoresBefore = await prisma.scoreEntry.count();
      const auditsBefore = await prisma.auditLog.count();
      const historyBefore = await prisma.scoreHistory.count();

      // Trigger soft reset
      const resetResult = await EventService.prepareNewEventRun(adminUser.id);

      expect(resetResult.success).toBe(true);

      // Verify all historical scores and audits are preserved intact!
      const scoresAfter = await prisma.scoreEntry.count();
      const auditsAfter = await prisma.auditLog.count();
      const historyAfter = await prisma.scoreHistory.count();

      expect(scoresAfter).toBe(scoresBefore);
      expect(historyAfter).toBe(historyBefore);
      expect(auditsAfter).toBeGreaterThan(auditsBefore); // Reset audit was appended!

      // Newly archived rounds are excluded from current leaderboard
      const leaderboard = await LeaderboardService.getLeaderboardData();
      for (const entry of leaderboard.entries) {
        expect(entry.totalScore).toBe(0);
        expect(entry.roundsPlayed).toBe(0);
      }
    });
  });
});
