import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole, handleApiError, jsonSuccess } from "@/lib/api-helpers";
import { EventService } from "@/services/event.service";
import { updateEventSettingsSchema } from "@/validation/event.schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await EventService.getSettings();
    return jsonSuccess(settings);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireRole([UserRole.ADMIN]);
    const body = await req.json();
    const validatedData = updateEventSettingsSchema.parse(body);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;
    const updated = await EventService.updateSettings(validatedData, user.id, clientIp);

    return jsonSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
