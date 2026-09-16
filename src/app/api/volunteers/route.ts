import { requireRole, jsonSuccess, handleApiError } from "@/lib/api-helpers";
import { UserRole } from "@prisma/client";
import { AdminService } from "@/services/admin.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/volunteers
 * Returns active volunteers for assignment interfaces. Admin only.
 */
export async function GET() {
  try {
    await requireRole([UserRole.ADMIN]);
    const volunteers = await AdminService.getVolunteers();
    return jsonSuccess(volunteers);
  } catch (error) {
    return handleApiError(error);
  }
}
