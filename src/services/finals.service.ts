import { prisma } from "@/lib/prisma";
import {
  RoundType,
  LobbyStatus,
  ParticipantStatus,
} from "@prisma/client";
import { ApiError } from "@/lib/api-helpers";
import { AuditService } from "@/services/audit.service";
import { LeaderboardService } from "@/services/leaderboard.service";
import { EventService } from "@/services/event.service";
import { EnrollRosterInput, UnlockResultsInput } from "@/validation/finals.schema";

export interface FinalResultEntryDto {
  rank: number | null;
  participantId: string;
  name: string;
  amongUsUsername: string | null;
  preliminaryScore: number;
  finalScore: number;
  overallScore: number;
  isPodium: boolean;
  podiumPlace?: 1 | 2 | 3;
  isTie: boolean;
}

export interface FinalResultsResponseDto {
  isPublished: boolean;
  isLocked: boolean;
  formula: string | null;
  preliminaryWeight: number;
  finalWeight: number;
  hasUnresolvedTie: boolean;
  unresolvedTieReason?: string;
  winnerId: string | null;
  standings: FinalResultEntryDto[];
}

export class FinalsService {
  /**
   * Retrieves the qualified participants eligible for the finals roster.
   */
  public static async getFinalsRoster() {
    return prisma.qualification.findMany({
      where: { qualified: true },
      include: {
        participant: {
          select: {
            id: true,
            participantId: true,
            name: true,
            amongUsUsername: true,
            status: true,
          },
        },
      },
      orderBy: { rank: "asc" },
    });
  }

  /**
   * Enrolls qualified participants into a final round and final lobby.
   */
  public static async enrollFinalsRoster(
    input: EnrollRosterInput,
    adminUserId: string,
    ipAddress?: string
  ) {
    // 1. Verify target round exists, is unarchived, and is of type FINAL
    const round = await prisma.round.findUnique({
      where: { id: input.roundId },
    });
    if (!round) {
      throw ApiError.notFound("Target round not found.");
    }
    if (round.isArchived) {
      throw ApiError.badRequest("Cannot enroll into an archived round.");
    }
    if (round.type !== RoundType.FINAL) {
      throw ApiError.badRequest("Target round is not a FINAL round.");
    }
    if (round.scoreLocked) {
      throw ApiError.badRequest("Target final round is score locked.");
    }

    // 2. Verify target lobby exists and is active
    const lobby = await prisma.lobby.findUnique({
      where: { id: input.lobbyId },
    });
    if (!lobby) {
      throw ApiError.notFound("Target lobby not found.");
    }
    if (lobby.status !== LobbyStatus.ACTIVE) {
      throw ApiError.badRequest("Target lobby is inactive.");
    }

    // 3. Fetch all qualified participants
    const qualifiedList = await prisma.qualification.findMany({
      where: { qualified: true },
      include: { participant: true },
    });

    if (qualifiedList.length === 0) {
      throw ApiError.badRequest(
        "No qualified participants found. Please calculate qualification before enrolling finals roster."
      );
    }

    // 4. Verify all qualified participants are ACTIVE
    const inactive = qualifiedList.filter(
      (q) => q.participant.status !== ParticipantStatus.ACTIVE
    );
    if (inactive.length > 0) {
      throw ApiError.badRequest(
        `Cannot enroll finals roster: ${inactive.length} qualified participant(s) are not active (disqualified or withdrawn).`
      );
    }

    // 5. Verify lobby capacity if specified
    if (lobby.capacity !== null && lobby.capacity < qualifiedList.length) {
      throw ApiError.badRequest(
        `Target lobby capacity (${lobby.capacity}) is insufficient for ${qualifiedList.length} qualified finalists.`
      );
    }

    // 6. Transactional enrollment of RoundParticipant records
    await prisma.$transaction(async (tx) => {
      for (const q of qualifiedList) {
        await tx.roundParticipant.upsert({
          where: {
            roundId_participantId: {
              roundId: input.roundId,
              participantId: q.participantId,
            },
          },
          create: {
            roundId: input.roundId,
            lobbyId: input.lobbyId,
            participantId: q.participantId,
          },
          update: {
            lobbyId: input.lobbyId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: "FINALS_ROSTER_ENROLLED",
          entityType: "ROUND",
          entityId: round.id,
          newValue: {
            roundId: round.id,
            roundName: round.name,
            lobbyId: lobby.id,
            lobbyName: lobby.name,
            enrolledCount: qualifiedList.length,
            participantIds: qualifiedList.map((q) => q.participant.participantId),
          },
          reason: "Enrolled qualified participants into finals match",
          ipAddress: ipAddress ?? null,
        },
      });
    });

    // 7. Post-commit SSE notification
    LeaderboardService.notifyUpdate();

    return {
      success: true,
      enrolledCount: qualifiedList.length,
      roundId: round.id,
      lobbyId: lobby.id,
    };
  }

  /**
   * Computes final results standings using the configured formula.
   * Access control:
   * - If isPreview is false, results must be published, else throws 403.
   * - Formula must be configured, else throws 400.
   * - Unresolved multiple final rounds aggregation throws 400 if multiple rounds exist.
   * - No invented tie-break cascade: identical scores receive shared ranks.
   */
  public static async getFinalResults(isPreview: boolean): Promise<FinalResultsResponseDto> {
    const settings = await prisma.eventSetting.findFirst();
    if (!settings) {
      throw ApiError.internal("Event settings not found.");
    }

    // Access check: if not preview, results must be published
    if (!isPreview && !settings.resultsPublished) {
      throw ApiError.forbidden("Final tournament results have not been published yet.");
    }

    // Formula check: formula must be explicitly configured
    if (!settings.finalScoreFormula) {
      throw ApiError.badRequest(
        "Final scoring formula is not configured. Admin must configure the formula first."
      );
    }

    // 1. Fetch qualified participants
    const qualified = await prisma.qualification.findMany({
      where: { qualified: true },
      include: { participant: true },
    });

    if (qualified.length === 0) {
      return {
        isPublished: settings.resultsPublished,
        isLocked: settings.resultsLocked,
        formula: settings.finalScoreFormula,
        preliminaryWeight: Number(settings.preliminaryWeight),
        finalWeight: Number(settings.finalWeight),
        hasUnresolvedTie: false,
        winnerId: null,
        standings: [],
      };
    }

    // 2. Fetch unarchived FINAL rounds
    const finalRounds = await prisma.round.findMany({
      where: { isArchived: false, type: RoundType.FINAL },
    });

    // Unresolved check 4: Aggregation across multiple final rounds
    if (finalRounds.length > 1) {
      throw ApiError.badRequest(
        "Aggregation of FINAL SCORE across multiple final rounds is not specified in REQUIREMENTS.md and requires clarification."
      );
    }

    // 3. Fetch score entries for unarchived FINAL rounds
    const finalScoreEntries = await prisma.scoreEntry.findMany({
      where: {
        round: { isArchived: false, type: RoundType.FINAL },
        participantId: { in: qualified.map((q) => q.participantId) },
      },
      select: {
        participantId: true,
        totalScore: true,
      },
    });

    const finalScoreMap = new Map<string, number>();
    for (const entry of finalScoreEntries) {
      finalScoreMap.set(entry.participantId, entry.totalScore);
    }

    // 4. Calculate overall scores
    const prelimWeight = Number(settings.preliminaryWeight);
    const finalWeight = Number(settings.finalWeight);
    const formula = settings.finalScoreFormula;

    const unranked = qualified.map((q) => {
      const prelim = q.preliminaryScore;
      const finalScore = finalScoreMap.get(q.participantId) || 0;
      let overall = 0;

      if (formula === "SUM") {
        overall = prelim + finalScore;
      } else if (formula === "WEIGHTED") {
        overall = Number(((prelim * prelimWeight) + (finalScore * finalWeight)).toFixed(2));
      }

      return {
        participantId: q.participant.participantId,
        name: q.participant.name,
        amongUsUsername: q.participant.amongUsUsername,
        preliminaryScore: prelim,
        finalScore,
        overallScore: overall,
      };
    });

    // 5. Stable sort by overallScore DESC.
    // Critical: Do NOT use participantId, preliminaryScore, or finalScore as fallback tie-breakers!
    unranked.sort((a, b) => b.overallScore - a.overallScore);

    // 6. Detect ties in overallScore
    const scoreCounts = new Map<number, number>();
    for (const item of unranked) {
      scoreCounts.set(item.overallScore, (scoreCounts.get(item.overallScore) || 0) + 1);
    }

    const hasUnresolvedTie = Array.from(scoreCounts.values()).some((cnt) => cnt > 1);

    // 7. Assign ranks and podium placements without inventing tie-break rules:
    // - For equal overall scores: do not assign shared ranks, do not use fallback sorting.
    //   Tied participants receive rank = null, isTie = true, isPodium = false, podiumPlace = undefined.
    // - If any ties exist above a participant, assigning a rank would assume an invented ranking rule
    //   (e.g., standard competition vs dense ranking). Therefore, participants below ties also receive rank = null.
    // - Only participants with strictly distinct scores and NO ties above them receive an unambiguous rank.
    const standings: FinalResultEntryDto[] = [];

    for (let i = 0; i < unranked.length; i++) {
      const item = unranked[i];
      const count = scoreCounts.get(item.overallScore) || 1;
      const isTie = count > 1;

      // Count participants strictly higher
      const higherItems = unranked.filter((other) => other.overallScore > item.overallScore);
      const higherCount = higherItems.length;
      const hasTiesAbove = higherItems.some((other) => (scoreCounts.get(other.overallScore) || 1) > 1);

      let rank: number | null = null;
      let isPodium = false;
      let podiumPlace: 1 | 2 | 3 | undefined = undefined;

      if (!isTie && !hasTiesAbove) {
        rank = higherCount + 1;
        if (rank <= 3) {
          isPodium = true;
          podiumPlace = rank as 1 | 2 | 3;
        }
      }

      standings.push({
        rank,
        participantId: item.participantId,
        name: item.name,
        amongUsUsername: item.amongUsUsername,
        preliminaryScore: item.preliminaryScore,
        finalScore: item.finalScore,
        overallScore: item.overallScore,
        isPodium,
        podiumPlace,
        isTie,
      });
    }

    // Determine winner: strictly require unique highest score. If highest score is tied, winnerId is null.
    const hasTopTie =
      standings.length > 0 &&
      (standings.length > 1 ? standings[0].overallScore === standings[1].overallScore : false);

    const winnerId =
      standings.length > 0 && !hasTopTie && standings[0].rank === 1
        ? standings[0].participantId
        : null;

    return {
      isPublished: settings.resultsPublished,
      isLocked: settings.resultsLocked,
      formula: settings.finalScoreFormula,
      preliminaryWeight: prelimWeight,
      finalWeight,
      hasUnresolvedTie,
      unresolvedTieReason: hasUnresolvedTie
        ? "Final tournament results tie-breaking is not specified in REQUIREMENTS.md and requires clarification."
        : undefined,
      winnerId,
      standings,
    };
  }

  /**
   * Publishes and locks the final tournament results.
   * Requires explicit confirmation and configured formula.
   */
  public static async publishResults(adminUserId: string, ipAddress?: string) {
    // Enforce formula requirement
    await EventService.assertCanPublishResults();

    const currentSettings = await prisma.eventSetting.findFirst();
    if (!currentSettings) {
      throw ApiError.internal("Event settings not found.");
    }

    if (currentSettings.resultsPublished) {
      throw ApiError.badRequest("Tournament results have already been published.");
    }

    // Compute preview results to ascertain winner and tie status
    const results = await this.getFinalResults(true);

    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.eventSetting.update({
        where: { id: currentSettings.id },
        data: {
          resultsPublished: true,
          resultsLocked: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: "RESULTS_PUBLISHED",
          entityType: "EVENT_SETTINGS",
          entityId: currentSettings.id,
          newValue: {
            resultsPublished: true,
            resultsLocked: true,
            formula: s.finalScoreFormula,
            hasUnresolvedTie: results.hasUnresolvedTie,
            winnerId: results.winnerId, // strictly null if highest score is tied; no fabricated winner!
          },
          reason: results.hasUnresolvedTie
            ? "Administrator published final tournament results with unresolved ties"
            : "Administrator published and locked final tournament results",
          ipAddress: ipAddress ?? null,
        },
      });

      return s;
    });

    // Notify SSE clients strictly AFTER transaction commits
    LeaderboardService.notifyUpdate();

    return updated;
  }

  /**
   * Unlocks previously published tournament results with an explicit required reason.
   */
  public static async unlockResults(
    input: UnlockResultsInput,
    adminUserId: string,
    ipAddress?: string
  ) {
    const currentSettings = await prisma.eventSetting.findFirst();
    if (!currentSettings) {
      throw ApiError.internal("Event settings not found.");
    }

    if (!input.reason || !input.reason.trim()) {
      throw ApiError.badRequest("An explicit administrative reason is required to unlock tournament results.");
    }

    if (!currentSettings.resultsPublished && !currentSettings.resultsLocked) {
      throw ApiError.badRequest("Tournament results are not currently published or locked.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.eventSetting.update({
        where: { id: currentSettings.id },
        data: {
          resultsPublished: false,
          resultsLocked: false,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: "RESULTS_UNLOCKED",
          entityType: "EVENT_SETTINGS",
          entityId: currentSettings.id,
          oldValue: {
            resultsPublished: currentSettings.resultsPublished,
            resultsLocked: currentSettings.resultsLocked,
          },
          newValue: {
            resultsPublished: false,
            resultsLocked: false,
          },
          reason: input.reason,
          ipAddress: ipAddress ?? null,
        },
      });

      return s;
    });

    // Notify SSE clients strictly AFTER transaction commits
    LeaderboardService.notifyUpdate();

    return updated;
  }
}
