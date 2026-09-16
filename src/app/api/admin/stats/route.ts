import { requireRole, jsonSuccess, handleApiError } from "@/lib/api-helpers";
import { UserRole } from "@prisma/client";
import { AdminService } from "@/services/admin.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/stats
 * Operational tournament statistics for the Admin Dashboard.
 * Admin only.
 */
export async function GET() {
  try {
    await requireRole([UserRole.ADMIN]);
    const stats = await AdminService.getStats();
    return jsonSuccess(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
