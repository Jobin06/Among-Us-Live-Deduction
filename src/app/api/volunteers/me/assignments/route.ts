import { requireRole, jsonSuccess, handleApiError } from "@/lib/api-helpers";
import { UserRole } from "@prisma/client";
import { VolunteerAssignmentService } from "@/services/volunteer-assignment.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/volunteers/me/assignments
 * Retrieves active assignments for the currently authenticated volunteer.
 */
export async function GET() {
  try {
    const user = await requireRole([UserRole.VOLUNTEER]);

    const volunteerId = user.volunteerId;
    if (!volunteerId) {
      return jsonSuccess([]);
    }

    const assignments = await VolunteerAssignmentService.getVolunteerAssignments(volunteerId);
    return jsonSuccess(assignments);
  } catch (error) {
    return handleApiError(error);
  }
}
