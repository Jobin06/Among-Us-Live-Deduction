import { z } from "zod";
import { EventStatus, TieBreakMethod } from "@prisma/client";

export const updateEventSettingsSchema = z.object({
  eventName: z.string().min(1).max(200).optional(),
  eventDescription: z.string().nullable().optional(),
  eventDate: z.string().datetime().nullable().optional(),
  eventStatus: z.nativeEnum(EventStatus).optional(),
  venue: z.string().max(200).nullable().optional(),
  eventStart: z.string().max(10).optional(),
  eventEnd: z.string().max(10).optional(),
  qualificationCount: z.number().int().positive().optional(),
  finalScoreFormula: z.enum(["SUM", "WEIGHTED"]).nullable().optional(),
  preliminaryWeight: z.number().positive().optional(),
  finalWeight: z.number().positive().optional(),
  tieBreakMethod: z.nativeEnum(TieBreakMethod).optional(),
  maxEliminationsPerRound: z.number().int().positive().nullable().optional(),
});

export type UpdateEventSettingsInput = z.infer<typeof updateEventSettingsSchema>;

export const configureFormulaSchema = z
  .object({
    formula: z.enum(["SUM", "WEIGHTED"], {
      required_error: "Formula must be explicitly configured as 'SUM' or 'WEIGHTED'",
    }),
    preliminaryWeight: z.number().positive().default(1.0),
    finalWeight: z.number().positive().default(1.0),
  })
  .refine(
    (data) => {
      if (data.formula === "WEIGHTED") {
        return data.preliminaryWeight > 0 && data.finalWeight > 0;
      }
      return true;
    },
    {
      message: "Preliminary and Final weights must be greater than 0 for WEIGHTED formula",
    }
  );

export type ConfigureFormulaInput = z.infer<typeof configureFormulaSchema>;
