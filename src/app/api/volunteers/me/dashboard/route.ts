import { requireRole, jsonSuccess, handleApiError } from "@/lib/api-helpers";
import { UserRole } from "@prisma/client";
import { ScoringService } from "@/services/scoring.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/volunteers/me/dashboard
 * Retrieves dashboard data strictly scoped to the authenticated volunteer's
 * exact (roundId, lobbyId) assigned pairs.
 */
export async function GET() {
  try {
    const user = await requireRole([UserRole.VOLUNTEER]);

    const dashboardData = await ScoringService.getVolunteerDashboardData(user.id);
    return jsonSuccess(dashboardData);
  } catch (error) {
    return handleApiError(error);
  }
}
