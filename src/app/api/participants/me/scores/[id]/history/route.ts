import { NextRequest } from "next/server";
import { jsonSuccess, handleApiError, requireRole } from "@/lib/api-helpers";
import { UserRole } from "@prisma/client";
import { ParticipantService } from "@/services/participant.service";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/participants/me/scores/[id]/history
 * Retrieves versioned change history for a score entry belonging to the participant.
 * Enforces deterministic 404 Not Found if score does not belong to authenticated participant.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole([UserRole.PARTICIPANT]);
    const data = await ParticipantService.getParticipantScoreHistory(params.id, user.id);
    return jsonSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
