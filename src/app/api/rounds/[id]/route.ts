import { NextRequest } from "next/server";
import { requireRole, jsonSuccess, handleApiError } from "@/lib/api-helpers";
import { UserRole } from "@prisma/client";
import { AdminService } from "@/services/admin.service";
import { updateRoundSchema } from "@/validation/admin.schema";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/rounds/[id]
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const round = await prisma.round.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            roundParticipants: true,
            scoreEntries: true,
            volunteerAssignments: true,
          },
        },
      },
    });
    if (!round) {
      return handleApiError({ statusCode: 404, message: "Round not found" });
    }
    return jsonSuccess(round);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/rounds/[id]
 * Updates round properties, status, or scoreLocked state. Admin only.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole([UserRole.ADMIN]);
    const body = await req.json();
    const validatedData = updateRoundSchema.parse(body);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;
    const updated = await AdminService.updateRound(params.id, validatedData, user.id, clientIp);

    return jsonSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
