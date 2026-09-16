import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-helpers";
import { AuditService } from "@/services/audit.service";
import { CreateVolunteerAssignmentInput } from "@/validation/volunteer-assignment.schema";

export class VolunteerAssignmentService {
  /**
   * Assigns a volunteer to score a specific round and lobby.
   */
  public static async createAssignment(
    input: CreateVolunteerAssignmentInput,
    assignedById: string,
    ipAddress?: string
  ) {
    // 1. Verify volunteer exists
    const volunteer = await prisma.volunteer.findUnique({
      where: { id: input.volunteerId },
      include: { user: true },
    });

    if (!volunteer || !volunteer.user.isActive) {
      throw new ApiError("Active volunteer profile not found", 404);
    }

    // 2. Verify round exists and is not archived
    const round = await prisma.round.findUnique({
      where: { id: input.roundId },
    });

    if (!round) {
      throw new ApiError("Round not found", 404);
    }

    if (round.isArchived) {
      throw new ApiError("Cannot assign volunteers to archived rounds", 400);
    }

    // 3. Verify lobby exists and is active
    const lobby = await prisma.lobby.findUnique({
      where: { id: input.lobbyId },
    });

    if (!lobby || lobby.status !== "ACTIVE") {
      throw new ApiError("Active lobby not found", 404);
    }

    // 4. Create assignment (handles uniqueness check)
    const existing = await prisma.volunteerAssignment.findUnique({
      where: {
        volunteerId_roundId_lobbyId: {
          volunteerId: input.volunteerId,
          roundId: input.roundId,
          lobbyId: input.lobbyId,
        },
      },
    });

    if (existing) {
      throw new ApiError("Volunteer is already assigned to this round and lobby", 409);
    }

    const assignment = await prisma.volunteerAssignment.create({
      data: {
        volunteerId: input.volunteerId,
        roundId: input.roundId,
        lobbyId: input.lobbyId,
        assignedById,
      },
      include: {
        volunteer: true,
        round: true,
        lobby: true,
      },
    });

    // 5. Audit log
    await AuditService.log({
      userId: assignedById,
      action: "VOLUNTEER_ASSIGNED",
      entityType: "VOLUNTEER_ASSIGNMENT",
      entityId: assignment.id,
      newValue: {
        volunteerId: assignment.volunteerId,
        volunteerName: assignment.volunteer.name,
        roundId: assignment.roundId,
        roundName: assignment.round.name,
        lobbyId: assignment.lobbyId,
        lobbyName: assignment.lobby.name,
      },
      reason: `Assigned volunteer ${assignment.volunteer.name} to ${assignment.round.name} (${assignment.lobby.name})`,
      ipAddress,
    });

    return assignment;
  }

  /**
   * Bulk creates volunteer assignments in a single transaction.
   */
  public static async createBulkAssignments(
    inputs: CreateVolunteerAssignmentInput[],
    assignedById: string,
    ipAddress?: string
  ) {
    const results = [];
    for (const item of inputs) {
      const created = await this.createAssignment(item, assignedById, ipAddress);
      results.push(created);
    }
    return results;
  }

  /**
   * Removes a volunteer assignment.
   */
  public static async removeAssignment(
    assignmentId: string,
    adminUserId: string,
    ipAddress?: string
  ) {
    const assignment = await prisma.volunteerAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        volunteer: true,
        round: true,
        lobby: true,
      },
    });

    if (!assignment) {
      throw new ApiError("Volunteer assignment not found", 404);
    }

    await prisma.volunteerAssignment.delete({
      where: { id: assignmentId },
    });

    await AuditService.log({
      userId: adminUserId,
      action: "VOLUNTEER_ASSIGNMENT_REMOVED",
      entityType: "VOLUNTEER_ASSIGNMENT",
      entityId: assignmentId,
      oldValue: {
        volunteerName: assignment.volunteer.name,
        roundName: assignment.round.name,
        lobbyName: assignment.lobby.name,
      },
      reason: "Admin unassigned volunteer from round/lobby",
      ipAddress,
    });

    return { success: true };
  }

  /**
   * Gets all active assignments for a volunteer (filters out archived rounds).
   */
  public static async getVolunteerAssignments(volunteerId: string) {
    return await prisma.volunteerAssignment.findMany({
      where: {
        volunteerId,
        round: {
          isArchived: false,
        },
      },
      include: {
        round: true,
        lobby: true,
      },
      orderBy: [
        { round: { roundNumber: "asc" } },
        { lobby: { name: "asc" } },
      ],
    });
  }

  /**
   * Gets all assignments (admin view, optional round/lobby filters).
   */
  public static async getAllAssignments(filters?: { roundId?: string; lobbyId?: string }) {
    const where: any = {
      round: {
        isArchived: false,
      },
    };

    if (filters?.roundId) where.roundId = filters.roundId;
    if (filters?.lobbyId) where.lobbyId = filters.lobbyId;

    return await prisma.volunteerAssignment.findMany({
      where,
      include: {
        volunteer: true,
        round: true,
        lobby: true,
        assignedBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: [
        { round: { roundNumber: "asc" } },
        { lobby: { name: "asc" } },
      ],
    });
  }

  /**
   * Validates if a volunteer has an assignment for a given round and lobby.
   */
  public static async isVolunteerAssigned(
    volunteerId: string,
    roundId: string,
    lobbyId: string
  ): Promise<boolean> {
    const assignment = await prisma.volunteerAssignment.findUnique({
      where: {
        volunteerId_roundId_lobbyId: {
          volunteerId,
          roundId,
          lobbyId,
        },
      },
      include: {
        round: true,
      },
    });

    if (!assignment || assignment.round.isArchived) {
      return false;
    }

    return true;
  }
}
