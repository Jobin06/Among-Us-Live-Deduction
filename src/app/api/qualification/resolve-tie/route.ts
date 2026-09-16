import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole, handleApiError, jsonSuccess } from "@/lib/api-helpers";
import { QualificationService } from "@/services/qualification.service";
import { resolveTieSchema } from "@/validation/qualification.schema";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole([UserRole.ADMIN]);
    const body = await req.json();
    const validatedData = resolveTieSchema.parse(body);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;
    const result = await QualificationService.resolveTie(validatedData, user.id, clientIp);

    return jsonSuccess({
      message: "Cutoff tie resolved successfully.",
      qualifications: result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
