import { NextRequest } from "next/server";
import { jsonSuccess, handleApiError } from "@/lib/api-helpers";
import { LeaderboardService } from "@/services/leaderboard.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/leaderboard
 * Public endpoint returning the sanitized tournament leaderboard DTO.
 * Operates without authentication to support public arena screens and spectators.
 */
export async function GET(_req: NextRequest) {
  try {
    const data = await LeaderboardService.getLeaderboardData();
    return jsonSuccess(data);
  } catch (error) {
    return handleApiError(error);
  }
}
