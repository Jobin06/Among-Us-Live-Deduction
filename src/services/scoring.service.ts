import { LeaderboardService } from "@/services/leaderboard.service";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { UserRole, PlayerRole, ScoringRule, ParticipantStatus } from "@prisma/client";
import { CreateScoreInput, UpdateScoreInput, UpdateScoringRuleInput } from "@/validation/score.schema";

export interface ActorContext {
  userId: string;
  role: UserRole;
  username: string;
  volunteerId?: string | null;
}

export interface PerformanceValues {
  correctVote: boolean;
  correctIdentification: boolean;
  tasksCompleted: number;
  survived: boolean;
  wonAsCrewmate: boolean;
  wonAsImposter: boolean;
  successfulElimination: number;
  avoidedIdentification: boolean;
  votedOutAsImposter: boolean;
}

const CANONICAL_RULE_KEYS = [
  "correct_vote",
  "correct_identification",
  "task_completed",
  "survived",
  "won_as_crewmate",
  "won_as_imposter",
  "successful_elimination",
  "avoided_identification",
  "voted_out_as_imposter",
] as const;

export class ScoringService {
  /**
   * Resolves all active scoring rules from the database deterministically.
   * Fails safely if any canonical rule key is missing or if duplicate keys exist.
   */
  public static async getActiveRules(): Promise<Map<string, ScoringRule>> {
    const rules = await prisma.scoringRule.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    const ruleMap = new Map<string, ScoringRule>();
    for (const rule of rules) {
      if (ruleMap.has(rule.ruleKey)) {
        throw ApiError.internal(
          `Scoring configuration error: duplicate active rule key '${rule.ruleKey}' found. Scoring calculation aborted.`
        );
      }
      ruleMap.set(rule.ruleKey, rule);
    }

    // Verify all 9 canonical rule keys exist
    for (const key of CANONICAL_RULE_KEYS) {
      if (!ruleMap.has(key)) {
        throw ApiError.internal(
          `Scoring configuration error: missing required canonical rule '${key}'. Scoring calculation aborted.`
        );
      }
    }

    return ruleMap;
  }

  /**
   * Authoritatively calculates the total score on the server from performance inputs
   * and the resolved active database rules.
   */
  public static calculateScore(
    performance: PerformanceValues,
    role: PlayerRole,
    rules: Map<string, ScoringRule>
  ): number {
    let total = 0;

    // 1. Shared Rules (Applicable to ANY role)
    if (performance.correctVote) {
      total += rules.get("correct_vote")!.points;
    }
    if (performance.correctIdentification) {
      total += rules.get("correct_identification")!.points;
    }
    if (performance.survived) {
      total += rules.get("survived")!.points;
    }

    // 2. Role-Specific Rules
    if (role === PlayerRole.CREWMATE) {
      if (performance.wonAsCrewmate) {
        total += rules.get("won_as_crewmate")!.points;
      }
      total += (performance.tasksCompleted || 0) * rules.get("task_completed")!.points;
    } else if (role === PlayerRole.IMPOSTER) {
      if (performance.wonAsImposter) {
        total += rules.get("won_as_imposter")!.points;
      }
      total += (performance.successfulElimination || 0) * rules.get("successful_elimination")!.points;
      if (performance.avoidedIdentification) {
        total += rules.get("avoided_identification")!.points;
      }
      if (performance.votedOutAsImposter) {
        total += rules.get("voted_out_as_imposter")!.points;
      }
    }

    return total;
  }

  /**
   * Creates a new authoritative score entry:
   * Strictly enforces relationship integrity, volunteer assignment scope,
   * elimination limits, and creates version 1 history + audit trail atomically.
   */
  public static async createScoreEntry(
    input: CreateScoreInput,
    actor: ActorContext,
    ipAddress?: string
  ) {
    // 1. Check actor role
    if (actor.role === UserRole.PARTICIPANT) {
      throw ApiError.forbidden("Participants are not permitted to record scores.");
    }

    // 2. Verify participant exists and is active
    const participant = await prisma.participant.findUnique({
      where: { id: input.participantId },
    });
    if (!participant || participant.status !== ParticipantStatus.ACTIVE) {
      throw ApiError.badRequest("Participant does not exist or is inactive.");
    }

    // 3. Verify round exists, is not archived, and is not score locked
    const round = await prisma.round.findUnique({
      where: { id: input.roundId },
    });
    if (!round) {
      throw ApiError.notFound("Round not found.");
    }
    if (round.isArchived) {
      throw ApiError.badRequest("Cannot submit scores to an archived round.");
    }
    if (round.scoreLocked) {
      throw ApiError.badRequest("Round scoring is locked. No new scores can be submitted.");
    }

    // 4. Verify lobby exists
    const lobby = await prisma.lobby.findUnique({
      where: { id: input.lobbyId },
    });
    if (!lobby) {
      throw ApiError.notFound("Lobby not found.");
    }

    // 5. Verify Participant / Round / Lobby relationship
    const roundParticipant = await prisma.roundParticipant.findUnique({
      where: {
        roundId_participantId: {
          roundId: input.roundId,
          participantId: input.participantId,
        },
      },
    });
    if (!roundParticipant) {
      throw ApiError.badRequest("Participant is not registered for this round.");
    }
    if (roundParticipant.lobbyId !== input.lobbyId) {
      throw ApiError.badRequest("Participant is not assigned to the specified lobby in this round.");
    }

    // 6. Verify Volunteer assignment scope
    if (actor.role === UserRole.VOLUNTEER) {
      let volunteerId = actor.volunteerId;
      if (!volunteerId) {
        const v = await prisma.volunteer.findUnique({ where: { userId: actor.userId } });
        if (!v) throw ApiError.forbidden("Volunteer profile not found.");
        volunteerId = v.id;
      }

      const assignment = await prisma.volunteerAssignment.findUnique({
        where: {
          volunteerId_roundId_lobbyId: {
            volunteerId,
            roundId: input.roundId,
            lobbyId: input.lobbyId,
          },
        },
      });
      if (!assignment) {
        throw ApiError.forbidden("You are not assigned to score this round and lobby combination.");
      }
    }

    // 7. Verify configurable max eliminations limit
    const eventSettings = await prisma.eventSetting.findFirst();
    if (
      input.role === PlayerRole.IMPOSTER &&
      eventSettings?.maxEliminationsPerRound !== null &&
      eventSettings?.maxEliminationsPerRound !== undefined &&
      input.successfulElimination > eventSettings.maxEliminationsPerRound
    ) {
      throw ApiError.badRequest(
        `Elimination count exceeds configured maximum of ${eventSettings.maxEliminationsPerRound}`
      );
    }

    // 8. Check UNIQUE(round_id, participant_id)
    const existingScore = await prisma.scoreEntry.findUnique({
      where: {
        roundId_participantId: {
          roundId: input.roundId,
          participantId: input.participantId,
        },
      },
    });
    if (existingScore) {
      throw ApiError.conflict(
        "A score entry already exists for this participant in this round. Please use score editing instead."
      );
    }

    // 9. Resolve active rules and calculate authoritative total_score
    const rules = await this.getActiveRules();
    const authoritativeScore = this.calculateScore(input, input.role, rules);

    // 10. Persist score entry, initial history (v1), and audit log atomically
    const result = await prisma.$transaction(async (tx) => {
      const scoreEntry = await tx.scoreEntry.create({
        data: {
          roundId: input.roundId,
          participantId: input.participantId,
          role: input.role,
          correctVote: input.correctVote,
          correctIdentification: input.correctIdentification,
          tasksCompleted: input.tasksCompleted,
          survived: input.survived,
          wonAsCrewmate: input.wonAsCrewmate,
          wonAsImposter: input.wonAsImposter,
          successfulElimination: input.successfulElimination,
          avoidedIdentification: input.avoidedIdentification,
          votedOutAsImposter: input.votedOutAsImposter,
          totalScore: authoritativeScore,
          enteredById: actor.userId,
        },
        include: {
          round: true,
          participant: true,
        },
      });

      // Complete initial snapshot in newValues
      const initialSnapshot = {
        role: input.role,
        correctVote: input.correctVote,
        correctIdentification: input.correctIdentification,
        tasksCompleted: input.tasksCompleted,
        survived: input.survived,
        wonAsCrewmate: input.wonAsCrewmate,
        wonAsImposter: input.wonAsImposter,
        successfulElimination: input.successfulElimination,
        avoidedIdentification: input.avoidedIdentification,
        votedOutAsImposter: input.votedOutAsImposter,
        totalScore: authoritativeScore,
      };

      await tx.scoreHistory.create({
        data: {
          scoreEntryId: scoreEntry.id,
          version: 1,
          oldTotalScore: null,
          newTotalScore: authoritativeScore,
          oldValues: undefined,
          newValues: initialSnapshot,
          changedById: actor.userId,
          reason: "Initial score entry",
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: "SCORE_CREATED",
          entityType: "SCORE_ENTRY",
          entityId: scoreEntry.id,
          oldValue: undefined,
          newValue: initialSnapshot,
          reason: "Recorded initial participant performance score",
          ipAddress,
        },
      });

      return scoreEntry;
    });

    // Notify SSE clients strictly AFTER transaction commits successfully
    LeaderboardService.notifyUpdate();

    return result;
  }

  /**
   * Updates an existing score entry with concurrency serialization (row lock),
   * recalculates authoritative score, and records versioned immutable history + audit trail.
   */
  public static async updateScoreEntry(
    id: string,
    input: UpdateScoreInput,
    actor: ActorContext,
    ipAddress?: string
  ) {
    if (actor.role === UserRole.PARTICIPANT) {
      throw ApiError.forbidden("Participants are not permitted to modify scores.");
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Acquire row-level lock on the target score entry to serialize concurrent edits
      const lockedRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM score_entries WHERE id = $1::uuid FOR UPDATE`,
        id
      );
      if (!lockedRows || lockedRows.length === 0) {
        throw ApiError.notFound("Score entry not found.");
      }

      // 2. Fetch current score entry with associations
      const scoreEntry = await tx.scoreEntry.findUnique({
        where: { id },
        include: {
          round: true,
          participant: true,
        },
      });
      if (!scoreEntry) {
        throw ApiError.notFound("Score entry not found.");
      }

      // 3. Verify round lifecycle
      if (scoreEntry.round.isArchived) {
        throw ApiError.badRequest("Cannot edit scores in an archived round.");
      }
      if (scoreEntry.round.scoreLocked) {
        throw ApiError.badRequest("Round scoring is locked. Scores cannot be modified.");
      }

      // 4. Verify Volunteer assignment scope
      if (actor.role === UserRole.VOLUNTEER) {
        let volunteerId = actor.volunteerId;
        if (!volunteerId) {
          const v = await tx.volunteer.findUnique({ where: { userId: actor.userId } });
          if (!v) throw ApiError.forbidden("Volunteer profile not found.");
          volunteerId = v.id;
        }

        const roundParticipant = await tx.roundParticipant.findUnique({
          where: {
            roundId_participantId: {
              roundId: scoreEntry.roundId,
              participantId: scoreEntry.participantId,
            },
          },
        });
        if (!roundParticipant) {
          throw ApiError.badRequest("Participant is not registered for this round.");
        }

        const assignment = await tx.volunteerAssignment.findUnique({
          where: {
            volunteerId_roundId_lobbyId: {
              volunteerId,
              roundId: scoreEntry.roundId,
              lobbyId: roundParticipant.lobbyId,
            },
          },
        });
        if (!assignment) {
          throw ApiError.forbidden(
            "You are not assigned to score this participant's round and lobby."
          );
        }
      }

      // 5. Check elimination limit
      const eventSettings = await tx.eventSetting.findFirst();
      if (
        input.role === PlayerRole.IMPOSTER &&
        eventSettings?.maxEliminationsPerRound !== null &&
        eventSettings?.maxEliminationsPerRound !== undefined &&
        input.successfulElimination > eventSettings.maxEliminationsPerRound
      ) {
        throw ApiError.badRequest(
          `Elimination count exceeds configured maximum of ${eventSettings.maxEliminationsPerRound}`
        );
      }

      // 6. Recalculate authoritative total score
      const rules = await this.getActiveRules();
      const newAuthoritativeScore = this.calculateScore(input, input.role, rules);

      // 7. Determine next history version
      const currentHistoryCount = await tx.scoreHistory.count({
        where: { scoreEntryId: id },
      });
      const nextVersion = currentHistoryCount + 1;

      // 8. Construct snapshots
      const oldSnapshot = {
        role: scoreEntry.role,
        correctVote: scoreEntry.correctVote,
        correctIdentification: scoreEntry.correctIdentification,
        tasksCompleted: scoreEntry.tasksCompleted,
        survived: scoreEntry.survived,
        wonAsCrewmate: scoreEntry.wonAsCrewmate,
        wonAsImposter: scoreEntry.wonAsImposter,
        successfulElimination: scoreEntry.successfulElimination,
        avoidedIdentification: scoreEntry.avoidedIdentification,
        votedOutAsImposter: scoreEntry.votedOutAsImposter,
        totalScore: scoreEntry.totalScore,
      };

      const newSnapshot = {
        role: input.role,
        correctVote: input.correctVote,
        correctIdentification: input.correctIdentification,
        tasksCompleted: input.tasksCompleted,
        survived: input.survived,
        wonAsCrewmate: input.wonAsCrewmate,
        wonAsImposter: input.wonAsImposter,
        successfulElimination: input.successfulElimination,
        avoidedIdentification: input.avoidedIdentification,
        votedOutAsImposter: input.votedOutAsImposter,
        totalScore: newAuthoritativeScore,
      };

      // 9. Update score entry
      const updatedScore = await tx.scoreEntry.update({
        where: { id },
        data: {
          role: input.role,
          correctVote: input.correctVote,
          correctIdentification: input.correctIdentification,
          tasksCompleted: input.tasksCompleted,
          survived: input.survived,
          wonAsCrewmate: input.wonAsCrewmate,
          wonAsImposter: input.wonAsImposter,
          successfulElimination: input.successfulElimination,
          avoidedIdentification: input.avoidedIdentification,
          votedOutAsImposter: input.votedOutAsImposter,
          totalScore: newAuthoritativeScore,
        },
        include: {
          round: true,
          participant: true,
        },
      });

      // 10. Append new immutable history version
      await tx.scoreHistory.create({
        data: {
          scoreEntryId: id,
          version: nextVersion,
          oldTotalScore: scoreEntry.totalScore,
          newTotalScore: newAuthoritativeScore,
          oldValues: oldSnapshot,
          newValues: newSnapshot,
          changedById: actor.userId,
          reason: input.reason,
        },
      });

      // 11. Append audit log
      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: "SCORE_UPDATED",
          entityType: "SCORE_ENTRY",
          entityId: id,
          oldValue: oldSnapshot,
          newValue: newSnapshot,
          reason: input.reason,
          ipAddress,
        },
      });

      return updatedScore;
    });

    // Notify SSE clients strictly AFTER transaction commits successfully
    LeaderboardService.notifyUpdate();

    return result;
  }

  /**
   * Retrieves a single score entry with history, enforcing assignment scope for volunteers.
   */
  public static async getScoreById(id: string, actor: ActorContext) {
    if (actor.role === UserRole.PARTICIPANT) {
      throw ApiError.forbidden("Participants cannot view score entry management details.");
    }

    const score = await prisma.scoreEntry.findUnique({
      where: { id },
      include: {
        round: true,
        participant: true,
        history: {
          orderBy: { version: "asc" },
          include: { changedBy: { select: { id: true, username: true, role: true } } },
        },
      },
    });

    if (!score) {
      throw ApiError.notFound("Score entry not found.");
    }

    if (actor.role === UserRole.VOLUNTEER) {
      let volunteerId = actor.volunteerId;
      if (!volunteerId) {
        const v = await prisma.volunteer.findUnique({ where: { userId: actor.userId } });
        if (!v) throw ApiError.forbidden("Volunteer profile not found.");
        volunteerId = v.id;
      }

      const roundParticipant = await prisma.roundParticipant.findUnique({
        where: {
          roundId_participantId: {
            roundId: score.roundId,
            participantId: score.participantId,
          },
        },
      });
      if (!roundParticipant) {
        throw ApiError.forbidden("Participant registration not found for this round.");
      }

      const assignment = await prisma.volunteerAssignment.findUnique({
        where: {
          volunteerId_roundId_lobbyId: {
            volunteerId,
            roundId: score.roundId,
            lobbyId: roundParticipant.lobbyId,
          },
        },
      });
      if (!assignment) {
        throw ApiError.forbidden("You are not assigned to this score's round and lobby.");
      }
    }

    return score;
  }

  /**
   * Retrieves scores with optional round and lobby filters, strictly enforcing volunteer scope.
   */
  public static async getScores(
    filters: { roundId?: string; lobbyId?: string },
    actor: ActorContext
  ) {
    if (actor.role === UserRole.PARTICIPANT) {
      throw ApiError.forbidden("Participants cannot query administrative scores.");
    }

    if (actor.role === UserRole.VOLUNTEER) {
      let volunteerId = actor.volunteerId;
      if (!volunteerId) {
        const v = await prisma.volunteer.findUnique({ where: { userId: actor.userId } });
        if (!v) throw ApiError.forbidden("Volunteer profile not found.");
        volunteerId = v.id;
      }

      const assignments = await prisma.volunteerAssignment.findMany({
        where: {
          volunteerId,
          round: { isArchived: false },
        },
      });

      if (assignments.length === 0) {
        return [];
      }

      // If user requested specific round/lobby, verify it's assigned
      if (filters.roundId && filters.lobbyId) {
        const isAssigned = assignments.some(
          (a) => a.roundId === filters.roundId && a.lobbyId === filters.lobbyId
        );
        if (!isAssigned) {
          throw ApiError.forbidden("You are not assigned to this round and lobby.");
        }
      }

      // Filter by exact assigned pairs
      const exactPairs = assignments
        .filter((a) => (!filters.roundId || a.roundId === filters.roundId) && (!filters.lobbyId || a.lobbyId === filters.lobbyId))
        .map((a) => ({ roundId: a.roundId, lobbyId: a.lobbyId }));

      if (exactPairs.length === 0) {
        return [];
      }

      // Find round_participants for these exact pairs
      const roundParticipants = await prisma.roundParticipant.findMany({
        where: {
          OR: exactPairs.map((pair) => ({
            roundId: pair.roundId,
            lobbyId: pair.lobbyId,
          })),
        },
      });

      if (roundParticipants.length === 0) {
        return [];
      }

      return await prisma.scoreEntry.findMany({
        where: {
          round: { isArchived: false },
          OR: roundParticipants.map((rp) => ({
            roundId: rp.roundId,
            participantId: rp.participantId,
          })),
        },
        include: {
          participant: true,
          round: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    // Admin access
    const whereClause: any = {
      round: { isArchived: false },
    };
    if (filters.roundId) whereClause.roundId = filters.roundId;
    if (filters.lobbyId) {
      const rps = await prisma.roundParticipant.findMany({
        where: { lobbyId: filters.lobbyId },
        select: { participantId: true, roundId: true },
      });
      if (rps.length > 0) {
        whereClause.OR = rps.map((rp) => ({
          roundId: rp.roundId,
          participantId: rp.participantId,
        }));
      } else {
        return [];
      }
    }

    return await prisma.scoreEntry.findMany({
      where: whereClause,
      include: {
        participant: true,
        round: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Retrieves Volunteer Dashboard data with exact (roundId, lobbyId) pair matching.
   * Eliminates Cartesian cross-combination data leakage completely.
   */
  public static async getVolunteerDashboardData(userId: string) {
    const volunteer = await prisma.volunteer.findUnique({
      where: { userId },
    });
    if (!volunteer) {
      throw ApiError.forbidden("Volunteer profile not found.");
    }

    // 1. Fetch active assignments
    const assignments = await prisma.volunteerAssignment.findMany({
      where: {
        volunteerId: volunteer.id,
        round: { isArchived: false },
      },
      include: {
        round: true,
        lobby: true,
      },
    });

    if (assignments.length === 0) {
      return {
        assignments: [],
        rounds: [],
        lobbies: [],
        participantsWithStatus: [],
      };
    }

    // 2. Exact assignment pair mapping (preserves exact pairs, no Cartesian leakage)
    const exactPairs = assignments.map((a) => ({
      roundId: a.roundId,
      lobbyId: a.lobbyId,
    }));

    // 3. Query participants registered strictly in these exact pairs
    const roundParticipants = await prisma.roundParticipant.findMany({
      where: {
        OR: exactPairs.map((pair) => ({
          roundId: pair.roundId,
          lobbyId: pair.lobbyId,
        })),
      },
      include: {
        participant: true,
        round: true,
        lobby: true,
      },
      orderBy: [
        { round: { roundNumber: "asc" } },
        { lobby: { name: "asc" } },
        { participant: { participantId: "asc" } },
      ],
    });

    // 4. Query score entries strictly within these exact participant/round combinations
    let existingScores: Array<any> = [];
    if (roundParticipants.length > 0) {
      existingScores = await prisma.scoreEntry.findMany({
        where: {
          OR: roundParticipants.map((rp) => ({
            roundId: rp.roundId,
            participantId: rp.participantId,
          })),
        },
      });
    }

    const scoreMap = new Map<string, any>();
    for (const score of existingScores) {
      scoreMap.set(`${score.roundId}:${score.participantId}`, score);
    }

    // 5. Map participants with completion status
    const participantsWithStatus = roundParticipants.map((rp) => {
      const score = scoreMap.get(`${rp.roundId}:${rp.participantId}`);
      return {
        id: rp.participant.id,
        participantId: rp.participant.participantId,
        name: rp.participant.name,
        amongUsUsername: rp.participant.amongUsUsername,
        roundId: rp.roundId,
        roundName: rp.round.name,
        roundNumber: rp.round.roundNumber,
        roundType: rp.round.type,
        scoreLocked: rp.round.scoreLocked,
        lobbyId: rp.lobbyId,
        lobbyName: rp.lobby.name,
        status: score ? "COMPLETED" : "PENDING",
        scoreEntry: score
          ? {
              id: score.id,
              totalScore: score.totalScore,
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
            }
          : null,
      };
    });

    // Extract unique rounds and lobbies
    const uniqueRoundsMap = new Map<string, any>();
    const uniqueLobbiesMap = new Map<string, any>();
    for (const a of assignments) {
      uniqueRoundsMap.set(a.round.id, a.round);
      uniqueLobbiesMap.set(a.lobby.id, a.lobby);
    }

    return {
      assignments: assignments.map((a) => ({
        id: a.id,
        roundId: a.roundId,
        roundName: a.round.name,
        lobbyId: a.lobbyId,
        lobbyName: a.lobby.name,
      })),
      rounds: Array.from(uniqueRoundsMap.values()),
      lobbies: Array.from(uniqueLobbiesMap.values()),
      participantsWithStatus,
    };
  }

  /**
   * Retrieves all active scoring rules (used by frontend for preview).
   */
  public static async getScoringRules() {
    return await prisma.scoringRule.findMany({
      orderBy: { sortOrder: "asc" },
    });
  }

  /**
   * Updates a scoring rule point value (Admin only).
   */
  public static async updateScoringRule(
    id: string,
    input: UpdateScoringRuleInput,
    adminUserId: string,
    ipAddress?: string
  ) {
    const existing = await prisma.scoringRule.findUnique({ where: { id } });
    if (!existing) {
      throw ApiError.notFound("Scoring rule not found.");
    }

    const updated = await prisma.scoringRule.update({
      where: { id },
      data: {
        points: input.points,
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: "SCORING_RULE_UPDATED",
        entityType: "SCORING_RULE",
        entityId: id,
        oldValue: { points: existing.points, isActive: existing.isActive },
        newValue: { points: updated.points, isActive: updated.isActive },
        reason: `Updated rule ${existing.ruleKey} points to ${input.points}`,
        ipAddress,
      },
    });

    LeaderboardService.notifyUpdate();
    return updated;
  }
}
