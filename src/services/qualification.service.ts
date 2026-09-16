import { prisma } from "@/lib/prisma";
import {
  RoundType,
  ParticipantStatus,
  TieBreakMethod,
} from "@prisma/client";
import { ApiError } from "@/lib/api-helpers";
import { AuditService } from "@/services/audit.service";
import { LeaderboardService } from "@/services/leaderboard.service";
import { ResolveTieInput } from "@/validation/qualification.schema";

export interface QualificationResultDto {
  totalEligible: number;
  qualificationCount: number;
  qualifiedCount: number;
  isTieAtCutoff: boolean;
  unresolvedTie: boolean;
  qualifications: {
    id: string;
    participantId: string;
    participantCode: string;
    name: string;
    amongUsUsername: string | null;
    preliminaryScore: number;
    rank: number;
    qualified: boolean;
    isTieAtCutoff: boolean;
    adminOverride: boolean;
  }[];
}

export class QualificationService {
  /**
   * Authoritatively calculates preliminary qualification standings for the current run:
   * 1. Aggregates unarchived PRELIMINARY rounds for ACTIVE participants.
   * 2. Evaluates cutoff count from EventSetting.
   * 3. Fails safely if eligible participants < qualification cutoff (unresolved in REQUIREMENTS.md).
   * 4. Enforces ADMIN_DECISION for boundary tie resolution (other enums require clarification).
   * 5. Atomically persists to the qualifications table and logs to audit trail.
   * 6. Strictly notifies SSE subscribers after commit.
   */
  public static async calculateQualification(
    adminUserId: string,
    ipAddress?: string
  ): Promise<QualificationResultDto> {
    const settings = await prisma.eventSetting.findFirst();
    if (!settings) {
      throw ApiError.internal("Event settings not found.");
    }

    const cutoff = settings.qualificationCount;

    // 1. Fetch all ACTIVE participants
    const activeParticipants = await prisma.participant.findMany({
      where: { status: ParticipantStatus.ACTIVE },
      select: {
        id: true,
        participantId: true,
        name: true,
        amongUsUsername: true,
      },
    });

    // Unresolved behavior check 1: eligible participants < qualification cutoff
    if (activeParticipants.length < cutoff) {
      throw ApiError.badRequest(
        `Cannot calculate qualification: eligible active participant count (${activeParticipants.length}) is fewer than the configured qualification cutoff (${cutoff}). This condition is not specified in REQUIREMENTS.md and requires admin clarification/configuration.`
      );
    }

    // Unresolved behavior check 2: Concrete mechanics for non-ADMIN_DECISION enums
    if (settings.tieBreakMethod !== TieBreakMethod.ADMIN_DECISION) {
      throw ApiError.badRequest(
        `Tie break method ${settings.tieBreakMethod} mechanics are not specified in REQUIREMENTS.md and require clarification. Only ADMIN_DECISION is currently supported as an admin-configurable mechanism.`
      );
    }

    // 2. Fetch unarchived PRELIMINARY score entries for ACTIVE participants
    const scoreEntries = await prisma.scoreEntry.findMany({
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

    // 3. Aggregate preliminary scores
    const scoreMap = new Map<string, number>();
    for (const entry of scoreEntries) {
      scoreMap.set(entry.participantId, (scoreMap.get(entry.participantId) || 0) + entry.totalScore);
    }

    // 4. Map active participants with aggregated scores
    const rankedList = activeParticipants.map((p) => ({
      participantDbId: p.id,
      participantCode: p.participantId,
      name: p.name,
      amongUsUsername: p.amongUsUsername,
      preliminaryScore: scoreMap.get(p.id) || 0,
    }));

    // 5. Deterministic preliminary sort: totalScore DESC, participantId ASC
    rankedList.sort((a, b) => {
      if (b.preliminaryScore !== a.preliminaryScore) {
        return b.preliminaryScore - a.preliminaryScore;
      }
      return a.participantCode.localeCompare(b.participantCode);
    });

    // 6. Assign ranks and inspect cutoff boundary
    // Participant at cutoff index (1-based: cutoff)
    const cutoffScore = rankedList[cutoff - 1].preliminaryScore;
    const nextScore = rankedList.length > cutoff ? rankedList[cutoff].preliminaryScore : null;

    const hasBoundaryTie = nextScore !== null && cutoffScore === nextScore;

    // Determine qualification status cleanly without invented retention heuristics
    const calculatedRows: {
      participantId: string;
      participantCode: string;
      name: string;
      amongUsUsername: string | null;
      preliminaryScore: number;
      rank: number;
      qualified: boolean;
      isTieAtCutoff: boolean;
      adminOverride: boolean;
    }[] = [];

    let unresolvedTie = false;

    for (let i = 0; i < rankedList.length; i++) {
      const item = rankedList[i];
      const rank = i + 1;

      let qualified = false;
      let isTieAtCutoff = false;
      let adminOverride = false;

      if (!hasBoundaryTie) {
        // Clean cutoff
        qualified = rank <= cutoff;
      } else {
        // Boundary tie exists (S_K == S_{K+1})
        if (item.preliminaryScore > cutoffScore) {
          qualified = true;
        } else if (item.preliminaryScore < cutoffScore) {
          qualified = false;
        } else {
          // Exactly at the boundary tie score:
          // All participants straddling the cutoff boundary belong to the tie group.
          // Fresh recalculation marks all boundary-tied participants as unresolved.
          // Requires explicit administrative tie-break decision.
          isTieAtCutoff = true;
          qualified = false;
          adminOverride = false;
          unresolvedTie = true;
        }
      }

      calculatedRows.push({
        participantId: item.participantDbId,
        participantCode: item.participantCode,
        name: item.name,
        amongUsUsername: item.amongUsUsername,
        preliminaryScore: item.preliminaryScore,
        rank,
        qualified,
        isTieAtCutoff,
        adminOverride,
      });
    }

    // 7. Transactional persistence
    await prisma.$transaction(async (tx) => {
      for (const row of calculatedRows) {
        await tx.qualification.upsert({
          where: { participantId: row.participantId },
          create: {
            participantId: row.participantId,
            preliminaryScore: row.preliminaryScore,
            rank: row.rank,
            qualified: row.qualified,
            isTieAtCutoff: row.isTieAtCutoff,
            adminOverride: row.adminOverride,
          },
          update: {
            preliminaryScore: row.preliminaryScore,
            rank: row.rank,
            qualified: row.qualified,
            isTieAtCutoff: row.isTieAtCutoff,
            adminOverride: row.adminOverride,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: "QUALIFICATION_CALCULATED",
          entityType: "QUALIFICATION",
          entityId: settings.id,
          newValue: {
            cutoff,
            totalEligible: activeParticipants.length,
            hasBoundaryTie,
            unresolvedTie,
            qualifiedCount: calculatedRows.filter((r) => r.qualified).length,
          },
          reason: "Administrator calculated preliminary qualification standings",
          ipAddress: ipAddress ?? null,
        },
      });
    });

    // 8. Post-commit SSE notification
    LeaderboardService.notifyUpdate();

    const qualifiedCount = calculatedRows.filter((r) => r.qualified).length;

    // Fetch freshly persisted records to return
    const persisted = await prisma.qualification.findMany({
      where: {
        participantId: { in: calculatedRows.map((r) => r.participantId) },
      },
      include: {
        participant: {
          select: {
            participantId: true,
            name: true,
            amongUsUsername: true,
          },
        },
      },
      orderBy: { rank: "asc" },
    });

    return {
      totalEligible: activeParticipants.length,
      qualificationCount: cutoff,
      qualifiedCount,
      isTieAtCutoff: hasBoundaryTie,
      unresolvedTie,
      qualifications: persisted.map((p) => ({
        id: p.id,
        participantId: p.participantId,
        participantCode: p.participant.participantId,
        name: p.participant.name,
        amongUsUsername: p.participant.amongUsUsername,
        preliminaryScore: p.preliminaryScore,
        rank: p.rank,
        qualified: p.qualified,
        isTieAtCutoff: p.isTieAtCutoff,
        adminOverride: p.adminOverride,
      })),
    };
  }

  /**
   * Retrieves the current qualification standings.
   */
  public static async getQualificationList() {
    return prisma.qualification.findMany({
      include: {
        participant: {
          select: {
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
   * Resolves a cutoff tie using ADMIN_DECISION:
   * Sets adminOverride = true and qualified = true on the chosen participant.
   */
  public static async resolveTie(
    input: ResolveTieInput,
    adminUserId: string,
    ipAddress?: string
  ) {
    const targetQual = await prisma.qualification.findUnique({
      where: { participantId: input.participantId },
      include: { participant: true },
    });

    if (!targetQual) {
      throw ApiError.notFound("Qualification record not found for participant.");
    }

    if (!targetQual.isTieAtCutoff) {
      throw ApiError.badRequest(
        "Participant is not in a boundary tie state. Only participants tied at cutoff can be resolved."
      );
    }

    const tiedGroup = await prisma.qualification.findMany({
      where: {
        isTieAtCutoff: true,
        preliminaryScore: targetQual.preliminaryScore,
      },
    });

    await prisma.$transaction(async (tx) => {
      // Set chosen participant as qualified with adminOverride
      await tx.qualification.update({
        where: { id: targetQual.id },
        data: {
          qualified: true,
          adminOverride: true,
        },
      });

      // Set other tied participants as not qualified (adminOverride = false)
      const otherTied = tiedGroup.filter((q) => q.id !== targetQual.id);
      if (otherTied.length > 0) {
        await tx.qualification.updateMany({
          where: { id: { in: otherTied.map((q) => q.id) } },
          data: {
            qualified: false,
            adminOverride: false,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: "QUALIFICATION_TIE_RESOLVED",
          entityType: "QUALIFICATION",
          entityId: targetQual.id,
          newValue: {
            selectedParticipantId: targetQual.participantId,
            selectedParticipantCode: targetQual.participant.participantId,
            reason: input.reason ?? "Admin manual tie-break decision",
          },
          reason: input.reason ?? "Admin manual tie-break decision",
          ipAddress: ipAddress ?? null,
        },
      });
    });

    // Notify SSE clients strictly AFTER transaction commits
    LeaderboardService.notifyUpdate();

    return this.getQualificationList();
  }
}
