import { NextRequest } from "next/server";
import { requireAuth, requireRole, jsonSuccess, handleApiError } from "@/lib/api-helpers";
import { UserRole } from "@prisma/client";
import { AdminService } from "@/services/admin.service";
import { createRoundSchema } from "@/validation/admin.schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/rounds
 * Returns rounds. Admin and Volunteers only.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role === UserRole.PARTICIPANT) {
      return handleApiError(new Error("Access denied"));
    }

    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("includeArchived") === "true" && user.role === UserRole.ADMIN;

    const rounds = await AdminService.getRounds(includeArchived);
    return jsonSuccess(rounds);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/rounds
 * Creates a new round. Admin only.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole([UserRole.ADMIN]);
    const body = await req.json();
    const validatedData = createRoundSchema.parse(body);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;
    const round = await AdminService.createRound(validatedData, user.id, clientIp);

    return jsonSuccess(round, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
