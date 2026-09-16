import { NextRequest } from "next/server";
import { requireRole, jsonSuccess, handleApiError } from "@/lib/api-helpers";
import { UserRole } from "@prisma/client";
import { ScoringService } from "@/services/scoring.service";
import { updateScoringRuleSchema } from "@/validation/score.schema";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

/**
 * PUT /api/scoring-rules/[id]
 * Updates a scoring rule point value. ADMIN only.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole([UserRole.ADMIN]);

    const body = await req.json();
    const parseResult = updateScoringRuleSchema.safeParse(body);
    if (!parseResult.success) {
      return handleApiError(parseResult.error);
    }

    const forwarded = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    const ipAddress = forwarded ? forwarded.split(",")[0].trim() : undefined;

    const updated = await ScoringService.updateScoringRule(
      params.id,
      parseResult.data,
      user.id,
      ipAddress
    );

    return jsonSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
