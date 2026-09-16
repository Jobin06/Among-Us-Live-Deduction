import { jsonSuccess, handleApiError, requireAuth } from "@/lib/api-helpers";
import { ParticipantService } from "@/services/participant.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/schedule
 * Retrieves chronological tournament schedule items.
 */
export async function GET() {
  try {
    await requireAuth();
    const schedule = await ParticipantService.getScheduleItems();
    return jsonSuccess(schedule);
  } catch (error) {
    return handleApiError(error);
  }
}
