import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole, handleApiError, jsonSuccess } from "@/lib/api-helpers";
import { FinalsService } from "@/services/finals.service";
import { enrollRosterSchema } from "@/validation/finals.schema";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole([UserRole.ADMIN]);
    const body = await req.json();
    const validatedData = enrollRosterSchema.parse(body);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;
    const result = await FinalsService.enrollFinalsRoster(validatedData, user.id, clientIp);

    return jsonSuccess({
      message: "Qualified roster successfully enrolled into final round.",
      result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
