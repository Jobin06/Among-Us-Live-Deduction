import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, UserRole, PlayerRole, RoundType, RoundStatus, EventStatus } from "@prisma/client";

const prisma = new PrismaClient();

describe("Phase 2 — Database Integrity & Immutability Triggers", () => {
  let adminUserId: string;
  let testRoundId: string;
  let testParticipantId: string;
  let testScoreEntryId: string;

  beforeAll(async () => {
    // Locate admin user
    const admin = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
    });
    if (!admin) throw new Error("Admin user not found in seeded database");
    adminUserId = admin.id;

    // Ensure Preliminary Round 1 is active
    let round = await prisma.round.findFirst({
      where: { type: RoundType.PRELIMINARY, roundNumber: 1, isArchived: false },
    });
    if (!round) {
      const latest = await prisma.round.findFirst({
        where: { type: RoundType.PRELIMINARY, roundNumber: 1 },
        orderBy: { createdAt: "desc" },
      });
      if (latest) {
        round = await prisma.round.update({
          where: { id: latest.id },
          data: { isArchived: false },
        });
      }
    }
    if (!round) throw new Error("Preliminary round 1 not found");
    testRoundId = round.id;

    const participant = await prisma.participant.findFirst({
      where: { participantId: "P001" },
    });
    if (!participant) throw new Error("Participant P001 not found");
    testParticipantId = participant.id;
  });

  afterAll(async () => {
    // Clean up test score entry if created
    if (testScoreEntryId) {
      // Clean up score_history first if any raw cleanup is needed or leave intact
    }
    await prisma.$disconnect();
  });

  describe("1. PostgreSQL Immutability Triggers for audit_logs", () => {
    let createdAuditLogId: string;

    it("should allow INSERT into audit_logs", async () => {
      const log = await prisma.auditLog.create({
        data: {
          userId: adminUserId,
          action: "INTEGRATION_TEST_INSERT",
          entityType: "TEST",
          reason: "Verifying INSERT succeeds on immutable audit_logs",
        },
      });

      expect(log).toBeDefined();
      expect(log.id).toBeDefined();
      expect(log.action).toBe("INTEGRATION_TEST_INSERT");
      createdAuditLogId = log.id;
    });

    it("should REJECT UPDATE on audit_logs at database level via trigger", async () => {
      expect(createdAuditLogId).toBeDefined();

      let errorThrown = false;
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE audit_logs SET action = 'TAMPERED' WHERE id = '${createdAuditLogId}'::uuid`
        );
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toMatch(/IMMUTABLE TABLE VIOLATION/);
        expect(err.message).toMatch(/UPDATE operations are not permitted on table "audit_logs"/);
      }

      expect(errorThrown).toBe(true);

      // Verify action was NOT modified
      const log = await prisma.auditLog.findUnique({ where: { id: createdAuditLogId } });
      expect(log?.action).toBe("INTEGRATION_TEST_INSERT");
    });

    it("should REJECT DELETE on audit_logs at database level via trigger", async () => {
      expect(createdAuditLogId).toBeDefined();

      let errorThrown = false;
      try {
        await prisma.$executeRawUnsafe(
          `DELETE FROM audit_logs WHERE id = '${createdAuditLogId}'::uuid`
        );
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toMatch(/IMMUTABLE TABLE VIOLATION/);
        expect(err.message).toMatch(/DELETE operations are not permitted on table "audit_logs"/);
      }

      expect(errorThrown).toBe(true);

      // Verify row still exists
      const log = await prisma.auditLog.findUnique({ where: { id: createdAuditLogId } });
      expect(log).not.toBeNull();
    });
  });

  describe("2. PostgreSQL Immutability Triggers for score_history", () => {
    let createdHistoryId: string;

    it("should allow INSERT into score_history", async () => {
      // First ensure a score_entry exists for testing
      let scoreEntry = await prisma.scoreEntry.findUnique({
        where: {
          roundId_participantId: {
            roundId: testRoundId,
            participantId: testParticipantId,
          },
        },
      });

      if (!scoreEntry) {
        scoreEntry = await prisma.scoreEntry.create({
          data: {
            roundId: testRoundId,
            participantId: testParticipantId,
            role: PlayerRole.CREWMATE,
            tasksCompleted: 4,
            totalScore: 4,
            enteredById: adminUserId,
          },
        });
      }
      testScoreEntryId = scoreEntry.id;

      const history = await prisma.scoreHistory.create({
        data: {
          scoreEntryId: scoreEntry.id,
          version: 1,
          newTotalScore: 4,
          newValues: { role: "CREWMATE", tasksCompleted: 4 },
          changedById: adminUserId,
          reason: "Initial test entry",
        },
      });

      expect(history).toBeDefined();
      expect(history.id).toBeDefined();
      createdHistoryId = history.id;
    });

    it("should REJECT UPDATE on score_history at database level via trigger", async () => {
      expect(createdHistoryId).toBeDefined();

      let errorThrown = false;
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE score_history SET new_total_score = 999 WHERE id = '${createdHistoryId}'::uuid`
        );
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toMatch(/IMMUTABLE TABLE VIOLATION/);
        expect(err.message).toMatch(/UPDATE operations are not permitted on table "score_history"/);
      }

      expect(errorThrown).toBe(true);

      // Verify total score was NOT modified
      const history = await prisma.scoreHistory.findUnique({ where: { id: createdHistoryId } });
      expect(history?.newTotalScore).toBe(4);
    });

    it("should REJECT DELETE on score_history at database level via trigger", async () => {
      expect(createdHistoryId).toBeDefined();

      let errorThrown = false;
      try {
        await prisma.$executeRawUnsafe(
          `DELETE FROM score_history WHERE id = '${createdHistoryId}'::uuid`
        );
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toMatch(/IMMUTABLE TABLE VIOLATION/);
        expect(err.message).toMatch(/DELETE operations are not permitted on table "score_history"/);
      }

      expect(errorThrown).toBe(true);

      // Verify row still exists
      const history = await prisma.scoreHistory.findUnique({ where: { id: createdHistoryId } });
      expect(history).not.toBeNull();
    });
  });

  describe("3. Database Constraints & Integrity", () => {
    it("should enforce UNIQUE(round_id, participant_id) on score_entries", async () => {
      // testScoreEntryId already exists for (testRoundId, testParticipantId)
      expect(testScoreEntryId).toBeDefined();

      let duplicateError = false;
      try {
        await prisma.scoreEntry.create({
          data: {
            roundId: testRoundId,
            participantId: testParticipantId,
            role: PlayerRole.IMPOSTER,
            totalScore: 5,
            enteredById: adminUserId,
          },
        });
      } catch (err: any) {
        duplicateError = true;
        expect(err.code).toBe("P2002"); // Prisma unique constraint violation code
      }

      expect(duplicateError).toBe(true);
    });

    it("should enforce check constraint on tasks_completed >= 0", async () => {
      let checkError = false;
      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO score_entries (
            id, round_id, participant_id, role, tasks_completed, total_score, entered_by, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), '${testRoundId}'::uuid,
            (SELECT id FROM participants WHERE participant_id = 'P002'),
            'CREWMATE', -1, 0, '${adminUserId}'::uuid, now(), now()
          )
        `);
      } catch (err: any) {
        checkError = true;
        expect(err.message).toMatch(/chk_tasks_completed_non_negative/);
      }

      expect(checkError).toBe(true);
    });

    it("should enforce check constraint on successful_elimination >= 0", async () => {
      let checkError = false;
      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO score_entries (
            id, round_id, participant_id, role, successful_elimination, total_score, entered_by, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), '${testRoundId}'::uuid,
            (SELECT id FROM participants WHERE participant_id = 'P003'),
            'IMPOSTER', -5, 0, '${adminUserId}'::uuid, now(), now()
          )
        `);
      } catch (err: any) {
        checkError = true;
        expect(err.message).toMatch(/chk_successful_elimination_non_negative/);
      }

      expect(checkError).toBe(true);
    });

    it("should enforce event_settings singleton with final_score_formula = NULL", async () => {
      const settings = await prisma.eventSetting.findFirst();
      expect(settings).not.toBeNull();
      expect(settings?.eventName).toBe("AMONG US: LIVE DEDUCTION");
      expect(settings?.finalScoreFormula).toBeNull();
      expect(settings?.resultsPublished).toBe(false);
      expect(settings?.resultsLocked).toBe(false);
      expect(Number(settings?.qualificationCount)).toBe(8);
      expect(settings?.isSingleton).toBe(true);
    });

    it("should REJECT creating a second event_settings row via Prisma due to unique singleton constraint", async () => {
      let duplicateError = false;
      try {
        await prisma.eventSetting.create({
          data: {
            eventName: "DUPLICATE EVENT ATTEMPT",
            eventStatus: EventStatus.NOT_STARTED,
          },
        });
      } catch (err: any) {
        duplicateError = true;
        expect(err.code).toBe("P2002"); // Unique constraint failed
        expect(err.meta?.target).toContain("is_singleton");
      }

      expect(duplicateError).toBe(true);
    });

    it("should REJECT creating a second event_settings row via raw SQL due to unique index", async () => {
      let sqlError = false;
      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO event_settings (
            id, event_name, event_status, is_singleton, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), 'DUPLICATE VIA RAW SQL', 'NOT_STARTED', true, now(), now()
          )
        `);
      } catch (err: any) {
        sqlError = true;
        expect(err.message).toMatch(/Key \(is_singleton\)=\(t\) already exists|23505/);
      }

      expect(sqlError).toBe(true);
    });

    it("should REJECT creating an event_settings row with is_singleton = false due to check constraint", async () => {
      let checkError = false;
      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO event_settings (
            id, event_name, event_status, is_singleton, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), 'INVALID SINGLETON FALSE', 'NOT_STARTED', false, now(), now()
          )
        `);
      } catch (err: any) {
        checkError = true;
        expect(err.message).toMatch(/chk_event_settings_is_singleton/);
      }

      expect(checkError).toBe(true);
    });

    it("should enforce RESTRICT foreign key: cannot delete round that has scores", async () => {
      let deleteError = false;
      try {
        await prisma.round.delete({
          where: { id: testRoundId },
        });
      } catch (err: any) {
        deleteError = true;
        // P2003 or foreign key constraint violation
        expect(["P2003", "P2014"]).toContain(err.code);
      }

      expect(deleteError).toBe(true);
    });

    it("should support archiving rounds and creating new rounds with the same number for a new run", async () => {
      // Archive test round
      const archiveRound = await prisma.round.create({
        data: {
          name: "Temporary Test Round",
          roundNumber: 99,
          type: RoundType.PRELIMINARY,
          status: RoundStatus.COMPLETED,
          isArchived: true, // Archived
        },
      });

      // Now we should be able to create a new active round with roundNumber: 99 without conflict
      const newActiveRound = await prisma.round.create({
        data: {
          name: "Fresh Run Round 99",
          roundNumber: 99,
          type: RoundType.PRELIMINARY,
          status: RoundStatus.UPCOMING,
          isArchived: false,
        },
      });

      expect(newActiveRound).toBeDefined();
      expect(newActiveRound.roundNumber).toBe(99);
      expect(newActiveRound.isArchived).toBe(false);

      // Clean up test rounds
      await prisma.round.delete({ where: { id: newActiveRound.id } });
      await prisma.round.delete({ where: { id: archiveRound.id } });
    });

    it("should allow a new event run to accept fresh scores for the same participant after archiving old round without violating UNIQUE(round_id, participant_id), while historical scores remain intact", async () => {
      // 1. Participant P005 has a score in Round 1
      const p5 = await prisma.participant.findFirst({ where: { participantId: "P005" } });
      expect(p5).not.toBeNull();

      // Create initial round and score
      const run1Round = await prisma.round.create({
        data: {
          name: "Run 1 Prelim",
          roundNumber: 88,
          type: RoundType.PRELIMINARY,
          status: RoundStatus.COMPLETED,
          isArchived: false,
        },
      });

      const run1Score = await prisma.scoreEntry.create({
        data: {
          roundId: run1Round.id,
          participantId: p5!.id,
          role: PlayerRole.CREWMATE,
          tasksCompleted: 3,
          totalScore: 3,
          enteredById: adminUserId,
        },
      });

      // 2. Admin prepares new run by archiving Run 1 round
      await prisma.round.update({
        where: { id: run1Round.id },
        data: { isArchived: true },
      });

      // 3. Admin creates new round for Run 2 with new UUID
      const run2Round = await prisma.round.create({
        data: {
          name: "Run 2 Prelim",
          roundNumber: 88,
          type: RoundType.PRELIMINARY,
          status: RoundStatus.SCORING,
          isArchived: false,
        },
      });

      // 4. Score entry for P005 in Run 2 round succeeds without UNIQUE violation
      const run2Score = await prisma.scoreEntry.create({
        data: {
          roundId: run2Round.id,
          participantId: p5!.id,
          role: PlayerRole.IMPOSTER,
          successfulElimination: 2,
          totalScore: 4,
          enteredById: adminUserId,
        },
      });

      expect(run2Score).toBeDefined();
      expect(run2Score.id).not.toBe(run1Score.id);
      expect(run2Score.roundId).toBe(run2Round.id);
      expect(run2Score.totalScore).toBe(4);

      // 5. Verify Run 1 score still exists untouched
      const historicalScore = await prisma.scoreEntry.findUnique({
        where: { id: run1Score.id },
      });
      expect(historicalScore).not.toBeNull();
      expect(historicalScore?.roundId).toBe(run1Round.id);
      expect(historicalScore?.totalScore).toBe(3);

      // Clean up test scores and rounds
      await prisma.scoreEntry.delete({ where: { id: run2Score.id } });
      await prisma.round.delete({ where: { id: run2Round.id } });
      await prisma.scoreEntry.delete({ where: { id: run1Score.id } });
      await prisma.round.delete({ where: { id: run1Round.id } });
    });
  });
});
