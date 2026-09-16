import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole, handleApiError, jsonSuccess } from "@/lib/api-helpers";
import { AuditService } from "@/services/audit.service";
import { queryAuditLogsSchema } from "@/validation/audit.schema";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireRole([UserRole.ADMIN]);

    const { searchParams } = new URL(req.url);
    const parsedQuery = queryAuditLogsSchema.parse({
      entityType: searchParams.get("entityType") || undefined,
      entityId: searchParams.get("entityId") || undefined,
      userId: searchParams.get("userId") || undefined,
      action: searchParams.get("action") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    const result = await AuditService.getLogs(parsedQuery);
    return jsonSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
