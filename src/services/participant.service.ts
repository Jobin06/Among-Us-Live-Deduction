import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { RoundType } from "@prisma/client";

export class ParticipantService {
  /**
   * Resolves the primary dashboard data for an authenticated participant user.
   * Derived strictly from the session's userId.
   * Excludes archived rounds and filters cumulative score strictly to preliminary rounds.
   */
  public static async getParticipantDashboardData(userId: string) {
    // 1. Resolve participant record
    const participant = await prisma.participant.findUnique({
      where: { userId },
      select: {
        id: true,
        participantId: true,
        name: true,
        amongUsUsername: true,
        status: true,
        lobby: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        qualification: {
          select: {
            preliminaryScore: true,
            rank: true,
            qualified: true,
          },
        },
      },
    });

    if (!participant) {
      throw ApiError.forbidden("Participant profile not found for this user account");
    }

    // 2. Fetch active event settings
    const eventSettings = await prisma.eventSetting.findFirst({
      select: {
        eventName: true,
        eventStatus: true,
        venue: true,
        eventStart: true,
        eventEnd: true,
        eventDate: true,
        eventDescription: true,
        resultsPublished: true,
      },
    });

    // 3. Fetch active (unarchived) round assignments for this participant
    const roundParticipants = await prisma.roundParticipant.findMany({
      where: {
        participantId: participant.id,
        round: { isArchived: false },
      },
      select: {
        roundId: true,
        lobby: {
          select: {
            id: true,
            name: true,
          },
        },
        round: {
          select: {
            id: true,
            name: true,
            roundNumber: true,
            type: true,
            status: true,
            scoreLocked: true,
          },
        },
      },
      orderBy: {
        round: {
          roundNumber: "asc",
        },
      },
    });

    // 4. Fetch authoritative score entries for this participant (unarchived rounds only)
    const scoreEntries = await prisma.scoreEntry.findMany({
      where: {
        participantId: participant.id,
        round: { isArchived: false },
      },
      select: {
        id: true,
        roundId: true,
        role: true,
        correctVote: true,
        correctIdentification: true,
        tasksCompleted: true,
        survived: true,
        wonAsCrewmate: true,
        wonAsImposter: true,
        successfulElimination: true,
        avoidedIdentification: true,
        votedOutAsImposter: true,
        totalScore: true,
        createdAt: true,
        updatedAt: true,
        history: {
          select: {
            id: true,
          },
        },
        round: {
          select: {
            type: true,
          },
        },
      },
    });

    // Map scores by roundId for quick association
    const scoreMap = new Map<string, (typeof scoreEntries)[0]>();
    for (const score of scoreEntries) {
      scoreMap.set(score.roundId, score);
    }

    // 5. Compute authoritative cumulative score
    // In strict accordance with REQUIREMENTS.md §2 (line 120):
    // Practice rounds DO NOT contribute to leaderboard/cumulative scores.
    // Sum only unarchived PRELIMINARY rounds.
    let cumulativePreliminaryScore = 0;
    for (const s of scoreEntries) {
      if (s.round.type === RoundType.PRELIMINARY) {
        cumulativePreliminaryScore += s.totalScore;
      }
    }

    // Build rounds display list
    const rounds = roundParticipants.map((rp) => {
      const score = scoreMap.get(rp.roundId);
      return {
        roundId: rp.round.id,
        name: rp.round.name,
        roundNumber: rp.round.roundNumber,
        type: rp.round.type,
        status: rp.round.status,
        scoreLocked: rp.round.scoreLocked,
        lobbyName: rp.lobby.name,
        scoreEntry: score
          ? {
              id: score.id,
              role: score.role,
              correctVote: score.correctVote,
              correctIdentification: score.correctIdentification,
              tasksCompleted: score.tasksCompleted,
              survived: score.survived,
              wonAsCrewmate: score.wonAsCrewmate,
              wonAsImposter: score.wonAsImposter,
              successfulElimination: score.successfulElimination,
              avoidedIdentification: score.avoidedIdentification,
              votedOutAsImposter: score.votedOutAsImposter,
              totalScore: score.totalScore,
              hasHistory: score.history.length > 1,
              historyCount: score.history.length,
            }
          : null,
      };
    });

    // Find current active round if any
    const currentRoundParticipant = roundParticipants.find(
      (rp) => rp.round.status === "ACTIVE" || rp.round.status === "SCORING"
    );

    // 6. Fetch active announcements (priority desc, createdAt desc)
    const announcements = await prisma.announcement.findMany({
      where: { isActive: true },
      select: {
        id: true,
        title: true,
        message: true,
        priority: true,
        createdAt: true,
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 5,
    });

    return {
      participant: {
        id: participant.id,
        participantId: participant.participantId,
        name: participant.name,
        amongUsUsername: participant.amongUsUsername,
        status: participant.status,
        lobby: participant.lobby,
      },
      event: eventSettings
        ? {
            eventName: eventSettings.eventName,
            eventStatus: eventSettings.eventStatus,
            venue: eventSettings.venue,
            eventStart: eventSettings.eventStart,
            eventEnd: eventSettings.eventEnd,
            eventDate: eventSettings.eventDate,
            eventDescription: eventSettings.eventDescription,
            resultsPublished: eventSettings.resultsPublished,
          }
        : null,
      currentRound: currentRoundParticipant
        ? {
            id: currentRoundParticipant.round.id,
            name: currentRoundParticipant.round.name,
            roundNumber: currentRoundParticipant.round.roundNumber,
            type: currentRoundParticipant.round.type,
            status: currentRoundParticipant.round.status,
            scoreLocked: currentRoundParticipant.round.scoreLocked,
            assignedLobby: currentRoundParticipant.lobby,
          }
        : null,
      rounds,
      cumulativeScore: cumulativePreliminaryScore,
      qualification: participant.qualification,
      announcements,
    };
  }

  /**
   * Retrieves the versioned score change history for a specific score entry.
   * Enforces strict participant ownership: if the score entry does not exist OR
   * does not belong to the authenticated participant, throws 404 Not Found.
   */
  public static async getParticipantScoreHistory(scoreId: string, userId: string) {
    const participant = await prisma.participant.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!participant) {
      throw ApiError.forbidden("Participant profile not found for this user account");
    }

    const scoreEntry = await prisma.scoreEntry.findUnique({
      where: { id: scoreId },
      select: {
        id: true,
        participantId: true,
        round: {
          select: {
            name: true,
            roundNumber: true,
          },
        },
      },
    });

    // Mismatch or non-existent score MUST return 404 Not Found
    // Do NOT return 403 or reveal other participants' score data
    if (!scoreEntry || scoreEntry.participantId !== participant.id) {
      throw ApiError.notFound("Score entry not found");
    }

    const history = await prisma.scoreHistory.findMany({
      where: { scoreEntryId: scoreId },
      select: {
        id: true,
        version: true,
        oldTotalScore: true,
        newTotalScore: true,
        oldValues: true,
        newValues: true,
        reason: true,
        createdAt: true,
      },
      orderBy: { version: "asc" },
    });

    return {
      roundName: scoreEntry.round.name,
      roundNumber: scoreEntry.round.roundNumber,
      history,
    };
  }

  /**
   * Retrieves active announcements ordered by priority desc, createdAt desc.
   */
  public static async getActiveAnnouncements() {
    return await prisma.announcement.findMany({
      where: { isActive: true },
      select: {
        id: true,
        title: true,
        message: true,
        priority: true,
        createdAt: true,
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
  }

  /**
   * Retrieves chronological tournament schedule items.
   */
  public static async getScheduleItems() {
    return await prisma.scheduleItem.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        startTime: true,
        endTime: true,
        sortOrder: true,
      },
      orderBy: { sortOrder: "asc" },
    });
  }
}
