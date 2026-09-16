"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Trophy,
  Award,
  Medal,
  Maximize2,
  Minimize2,
  Tv,
  RefreshCw,
  Clock,
  Shield,
  AlertCircle,
} from "lucide-react";
import { FinalResultsResponseDto, FinalResultEntryDto } from "@/services/finals.service";

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialProjector = searchParams.get("projector") === "true";

  const [data, setData] = useState<FinalResultsResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProjector, setIsProjector] = useState(initialProjector);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setIsProjector(searchParams.get("projector") === "true");
  }, [searchParams]);

  const toggleProjectorMode = () => {
    const next = !isProjector;
    setIsProjector(next);
    const params = new URLSearchParams(window.location.search);
    if (next) {
      params.set("projector", "true");
    } else {
      params.delete("projector");
    }
    router.replace('/results?' + params.toString());
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const fetchResults = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/results");
      const json = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          setError("Final tournament results have not been published yet.");
        } else {
          setError(json.error?.message || "Failed to load tournament results.");
        }
        setData(null);
        return;
      }

      setData(json.data);
    } catch {
      setError("Network error while loading results. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        <p className="font-mono text-sm text-slate-400 animate-pulse">Loading tournament results...</p>
      </div>
    );
  }

  if (error || !data || !data.isPublished) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Trophy className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">Championship Results</h2>
          <p className="text-sm text-slate-400">
            {error || "Final tournament results have not been published yet. Please check back after finals conclude."}
          </p>
          <div className="pt-4 flex justify-center gap-3">
            <button
              onClick={fetchResults}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <a
              href="/leaderboard"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 transition-colors"
            >
              View Preliminary Leaderboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  const standings = data.standings;
  const first = standings.find((s) => s.rank === 1);
  const second = standings.find((s) => s.rank === 2);
  const third = standings.find((s) => s.rank === 3);

  // PROJECTOR MODE
  if (isProjector) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col p-6 sm:p-8 select-none font-sans">
        {/* Projector Header */}
        <header className="flex items-center justify-between border-b border-slate-800 pb-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 shadow-lg shadow-amber-500/20 text-slate-950">
              <Trophy className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-wider text-white">
                Final Results
              </h1>
              <p className="text-sm sm:text-base font-semibold text-amber-400 tracking-wide">
                AMONG US: LIVE DEDUCTION — CHAMPIONSHIP
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-slate-200 hover:bg-slate-700 border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </button>
            <button
              type="button"
              onClick={toggleProjectorMode}
              className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 min-h-[44px] text-sm font-semibold text-slate-200 hover:bg-slate-700 border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <Tv className="h-4 w-4 text-cyan-400" />
              Standard View
            </button>
          </div>
        </header>

        {/* Unresolved Tie Alert */}
        {data.hasUnresolvedTie && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-950/30 p-5 mb-8 flex items-start gap-4 text-amber-200">
            <AlertCircle className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-bold text-white">Unresolved Final Results Tie</h3>
              <p className="text-sm text-slate-300 mt-1">
                Final tournament results tie-breaking is not specified in REQUIREMENTS.md and requires administrative clarification. Tied positions are displayed without arbitrary ranking or podium assignments.
              </p>
            </div>
          </div>
        )}

        {/* Podium Row with mobile order hierarchy */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* 2nd Place */}
          {second && (
            <div className="order-2 md:order-1 rounded-2xl border-2 border-slate-400/40 bg-slate-900/80 p-6 flex flex-col justify-between shadow-xl">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-slate-400/20 text-slate-300 border border-slate-400/30 flex items-center gap-1.5">
                    🥈 2nd Place
                  </span>
                  <span className="font-mono text-xs text-slate-400">{second.participantId}</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white truncate">{second.name}</h3>
                <p className="text-sm font-medium text-slate-400 truncate">
                  In-Game: <span className="text-slate-200">{second.amongUsUsername || "—"}</span>
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-baseline justify-between">
                <span className="text-xs text-slate-400 font-semibold uppercase">Overall</span>
                <span className="font-mono text-3xl sm:text-4xl font-black text-slate-300">
                  {second.overallScore} <span className="text-xs text-slate-500 font-sans">pts</span>
                </span>
              </div>
            </div>
          )}

          {/* 1st Place (Champion) */}
          {first ? (
            <div className="order-1 md:order-2 rounded-2xl border-2 border-amber-400/70 bg-gradient-to-b from-amber-950/40 to-slate-900/90 p-8 flex flex-col justify-between shadow-2xl shadow-amber-500/20 md:-translate-y-2">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-black uppercase tracking-widest px-3.5 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center gap-1.5 shadow-sm">
                    🥇 Tournament Champion
                  </span>
                  <span className="font-mono text-xs text-amber-400/70">{first.participantId}</span>
                </div>
                <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight truncate">{first.name}</h3>
                <p className="text-base font-semibold text-amber-300/80 truncate">
                  In-Game: <span className="text-white">{first.amongUsUsername || "—"}</span>
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-amber-400/30 flex items-baseline justify-between">
                <span className="text-sm text-amber-400 font-bold uppercase">Final Score</span>
                <span className="font-mono text-4xl sm:text-5xl font-black text-amber-400">
                  {first.overallScore} <span className="text-sm text-amber-400/60 font-sans">pts</span>
                </span>
              </div>
            </div>
          ) : data.hasUnresolvedTie ? (
            <div className="order-1 md:order-2 rounded-2xl border-2 border-amber-500/50 bg-amber-950/40 p-8 flex flex-col justify-center items-center text-center shadow-xl">
              <AlertCircle className="h-10 w-10 text-amber-400 mb-3" />
              <h3 className="text-2xl font-black text-white">Championship Tied</h3>
              <p className="text-sm text-slate-300 mt-2 max-w-sm">
                Multiple finalists tied for the highest overall score. No arbitrary champion declared.
              </p>
            </div>
          ) : null}

          {/* 3rd Place */}
          {third && (
            <div className="order-3 md:order-3 rounded-2xl border-2 border-amber-700/40 bg-slate-900/80 p-6 flex flex-col justify-between shadow-xl">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-amber-700/20 text-amber-400 border border-amber-700/30 flex items-center gap-1.5">
                    🥉 3rd Place
                  </span>
                  <span className="font-mono text-xs text-slate-400">{third.participantId}</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white truncate">{third.name}</h3>
                <p className="text-sm font-medium text-slate-400 truncate">
                  In-Game: <span className="text-slate-200">{third.amongUsUsername || "—"}</span>
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-baseline justify-between">
                <span className="text-xs text-slate-400 font-semibold uppercase">Overall</span>
                <span className="font-mono text-3xl sm:text-4xl font-black text-amber-600">
                  {third.overallScore} <span className="text-xs text-slate-500 font-sans">pts</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Complete Standings Table */}
        <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-900 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 w-24">Rank</th>
                <th className="px-6 py-4">Participant</th>
                <th className="px-6 py-4">In-Game</th>
                <th className="px-6 py-4 text-center">Preliminary</th>
                <th className="px-6 py-4 text-center">Final</th>
                <th className="px-6 py-4 text-right">Overall Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {standings.map((entry) => (
                <tr key={entry.participantId} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 font-black text-lg">
                    {entry.rank === 1 ? "🥇 1" : entry.rank === 2 ? "🥈 2" : entry.rank === 3 ? "🥉 3" : entry.rank ? `#${entry.rank}` : (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30">
                        TIED
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-white text-base mr-2">{entry.name}</span>
                    <span className="font-mono text-xs text-slate-400">({entry.participantId})</span>
                  </td>
                  <td className="px-6 py-4 text-slate-300 font-medium">{entry.amongUsUsername || "—"}</td>
                  <td className="px-6 py-4 text-center font-mono text-slate-300">{entry.preliminaryScore}</td>
                  <td className="px-6 py-4 text-center font-mono text-amber-400 font-bold">{entry.finalScore}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-mono text-2xl font-black text-white">{entry.overallScore}</span>
                    <span className="ml-1 text-xs text-slate-500 font-sans">pts</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    );
  }

  // STANDARD VIEW
  return (
    <main className="min-h-screen bg-background text-foreground py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Trophy className="h-3.5 w-3.5" /> Official Final Standings
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Tournament Results
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Official championship results calculated via {data.formula} formula.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchResults}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button
            onClick={toggleProjectorMode}
            className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 text-xs font-bold transition-colors shadow-sm"
          >
            <Tv className="h-3.5 w-3.5" /> Projector Mode
          </button>
        </div>
      </div>

      {/* Unresolved Tie Alert */}
      {data.hasUnresolvedTie && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 flex items-start gap-3.5 text-amber-200">
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-white">Unresolved Final Results Tie</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Final tournament results tie-breaking is not specified in REQUIREMENTS.md and requires administrative clarification. Tied positions are displayed without arbitrary ranking or podium assignments.
            </p>
          </div>
        </div>
      )}

      {/* Podium Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 2nd */}
        {second && (
          <div className="order-2 md:order-1 rounded-2xl border border-slate-400/30 bg-card p-6 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-400/20 text-slate-300">
                  🥈 2nd Place
                </span>
                <span className="font-mono text-xs text-muted-foreground">{second.participantId}</span>
              </div>
              <h3 className="text-xl font-bold text-white truncate">{second.name}</h3>
              <p className="text-xs text-muted-foreground">In-Game: {second.amongUsUsername || "—"}</p>
            </div>
            <div className="mt-6 pt-4 border-t border-border flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Overall</span>
              <span className="font-mono text-3xl font-black text-slate-300">
                {second.overallScore} <span className="text-xs text-muted-foreground font-sans">pts</span>
              </span>
            </div>
          </div>
        )}

        {/* 1st */}
        {first ? (
          <div className="order-1 md:order-2 rounded-2xl border-2 border-amber-500/50 bg-amber-500/5 p-6 flex flex-col justify-between shadow-md">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  🥇 Champion
                </span>
                <span className="font-mono text-xs text-amber-400/80">{first.participantId}</span>
              </div>
              <h3 className="text-2xl font-black text-white truncate">{first.name}</h3>
              <p className="text-xs text-muted-foreground">In-Game: {first.amongUsUsername || "—"}</p>
            </div>
            <div className="mt-6 pt-4 border-t border-amber-500/20 flex items-baseline justify-between">
              <span className="text-xs text-amber-400 uppercase font-bold">Overall Score</span>
              <span className="font-mono text-4xl font-black text-amber-400">
                {first.overallScore} <span className="text-xs text-amber-400/70 font-sans">pts</span>
              </span>
            </div>
          </div>
        ) : data.hasUnresolvedTie ? (
          <div className="order-1 md:order-2 rounded-2xl border-2 border-amber-500/40 bg-amber-500/5 p-6 flex flex-col justify-center items-center text-center shadow-md">
            <AlertCircle className="h-8 w-8 text-amber-400 mb-2" />
            <h3 className="text-lg font-black text-white">Championship Tied</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Multiple finalists tied for highest score. No arbitrary champion declared.
            </p>
          </div>
        ) : null}

        {/* 3rd */}
        {third && (
          <div className="order-3 md:order-3 rounded-2xl border border-amber-700/30 bg-card p-6 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-700/20 text-amber-500">
                  🥉 3rd Place
                </span>
                <span className="font-mono text-xs text-muted-foreground">{third.participantId}</span>
              </div>
              <h3 className="text-xl font-bold text-white truncate">{third.name}</h3>
              <p className="text-xs text-muted-foreground">In-Game: {third.amongUsUsername || "—"}</p>
            </div>
            <div className="mt-6 pt-4 border-t border-border flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Overall</span>
              <span className="font-mono text-3xl font-black text-amber-600">
                {third.overallScore} <span className="text-xs text-muted-foreground font-sans">pts</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Complete Standings Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm" role="region" aria-label="Complete Tournament Standings">
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-bold text-white">Complete Tournament Standings</h2>
          <p className="text-xs text-muted-foreground">
            Sourced from authoritative preliminary cumulative totals and final match scores.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th scope="col" className="px-5 py-3 w-20">Rank</th>
                <th scope="col" className="px-5 py-3">Participant</th>
                <th scope="col" className="px-5 py-3">Among Us Username</th>
                <th scope="col" className="px-5 py-3 text-center">Preliminary</th>
                <th scope="col" className="px-5 py-3 text-center">Final</th>
                <th scope="col" className="px-5 py-3 text-right">Overall Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {standings.map((entry) => (
                <tr key={entry.participantId} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-4 font-black">
                    {entry.rank === 1 ? "🥇 1" : entry.rank === 2 ? "🥈 2" : entry.rank === 3 ? "🥉 3" : entry.rank ? `#${entry.rank}` : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30">
                        TIED
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-bold text-white mr-2">{entry.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">({entry.participantId})</span>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">{entry.amongUsUsername || "—"}</td>
                  <td className="px-5 py-4 text-center font-mono text-muted-foreground">{entry.preliminaryScore}</td>
                  <td className="px-5 py-4 text-center font-mono font-semibold text-amber-400">{entry.finalScore}</td>
                  <td className="px-5 py-4 text-right font-mono text-lg font-black text-white">
                    {entry.overallScore} <span className="text-xs text-muted-foreground font-sans">pts</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

export default function ResultsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            <span>Loading tournament results...</span>
          </div>
        </div>
      }
    >
      <ResultsContent />
    </React.Suspense>
  );
}
