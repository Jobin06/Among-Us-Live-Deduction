import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole, handleApiError, jsonSuccess } from "@/lib/api-helpers";
import { FinalsService } from "@/services/finals.service";
import { unlockResultsSchema } from "@/validation/finals.schema";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole([UserRole.ADMIN]);
    const body = await req.json();
    const validatedData = unlockResultsSchema.parse(body);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;
    const settings = await FinalsService.unlockResults(validatedData, user.id, clientIp);

    return jsonSuccess({
      message: "Tournament results unlocked successfully.",
      settings,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
