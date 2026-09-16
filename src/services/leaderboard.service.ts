import { EventEmitter } from "events";
import { prisma } from "@/lib/prisma";
import { RoundType, RoundStatus, EventStatus, ParticipantStatus } from "@prisma/client";

export interface LeaderboardEntryDto {
  rank: number;
  participantId: string;
  name: string;
  amongUsUsername: string | null;
  totalScore: number;
  roundsPlayed: number;
}

export interface LeaderboardResponseDto {
  eventStatus: EventStatus;
  activeRound: {
    id: string;
    name: string;
    roundNumber: number;
    type: RoundType;
    status: RoundStatus;
    scoreLocked: boolean;
  } | null;
  entries: LeaderboardEntryDto[];
  updatedAt: string;
}

// Global singleton EventEmitter across module reloads
declare global {
  // eslint-disable-next-line no-var
  var __leaderboardEmitter: EventEmitter | undefined;
}

const leaderboardEmitter = globalThis.__leaderboardEmitter || new EventEmitter();
if (process.env.NODE_ENV !== "production") {
  globalThis.__leaderboardEmitter = leaderboardEmitter;
}
leaderboardEmitter.setMaxListeners(200);

export class LeaderboardService {
  /**
   * Retrieves the sanitized public leaderboard data according to strict Phase 5 rules:
   * 1. Aggregates ONLY unarchived preliminary rounds (round.isArchived = false AND round.type = PRELIMINARY).
   * 2. Excludes PRACTICE, FINAL, and archived rounds.
   * 3. Sourced strictly from authoritative score_entries.totalScore.
   * 4. Includes active participants (status = ACTIVE).
   * 5. Participants with zero or no scores appear with totalScore = 0 and roundsPlayed = 0.
   * 6. Deterministic ranking: totalScore DESC, then participantId ASC.
   * 7. Excludes sensitive/private fields (passwords, tokens, audit logs, volunteer UUIDs, edit reasons).
   */
  public static async getLeaderboardData(): Promise<LeaderboardResponseDto> {
    // 1. Fetch current event status
    const eventSettings = await prisma.eventSetting.findFirst({
      select: { eventStatus: true },
    });

    // 2. Fetch current active or scoring round (if any)
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

    // 3. Fetch all active participants
    const activeParticipants = await prisma.participant.findMany({
      where: { status: ParticipantStatus.ACTIVE },
      select: {
        id: true,
        participantId: true,
        name: true,
        amongUsUsername: true,
      },
    });

    // 4. Fetch score entries strictly matching: round.isArchived = false AND round.type = PRELIMINARY
    const preliminaryScoreEntries = await prisma.scoreEntry.findMany({
      where: {
        round: {
          isArchived: false,
          type: RoundType.PRELIMINARY,
        },
        participant: {
          status: ParticipantStatus.ACTIVE,
        },
      },
      select: {
        participantId: true,
        totalScore: true,
      },
    });

    // 5. Aggregate preliminary totalScore and roundsPlayed per participant
    const scoreMap = new Map<string, { totalScore: number; roundsPlayed: number }>();
    for (const entry of preliminaryScoreEntries) {
      const existing = scoreMap.get(entry.participantId) || { totalScore: 0, roundsPlayed: 0 };
      existing.totalScore += entry.totalScore;
      existing.roundsPlayed += 1;
      scoreMap.set(entry.participantId, existing);
    }

    // 6. Map all active participants (including those with no scores)
    const unranked = activeParticipants.map((p) => {
      const stats = scoreMap.get(p.id) || { totalScore: 0, roundsPlayed: 0 };
      return {
        participantId: p.participantId,
        name: p.name,
        amongUsUsername: p.amongUsUsername,
        totalScore: stats.totalScore,
        roundsPlayed: stats.roundsPlayed,
      };
    });

    // 7. Deterministic sort: totalScore DESC, participantId ASC fallback
    unranked.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      return a.participantId.localeCompare(b.participantId);
    });

    // 8. Assign sequential ranks
    const ranked: LeaderboardEntryDto[] = unranked.map((item, index) => ({
      rank: index + 1,
      participantId: item.participantId,
      name: item.name,
      amongUsUsername: item.amongUsUsername,
      totalScore: item.totalScore,
      roundsPlayed: item.roundsPlayed,
    }));

    return {
      eventStatus: eventSettings?.eventStatus ?? EventStatus.NOT_STARTED,
      activeRound: activeRound ?? null,
      entries: ranked,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Broadcasts a real-time notification to all connected SSE clients.
   * MUST be called strictly after a database transaction has successfully committed.
   */
  public static notifyUpdate(): void {
    leaderboardEmitter.emit("leaderboard:update");
  }

  /**
   * Subscribes a listener to leaderboard updates.
   */
  public static onUpdate(listener: () => void): void {
    leaderboardEmitter.on("leaderboard:update", listener);
  }

  /**
   * Unsubscribes a listener from leaderboard updates.
   */
  public static offUpdate(listener: () => void): void {
    leaderboardEmitter.off("leaderboard:update", listener);
  }
}
