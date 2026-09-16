import { NextRequest } from "next/server";
import { requireRole, jsonSuccess, handleApiError } from "@/lib/api-helpers";
import { UserRole } from "@prisma/client";
import { AdminService } from "@/services/admin.service";
import { updateAnnouncementSchema } from "@/validation/admin.schema";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

/**
 * PUT /api/announcements/[id]
 * Updates announcement content, priority, or active state. Admin only.
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole([UserRole.ADMIN]);
    const body = await req.json();
    const validatedData = updateAnnouncementSchema.parse(body);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;
    const updated = await AdminService.updateAnnouncement(params.id, validatedData, user.id, clientIp);

    return jsonSuccess(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/announcements/[id]
 * Soft-deactivates the announcement (isActive = false) to preserve tournament audit history.
 * Admin only.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole([UserRole.ADMIN]);
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;

    const updated = await AdminService.softDeactivateAnnouncement(params.id, user.id, clientIp);
    return jsonSuccess({
      message: "Announcement deactivated successfully",
      announcement: updated,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
