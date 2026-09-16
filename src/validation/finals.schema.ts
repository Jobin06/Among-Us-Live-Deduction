import { z } from "zod";

export const enrollRosterSchema = z.object({
  roundId: z.string().uuid("Invalid round ID"),
  lobbyId: z.string().uuid("Invalid lobby ID"),
});

export type EnrollRosterInput = z.infer<typeof enrollRosterSchema>;

export const unlockResultsSchema = z.object({
  reason: z.string().min(1, "Unlock reason is required").max(500),
});

export type UnlockResultsInput = z.infer<typeof unlockResultsSchema>;
