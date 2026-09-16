"use client";

import React, { useState, useEffect } from "react";
import { Calendar, Clock, AlertCircle } from "lucide-react";

interface ScheduleItem {
  id: string;
  name: string;
  description: string | null;
  startTime: string;
  endTime: string;
  sortOrder: number;
}

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSchedule() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/schedule");
        if (!res.ok) {
          throw new Error("Failed to load tournament schedule.");
        }
        const json = await res.json();
        setSchedule(json.data || []);
      } catch (err: any) {
        setError(err.message || "An error occurred.");
      } finally {
        setLoading(false);
      }
    }

    fetchSchedule();
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
            <h2 className="text-lg font-bold">Error Loading Schedule</h2>
          </div>
          <p className="text-sm">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto p-4 sm:p-6 max-w-4xl space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">
            <Calendar className="h-3.5 w-3.5" /> Official Timeline
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100">
            Tournament Schedule
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Chronological stages of the Among Us: Live Deduction championship
          </p>
        </div>
      </div>

      {/* Schedule Items Timeline */}
      <div className="relative border-l border-border/80 ml-4 sm:ml-6 space-y-6">
        {schedule.map((item, idx) => (
          <div key={item.id} className="relative pl-6 sm:pl-8">
            {/* Timeline Dot */}
            <span className="absolute -left-2 top-1.5 h-4 w-4 rounded-full border-2 border-card bg-cyan-500 shadow-sm shadow-cyan-500/50" />

            <div className="rounded-2xl border border-border bg-card p-5 space-y-2 transition hover:border-cyan-500/40 hover:bg-slate-900/60 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-cyan-400 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1">
                  <Clock className="h-3 w-3" />
                  {item.startTime} – {item.endTime}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Phase {idx + 1} of {schedule.length}
                </span>
              </div>

              <h3 className="text-lg font-bold text-slate-100">{item.name}</h3>

              {item.description && (
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
