import { NextRequest } from "next/server";
import { requireRole, jsonSuccess, handleApiError } from "@/lib/api-helpers";
import { UserRole } from "@prisma/client";
import { ScoringService } from "@/services/scoring.service";
import { createScoreSchema } from "@/validation/score.schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/scores
 * Lists scores with optional roundId and lobbyId filters.
 * VOLUNTEER is scoped strictly to assigned rounds/lobbies.
 * ADMIN has full query access.
 * PARTICIPANT is rejected with 403.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireRole([UserRole.ADMIN, UserRole.VOLUNTEER]);

    const url = new URL(req.url);
    const roundId = url.searchParams.get("roundId") || undefined;
    const lobbyId = url.searchParams.get("lobbyId") || undefined;

    const actor = {
      userId: user.id,
      role: user.role,
      username: user.username,
      volunteerId: user.volunteerId,
    };

    const scores = await ScoringService.getScores({ roundId, lobbyId }, actor);
    return jsonSuccess(scores);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/scores
 * Creates a new score entry.
 * Strips client-provided total_score, authoritatively computes on server.
 * Requires VOLUNTEER (within scope) or ADMIN.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole([UserRole.ADMIN, UserRole.VOLUNTEER]);

    const body = await req.json();
    const parseResult = createScoreSchema.safeParse(body);
    if (!parseResult.success) {
      return handleApiError(parseResult.error);
    }

    const forwarded = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    const ipAddress = forwarded ? forwarded.split(",")[0].trim() : undefined;

    const actor = {
      userId: user.id,
      role: user.role,
      username: user.username,
      volunteerId: user.volunteerId,
    };

    const score = await ScoringService.createScoreEntry(parseResult.data, actor, ipAddress);
    return jsonSuccess(score, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
