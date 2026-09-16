import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole, handleApiError, jsonSuccess } from "@/lib/api-helpers";
import { FinalsService } from "@/services/finals.service";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole([UserRole.ADMIN]);
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;

    const settings = await FinalsService.publishResults(user.id, clientIp);
    return jsonSuccess({
      message: "Final tournament results published and locked successfully.",
      settings,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
