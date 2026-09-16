import { NextRequest } from "next/server";
import { requireRole, jsonSuccess, handleApiError } from "@/lib/api-helpers";
import { UserRole } from "@prisma/client";
import { ScoringService } from "@/services/scoring.service";
import { updateScoreSchema } from "@/validation/score.schema";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/scores/[id]
 * Retrieves a single score entry with history.
 * Scoped for VOLUNTEER (must be assigned to score's round and lobby).
 * ADMIN has full access.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole([UserRole.ADMIN, UserRole.VOLUNTEER]);

    const actor = {
      userId: user.id,
      role: user.role,
      username: user.username,
      volunteerId: user.volunteerId,
    };

    const score = await ScoringService.getScoreById(params.id, actor);
    return jsonSuccess(score);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/scores/[id]
 * Edits an existing score entry with concurrency row-locking.
 * Requires reason (min 3 chars). Recalculates authoritative score and creates versioned history.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole([UserRole.ADMIN, UserRole.VOLUNTEER]);

    const body = await req.json();
    const parseResult = updateScoreSchema.safeParse(body);
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

    const updatedScore = await ScoringService.updateScoreEntry(
      params.id,
      parseResult.data,
      actor,
      ipAddress
    );

    return jsonSuccess(updatedScore);
  } catch (error) {
    return handleApiError(error);
  }
}
