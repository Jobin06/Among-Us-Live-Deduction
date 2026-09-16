import { PrismaClient, UserRole, ParticipantStatus, LobbyType, RoundType, RoundStatus, RuleRole, RuleFieldType, EventStatus, TieBreakMethod } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seed...");

  // Password hash for all demo accounts (using 10 rounds for speedy seeding in dev/tests)
  const defaultPasswordHash = await bcrypt.hash("password123", 10);
  const adminPasswordHash = await bcrypt.hash("adminpassword123", 10);

  // 1. Create Admin User
  const adminUser = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });
  console.log("✓ Admin user ready:", adminUser.username);

  // 2. Create Event Settings Singleton (with final_score_formula = NULL)
  const existingSettings = await prisma.eventSetting.findFirst();
  if (!existingSettings) {
    await prisma.eventSetting.create({
      data: {
        eventName: "AMONG US: LIVE DEDUCTION",
        eventDescription: "University live deduction e-sports championship tournament.",
        eventStatus: EventStatus.NOT_STARTED,
        venue: "Main Campus E-Sports Arena",
        eventStart: "09:00",
        eventEnd: "12:00",
        qualificationCount: 8,
        finalScoreFormula: null, // CRITICAL: null by default per REQUIREMENTS.md §18
        preliminaryWeight: 1.0,
        finalWeight: 1.0,
        resultsPublished: false,
        resultsLocked: false,
        tieBreakMethod: TieBreakMethod.ADMIN_DECISION,
      },
    });
    console.log("✓ Event settings singleton created (finalScoreFormula = null)");
  }

  // 3. Create Lobbies (4 Preliminary + 1 Final)
  const lobbyNames = [
    { name: "Lobby A", type: LobbyType.PRELIMINARY, capacity: 10 },
    { name: "Lobby B", type: LobbyType.PRELIMINARY, capacity: 10 },
    { name: "Lobby C", type: LobbyType.PRELIMINARY, capacity: 10 },
    { name: "Lobby D", type: LobbyType.PRELIMINARY, capacity: 10 },
    { name: "Final Lobby", type: LobbyType.FINAL, capacity: 10 },
  ];

  const lobbies: Record<string, string> = {};
  for (const lob of lobbyNames) {
    const record = await prisma.lobby.upsert({
      where: { name: lob.name },
      update: { type: lob.type, capacity: lob.capacity },
      create: {
        name: lob.name,
        type: lob.type,
        capacity: lob.capacity,
      },
    });
    lobbies[lob.name] = record.id;
  }
  console.log("✓ 5 Lobbies ready (4 Preliminary, 1 Final)");

  // 4. Create 3 Volunteers
  const volunteerData = [
    { username: "volunteer1", name: "Volunteer Alice" },
    { username: "volunteer2", name: "Volunteer Bob" },
    { username: "volunteer3", name: "Volunteer Charlie" },
  ];

  const volunteerIds: string[] = [];
  for (const v of volunteerData) {
    const user = await prisma.user.upsert({
      where: { username: v.username },
      update: {},
      create: {
        username: v.username,
        passwordHash: defaultPasswordHash,
        role: UserRole.VOLUNTEER,
        isActive: true,
      },
    });

    const volProfile = await prisma.volunteer.upsert({
      where: { userId: user.id },
      update: { name: v.name },
      create: {
        userId: user.id,
        name: v.name,
      },
    });

    volunteerIds.push(volProfile.id);
  }
  console.log("✓ 3 Volunteers ready");

  // 5. Create 40 Participants (P001 to P040)
  const participantLobbyKeys = ["Lobby A", "Lobby B", "Lobby C", "Lobby D"];
  const participantIds: { id: string; participantId: string; lobbyId: string }[] = [];

  for (let i = 1; i <= 40; i++) {
    const pId = `P${i.toString().padStart(3, "0")}`;
    const lobbyKey = participantLobbyKeys[Math.floor((i - 1) / 10)];
    const assignedLobbyId = lobbies[lobbyKey];

    const user = await prisma.user.upsert({
      where: { username: pId },
      update: {},
      create: {
        username: pId,
        passwordHash: defaultPasswordHash,
        role: UserRole.PARTICIPANT,
        isActive: true,
      },
    });

    const participant = await prisma.participant.upsert({
      where: { participantId: pId },
      update: {
        name: `Cadet ${pId}`,
        amongUsUsername: `Astronaut_${i}`,
        lobbyId: assignedLobbyId,
        status: ParticipantStatus.ACTIVE,
      },
      create: {
        userId: user.id,
        participantId: pId,
        name: `Cadet ${pId}`,
        amongUsUsername: `Astronaut_${i}`,
        lobbyId: assignedLobbyId,
        status: ParticipantStatus.ACTIVE,
      },
    });

    participantIds.push({
      id: participant.id,
      participantId: participant.participantId,
      lobbyId: assignedLobbyId,
    });
  }
  console.log("✓ 40 Participants ready (10 per preliminary lobby)");

  // 6. Create Initial Rounds
  const roundDefinitions = [
    { name: "Practice Round", roundNumber: 1, type: RoundType.PRACTICE, status: RoundStatus.UPCOMING },
    { name: "Preliminary Round 1", roundNumber: 1, type: RoundType.PRELIMINARY, status: RoundStatus.UPCOMING },
    { name: "Preliminary Round 2", roundNumber: 2, type: RoundType.PRELIMINARY, status: RoundStatus.UPCOMING },
    { name: "Preliminary Round 3", roundNumber: 3, type: RoundType.PRELIMINARY, status: RoundStatus.UPCOMING },
    { name: "Final Round 1", roundNumber: 1, type: RoundType.FINAL, status: RoundStatus.UPCOMING },
  ];

  const createdRounds: Record<string, string> = {};
  for (const rd of roundDefinitions) {
    const existing = await prisma.round.findFirst({
      where: { type: rd.type, roundNumber: rd.roundNumber, isArchived: false },
    });

    if (existing) {
      createdRounds[rd.name] = existing.id;
    } else {
      const created = await prisma.round.create({
        data: {
          name: rd.name,
          roundNumber: rd.roundNumber,
          type: rd.type,
          status: rd.status,
          isArchived: false,
        },
      });
      createdRounds[rd.name] = created.id;
    }
  }
  console.log("✓ 5 Event rounds ready (1 practice, 3 preliminary, 1 final)");

  // 7. Create Round Participants for Preliminary Round 1
  const prelim1Id = createdRounds["Preliminary Round 1"];
  if (prelim1Id) {
    for (const p of participantIds) {
      await prisma.roundParticipant.upsert({
        where: {
          roundId_participantId: {
            roundId: prelim1Id,
            participantId: p.id,
          },
        },
        update: { lobbyId: p.lobbyId },
        create: {
          roundId: prelim1Id,
          participantId: p.id,
          lobbyId: p.lobbyId,
        },
      });
    }
    console.log("✓ 40 Round participants mapped to Preliminary Round 1");
  }

  // 8. Create Volunteer Assignments for Preliminary Round 1
  if (prelim1Id && volunteerIds.length >= 3) {
    const assignments = [
      { volIdx: 0, lobby: "Lobby A" },
      { volIdx: 0, lobby: "Lobby B" }, // Alice assigned to A & B
      { volIdx: 1, lobby: "Lobby C" }, // Bob assigned to C
      { volIdx: 2, lobby: "Lobby D" }, // Charlie assigned to D
    ];

    for (const a of assignments) {
      const volId = volunteerIds[a.volIdx];
      const lobId = lobbies[a.lobby];
      await prisma.volunteerAssignment.upsert({
        where: {
          volunteerId_roundId_lobbyId: {
            volunteerId: volId,
            roundId: prelim1Id,
            lobbyId: lobId,
          },
        },
        update: {},
        create: {
          volunteerId: volId,
          roundId: prelim1Id,
          lobbyId: lobId,
          assignedById: adminUser.id,
        },
      });
    }
    console.log("✓ Volunteer assignments created for Preliminary Round 1");
  }

  // 9. Create Scoring Rules
  const scoringRules = [
    { ruleKey: "correct_vote", ruleName: "Correctly vote out an Imposter", points: 3, applicableRole: RuleRole.ANY, fieldType: RuleFieldType.BOOLEAN, sortOrder: 1 },
    { ruleKey: "correct_identification", ruleName: "Correctly identify an Imposter", points: 1, applicableRole: RuleRole.ANY, fieldType: RuleFieldType.BOOLEAN, sortOrder: 2 },
    { ruleKey: "task_completed", ruleName: "Complete a task", points: 1, applicableRole: RuleRole.CREWMATE, fieldType: RuleFieldType.INTEGER, sortOrder: 3 },
    { ruleKey: "survived", ruleName: "Survive the round", points: 2, applicableRole: RuleRole.ANY, fieldType: RuleFieldType.BOOLEAN, sortOrder: 4 },
    { ruleKey: "won_as_crewmate", ruleName: "Win as a Crewmate", points: 3, applicableRole: RuleRole.CREWMATE, fieldType: RuleFieldType.BOOLEAN, sortOrder: 5 },
    { ruleKey: "won_as_imposter", ruleName: "Win as an Imposter", points: 5, applicableRole: RuleRole.IMPOSTER, fieldType: RuleFieldType.BOOLEAN, sortOrder: 6 },
    { ruleKey: "successful_elimination", ruleName: "Successful elimination as Imposter", points: 2, applicableRole: RuleRole.IMPOSTER, fieldType: RuleFieldType.INTEGER, sortOrder: 7 },
    { ruleKey: "avoided_identification", ruleName: "Avoid being identified as Imposter", points: 3, applicableRole: RuleRole.IMPOSTER, fieldType: RuleFieldType.BOOLEAN, sortOrder: 8 },
    { ruleKey: "voted_out_as_imposter", ruleName: "Voted out as Imposter", points: -2, applicableRole: RuleRole.IMPOSTER, fieldType: RuleFieldType.BOOLEAN, sortOrder: 9 },
  ];

  for (const r of scoringRules) {
    await prisma.scoringRule.upsert({
      where: { ruleKey: r.ruleKey },
      update: {
        ruleName: r.ruleName,
        points: r.points,
        applicableRole: r.applicableRole,
        fieldType: r.fieldType,
        sortOrder: r.sortOrder,
      },
      create: r,
    });
  }
  console.log("✓ 9 Scoring rules seeded");

  // 10. Create Schedule Items
  const schedule = [
    { name: "Registration", startTime: "09:00", endTime: "09:15", sortOrder: 1 },
    { name: "Briefing", startTime: "09:15", endTime: "09:30", sortOrder: 2 },
    { name: "Practice Round", startTime: "09:30", endTime: "09:45", sortOrder: 3 },
    { name: "Preliminary Round 1", startTime: "09:45", endTime: "10:05", sortOrder: 4 },
    { name: "Preliminary Round 2", startTime: "10:10", endTime: "10:30", sortOrder: 5 },
    { name: "Preliminary Round 3", startTime: "10:35", endTime: "10:55", sortOrder: 6 },
    { name: "Preliminary Results", startTime: "10:55", endTime: "11:05", sortOrder: 7 },
    { name: "Final", startTime: "11:05", endTime: "11:40", sortOrder: 8 },
    { name: "Final Results", startTime: "11:40", endTime: "11:50", sortOrder: 9 },
    { name: "Prize Distribution", startTime: "11:50", endTime: "12:00", sortOrder: 10 },
  ];

  for (const s of schedule) {
    await prisma.scheduleItem.upsert({
      where: { sortOrder: s.sortOrder },
      update: { name: s.name, startTime: s.startTime, endTime: s.endTime },
      create: s,
    });
  }
  console.log("✓ 10 Schedule items seeded");

  // 11. Initial Announcement
  const announcementCount = await prisma.announcement.count();
  if (announcementCount === 0) {
    await prisma.announcement.create({
      data: {
        title: "Welcome to Among Us: Live Deduction!",
        message: "Registration is open. Please check your assigned lobby on your dashboard and report to your station.",
        isActive: true,
        priority: 1,
        createdById: adminUser.id,
      },
    });
    console.log("✓ Welcome announcement seeded");
  }

  // 12. Initial Audit Log
  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: "DATABASE_SEEDED",
      entityType: "SYSTEM",
      newValue: {
        participantsCount: 40,
        lobbiesCount: 5,
        volunteersCount: 3,
        roundsCount: 5,
      },
      reason: "Initial database seed execution",
    },
  });
  console.log("✓ Initial system audit log created (append-only)");

  console.log("\nDatabase seed completed successfully! 🚀");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
