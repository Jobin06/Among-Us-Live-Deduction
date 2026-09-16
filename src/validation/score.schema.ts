import { z } from "zod";
import { PlayerRole } from "@prisma/client";

// Base performance fields schema with non-negative constraints
const performanceFieldsSchema = z.object({
  correctVote: z.boolean().default(false),
  correctIdentification: z.boolean().default(false),
  tasksCompleted: z
    .number()
    .int("Tasks completed must be an integer")
    .min(0, "Tasks completed cannot be negative")
    .default(0),
  survived: z.boolean().default(false),
  wonAsCrewmate: z.boolean().default(false),
  wonAsImposter: z.boolean().default(false),
  successfulElimination: z
    .number()
    .int("Eliminations must be an integer")
    .min(0, "Eliminations cannot be negative")
    .default(0),
  avoidedIdentification: z.boolean().default(false),
  votedOutAsImposter: z.boolean().default(false),
});

/**
 * Validates role-specific performance constraints:
 * - CREWMATE: cannot have imposter fields (eliminations, won as imposter, avoided id, voted out as imposter)
 * - IMPOSTER: cannot have crewmate fields (tasks completed, won as crewmate)
 * - Cross-role: voted out as imposter cannot survive
 */
function refineRoleConstraints<T extends {
  role: PlayerRole;
  wonAsImposter?: boolean;
  successfulElimination?: number;
  avoidedIdentification?: boolean;
  votedOutAsImposter?: boolean;
  wonAsCrewmate?: boolean;
  tasksCompleted?: number;
  survived?: boolean;
}>(data: T, ctx: z.RefinementCtx) {
  if (data.role === PlayerRole.CREWMATE) {
    if (data.wonAsImposter) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Crewmate cannot win as Imposter",
        path: ["wonAsImposter"],
      });
    }
    if ((data.successfulElimination ?? 0) > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Crewmate cannot perform eliminations",
        path: ["successfulElimination"],
      });
    }
    if (data.avoidedIdentification) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only Imposters can avoid identification",
        path: ["avoidedIdentification"],
      });
    }
    if (data.votedOutAsImposter) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only Imposters can be voted out as Imposter",
        path: ["votedOutAsImposter"],
      });
    }
  }

  if (data.role === PlayerRole.IMPOSTER) {
    if (data.wonAsCrewmate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Imposter cannot win as Crewmate",
        path: ["wonAsCrewmate"],
      });
    }
    if ((data.tasksCompleted ?? 0) > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Imposters do not complete tasks for scoring",
        path: ["tasksCompleted"],
      });
    }
  }

  if (data.votedOutAsImposter && data.survived) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Cannot survive if voted out",
      path: ["survived"],
    });
  }
}

// 1. Create Score Schema
// Explicitly strips any client-provided totalScore / total_score to preserve backend authority
export const createScoreSchema = z
  .object({
    roundId: z.string().uuid("Invalid round ID format"),
    participantId: z.string().uuid("Invalid participant ID format"),
    lobbyId: z.string().uuid("Invalid lobby ID format"),
    role: z.nativeEnum(PlayerRole, {
      errorMap: () => ({ message: "Role must be CREWMATE or IMPOSTER" }),
    }),
  })
  .merge(performanceFieldsSchema)
  .strip() // Strips totalScore or total_score from payload
  .superRefine(refineRoleConstraints);

export type CreateScoreInput = z.infer<typeof createScoreSchema>;

// 2. Update Score Schema
export const updateScoreSchema = z
  .object({
    role: z.nativeEnum(PlayerRole, {
      errorMap: () => ({ message: "Role must be CREWMATE or IMPOSTER" }),
    }),
    reason: z
      .string()
      .trim()
      .min(3, "Edit reason must be at least 3 characters"),
  })
  .merge(performanceFieldsSchema)
  .strip()
  .superRefine(refineRoleConstraints);

export type UpdateScoreInput = z.infer<typeof updateScoreSchema>;

// 3. Update Scoring Rule Schema (Admin only)
export const updateScoringRuleSchema = z.object({
  points: z.number().int("Points must be an integer"),
  isActive: z.boolean().optional(),
});

export type UpdateScoringRuleInput = z.infer<typeof updateScoringRuleSchema>;
