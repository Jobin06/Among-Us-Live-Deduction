import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { AuditService } from "@/services/audit.service";
import { LeaderboardService } from "@/services/leaderboard.service";
import {
  RoundStatus,
  RoundType,
  LobbyStatus,
  ParticipantStatus,
} from "@prisma/client";
import {
  CreateRoundInput,
  UpdateRoundInput,
  CreateLobbyInput,
  UpdateLobbyInput,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from "@/validation/admin.schema";

export class AdminService {
  /**
   * Retrieves high-level operational statistics for the Admin Dashboard.
   */
  public static async getStats() {
    const eventSettings = await prisma.eventSetting.findFirst();

    const totalParticipants = await prisma.participant.count({
      where: { status: ParticipantStatus.ACTIVE },
    });

    const activeRound = await prisma.round.findFirst({
      where: {
        isArchived: false,
        status: { in: [RoundStatus.ACTIVE, RoundStatus.SCORING] },
      },
      orderBy: { roundNumber: "asc" },
      select: {
        id: true,
        name: true,
        roundNumber: true,
        type: true,
        status: true,
        scoreLocked: true,
      },
    });

    let participantsScored = 0;
    if (activeRound) {
      participantsScored = await prisma.scoreEntry.count({
        where: { roundId: activeRound.id },
      });
    }

    const leaderboard = await LeaderboardService.getLeaderboardData();
    const currentLeader = leaderboard.entries.length > 0 ? leaderboard.entries[0] : null;

    const lobbiesCount = await prisma.lobby.count({
      where: { status: LobbyStatus.ACTIVE },
    });

    const volunteersCount = await prisma.volunteer.count({
      where: { user: { isActive: true } },
    });

    const roundsCount = await prisma.round.count({
      where: { isArchived: false },
    });

    return {
      totalParticipants,
      activeRound: activeRound ?? null,
      participantsScored,
      participantsPending: Math.max(0, totalParticipants - participantsScored),
      currentLeader: currentLeader
        ? {
            participantId: currentLeader.participantId,
            name: currentLeader.name,
            totalScore: currentLeader.totalScore,
          }
        : null,
      lobbiesCount,
      volunteersCount,
      roundsCount,
      isFormulaConfigured: Boolean(eventSettings?.finalScoreFormula),
      finalScoreFormula: eventSettings?.finalScoreFormula ?? null,
      eventStatus: eventSettings?.eventStatus ?? "NOT_STARTED",
    };
  }

  /**
   * Retrieves rounds. Defaults to active unarchived rounds unless includeArchived is true.
   */
  public static async getRounds(includeArchived = false) {
    return await prisma.round.findMany({
      where: includeArchived ? undefined : { isArchived: false },
      include: {
        _count: {
          select: {
            roundParticipants: true,
            scoreEntries: true,
            volunteerAssignments: true,
          },
        },
      },
      orderBy: { roundNumber: "asc" },
    });
  }

  /**
   * Creates a new round in the active run.
   */
  public static async createRound(
    input: CreateRoundInput,
    adminUserId: string,
    ipAddress?: string
  ) {
    const existing = await prisma.round.findFirst({
      where: {
        roundNumber: input.roundNumber,
        isArchived: false,
      },
    });
    if (existing) {
      throw ApiError.badRequest(`Active round number ${input.roundNumber} already exists.`);
    }

    const round = await prisma.round.create({
      data: {
        name: input.name,
        roundNumber: input.roundNumber,
        type: input.type,
        status: input.status,
        startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
        endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      },
    });

    await AuditService.log({
      userId: adminUserId,
      action: "ROUND_CREATED",
      entityType: "ROUND",
      entityId: round.id,
      newValue: {
        name: round.name,
        roundNumber: round.roundNumber,
        type: round.type,
        status: round.status,
      },
      reason: "Admin created new tournament round",
      ipAddress,
    });

    LeaderboardService.notifyUpdate();
    return round;
  }

  /**
   * Updates round status, scoreLocked, or schedule.
   * Archived rounds are strictly immutable.
   */
  public static async updateRound(
    id: string,
    input: UpdateRoundInput,
    adminUserId: string,
    ipAddress?: string
  ) {
    const round = await prisma.round.findUnique({ where: { id } });
    if (!round) {
      throw ApiError.notFound("Round not found.");
    }

    if (round.isArchived) {
      throw ApiError.badRequest("Cannot modify archived historical rounds.");
    }

    const updated = await prisma.round.update({
      where: { id },
      data: {
        name: input.name,
        status: input.status,
        scoreLocked: input.scoreLocked,
        startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
        endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      },
    });

    let action = "ROUND_UPDATED";
    if (input.scoreLocked !== undefined && input.scoreLocked !== round.scoreLocked) {
      action = input.scoreLocked ? "ROUND_SCORE_LOCKED" : "ROUND_SCORE_UNLOCKED";
    }

    await AuditService.log({
      userId: adminUserId,
      action,
      entityType: "ROUND",
      entityId: id,
      oldValue: {
        status: round.status,
        scoreLocked: round.scoreLocked,
        name: round.name,
      },
      newValue: {
        status: updated.status,
        scoreLocked: updated.scoreLocked,
        name: updated.name,
      },
      reason: `Admin updated round ${round.name}`,
      ipAddress,
    });

    LeaderboardService.notifyUpdate();
    return updated;
  }

  /**
   * Retrieves lobbies with participant and assignment counts.
   */
  public static async getLobbies() {
    return await prisma.lobby.findMany({
      include: {
        _count: {
          select: {
            participants: true,
            roundParticipants: true,
            volunteerAssignments: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Creates a new lobby.
   */
  public static async createLobby(
    input: CreateLobbyInput,
    adminUserId: string,
    ipAddress?: string
  ) {
    if (input.capacity !== undefined && input.capacity !== null && input.capacity <= 0) {
      throw ApiError.badRequest("Lobby capacity must be a positive integer.");
    }

    const existing = await prisma.lobby.findUnique({
      where: { name: input.name },
    });
    if (existing) {
      throw ApiError.badRequest(`Lobby with name "${input.name}" already exists.`);
    }

    const lobby = await prisma.lobby.create({
      data: {
        name: input.name,
        type: input.type,
        capacity: input.capacity,
      },
    });

    await AuditService.log({
      userId: adminUserId,
      action: "LOBBY_CREATED",
      entityType: "LOBBY",
      entityId: lobby.id,
      newValue: { name: lobby.name, type: lobby.type, capacity: lobby.capacity },
      reason: "Admin created new lobby",
      ipAddress,
    });

    return lobby;
  }

  /**
   * Updates an existing lobby.
   */
  public static async updateLobby(
    id: string,
    input: UpdateLobbyInput,
    adminUserId: string,
    ipAddress?: string
  ) {
    const lobby = await prisma.lobby.findUnique({ where: { id } });
    if (!lobby) {
      throw ApiError.notFound("Lobby not found.");
    }

    if (input.name && input.name !== lobby.name) {
      const duplicate = await prisma.lobby.findUnique({ where: { name: input.name } });
      if (duplicate) {
        throw ApiError.badRequest(`Lobby with name "${input.name}" already exists.`);
      }
    }

    const updated = await prisma.lobby.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        capacity: input.capacity,
        status: input.status,
      },
    });

    await AuditService.log({
      userId: adminUserId,
      action: "LOBBY_UPDATED",
      entityType: "LOBBY",
      entityId: id,
      oldValue: { name: lobby.name, status: lobby.status, capacity: lobby.capacity },
      newValue: { name: updated.name, status: updated.status, capacity: updated.capacity },
      reason: `Admin updated lobby ${lobby.name}`,
      ipAddress,
    });

    return updated;
  }

  /**
   * Retrieves active volunteers for admin assignment interfaces.
   */
  public static async getVolunteers() {
    return await prisma.volunteer.findMany({
      where: {
        user: { isActive: true },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            assignments: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Creates a new tournament announcement.
   */
  public static async createAnnouncement(
    input: CreateAnnouncementInput,
    adminUserId: string,
    ipAddress?: string
  ) {
    const announcement = await prisma.announcement.create({
      data: {
        title: input.title,
        message: input.message,
        priority: input.priority,
        isActive: input.isActive,
        createdById: adminUserId,
      },
    });

    await AuditService.log({
      userId: adminUserId,
      action: "ANNOUNCEMENT_CREATED",
      entityType: "ANNOUNCEMENT",
      entityId: announcement.id,
      newValue: {
        title: announcement.title,
        priority: announcement.priority,
        isActive: announcement.isActive,
      },
      reason: "Admin posted tournament announcement",
      ipAddress,
    });

    return announcement;
  }

  /**
   * Updates an announcement.
   */
  public static async updateAnnouncement(
    id: string,
    input: UpdateAnnouncementInput,
    adminUserId: string,
    ipAddress?: string
  ) {
    const announcement = await prisma.announcement.findUnique({ where: { id } });
    if (!announcement) {
      throw ApiError.notFound("Announcement not found.");
    }

    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        title: input.title,
        message: input.message,
        priority: input.priority,
        isActive: input.isActive,
      },
    });

    await AuditService.log({
      userId: adminUserId,
      action: "ANNOUNCEMENT_UPDATED",
      entityType: "ANNOUNCEMENT",
      entityId: id,
      oldValue: {
        title: announcement.title,
        priority: announcement.priority,
        isActive: announcement.isActive,
      },
      newValue: {
        title: updated.title,
        priority: updated.priority,
        isActive: updated.isActive,
      },
      reason: `Admin updated announcement "${announcement.title}"`,
      ipAddress,
    });

    return updated;
  }

  /**
   * Soft-deactivates an announcement (isActive = false).
   * Preserves historical announcement records in the database.
   */
  public static async softDeactivateAnnouncement(
    id: string,
    adminUserId: string,
    ipAddress?: string
  ) {
    const announcement = await prisma.announcement.findUnique({ where: { id } });
    if (!announcement) {
      throw ApiError.notFound("Announcement not found.");
    }

    const updated = await prisma.announcement.update({
      where: { id },
      data: { isActive: false },
    });

    await AuditService.log({
      userId: adminUserId,
      action: "ANNOUNCEMENT_DEACTIVATED",
      entityType: "ANNOUNCEMENT",
      entityId: id,
      oldValue: { isActive: true },
      newValue: { isActive: false },
      reason: `Admin deactivated announcement "${announcement.title}"`,
      ipAddress,
    });

    return updated;
  }

  /**
   * Retrieves all announcements for admin management.
   */
  public static async getAllAnnouncements() {
    return await prisma.announcement.findMany({
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });
  }
}
