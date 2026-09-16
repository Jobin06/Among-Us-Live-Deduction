import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginRateLimiter } from "@/lib/rate-limiter";
import { loginSchema } from "@/validation/auth.schema";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60, // 12 hours
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username or Participant ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials) {
          throw new Error("Missing credentials");
        }

        const parseResult = loginSchema.safeParse(credentials);
        if (!parseResult.success) {
          throw new Error(parseResult.error.errors[0]?.message || "Invalid credentials format");
        }

        const { username, password } = parseResult.data;

        // Extract client IP from headers if available
        const rawReq = req as any;
        const forwarded = rawReq?.headers?.["x-forwarded-for"] || rawReq?.headers?.["x-real-ip"];
        const clientIp = typeof forwarded === "string" 
          ? forwarded.split(",")[0].trim() 
          : (rawReq?.connection?.remoteAddress ?? "unknown");

        // Rate limit by identifier + IP
        const rateStatus = loginRateLimiter.check(username, clientIp);
        if (!rateStatus.allowed) {
          throw new Error(rateStatus.reason || "Too many failed attempts. Please try again in 15 minutes.");
        }

        // Look up user by username or participant_id
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: { equals: username, mode: "insensitive" } },
              { participant: { participantId: { equals: username, mode: "insensitive" } } },
            ],
          },
          include: {
            participant: true,
            volunteer: true,
          },
        });

        if (!user) {
          loginRateLimiter.recordAttempt(username, clientIp);
          throw new Error("Invalid username or password.");
        }

        // Check if account is active
        if (!user.isActive) {
          throw new Error("Account has been deactivated. Please contact an administrator.");
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) {
          loginRateLimiter.recordAttempt(username, clientIp);
          throw new Error("Invalid username or password.");
        }

        // Successful authentication — reset rate limiter
        loginRateLimiter.reset(username, clientIp);

        return {
          id: user.id,
          username: user.username,
          role: user.role,
          name: user.participant?.name ?? user.volunteer?.name ?? user.username,
          participantId: user.participant?.participantId ?? null,
          volunteerId: user.volunteer?.id ?? null,
          isActive: user.isActive,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.name = user.name;
        token.participantId = user.participantId;
        token.volunteerId = user.volunteerId;
        token.isActive = user.isActive;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id;
        session.user.username = token.username;
        session.user.role = token.role;
        session.user.name = token.name;
        session.user.participantId = token.participantId;
        session.user.volunteerId = token.volunteerId;
        session.user.isActive = token.isActive;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
