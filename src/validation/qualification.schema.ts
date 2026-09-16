import { z } from "zod";

export const resolveTieSchema = z.object({
  participantId: z.string().uuid("Invalid participant ID"),
  reason: z.string().min(1, "Reason is required").max(255).optional(),
});

export type ResolveTieInput = z.infer<typeof resolveTieSchema>;
