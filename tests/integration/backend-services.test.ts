import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, UserRole, EventStatus } from "@prisma/client";
import { EventService } from "@/services/event.service";
import { AuditService } from "@/services/audit.service";
import { VolunteerAssignmentService } from "@/services/volunteer-assignment.service";
import { ApiError } from "@/lib/api-helpers";

const prisma = new PrismaClient();

describe("Consolidated Phase 2 — Backend Services & API Foundation", () => {
  let adminUser: any;
  let volunteer2User: any;
  let volunteer3User: any;
  let round1: any;
  let round2: any;
  let lobbyA: any;
  let lobbyB: any;
  let createdAssignmentId: string;

  beforeAll(async () => {
    // Ensure baseline seed rounds are active and unarchived
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
            data: { isArchived: false },
          });
        }
      }
    }

    adminUser = await prisma.user.findUnique({ where: { username: "admin" } });
    volunteer2User = await prisma.user.findUnique({
      where: { username: "volunteer2" },
      include: { volunteer: true },
    });
    volunteer3User = await prisma.user.findUnique({
      where: { username: "volunteer3" },
      include: { volunteer: true },
    });

    round1 = await prisma.round.findFirst({
      where: { name: "Preliminary Round 1", isArchived: false },
    });
    round2 = await prisma.round.findFirst({
      where: { name: "Preliminary Round 2", isArchived: false },
    });
    lobbyA = await prisma.lobby.findUnique({ where: { name: "Lobby A" } });
    lobbyB = await prisma.lobby.findUnique({ where: { name: "Lobby B" } });
  });

  afterAll(async () => {
    // Clean up any test assignments if still present
    if (createdAssignmentId) {
      try {
        await prisma.volunteerAssignment.delete({ where: { id: createdAssignmentId } });
      } catch {
        // Ignored
      }
    }

    // Restore baseline seed rounds to active unarchived state
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
            data: { isArchived: false },
          });
        }
      }
    }

    // Restore baseline event settings
    await prisma.eventSetting.updateMany({
      data: {
        eventName: "AMONG US: LIVE DEDUCTION",
        eventStatus: EventStatus.NOT_STARTED,
        venue: "Main Stage / Discord Arena",
        finalScoreFormula: null,
        preliminaryWeight: 1.0,
        finalWeight: 1.0,
        resultsPublished: false,
        resultsLocked: false,
      },
    });

    await prisma.$disconnect();
  });

  describe("1. Audit Service (Append-Only)", () => {
    let createdAuditId: string;

    it("should log actions to the audit_logs table", async () => {
      const log = await AuditService.log({
        userId: adminUser.id,
        action: "TEST_BACKEND_ACTION",
        entityType: "TEST_ENTITY",
        reason: "Testing AuditService.log",
        newValue: { testKey: "testValue" },
      });

      expect(log).toBeDefined();
      expect(log.id).toBeDefined();
      expect(log.action).toBe("TEST_BACKEND_ACTION");
      createdAuditId = log.id;
    });

    it("should query paginated audit logs", async () => {
      const result = await AuditService.getLogs({
        action: "TEST_BACKEND_ACTION",
        page: 1,
        limit: 10,
      });

      expect(result.logs.length).toBeGreaterThanOrEqual(1);
      expect(result.pagination.total).toBeGreaterThanOrEqual(1);
      const found = result.logs.find((l) => l.id === createdAuditId);
      expect(found).toBeDefined();
    });

    it("should fetch a single audit log by ID", async () => {
      const log = await AuditService.getLogById(createdAuditId);
      expect(log).not.toBeNull();
      expect(log?.id).toBe(createdAuditId);
      expect(log?.user.username).toBe("admin");
    });
  });

  describe("2. Event Service & Formula Configuration", () => {
    it("should retrieve event settings singleton", async () => {
      const settings = await EventService.getSettings();
      expect(settings).toBeDefined();
      expect(settings.eventName).toBe("AMONG US: LIVE DEDUCTION");
    });

    it("should block publishing when final_score_formula is null", async () => {
      // Ensure formula is null
      await prisma.eventSetting.updateMany({
        data: { finalScoreFormula: null },
      });

      await expect(EventService.assertCanPublishResults()).rejects.toThrow(
        "final scoring formula is not configured"
      );
    });

    it("should successfully configure final scoring formula as SUM", async () => {
      const updated = await EventService.configureFinalFormula(
        { formula: "SUM", preliminaryWeight: 1.0, finalWeight: 1.0 },
        adminUser.id
      );

      expect(updated.finalScoreFormula).toBe("SUM");

      // Verify formula check now succeeds
      const assertResult = await EventService.assertCanPublishResults();
      expect(assertResult.finalScoreFormula).toBe("SUM");
    });

    it("should successfully configure final scoring formula as WEIGHTED", async () => {
      const updated = await EventService.configureFinalFormula(
        { formula: "WEIGHTED", preliminaryWeight: 0.4, finalWeight: 0.6 },
        adminUser.id
      );

      expect(updated.finalScoreFormula).toBe("WEIGHTED");
      expect(Number(updated.preliminaryWeight)).toBe(0.4);
      expect(Number(updated.finalWeight)).toBe(0.6);
    });

    it("should update event settings and log change to audit trail", async () => {
      const updated = await EventService.updateSettings(
        { venue: "Auditorium Hall B" },
        adminUser.id
      );

      expect(updated.venue).toBe("Auditorium Hall B");

      // Check audit log was written
      const audit = await prisma.auditLog.findFirst({
        where: { action: "EVENT_SETTINGS_UPDATED" },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).not.toBeNull();
      expect(audit?.userId).toBe(adminUser.id);
    });
  });

  describe("3. Volunteer Assignment Service", () => {
    it("should create a new volunteer assignment and log to audit", async () => {
      const assignment = await VolunteerAssignmentService.createAssignment(
        {
          volunteerId: volunteer2User.volunteer.id,
          roundId: round2.id,
          lobbyId: lobbyB.id,
        },
        adminUser.id
      );

      expect(assignment).toBeDefined();
      expect(assignment.id).toBeDefined();
      expect(assignment.volunteerId).toBe(volunteer2User.volunteer.id);
      expect(assignment.roundId).toBe(round2.id);
      expect(assignment.lobbyId).toBe(lobbyB.id);
      createdAssignmentId = assignment.id;

      // Verify scope check returns true
      const isAssigned = await VolunteerAssignmentService.isVolunteerAssigned(
        volunteer2User.volunteer.id,
        round2.id,
        lobbyB.id
      );
      expect(isAssigned).toBe(true);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: { action: "VOLUNTEER_ASSIGNED" },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).not.toBeNull();
    });

    it("should reject duplicate volunteer assignment with 409 Conflict", async () => {
      await expect(
        VolunteerAssignmentService.createAssignment(
          {
            volunteerId: volunteer2User.volunteer.id,
            roundId: round2.id,
            lobbyId: lobbyB.id,
          },
          adminUser.id
        )
      ).rejects.toThrow("already assigned");
    });

    it("should return false for unassigned round/lobby", async () => {
      const isAssigned = await VolunteerAssignmentService.isVolunteerAssigned(
        volunteer3User.volunteer.id,
        round2.id,
        lobbyA.id
      );
      expect(isAssigned).toBe(false);
    });

    it("should reject assigning a volunteer to an archived round", async () => {
      const archivedRound = await prisma.round.create({
        data: {
          name: "Old Archived Round",
          roundNumber: 99,
          type: "PRELIMINARY",
          isArchived: true,
        },
      });

      await expect(
        VolunteerAssignmentService.createAssignment(
          {
            volunteerId: volunteer3User.volunteer.id,
            roundId: archivedRound.id,
            lobbyId: lobbyA.id,
          },
          adminUser.id
        )
      ).rejects.toThrow("Cannot assign volunteers to archived rounds");

      await prisma.round.delete({ where: { id: archivedRound.id } });
    });

    it("should remove a volunteer assignment and log to audit", async () => {
      expect(createdAssignmentId).toBeDefined();

      const result = await VolunteerAssignmentService.removeAssignment(
        createdAssignmentId,
        adminUser.id
      );
      expect(result.success).toBe(true);

      // Verify assignment no longer exists
      const exists = await prisma.volunteerAssignment.findUnique({
        where: { id: createdAssignmentId },
      });
      expect(exists).toBeNull();

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: { action: "VOLUNTEER_ASSIGNMENT_REMOVED" },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).not.toBeNull();
    });
  });

  describe("4. Prepare New Event Run Lifecycle", () => {
    it("should archive active rounds, reset event settings, and leave score history untouched", async () => {
      // 1. Create a temporary round and score to verify history survives
      const tempRound = await prisma.round.create({
        data: {
          name: "Active Round For Reset Test",
          roundNumber: 77,
          type: "PRELIMINARY",
          status: "COMPLETED",
          isArchived: false,
        },
      });

      const participant = await prisma.participant.findFirst();
      const tempScore = await prisma.scoreEntry.create({
        data: {
          roundId: tempRound.id,
          participantId: participant!.id,
          role: "CREWMATE",
          totalScore: 5,
          enteredById: adminUser.id,
        },
      });

      const tempHistory = await prisma.scoreHistory.create({
        data: {
          scoreEntryId: tempScore.id,
          version: 1,
          newTotalScore: 5,
          newValues: { totalScore: 5 },
          changedById: adminUser.id,
          reason: "Reset test score history",
        },
      });

      // 2. Execute Prepare New Event Run
      const resetResult = await EventService.prepareNewEventRun(adminUser.id);
      expect(resetResult.success).toBe(true);
      expect(resetResult.archivedRoundsCount).toBeGreaterThan(0);

      // 3. Verify settings reset
      const settings = await EventService.getSettings();
      expect(settings.eventStatus).toBe(EventStatus.NOT_STARTED);
      expect(settings.finalScoreFormula).toBeNull();
      expect(settings.resultsPublished).toBe(false);

      // 4. Verify temp round was archived
      const checkedRound = await prisma.round.findUnique({ where: { id: tempRound.id } });
      expect(checkedRound?.isArchived).toBe(true);

      // 5. Verify historical score and score_history are preserved
      const preservedScore = await prisma.scoreEntry.findUnique({ where: { id: tempScore.id } });
      const preservedHistory = await prisma.scoreHistory.findUnique({ where: { id: tempHistory.id } });
      expect(preservedScore).not.toBeNull();
      expect(preservedHistory).not.toBeNull();

      // 6. Verify audit log entry
      const auditLog = await prisma.auditLog.findFirst({
        where: { action: "EVENT_RESET_FOR_NEW_RUN" },
        orderBy: { createdAt: "desc" },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.userId).toBe(adminUser.id);

      // Clean up temp score and round
      // (Wait: scoreEntry has scoreHistory with RESTRICT, so we delete them or leave in dev db)
      // Since scoreHistory has RESTRICT, deleting scoreEntry directly will be restricted.
      // We can leave it attached to the archived round as historical record!
    });
  });
});
