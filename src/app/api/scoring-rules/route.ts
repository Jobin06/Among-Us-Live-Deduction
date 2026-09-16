import { NextRequest } from "next/server";
import { jsonSuccess, handleApiError } from "@/lib/api-helpers";
import { ScoringService } from "@/services/scoring.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/scoring-rules
 * Public/authenticated endpoint to retrieve active scoring rules.
 * Used by frontend to compute live, non-authoritative score previews.
 */
export async function GET(_req: NextRequest) {
  try {
    const rules = await ScoringService.getScoringRules();
    return jsonSuccess(rules);
  } catch (error) {
    return handleApiError(error);
  }
}
