import { z } from "zod";

export const createVolunteerAssignmentSchema = z.object({
  volunteerId: z.string().uuid("Invalid volunteer ID"),
  roundId: z.string().uuid("Invalid round ID"),
  lobbyId: z.string().uuid("Invalid lobby ID"),
});

export type CreateVolunteerAssignmentInput = z.infer<typeof createVolunteerAssignmentSchema>;

export const bulkVolunteerAssignmentSchema = z.object({
  assignments: z
    .array(createVolunteerAssignmentSchema)
    .min(1, "At least one assignment is required"),
});

export type BulkVolunteerAssignmentInput = z.infer<typeof bulkVolunteerAssignmentSchema>;
