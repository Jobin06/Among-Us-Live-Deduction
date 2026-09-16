import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole, handleApiError, jsonSuccess } from "@/lib/api-helpers";
import { QualificationService } from "@/services/qualification.service";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole([UserRole.ADMIN]);
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;

    const result = await QualificationService.calculateQualification(user.id, clientIp);
    return jsonSuccess(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}
