import { LeaderboardService } from "@/services/leaderboard.service";
import { prisma } from "@/lib/prisma";
import { EventStatus } from "@prisma/client";
import { ApiError } from "@/lib/api-helpers";
import { AuditService } from "@/services/audit.service";
import { UpdateEventSettingsInput, ConfigureFormulaInput } from "@/validation/event.schema";

export class EventService {
  /**
   * Retrieves the global event settings singleton.
   */
  public static async getSettings() {
    const settings = await prisma.eventSetting.findFirst();
    if (!settings) {
      throw new ApiError("Event configuration not found in database", 500);
    }
    return settings;
  }

  /**
   * Updates global event settings (Admin only).
   */
  public static async updateSettings(
    data: UpdateEventSettingsInput,
    adminUserId: string,
    ipAddress?: string
  ) {
    const current = await this.getSettings();

    const updated = await prisma.eventSetting.update({
      where: { id: current.id },
      data: {
        eventName: data.eventName,
        eventDescription: data.eventDescription,
        eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
        eventStatus: data.eventStatus,
        venue: data.venue,
        eventStart: data.eventStart,
        eventEnd: data.eventEnd,
        qualificationCount: data.qualificationCount,
        finalScoreFormula: data.finalScoreFormula,
        preliminaryWeight: data.preliminaryWeight,
        finalWeight: data.finalWeight,
        tieBreakMethod: data.tieBreakMethod,
        maxEliminationsPerRound: data.maxEliminationsPerRound,
      },
    });

    await AuditService.log({
      userId: adminUserId,
      action: "EVENT_SETTINGS_UPDATED",
      entityType: "EVENT_SETTINGS",
      entityId: updated.id,
      oldValue: current,
      newValue: updated,
      reason: "Admin modified tournament settings",
      ipAddress,
    });

    LeaderboardService.notifyUpdate();
    return updated;
  }

  /**
   * Configures the final round scoring formula.
   * Required before results can ever be published.
   */
  public static async configureFinalFormula(
    data: ConfigureFormulaInput,
    adminUserId: string,
    ipAddress?: string
  ) {
    const current = await this.getSettings();

    const updated = await prisma.eventSetting.update({
      where: { id: current.id },
      data: {
        finalScoreFormula: data.formula,
        preliminaryWeight: data.preliminaryWeight,
        finalWeight: data.finalWeight,
      },
    });

    await AuditService.log({
      userId: adminUserId,
      action: "FINAL_FORMULA_CONFIGURED",
      entityType: "EVENT_SETTINGS",
      entityId: updated.id,
      oldValue: {
        formula: current.finalScoreFormula,
        preliminaryWeight: current.preliminaryWeight,
        finalWeight: current.finalWeight,
      },
      newValue: {
        formula: updated.finalScoreFormula,
        preliminaryWeight: updated.preliminaryWeight,
        finalWeight: updated.finalWeight,
      },
      reason: `Configured final formula as ${data.formula}`,
      ipAddress,
    });

    return updated;
  }

  /**
   * Prepares the system for a fresh event run:
   * 1. Archives all existing rounds (is_archived = true)
   * 2. Resets event workflow state (status = NOT_STARTED, formula = NULL, resultsPublished = false)
   * 3. Deletes qualifications
   * 4. Deactivates announcements
   * 5. Preserves all historical audit_logs, score_history, and score_entries intact
   */
  public static async prepareNewEventRun(adminUserId: string, ipAddress?: string) {
    const currentSettings = await this.getSettings();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Archive active rounds
      const archivedRoundsResult = await tx.round.updateMany({
        where: { isArchived: false },
        data: { isArchived: true },
      });

      // 2. Reset event settings singleton
      const resetSettings = await tx.eventSetting.update({
        where: { id: currentSettings.id },
        data: {
          eventStatus: EventStatus.NOT_STARTED,
          resultsPublished: false,
          resultsLocked: false,
          finalScoreFormula: null, // Reset formula so admin must configure it for the new run
        },
      });

      // 3. Clear qualification calculations
      const deletedQualifications = await tx.qualification.deleteMany({});

      // 4. Deactivate existing announcements
      const deactivatedAnnouncements = await tx.announcement.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });

      // 5. Audit log the reset action
      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: "EVENT_RESET_FOR_NEW_RUN",
          entityType: "EVENT",
          entityId: currentSettings.id,
          oldValue: {
            status: currentSettings.eventStatus,
            archivedRoundsCount: archivedRoundsResult.count,
            deletedQualificationsCount: deletedQualifications.count,
            deactivatedAnnouncementsCount: deactivatedAnnouncements.count,
          },
          newValue: {
            status: EventStatus.NOT_STARTED,
            formula: null,
            published: false,
          },
          reason: "Administrator initiated Prepare New Event Run operation",
          ipAddress: ipAddress ?? null,
        },
      });

      return {
        success: true,
        archivedRoundsCount: archivedRoundsResult.count,
        settings: resetSettings,
      };
    });

    // Notify SSE clients strictly AFTER reset transaction commits
    LeaderboardService.notifyUpdate();

    return result;
  }

  /**
   * Enforces that results can NEVER be published without an explicitly configured formula.
   */
  public static async assertCanPublishResults() {
    const settings = await this.getSettings();
    if (!settings.finalScoreFormula) {
      throw new ApiError(
        "Cannot publish results: final scoring formula is not configured. Admin must configure formula first.",
        400
      );
    }
    return settings;
  }
}
