import { jsonSuccess, handleApiError, requireRole } from "@/lib/api-helpers";
import { UserRole } from "@prisma/client";
import { ParticipantService } from "@/services/participant.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/participants/me/dashboard
 * Resolves all primary dashboard data for the authenticated participant.
 * Identity is derived exclusively from session.user.id.
 */
export async function GET() {
  try {
    const user = await requireRole([UserRole.PARTICIPANT]);
    const data = await ParticipantService.getParticipantDashboardData(user.id);
    return jsonSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
