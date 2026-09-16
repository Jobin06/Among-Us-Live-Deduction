"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  Info,
  LogOut,
  Menu,
  X,
  Shield,
  Trophy,
  ShieldAlert,
  Medal,
} from "lucide-react";

interface NavbarProps {
  eventStatus?: string | null;
  eventName?: string | null;
}

export function Navbar({ eventStatus, eventName }: NavbarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: "Dashboard", href: "/participant/dashboard", icon: LayoutDashboard },
    { label: "Leaderboard", href: "/leaderboard", icon: Trophy },
    { label: "Results", href: "/results", icon: Medal },
    { label: "Event Info", href: "/participant/event-info", icon: Info },
    { label: "Schedule", href: "/participant/schedule", icon: Calendar },
    { label: "Rules", href: "/participant/rules", icon: BookOpen },
    ...(session?.user?.role === "ADMIN"
      ? [{ label: "Admin", href: "/admin/dashboard", icon: ShieldAlert }]
      : []),
  ];

  const formatStatus = (status?: string | null) => {
    if (!status) return "NOT STARTED";
    return status.replace(/_/g, " ");
  };

  // Close mobile menu on route change
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile menu on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand & Event Status */}
        <div className="flex items-center gap-4">
          <Link
            href="/participant/dashboard"
            className="flex items-center gap-2 text-slate-50 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-lg p-1"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-cyan-600 shadow-md shadow-cyan-500/20">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-black tracking-widest text-cyan-400 uppercase">
                {eventName || "AMONG US: LIVE DEDUCTION"}
              </span>
              <span className="text-sm font-bold text-slate-100 hidden sm:inline-block">
                Participant Portal
              </span>
            </div>
          </Link>

          {/* Live Event Status Badge */}
          {eventStatus && (
            <div
              className="hidden md:flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300"
              aria-label={"Event status: " + formatStatus(eventStatus)}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
              </span>
              <span>{formatStatus(eventStatus)}</span>
            </div>
          )}
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 " +
                  (isActive
                    ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-semibold"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white")
                }
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Identity Profile & Logout */}
        <div className="hidden md:flex items-center gap-3">
          {session?.user && (
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-950 border border-cyan-600/40 text-cyan-400 font-mono font-bold">
                {session.user.participantId ? session.user.participantId.slice(0, 2) : "P"}
              </div>
              <div className="flex flex-col text-left">
                <span className="font-semibold text-slate-100">{session.user.name}</span>
                <span className="font-mono text-[10px] text-cyan-400">
                  {session.user.participantId || session.user.username}
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label="Sign out of participant portal"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <div className="flex md:hidden items-center gap-2">
          {eventStatus && (
            <div className="flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              <span>{formatStatus(eventStatus)}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-xl border border-border bg-slate-900 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div id="mobile-navigation-menu" className="border-b border-border bg-card/95 px-4 py-4 md:hidden space-y-3">
          <nav className="flex flex-col gap-1.5" aria-label="Mobile Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={
                    "flex items-center gap-3 rounded-xl px-3.5 py-3 min-h-[44px] text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 " +
                    (isActive
                      ? "bg-cyan-500/15 text-cyan-400 font-semibold border border-cyan-500/30"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white")
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Sign Out in Mobile Menu */}
          {session?.user && (
            <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-950 border border-cyan-600 text-cyan-400 font-mono font-bold text-xs">
                  {session.user.participantId ? session.user.participantId.slice(0, 2) : "P"}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-100">{session.user.name}</p>
                  <p className="text-[10px] font-mono text-cyan-400">
                    {session.user.participantId || session.user.username}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 min-h-[44px] text-xs font-semibold text-red-400 hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
