import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole, handleApiError, jsonSuccess, ApiError } from "@/lib/api-helpers";
import { VolunteerAssignmentService } from "@/services/volunteer-assignment.service";
import { createVolunteerAssignmentSchema } from "@/validation/volunteer-assignment.schema";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.role === UserRole.ADMIN) {
      const { searchParams } = new URL(req.url);
      const roundId = searchParams.get("roundId") || undefined;
      const lobbyId = searchParams.get("lobbyId") || undefined;

      const assignments = await VolunteerAssignmentService.getAllAssignments({ roundId, lobbyId });
      return jsonSuccess(assignments);
    }

    if (user.role === UserRole.VOLUNTEER) {
      if (!user.volunteerId) {
        throw new ApiError("Volunteer profile not associated with this account", 403);
      }
      const assignments = await VolunteerAssignmentService.getVolunteerAssignments(user.volunteerId);
      return jsonSuccess(assignments);
    }

    // Participants are forbidden from accessing volunteer assignment records
    throw new ApiError("Access denied", 403);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole([UserRole.ADMIN]);
    const body = await req.json();
    const validatedData = createVolunteerAssignmentSchema.parse(body);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;
    const assignment = await VolunteerAssignmentService.createAssignment(
      validatedData,
      user.id,
      clientIp
    );

    return jsonSuccess(assignment, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
