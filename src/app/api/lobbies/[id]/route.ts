import { NextRequest } from "next/server";
import { requireRole, jsonSuccess, handleApiError } from "@/lib/api-helpers";
import { UserRole } from "@prisma/client";
import { AdminService } from "@/services/admin.service";
import { updateLobbySchema } from "@/validation/admin.schema";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

/**
 * PUT /api/lobbies/[id]
 * Updates lobby settings. Admin only.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole([UserRole.ADMIN]);
    const body = await req.json();
    const validatedData = updateLobbySchema.parse(body);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;
    const updated = await AdminService.updateLobby(params.id, validatedData, user.id, clientIp);

    return jsonSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
