import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // If token exists but user is deactivated, block access
    if (token && token.isActive === false) {
      return NextResponse.redirect(
        new URL("/login?error=deactivated", req.url)
      );
    }

    // Gating for /admin/*
    if (path.startsWith("/admin")) {
      if (token?.role !== "ADMIN") {
        return NextResponse.redirect(
          new URL("/login?error=unauthorized", req.url)
        );
      }
    }

    // Gating for /volunteer/*
    if (path.startsWith("/volunteer")) {
      if (token?.role !== "VOLUNTEER" && token?.role !== "ADMIN") {
        return NextResponse.redirect(
          new URL("/login?error=unauthorized", req.url)
        );
      }
    }

    // Gating for /participant/*
    if (path.startsWith("/participant")) {
      if (token?.role !== "PARTICIPANT") {
        return NextResponse.redirect(
          new URL("/login?error=unauthorized", req.url)
        );
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        // Routes that require authentication
        if (
          path.startsWith("/admin") ||
          path.startsWith("/volunteer") ||
          path.startsWith("/participant")
        ) {
          return !!token;
        }
        return true;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/admin/:path*",
    "/volunteer/:path*",
    "/participant/:path*",
  ],
};
