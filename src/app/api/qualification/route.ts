import { NextRequest } from "next/server";
import { requireAuth, handleApiError, jsonSuccess } from "@/lib/api-helpers";
import { QualificationService } from "@/services/qualification.service";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    await requireAuth();
    const list = await QualificationService.getQualificationList();
    return jsonSuccess({
      qualifications: list.map((q) => ({
        id: q.id,
        participantId: q.participantId,
        participantCode: q.participant.participantId,
        name: q.participant.name,
        amongUsUsername: q.participant.amongUsUsername,
        preliminaryScore: q.preliminaryScore,
        rank: q.rank,
        qualified: q.qualified,
        isTieAtCutoff: q.isTieAtCutoff,
        adminOverride: q.adminOverride,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
