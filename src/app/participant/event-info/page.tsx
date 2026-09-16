"use client";

import React, { useState, useEffect } from "react";
import { Calendar, Clock, MapPin, Target, Shield, AlertCircle } from "lucide-react";

interface EventSettings {
  eventName: string;
  eventDescription: string | null;
  venue: string | null;
  eventStart: string | null;
  eventEnd: string | null;
  eventDate: string | null;
  eventStatus: string;
}

export default function EventInfoPage() {
  const [event, setEvent] = useState<EventSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvent() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/event/settings");
        if (!res.ok) {
          throw new Error("Failed to load tournament information.");
        }
        const json = await res.json();
        setEvent(json.data);
      } catch (err: any) {
        setError(err.message || "An error occurred.");
      } finally {
        setLoading(false);
      }
    }

    fetchEvent();
  }, []);

  if (loading) {
    return (
      <main className="container mx-auto p-4 sm:p-6 max-w-4xl space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
        <div className="h-64 bg-card border border-border rounded-2xl animate-pulse" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto p-4 sm:p-6 max-w-4xl">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-destructive space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <h2 className="text-lg font-bold">Error Loading Event Details</h2>
          </div>
          <p className="text-sm">{error}</p>
        </div>
      </main>
    );
  }

  const durationDisplay =
    event?.eventStart && event?.eventEnd
      ? `${event.eventStart} – ${event.eventEnd}`
      : event?.eventStart
      ? `Starts at ${event.eventStart}`
      : null;

  return (
    <main className="container mx-auto p-4 sm:p-6 max-w-4xl space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 sm:p-10 shadow-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-4">
          <Shield className="h-3.5 w-3.5" /> Official Tournament Specification
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-50">
          {event?.eventName || "Not configured"}
        </h1>
        <p className="mt-3 text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
          {event?.eventDescription || "No description provided."}
        </p>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {/* Date */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-2 shadow-sm">
          <div className="flex items-center gap-2 text-cyan-400">
            <Calendar className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event Date</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-slate-100">
            {event?.eventDate
              ? new Date(event.eventDate).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })
              : "Not configured"}
          </p>
        </div>

        {/* Timing */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-2 shadow-sm">
          <div className="flex items-center gap-2 text-cyan-400">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Duration</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-slate-100">
            {durationDisplay || "Not configured"}
          </p>
        </div>

        {/* Venue */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-2 shadow-sm sm:col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 text-cyan-400">
            <MapPin className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tournament Venue</span>
          </div>
          <p className="text-base sm:text-lg font-bold text-slate-100">
            {event?.venue || "Not configured"}
          </p>
        </div>
      </div>

      {/* Tournament Objective */}
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-4 shadow-sm">
        <div className="flex items-center gap-2.5 text-cyan-400">
          <Target className="h-5 w-5" />
          <h2 className="text-xl font-bold text-slate-100">Tournament Objective</h2>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          AMONG US: LIVE DEDUCTION is a physical, in-person e-sports event where participants play Among Us in isolated lobbies while participating in face-to-face emergency meetings.
          Participants earn points through acute deduction, successful impostor deception, strategic voting, survival, and mission objectives.
        </p>
        <div className="pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-muted-foreground">
          <div className="space-y-1">
            <span className="font-bold text-slate-200">Preliminary Stage:</span>
            <p>Preliminary rounds across parallel lobbies determine qualification standing.</p>
          </div>
          <div className="space-y-1">
            <span className="font-bold text-slate-200">Final Stage:</span>
            <p>Qualified participants advance to the Grand Final Lobby to determine tournament champions.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
