import { UserRole } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    username: string;
    role: UserRole;
    name?: string | null;
    participantId?: string | null;
    volunteerId?: string | null;
    isActive: boolean;
  }

  interface Session {
    user: {
      id: string;
      username: string;
      role: UserRole;
      name?: string | null;
      participantId?: string | null;
      volunteerId?: string | null;
      isActive: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: UserRole;
    name?: string | null;
    participantId?: string | null;
    volunteerId?: string | null;
    isActive: boolean;
  }
}
