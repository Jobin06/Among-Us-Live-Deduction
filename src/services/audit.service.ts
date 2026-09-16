import { prisma } from "@/lib/prisma";
import { QueryAuditLogsInput } from "@/validation/audit.schema";

export interface CreateAuditLogParams {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: any;
  newValue?: any;
  reason?: string | null;
  ipAddress?: string | null;
}

/**
 * Append-Only Audit Logging Service.
 * Defense-in-depth: This service strictly exposes create and read methods.
 * No update or delete operations exist.
 */
export class AuditService {
  /**
   * Records a new administrative, event, or scoring action in the immutable audit log.
   */
  public static async log(params: CreateAuditLogParams) {
    return await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        oldValue: params.oldValue ?? undefined,
        newValue: params.newValue ?? undefined,
        reason: params.reason ?? null,
        ipAddress: params.ipAddress ?? null,
      },
    });
  }

  /**
   * Retrieves paginated audit logs with optional filters.
   */
  public static async getLogs(query: QueryAuditLogsInput) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = { contains: query.action, mode: "insensitive" };

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Fetches a single audit log by ID.
   */
  public static async getLogById(id: string) {
    return await prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
      },
    });
  }
}
