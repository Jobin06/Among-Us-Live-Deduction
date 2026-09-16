import { z } from "zod";
import { RoundType, RoundStatus, LobbyType, LobbyStatus } from "@prisma/client";

export const createRoundSchema = z.object({
  name: z.string().min(1, "Round name is required").max(100),
  roundNumber: z.number().int().positive("Round number must be positive"),
  type: z.nativeEnum(RoundType),
  status: z.nativeEnum(RoundStatus).optional().default(RoundStatus.UPCOMING),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

export type CreateRoundInput = z.infer<typeof createRoundSchema>;

export const updateRoundSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.nativeEnum(RoundStatus).optional(),
  scoreLocked: z.boolean().optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

export type UpdateRoundInput = z.infer<typeof updateRoundSchema>;

export const createLobbySchema = z.object({
  name: z.string().min(1, "Lobby name is required").max(50),
  type: z.nativeEnum(LobbyType).optional().default(LobbyType.PRELIMINARY),
  capacity: z.number().int().positive("Capacity must be positive").optional().nullable(),
});

export type CreateLobbyInput = z.infer<typeof createLobbySchema>;

export const updateLobbySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  type: z.nativeEnum(LobbyType).optional(),
  capacity: z.number().int().positive().optional().nullable(),
  status: z.nativeEnum(LobbyStatus).optional(),
});

export type UpdateLobbyInput = z.infer<typeof updateLobbySchema>;

export const createAnnouncementSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  message: z.string().min(1, "Message is required"),
  priority: z.number().int().min(0).max(10).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  message: z.string().min(1).optional(),
  priority: z.number().int().min(0).max(10).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
