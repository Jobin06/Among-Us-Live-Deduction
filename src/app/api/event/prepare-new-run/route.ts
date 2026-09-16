import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole, handleApiError, jsonSuccess } from "@/lib/api-helpers";
import { EventService } from "@/services/event.service";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole([UserRole.ADMIN]);
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;

    const result = await EventService.prepareNewEventRun(user.id, clientIp);
    return jsonSuccess({
      message: "Event run prepared: previous rounds archived and event workflow state reset",
      result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
