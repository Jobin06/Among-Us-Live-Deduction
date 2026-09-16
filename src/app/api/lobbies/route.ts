import { NextRequest } from "next/server";
import { requireAuth, requireRole, jsonSuccess, handleApiError } from "@/lib/api-helpers";
import { UserRole } from "@prisma/client";
import { AdminService } from "@/services/admin.service";
import { createLobbySchema } from "@/validation/admin.schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/lobbies
 * Returns active lobbies with capacity and participant counts.
 */
export async function GET() {
  try {
    await requireAuth();
    const lobbies = await AdminService.getLobbies();
    return jsonSuccess(lobbies);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/lobbies
 * Creates a new lobby. Admin only.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole([UserRole.ADMIN]);
    const body = await req.json();
    const validatedData = createLobbySchema.parse(body);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;
    const lobby = await AdminService.createLobby(validatedData, user.id, clientIp);

    return jsonSuccess(lobby, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
