import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export class ApiError extends Error {
  public statusCode: number;
  public details?: any;

  constructor(message: string, statusCode = 400, details?: any) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
  }

  public static badRequest(message: string, details?: any): ApiError {
    return new ApiError(message, 400, details);
  }

  public static unauthorized(message = "Authentication required", details?: any): ApiError {
    return new ApiError(message, 401, details);
  }

  public static forbidden(message = "Forbidden", details?: any): ApiError {
    return new ApiError(message, 403, details);
  }

  public static notFound(message = "Not found", details?: any): ApiError {
    return new ApiError(message, 404, details);
  }

  public static conflict(message: string, details?: any): ApiError {
    return new ApiError(message, 409, details);
  }

  public static internal(message = "Internal server error", details?: any): ApiError {
    return new ApiError(message, 500, details);
  }
}

export function jsonSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function jsonError(message: string, status = 400, details?: any) {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        details: details ?? null,
      },
    },
    { status }
  );
}

/**
 * Ensures the request is from an authenticated, active user.
 */
export async function requireAuth() {
  const session = await getServerAuthSession();

  if (!session || !session.user || !session.user.id) {
    throw new ApiError("Authentication required", 401);
  }

  if (!session.user.isActive) {
    throw new ApiError("Account has been deactivated", 403);
  }

  return session.user;
}

/**
 * Ensures the authenticated user possesses one of the allowed roles.
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const user = await requireAuth();

  if (!allowedRoles.includes(user.role)) {
    throw new ApiError(
      `Access denied: requires one of roles [${allowedRoles.join(", ")}]`,
      403
    );
  }

  return user;
}

/**
 * Enforces volunteer round/lobby assignment scope.
 * - ADMIN: unrestricted access across all rounds & lobbies.
 * - VOLUNTEER: restricted to assigned (round, lobby) pairs via volunteer_assignments.
 * - PARTICIPANT: completely forbidden.
 */
export async function requireVolunteerScope(roundId: string, lobbyId: string) {
  const user = await requireAuth();

  if (user.role === UserRole.ADMIN) {
    return { user, isExemptAdmin: true };
  }

  if (user.role === UserRole.VOLUNTEER) {
    if (!user.volunteerId) {
      throw new ApiError("Volunteer profile not associated with this account", 403);
    }

    const assignment = await prisma.volunteerAssignment.findUnique({
      where: {
        volunteerId_roundId_lobbyId: {
          volunteerId: user.volunteerId,
          roundId,
          lobbyId,
        },
      },
    });

    if (!assignment) {
      throw new ApiError(
        "Forbidden: You are not assigned to score this round and lobby",
        403
      );
    }

    return { user, isExemptAdmin: false, assignment };
  }

  throw new ApiError("Forbidden: Only volunteers and administrators may enter scores", 403);
}

/**
 * Standard API error wrapper catching ApiError and returning clean JSON.
 */
export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return jsonError(error.message, error.statusCode, error.details);
  }

  console.error("Unhandled API Error:", error);
  const isProduction = process.env.NODE_ENV === "production";
  const message = isProduction
    ? "Internal server error"
    : error instanceof Error
    ? error.message
    : "Internal server error";
  return jsonError(message, 500);
}

