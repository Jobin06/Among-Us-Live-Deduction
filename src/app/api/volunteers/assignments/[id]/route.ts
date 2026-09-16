import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole, handleApiError, jsonSuccess } from "@/lib/api-helpers";
import { VolunteerAssignmentService } from "@/services/volunteer-assignment.service";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole([UserRole.ADMIN]);
    const assignmentId = params.id;
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;

    const result = await VolunteerAssignmentService.removeAssignment(assignmentId, user.id, clientIp);
    return jsonSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
