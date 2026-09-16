import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  PrismaClient,
  UserRole,
  ParticipantStatus,
  RoundType,
  RoundStatus,
  LobbyType,
  PlayerRole,
  TieBreakMethod,
} from "@prisma/client";
import { QualificationService } from "@/services/qualification.service";
import { FinalsService } from "@/services/finals.service";
import { ScoringService } from "@/services/scoring.service";
import { EventService } from "@/services/event.service";
import { ApiError } from "@/lib/api-helpers";
import * as authLib from "@/lib/auth";

const prisma = new PrismaClient();

describe("Consolidated Phase 6 — Qualification, Finals & Results", () => {
  let adminUser: any;
  let volunteerUser: any;
  let participant1User: any;
  let activeParticipants: any[] = [];
  let prelimRound1: any;
  let practiceRound: any;
  let finalRound1: any;
  let finalLobby: any;
  let testLobby: any;
  const createdScoreIds: string[] = [];
  const createdRoundIds: string[] = [];

  beforeAll(async () => {
    adminUser = await prisma.user.findUnique({ where: { username: "admin" } });
    volunteerUser = await prisma.user.findUnique({
      where: { username: "volunteer1" },
      include: { volunteer: true },
    });
    participant1User = await prisma.user.findUnique({
      where: { username: "P001" },
    });

    activeParticipants = await prisma.participant.findMany({
      where: { status: ParticipantStatus.ACTIVE },
      orderBy: { participantId: "asc" },
    });

    // Temporarily archive existing unarchived FINAL rounds so we have a clean test baseline
    await prisma.round.updateMany({
      where: { isArchived: false, type: RoundType.FINAL },
      data: { isArchived: true },
    });

    // Create dedicated active test lobby
    testLobby = await prisma.lobby.create({
      data: {
        name: "Phase 6 Test Lobby " + Date.now(),
        type: LobbyType.PRELIMINARY,
        capacity: 20,
      },
    });

    // Create dedicated active Final lobby
    finalLobby = await prisma.lobby.create({
      data: {
        name: "Phase 6 Final Lobby " + Date.now(),
        type: LobbyType.FINAL,
        capacity: 15,
      },
    });

    // Create dedicated rounds with high unique numbers
    const baseNumber = Math.floor(Math.random() * 80000) + 40000;

    prelimRound1 = await prisma.round.create({
      data: {
        name: "Phase 6 Prelim 1 " + Date.now(),
        roundNumber: baseNumber + 1,
        type: RoundType.PRELIMINARY,
        status: RoundStatus.ACTIVE,
        isArchived: false,
      },
    });
    createdRoundIds.push(prelimRound1.id);

    practiceRound = await prisma.round.create({
      data: {
        name: "Phase 6 Practice " + Date.now(),
        roundNumber: baseNumber + 2,
        type: RoundType.PRACTICE,
        status: RoundStatus.ACTIVE,
        isArchived: false,
      },
    });
    createdRoundIds.push(practiceRound.id);

    finalRound1 = await prisma.round.create({
      data: {
        name: "Phase 6 Final 1 " + Date.now(),
        roundNumber: baseNumber + 3,
        type: RoundType.FINAL,
        status: RoundStatus.ACTIVE,
        isArchived: false,
      },
    });
    createdRoundIds.push(finalRound1.id);

    // Assign volunteer to final round and final lobby
    await prisma.volunteerAssignment.create({
      data: {
        volunteerId: volunteerUser.volunteer.id,
        roundId: finalRound1.id,
        lobbyId: finalLobby.id,
        assignedById: adminUser.id,
      },
    });

    // Seed distinct preliminary scores for all active participants in prelimRound1
    // to establish a clean, deterministic leaderboard ranking
    for (let i = 0; i < activeParticipants.length; i++) {
      const p = activeParticipants[i];
      await prisma.roundParticipant.create({
        data: {
          roundId: prelimRound1.id,
          lobbyId: testLobby.id,
          participantId: p.id,
        },
      });

      const assignedTasks = (activeParticipants.length - i) * 50;
      const score = await prisma.scoreEntry.create({
        data: {
          roundId: prelimRound1.id,
          participantId: p.id,
          role: PlayerRole.CREWMATE,
          tasksCompleted: assignedTasks,
          totalScore: assignedTasks,
          enteredById: adminUser.id,
        },
      });
      createdScoreIds.push(score.id);
    }

    // Set baseline event settings: cutoff = 8, formula = null
    await prisma.eventSetting.updateMany({
      data: {
        qualificationCount: 8,
        tieBreakMethod: TieBreakMethod.ADMIN_DECISION,
        finalScoreFormula: null,
        resultsPublished: false,
        resultsLocked: false,
      },
    });
  });

  afterAll(async () => {
    // Restore baseline settings so other suites pass cleanly
    await prisma.eventSetting.updateMany({
      data: {
        qualificationCount: 8,
        tieBreakMethod: TieBreakMethod.ADMIN_DECISION,
        finalScoreFormula: null,
        resultsPublished: false,
        resultsLocked: false,
      },
    });

    // Cleanup created assignments, round participants, rounds and lobbies
    await prisma.volunteerAssignment.deleteMany({
      where: { lobbyId: { in: [testLobby.id, finalLobby.id] } },
    });
    await prisma.roundParticipant.deleteMany({
      where: { roundId: { in: createdRoundIds } },
    });

    // Archive our test rounds so they don't conflict
    await prisma.round.updateMany({
      where: { id: { in: createdRoundIds } },
      data: { isArchived: true },
    });

    // Restore canonical seed rounds for subsequent test suites
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
  });

  // ==========================================================================
  // 1. QUALIFICATION ENGINE
  // ==========================================================================
  describe("1. Qualification Calculation & Scoping", () => {
    it("should calculate qualification from unarchived PRELIMINARY rounds only", async () => {
      const result = await QualificationService.calculateQualification(adminUser.id);

      expect(result).toBeDefined();
      expect(result.qualificationCount).toBe(8);
      expect(result.totalEligible).toBeGreaterThanOrEqual(8);
      expect(result.qualifiedCount).toBe(8);

      // Verify deterministic sorting: score DESC
      for (let i = 1; i < result.qualifications.length; i++) {
        const prev = result.qualifications[i - 1];
        const curr = result.qualifications[i];
        if (prev.preliminaryScore === curr.preliminaryScore) {
          expect(prev.participantCode.localeCompare(curr.participantCode)).toBeLessThan(0);
        } else {
          expect(prev.preliminaryScore).toBeGreaterThanOrEqual(curr.preliminaryScore);
        }
      }

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: { action: "QUALIFICATION_CALCULATED" },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).not.toBeNull();
      expect(audit?.userId).toBe(adminUser.id);
    });

    it("should exclude PRACTICE round scores from preliminary qualification totals", async () => {
      const p = activeParticipants[0];
      const initial = await QualificationService.calculateQualification(adminUser.id);
      const initialScore = initial.qualifications.find((q) => q.participantId === p.id)?.preliminaryScore;

      await prisma.roundParticipant.create({
        data: {
          roundId: practiceRound.id,
          lobbyId: testLobby.id,
          participantId: p.id,
        },
      });

      const practiceScore = await prisma.scoreEntry.create({
        data: {
          roundId: practiceRound.id,
          participantId: p.id,
          role: PlayerRole.CREWMATE,
          tasksCompleted: 99,
          totalScore: 99,
          enteredById: adminUser.id,
        },
      });
      createdScoreIds.push(practiceScore.id);

      // Re-calculate qualification
      const result = await QualificationService.calculateQualification(adminUser.id);
      const qualP = result.qualifications.find((q) => q.participantId === p.id);

      // Prelim score must NOT include the 99 points from practice round
      expect(qualP?.preliminaryScore).toBe(initialScore);
    });

    it("should fail safely if eligible participants < cutoff (unresolved in REQUIREMENTS.md)", async () => {
      await prisma.eventSetting.updateMany({
        data: { qualificationCount: 999 },
      });

      await expect(
        QualificationService.calculateQualification(adminUser.id)
      ).rejects.toThrow("fewer than the configured qualification cutoff");

      await prisma.eventSetting.updateMany({
        data: { qualificationCount: 8 },
      });
    });

    it("should fail safely if non-ADMIN_DECISION tieBreakMethod is configured (unresolved mechanics)", async () => {
      for (const method of [TieBreakMethod.HEAD_TO_HEAD, TieBreakMethod.ALL_QUALIFY, TieBreakMethod.FINAL_ROUND_SCORE]) {
        await prisma.eventSetting.updateMany({
          data: { tieBreakMethod: method },
        });

        await expect(
          QualificationService.calculateQualification(adminUser.id)
        ).rejects.toThrow("not specified in REQUIREMENTS.md and require clarification");
      }

      await prisma.eventSetting.updateMany({
        data: { tieBreakMethod: TieBreakMethod.ADMIN_DECISION },
      });
    });
  });

  // ==========================================================================
  // 2. BOUNDARY TIE HANDLING & FRESH RECALCULATION
  // ==========================================================================
  describe("2. Boundary Tie Detection, Resolution & Recalculation", () => {
    it("should flag boundary tie when participants at cutoff share identical scores", async () => {
      await QualificationService.calculateQualification(adminUser.id);

      const list = await QualificationService.getQualificationList();
      expect(list.length).toBeGreaterThanOrEqual(9);

      const qual8 = list[7];
      const qual9 = list[8];

      // Simulate a boundary tie at score 50
      await prisma.qualification.update({
        where: { id: qual8.id },
        data: { preliminaryScore: 50, isTieAtCutoff: true, qualified: false },
      });
      await prisma.qualification.update({
        where: { id: qual9.id },
        data: { preliminaryScore: 50, isTieAtCutoff: true, qualified: false },
      });

      // Resolve tie using ADMIN_DECISION for qual8
      const resolved = await QualificationService.resolveTie(
        { participantId: qual8.participantId, reason: "Referee manual tie break" },
        adminUser.id
      );

      const chosen = resolved.find((q) => q.participantId === qual8.participantId);
      const unchosen = resolved.find((q) => q.participantId === qual9.participantId);

      expect(chosen?.qualified).toBe(true);
      expect(chosen?.adminOverride).toBe(true);
      expect(unchosen?.qualified).toBe(false);
      expect(unchosen?.adminOverride).toBe(false);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: { action: "QUALIFICATION_TIE_RESOLVED" },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).not.toBeNull();
      expect(audit?.userId).toBe(adminUser.id);
    });

    it("should reject resolving tie for a participant not in boundary tie state", async () => {
      const list = await QualificationService.getQualificationList();
      const nonTied = list.find((q) => !q.isTieAtCutoff);
      if (nonTied) {
        await expect(
          QualificationService.resolveTie(
            { participantId: nonTied.participantId },
            adminUser.id
          )
        ).rejects.toThrow("Participant is not in a boundary tie state");
      }
    });

    it("should recalculate qualification freshly without invented override retention", async () => {
      // Calculate first to determine current standings
      const initial = await QualificationService.calculateQualification(adminUser.id);
      const targetRank8 = initial.qualifications[7];
      const targetRank9 = initial.qualifications[8];

      // Ensure targetRank9's total preliminary score matches targetRank8's preliminary score exactly
      const diff = targetRank8.preliminaryScore - targetRank9.preliminaryScore;
      if (diff !== 0) {
        const entry = await prisma.scoreEntry.findFirst({
          where: {
            round: { isArchived: false, type: RoundType.PRELIMINARY },
            participantId: targetRank9.participantId,
          },
        });
        if (entry) {
          await prisma.scoreEntry.update({
            where: { id: entry.id },
            data: { totalScore: entry.totalScore + diff },
          });
        }
      }

      const recalc = await QualificationService.calculateQualification(adminUser.id);
      expect(recalc.isTieAtCutoff).toBe(true);
      expect(recalc.unresolvedTie).toBe(true);

      const row8 = recalc.qualifications.find((q) => q.participantId === targetRank8.participantId);
      const row9 = recalc.qualifications.find((q) => q.participantId === targetRank9.participantId);

      // Both must be unselected without invented retention heuristics!
      expect(row8?.isTieAtCutoff).toBe(true);
      expect(row8?.qualified).toBe(false);
      expect(row8?.adminOverride).toBe(false);

      expect(row9?.isTieAtCutoff).toBe(true);
      expect(row9?.qualified).toBe(false);
      expect(row9?.adminOverride).toBe(false);

      // Admin explicitly resolves the tie for rank 8 participant
      await QualificationService.resolveTie({ participantId: targetRank8.participantId }, adminUser.id);

      // Revert the temporary score change so subsequent test runs and suites have clean, non-tied baseline
      if (diff !== 0) {
        const entry = await prisma.scoreEntry.findFirst({
          where: {
            round: { isArchived: false, type: RoundType.PRELIMINARY },
            participantId: targetRank9.participantId,
          },
        });
        if (entry) {
          await prisma.scoreEntry.update({
            where: { id: entry.id },
            data: { totalScore: entry.totalScore - diff },
          });
        }
      }
    });
  });

  // ==========================================================================
  // 3. FINALS ROSTER & LOBBY ENROLLMENT
  // ==========================================================================
  describe("3. Finals Roster & Match Enrollment", () => {
    it("should retrieve finals roster containing only qualified participants", async () => {
      const roster = await FinalsService.getFinalsRoster();
      expect(roster.length).toBe(8);
      for (const item of roster) {
        expect(item.qualified).toBe(true);
        expect(item.participant.status).toBe(ParticipantStatus.ACTIVE);
      }
    });

    it("should enroll qualified finalists into Final Round and Final Lobby", async () => {
      const result = await FinalsService.enrollFinalsRoster(
        { roundId: finalRound1.id, lobbyId: finalLobby.id },
        adminUser.id
      );

      expect(result.success).toBe(true);
      expect(result.enrolledCount).toBe(8);

      const enrollments = await prisma.roundParticipant.findMany({
        where: { roundId: finalRound1.id, lobbyId: finalLobby.id },
      });
      expect(enrollments.length).toBe(8);

      const audit = await prisma.auditLog.findFirst({
        where: { action: "FINALS_ROSTER_ENROLLED" },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).not.toBeNull();
      expect(audit?.userId).toBe(adminUser.id);
    });

    it("should reject enrolling into a non-FINAL round", async () => {
      await expect(
        FinalsService.enrollFinalsRoster(
          { roundId: prelimRound1.id, lobbyId: finalLobby.id },
          adminUser.id
        )
      ).rejects.toThrow("Target round is not a FINAL round");
    });

    it("should reject enrolling into a score-locked round", async () => {
      await prisma.round.update({
        where: { id: finalRound1.id },
        data: { scoreLocked: true },
      });

      await expect(
        FinalsService.enrollFinalsRoster(
          { roundId: finalRound1.id, lobbyId: finalLobby.id },
          adminUser.id
        )
      ).rejects.toThrow("Target final round is score locked");

      await prisma.round.update({
        where: { id: finalRound1.id },
        data: { scoreLocked: false },
      });
    });

    it("should reject enrollment if target lobby capacity is insufficient", async () => {
      await prisma.lobby.update({
        where: { id: finalLobby.id },
        data: { capacity: 2 },
      });

      await expect(
        FinalsService.enrollFinalsRoster(
          { roundId: finalRound1.id, lobbyId: finalLobby.id },
          adminUser.id
        )
      ).rejects.toThrow("Target lobby capacity (2) is insufficient");

      await prisma.lobby.update({
        where: { id: finalLobby.id },
        data: { capacity: 15 },
      });
    });
  });

  // ==========================================================================
  // 4. FINAL ROUND SCORING & FORMULA EVALUATION
  // ==========================================================================
  describe("4. Final Round Scoring & Formulas", () => {
    let finalist1: any;
    let finalist2: any;

    beforeAll(async () => {
      const roster = await FinalsService.getFinalsRoster();
      finalist1 = roster[0];
      finalist2 = roster[1];

      // Submit a distinct final score for finalist1
      const score1 = await ScoringService.createScoreEntry(
        {
          roundId: finalRound1.id,
          participantId: finalist1.participantId,
          lobbyId: finalLobby.id,
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
        },
        { userId: adminUser.id, role: UserRole.ADMIN }
      );
      createdScoreIds.push(score1.id);

      // Submit a distinct final score for finalist2
      const score2 = await ScoringService.createScoreEntry(
        {
          roundId: finalRound1.id,
          participantId: finalist2.participantId,
          lobbyId: finalLobby.id,
          role: PlayerRole.IMPOSTER,
          correctVote: false,
          correctIdentification: false,
          tasksCompleted: 0,
          survived: true,
          wonAsCrewmate: false,
          wonAsImposter: true,
          successfulElimination: 2,
          avoidedIdentification: true,
          votedOutAsImposter: false,
        },
        { userId: adminUser.id, role: UserRole.ADMIN }
      );
      createdScoreIds.push(score2.id);
    });

    it("should fail results preview when finalScoreFormula is NULL (no silent default to SUM)", async () => {
      await prisma.eventSetting.updateMany({
        data: { finalScoreFormula: null },
      });

      await expect(FinalsService.getFinalResults(true)).rejects.toThrow(
        "Final scoring formula is not configured"
      );
    });

    it("should fail safely when multiple unarchived FINAL rounds exist (unresolved aggregation)", async () => {
      await EventService.configureFinalFormula(
        { formula: "SUM", preliminaryWeight: 1.0, finalWeight: 1.0 },
        adminUser.id
      );

      // Create a 2nd unarchived FINAL round
      const extraFinal = await prisma.round.create({
        data: {
          name: "Extra Final Round",
          roundNumber: 99999,
          type: RoundType.FINAL,
          status: RoundStatus.ACTIVE,
          isArchived: false,
        },
      });

      await expect(FinalsService.getFinalResults(true)).rejects.toThrow(
        "Aggregation of FINAL SCORE across multiple final rounds is not specified in REQUIREMENTS.md and requires clarification."
      );

      // Archive extra final round
      await prisma.round.update({
        where: { id: extraFinal.id },
        data: { isArchived: true },
      });
    });

    it("should evaluate overall score using SUM formula", async () => {
      await EventService.configureFinalFormula(
        { formula: "SUM", preliminaryWeight: 1.0, finalWeight: 1.0 },
        adminUser.id
      );

      const results = await FinalsService.getFinalResults(true);
      expect(results.formula).toBe("SUM");
      expect(results.standings.length).toBe(8);

      const entry = results.standings.find((s) => s.participantId === finalist1.participant.participantId);
      expect(entry).toBeDefined();
      expect(entry?.overallScore).toBe(entry!.preliminaryScore + entry!.finalScore);
    });

    it("should evaluate overall score using WEIGHTED formula", async () => {
      await EventService.configureFinalFormula(
        { formula: "WEIGHTED", preliminaryWeight: 0.4, finalWeight: 0.6 },
        adminUser.id
      );

      const results = await FinalsService.getFinalResults(true);
      expect(results.formula).toBe("WEIGHTED");

      const entry = results.standings.find((s) => s.participantId === finalist1.participant.participantId);
      expect(entry).toBeDefined();

      const expected = Number(((entry!.preliminaryScore * 0.4) + (entry!.finalScore * 0.6)).toFixed(2));
      expect(entry?.overallScore).toBe(expected);
    });
  });

  // ==========================================================================
  // 5. DETERMINISTIC RANKING, TIE-BREAKING & WINNER/PODIUM CONSISTENCY
  // ==========================================================================
  describe("5. Deterministic Ranking, Final Ties & Winner Consistency", () => {
    let finalist1: any;
    let finalist2: any;

    beforeAll(async () => {
      const roster = await FinalsService.getFinalsRoster();
      finalist1 = roster[0];
      finalist2 = roster[1];

      await EventService.configureFinalFormula(
        { formula: "SUM", preliminaryWeight: 1.0, finalWeight: 1.0 },
        adminUser.id
      );
    });

    it("(A) Unique highest score: assigns rank 1, podium 1, winnerId, and audit log records winner", async () => {
      const roster = await FinalsService.getFinalsRoster();
      // Ensure every finalist receives a strictly decreasing final score so overall scores are all distinct
      for (let i = 0; i < roster.length; i++) {
        const q = roster[i];
        const finalScoreVal = (roster.length - i) * 20;
        await prisma.scoreEntry.upsert({
          where: {
            roundId_participantId: {
              roundId: finalRound1.id,
              participantId: q.participantId,
            },
          },
          create: {
            roundId: finalRound1.id,
            participantId: q.participantId,
            role: PlayerRole.CREWMATE,
            totalScore: finalScoreVal,
            enteredById: adminUser.id,
          },
          update: {
            totalScore: finalScoreVal,
          },
        });
      }

      const preview = await FinalsService.getFinalResults(true);
      expect(preview.hasUnresolvedTie).toBe(false);
      expect(preview.winnerId).toBe(roster[0].participant.participantId);

      const top = preview.standings[0];
      expect(top.participantId).toBe(roster[0].participant.participantId);
      expect(top.rank).toBe(1);
      expect(top.isPodium).toBe(true);
      expect(top.podiumPlace).toBe(1);
      expect(top.isTie).toBe(false);

      // Verify ranks 2 and 3 also have proper podium assignments
      expect(preview.standings[1].rank).toBe(2);
      expect(preview.standings[1].podiumPlace).toBe(2);
      expect(preview.standings[2].rank).toBe(3);
      expect(preview.standings[2].podiumPlace).toBe(3);

      // Publish results
      const published = await FinalsService.publishResults(adminUser.id);
      expect(published.resultsPublished).toBe(true);

      const audit = await prisma.auditLog.findFirst({
        where: { action: "RESULTS_PUBLISHED" },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).not.toBeNull();
      expect((audit?.newValue as any).winnerId).toBe(roster[0].participant.participantId);
      expect((audit?.newValue as any).hasUnresolvedTie).toBe(false);

      // Unlock for next test
      await FinalsService.unlockResults(
        { reason: "Testing tied final results" },
        adminUser.id
      );
    });

    it("(Intermediate Tie) Unique 1st place with tied 2nd/3rd places: assigns 1st podium but no arbitrary 2nd/3rd podium", async () => {
      const roster = await FinalsService.getFinalsRoster();
      const q1 = roster[0];
      const q2 = roster[1];
      const q3 = roster[2];

      // Give q1 a uniquely high overall score of 2500
      await prisma.scoreEntry.upsert({
        where: { roundId_participantId: { roundId: finalRound1.id, participantId: q1.participantId } },
        create: { roundId: finalRound1.id, participantId: q1.participantId, role: PlayerRole.CREWMATE, totalScore: 2500 - q1.preliminaryScore, enteredById: adminUser.id },
        update: { totalScore: 2500 - q1.preliminaryScore },
      });

      // Give q2 and q3 exactly identical overall score of 2300
      await prisma.scoreEntry.upsert({
        where: { roundId_participantId: { roundId: finalRound1.id, participantId: q2.participantId } },
        create: { roundId: finalRound1.id, participantId: q2.participantId, role: PlayerRole.CREWMATE, totalScore: 2300 - q2.preliminaryScore, enteredById: adminUser.id },
        update: { totalScore: 2300 - q2.preliminaryScore },
      });
      await prisma.scoreEntry.upsert({
        where: { roundId_participantId: { roundId: finalRound1.id, participantId: q3.participantId } },
        create: { roundId: finalRound1.id, participantId: q3.participantId, role: PlayerRole.CREWMATE, totalScore: 2300 - q3.preliminaryScore, enteredById: adminUser.id },
        update: { totalScore: 2300 - q3.preliminaryScore },
      });

      // Give all others 0 final score
      for (let i = 3; i < roster.length; i++) {
        await prisma.scoreEntry.upsert({
          where: { roundId_participantId: { roundId: finalRound1.id, participantId: roster[i].participantId } },
          create: { roundId: finalRound1.id, participantId: roster[i].participantId, role: PlayerRole.CREWMATE, totalScore: 0, enteredById: adminUser.id },
          update: { totalScore: 0 },
        });
      }

      const preview = await FinalsService.getFinalResults(true);
      expect(preview.hasUnresolvedTie).toBe(true);
      expect(preview.winnerId).toBe(q1.participant.participantId);

      // 1st place is unambiguous
      const first = preview.standings.find((s) => s.participantId === q1.participant.participantId);
      expect(first?.rank).toBe(1);
      expect(first?.isPodium).toBe(true);
      expect(first?.podiumPlace).toBe(1);

      // 2nd and 3rd are tied: neither gets arbitrary rank or arbitrary podium assignment
      const second = preview.standings.find((s) => s.participantId === q2.participant.participantId);
      const third = preview.standings.find((s) => s.participantId === q3.participant.participantId);

      expect(second?.rank).toBeNull();
      expect(second?.isTie).toBe(true);
      expect(second?.isPodium).toBe(false);
      expect(second?.podiumPlace).toBeUndefined();

      expect(third?.rank).toBeNull();
      expect(third?.isTie).toBe(true);
      expect(third?.isPodium).toBe(false);
      expect(third?.podiumPlace).toBeUndefined();
    });

    it("(B) Tied highest score: detects unresolved tie, no arbitrary winnerId, no podium place, audit has winnerId: null", async () => {
      const roster = await FinalsService.getFinalsRoster();
      const top1 = roster[0];
      const top2 = roster[1];

      const targetOverall = 3000;
      const finalScore1 = targetOverall - top1.preliminaryScore;
      const finalScore2 = targetOverall - top2.preliminaryScore;

      await prisma.scoreEntry.upsert({
        where: { roundId_participantId: { roundId: finalRound1.id, participantId: top1.participantId } },
        create: { roundId: finalRound1.id, participantId: top1.participantId, role: PlayerRole.CREWMATE, totalScore: finalScore1, enteredById: adminUser.id },
        update: { totalScore: finalScore1 },
      });
      await prisma.scoreEntry.upsert({
        where: { roundId_participantId: { roundId: finalRound1.id, participantId: top2.participantId } },
        create: { roundId: finalRound1.id, participantId: top2.participantId, role: PlayerRole.CREWMATE, totalScore: finalScore2, enteredById: adminUser.id },
        update: { totalScore: finalScore2 },
      });

      // Ensure all other finalists have strictly lower overall scores
      for (let i = 2; i < roster.length; i++) {
        await prisma.scoreEntry.upsert({
          where: { roundId_participantId: { roundId: finalRound1.id, participantId: roster[i].participantId } },
          create: { roundId: finalRound1.id, participantId: roster[i].participantId, role: PlayerRole.CREWMATE, totalScore: 0, enteredById: adminUser.id },
          update: { totalScore: 0 },
        });
      }

      const results = await FinalsService.getFinalResults(true);

      // Standings must flag unresolved tie
      expect(results.hasUnresolvedTie).toBe(true);
      expect(results.unresolvedTieReason).toMatch(/not specified in REQUIREMENTS.md/);

      // No arbitrary winnerId generated!
      expect(results.winnerId).toBeNull();

      const f1 = results.standings.find((s) => s.participantId === top1.participant.participantId);
      const f2 = results.standings.find((s) => s.participantId === top2.participant.participantId);

      expect(f1).toBeDefined();
      expect(f2).toBeDefined();
      expect(f1!.overallScore).toBe(targetOverall);
      expect(f2!.overallScore).toBe(targetOverall);

      // Neither receives an arbitrary rank or shared rank (strictly null)
      expect(f1!.rank).toBeNull();
      expect(f2!.rank).toBeNull();
      expect(f1!.isTie).toBe(true);
      expect(f2!.isTie).toBe(true);

      // Neither receives an arbitrary podium placement!
      expect(f1!.isPodium).toBe(false);
      expect(f1!.podiumPlace).toBeUndefined();
      expect(f2!.isPodium).toBe(false);
      expect(f2!.podiumPlace).toBeUndefined();

      // Publish tied results and verify audit log does NOT fabricate a unique winner
      await FinalsService.publishResults(adminUser.id);

      const audit = await prisma.auditLog.findFirst({
        where: { action: "RESULTS_PUBLISHED" },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).not.toBeNull();
      expect((audit?.newValue as any).winnerId).toBeNull();
      expect((audit?.newValue as any).hasUnresolvedTie).toBe(true);

      // Unlock results for subsequent tests
      await FinalsService.unlockResults(
        { reason: "Restoring state after tie test" },
        adminUser.id
      );
    });

    it("should reject duplicate publication when results are already published", async () => {
      await FinalsService.publishResults(adminUser.id);

      await expect(FinalsService.publishResults(adminUser.id)).rejects.toThrow(
        "Tournament results have already been published"
      );

      await FinalsService.unlockResults(
        { reason: "Continuing test suite" },
        adminUser.id
      );
    });

    it("should reject unlocking results without a mandatory administrative reason", async () => {
      await FinalsService.publishResults(adminUser.id);

      // Passing empty reason must be rejected by service / validation
      await expect(
        FinalsService.unlockResults({ reason: "" }, adminUser.id)
      ).rejects.toThrow();

      await FinalsService.unlockResults(
        { reason: "Valid admin unlock reason" },
        adminUser.id
      );
    });
  });

  // ==========================================================================
  // 6. ROLE-BASED ACCESS CONTROL (RBAC) & SECURITY DEFENSE
  // ==========================================================================
  describe("6. Role-Based Access Control (RBAC) & Security", () => {
    it("should reject non-preview public access when results are unpublished", async () => {
      await expect(FinalsService.getFinalResults(false)).rejects.toThrow(
        "Final tournament results have not been published yet"
      );
    });

    it("should allow public results access once results are published", async () => {
      await FinalsService.publishResults(adminUser.id);

      const publicResults = await FinalsService.getFinalResults(false);
      expect(publicResults.isPublished).toBe(true);
      expect(publicResults.standings.length).toBe(8);

      await FinalsService.unlockResults(
        { reason: "Resetting for RBAC tests" },
        adminUser.id
      );
    });

    it("should reject VOLUNTEER from executing admin qualification calculation", async () => {
      vi.spyOn(authLib, "getServerAuthSession").mockResolvedValueOnce({
        user: {
          id: volunteerUser.id,
          username: "volunteer1",
          role: UserRole.VOLUNTEER,
          isActive: true,
        },
        expires: new Date(Date.now() + 3600000).toISOString(),
      });

      const { requireRole } = await import("@/lib/api-helpers");
      let err: any;
      try {
        await requireRole([UserRole.ADMIN]);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(403);
    });

    it("should reject PARTICIPANT from executing admin finals roster enrollment", async () => {
      vi.spyOn(authLib, "getServerAuthSession").mockResolvedValueOnce({
        user: {
          id: participant1User.id,
          username: "P001",
          role: UserRole.PARTICIPANT,
          isActive: true,
        },
        expires: new Date(Date.now() + 3600000).toISOString(),
      });

      const { requireRole } = await import("@/lib/api-helpers");
      let err: any;
      try {
        await requireRole([UserRole.ADMIN]);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(403);
    });
  });

  // ==========================================================================
  // 7. HISTORICAL ISOLATION & RESET BEHAVIOR
  // ==========================================================================
  describe("7. Historical Isolation & Reset Behavior", () => {
    it("should preserve historical scores, rounds, and audit logs during event run reset (Option A)", async () => {
      const auditCountBefore = await prisma.auditLog.count();
      const scoreCountBefore = await prisma.scoreEntry.count();

      // Run event reset
      const resetResult = await EventService.prepareNewEventRun(adminUser.id);
      expect(resetResult.success).toBe(true);

      // Qualifications are cleared for current run
      const qualsAfter = await prisma.qualification.count();
      expect(qualsAfter).toBe(0);

      // Historical scores and audits are intact
      const scoreCountAfter = await prisma.scoreEntry.count();
      const auditCountAfter = await prisma.auditLog.count();
      expect(scoreCountAfter).toBe(scoreCountBefore);
      expect(auditCountAfter).toBeGreaterThan(auditCountBefore);

      // Restore canonical rounds unarchived state for subsequent test suites
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

      // Restore finalScoreFormula to null so database-integrity test passes
      await prisma.eventSetting.updateMany({
        data: { finalScoreFormula: null, resultsPublished: false, resultsLocked: false },
      });
    });
  });
});
