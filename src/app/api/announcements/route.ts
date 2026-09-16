import { NextRequest } from "next/server";
import { jsonSuccess, handleApiError, requireAuth, requireRole } from "@/lib/api-helpers";
import { UserRole } from "@prisma/client";
import { ParticipantService } from "@/services/participant.service";
import { AdminService } from "@/services/admin.service";
import { createAnnouncementSchema } from "@/validation/admin.schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/announcements
 * If ?all=true and user is ADMIN, returns all announcements.
 * Otherwise returns active announcements.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const showAll = searchParams.get("all") === "true";

    if (showAll && user.role === UserRole.ADMIN) {
      const allAnnouncements = await AdminService.getAllAnnouncements();
      return jsonSuccess(allAnnouncements);
    }

    const announcements = await ParticipantService.getActiveAnnouncements();
    return jsonSuccess(announcements);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/announcements
 * Creates a tournament announcement. Admin only.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole([UserRole.ADMIN]);
    const body = await req.json();
    const validatedData = createAnnouncementSchema.parse(body);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;
    const created = await AdminService.createAnnouncement(validatedData, user.id, clientIp);

    return jsonSuccess(created, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
