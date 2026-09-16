import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole, handleApiError, jsonSuccess } from "@/lib/api-helpers";
import { EventService } from "@/services/event.service";
import { configureFormulaSchema } from "@/validation/event.schema";

export async function PUT(req: NextRequest) {
  try {
    const user = await requireRole([UserRole.ADMIN]);
    const body = await req.json();
    const validatedData = configureFormulaSchema.parse(body);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;
    const updated = await EventService.configureFinalFormula(validatedData, user.id, clientIp);

    return jsonSuccess({
      message: `Final formula successfully configured as ${validatedData.formula}`,
      settings: updated,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
