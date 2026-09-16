import { NextRequest } from "next/server";
import { requireAuth, handleApiError, jsonSuccess } from "@/lib/api-helpers";
import { FinalsService } from "@/services/finals.service";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    await requireAuth();
    const roster = await FinalsService.getFinalsRoster();
    return jsonSuccess({
      roster: roster.map((r) => ({
        id: r.id,
        participantDbId: r.participantId,
        participantId: r.participant.participantId,
        name: r.participant.name,
        amongUsUsername: r.participant.amongUsUsername,
        preliminaryScore: r.preliminaryScore,
        rank: r.rank,
        status: r.participant.status,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
