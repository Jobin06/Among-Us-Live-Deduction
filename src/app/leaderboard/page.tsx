"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Trophy,
  Shield,
  Maximize2,
  Minimize2,
  Search,
  RefreshCw,
  Tv,
  Radio,
  Clock,
  Flame,
  AlertCircle,
} from "lucide-react";
import { LeaderboardResponseDto } from "@/services/leaderboard.service";

function LeaderboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialProjector = searchParams.get("projector") === "true";

  const [data, setData] = useState<LeaderboardResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isProjector, setIsProjector] = useState(initialProjector);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnectedSSE, setIsConnectedSSE] = useState(false);

  // Sync state with URL search param
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
    router.replace(`/leaderboard?${params.toString()}`);
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

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Fetch data via REST (initial load or manual refresh)
  const fetchLeaderboard = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/leaderboard");
      if (!res.ok) throw new Error("Failed to load tournament leaderboard.");
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Setup Server-Sent Events with fallback polling
  useEffect(() => {
    fetchLeaderboard();

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/leaderboard/sse");

      eventSource.onopen = () => {
        setIsConnectedSSE(true);
      };

      eventSource.onmessage = (event) => {
        if (!event.data || event.data.startsWith(":")) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload && Array.isArray(payload.entries)) {
            setData(payload);
            setLoading(false);
            setIsConnectedSSE(true);
          }
        } catch {
          // Ignore parse errors on heartbeat comments
        }
      };

      eventSource.onerror = () => {
        setIsConnectedSSE(false);
      };
    } catch {
      setIsConnectedSSE(false);
    }

    // Fallback polling every 10 seconds if SSE is not active
    const interval = setInterval(() => {
      if (!isConnectedSSE) {
        fetchLeaderboard();
      }
    }, 10000);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(interval);
    };
  }, [fetchLeaderboard, isConnectedSSE]);

  const filteredEntries = (data?.entries || []).filter((e) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      e.participantId.toLowerCase().includes(term) ||
      e.name.toLowerCase().includes(term) ||
      Boolean(e.amongUsUsername && e.amongUsUsername.toLowerCase().includes(term))
    );
  });

  const formatStatus = (status?: string | null) => {
    if (!status) return "NOT STARTED";
    return status.replace(/_/g, " ");
  };

  // Loading Skeleton
  if (loading && !data) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-5xl space-y-6 animate-pulse">
          <div className="h-14 bg-slate-900 rounded-2xl w-2/3 mx-auto" />
          <div className="h-24 bg-slate-900 rounded-2xl" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-16 bg-slate-900/60 rounded-xl" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  // Error State
  if (error && !data) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full bg-destructive/15 border border-destructive/30 rounded-2xl p-6 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold text-destructive">Unable to Load Leaderboard</h2>
          <p className="text-sm text-slate-300">{error}</p>
          <button
            onClick={() => fetchLeaderboard()}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      </main>
    );
  }

  // --------------------------------------------------------------------------
  // PROJECTOR / ARENA DISPLAY MODE
  // --------------------------------------------------------------------------
  if (isProjector) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-6 sm:p-10 flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
        {/* Floating Controls Bar */}
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/90 backdrop-blur px-3 py-1.5 shadow-2xl">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-2">
            <Radio className={`h-3.5 w-3.5 ${isConnectedSSE ? "text-emerald-400 animate-pulse" : "text-amber-400"}`} />
            <span>{isConnectedSSE ? "LIVE SSE" : "POLLING"}</span>
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={toggleProjectorMode}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            title="Exit Projector Mode"
            aria-label="Exit Projector Mode"
          >
            <Tv className="h-5 w-5 text-cyan-400" />
          </button>
        </div>

        {/* Projector Header */}
        <header className="mb-8 text-center space-y-3">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-5 py-1.5 text-sm font-black uppercase tracking-widest text-cyan-300 shadow-lg shadow-cyan-500/10">
            <Shield className="h-4 w-4 text-cyan-400" /> AMONG US: LIVE DEDUCTION
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white uppercase drop-shadow-md">
            Tournament Standings
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm sm:text-base font-semibold text-slate-300 pt-1">
            <div className="flex items-center gap-2 rounded-xl bg-slate-900/80 border border-slate-800 px-4 py-1.5">
              <span className="text-slate-400 uppercase text-xs tracking-wider">Status:</span>
              <span className="text-cyan-400">{formatStatus(data?.eventStatus)}</span>
            </div>
            {data?.activeRound && (
              <div className="flex items-center gap-2 rounded-xl bg-slate-900/80 border border-slate-800 px-4 py-1.5">
                <span className="text-slate-400 uppercase text-xs tracking-wider">Active Round:</span>
                <span className="text-emerald-400">{data.activeRound.name}</span>
                {data.activeRound.scoreLocked && (
                  <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/30">
                    LOCKED
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 rounded-xl bg-slate-900/80 border border-slate-800 px-4 py-1.5">
              <Clock className="h-4 w-4 text-slate-400" />
              <span className="text-slate-400 text-xs uppercase tracking-wider">Active Competitors:</span>
              <span className="text-white font-bold">{data?.entries.length || 0}</span>
            </div>
          </div>
        </header>

        {/* Projector Standings List */}
        <section className="flex-1 max-w-6xl w-full mx-auto space-y-3">
          {data?.entries.length === 0 ? (
            <div className="text-center py-20 rounded-3xl border border-slate-800 bg-slate-900/50 p-8">
              <p className="text-2xl text-slate-400 font-semibold">No tournament scores recorded yet.</p>
            </div>
          ) : (
            data?.entries.map((entry) => {
              const isGold = entry.rank === 1;
              const isSilver = entry.rank === 2;
              const isBronze = entry.rank === 3;

              let rankCardClass = "bg-slate-900/60 border-slate-800/80 hover:border-slate-700";
              let rankBadgeClass = "bg-slate-800 text-slate-300 border-slate-700";

              if (isGold) {
                rankCardClass = "bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-slate-900 border-amber-500/50 shadow-xl shadow-amber-500/10";
                rankBadgeClass = "bg-amber-500 text-slate-950 font-black border-amber-400";
              } else if (isSilver) {
                rankCardClass = "bg-gradient-to-r from-slate-800/50 via-slate-900/90 to-slate-900 border-slate-400/50 shadow-lg";
                rankBadgeClass = "bg-slate-300 text-slate-950 font-black border-slate-200";
              } else if (isBronze) {
                rankCardClass = "bg-gradient-to-r from-amber-900/30 via-slate-900/90 to-slate-900 border-amber-700/50 shadow-lg";
                rankBadgeClass = "bg-amber-700 text-slate-100 font-black border-amber-600";
              }

              return (
                <div
                  key={entry.participantId}
                  className={`flex items-center justify-between rounded-2xl border p-4 sm:p-5 transition ${rankCardClass}`}
                >
                  <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                    <div
                      className={`flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl border text-xl sm:text-2xl font-black shadow-md ${rankBadgeClass}`}
                    >
                      {entry.rank}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight truncate">
                          {entry.name}
                        </span>
                        <span className="hidden sm:inline-block rounded-lg bg-slate-800 px-2.5 py-0.5 text-xs font-mono font-bold text-cyan-400 border border-slate-700">
                          {entry.participantId}
                        </span>
                      </div>
                      <p className="text-sm sm:text-base font-medium text-slate-400 truncate">
                        In-Game: <span className="text-slate-200 font-semibold">{entry.amongUsUsername || "N/A"}</span>
                        <span className="mx-2 text-slate-600">•</span>
                        <span>{entry.roundsPlayed} {entry.roundsPlayed === 1 ? "round" : "rounds"} played</span>
                      </p>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right shrink-0 pl-4">
                    <div className="text-3xl sm:text-5xl font-black text-cyan-400 font-mono tracking-tight">
                      {entry.totalScore}
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Points
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Footer */}
        <footer className="mt-8 text-center text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wider">
          Official University E-Sports Tournament • Among Us: Live Deduction • Auto-Refreshed via SSE
        </footer>
      </main>
    );
  }

  // --------------------------------------------------------------------------
  // STANDARD PARTICIPANT / SPECTATOR VIEW
  // --------------------------------------------------------------------------
  return (
    <main className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-6xl space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-bold text-cyan-400 uppercase tracking-wider">
              <Trophy className="h-3.5 w-3.5" /> Official Tournament Leaderboard
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Live Standings
            </h1>
            <p className="text-sm text-slate-300 max-w-xl">
              Real-time cumulative scoring across preliminary rounds. Rankings update automatically as volunteers submit authoritative score entries.
            </p>
          </div>

          {/* Quick Actions & Mode Switcher */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={toggleProjectorMode}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 px-4 py-2.5 text-sm font-bold text-cyan-300 shadow-md transition"
              title="Launch large-screen projector display"
            >
              <Tv className="h-4 w-4 text-cyan-400" />
              <span>Projector Mode</span>
            </button>
            <button
              onClick={() => fetchLeaderboard()}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card hover:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-slate-200 shadow-sm transition"
              title="Refresh Standings"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Live Event Indicators */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tournament Stage</span>
            <p className="text-sm font-bold text-cyan-400">{formatStatus(data?.eventStatus)}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Round</span>
            <p className="text-sm font-bold text-slate-200">
              {data?.activeRound ? data.activeRound.name : "None active"}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Competitors</span>
            <p className="text-sm font-bold text-slate-200">{data?.entries.length || 0}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Stream Status</span>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span className={`h-2 w-2 rounded-full ${isConnectedSSE ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              <span className={isConnectedSSE ? "text-emerald-400" : "text-amber-400"}>
                {isConnectedSSE ? "Connected (SSE)" : "Polling Fallback"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="flex items-center gap-3 bg-card border border-border rounded-2xl p-2 sm:p-3 shadow-sm">
        <Search className="h-5 w-5 text-muted-foreground ml-2" />
        <input
          type="text"
          placeholder="Filter by participant ID, player name, or Among Us tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent border-none text-sm text-slate-100 placeholder:text-muted-foreground focus:outline-none"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="text-xs text-muted-foreground hover:text-white px-3 py-2 min-h-[44px] flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            Clear
          </button>
        )}
      </div>

      {/* Standings Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" role="region" aria-label="Tournament leaderboard standings" aria-live="polite">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-5 py-4 w-20 text-center">Rank</th>
                <th scope="col" className="px-5 py-4">Participant</th>
                <th scope="col" className="px-5 py-4">Among Us Tag</th>
                <th scope="col" className="px-5 py-4 text-center">Rounds Scored</th>
                <th scope="col" className="px-5 py-4 text-right">Cumulative Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    {search ? "No participants matching your search criteria." : "No participants enrolled."}
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => {
                  const isTop1 = entry.rank === 1;
                  const isTop2 = entry.rank === 2;
                  const isTop3 = entry.rank === 3;

                  let rankBadge = (
                    <span className="font-mono font-bold text-muted-foreground">#{entry.rank}</span>
                  );
                  if (isTop1) {
                    rankBadge = (
                      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 text-xs shadow-sm">
                        🥇 1
                      </span>
                    );
                  } else if (isTop2) {
                    rankBadge = (
                      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-slate-300/20 text-slate-200 font-bold border border-slate-300/40 text-xs shadow-sm">
                        🥈 2
                      </span>
                    );
                  } else if (isTop3) {
                    rankBadge = (
                      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-amber-700/20 text-amber-500 font-bold border border-amber-700/40 text-xs shadow-sm">
                        🥉 3
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={entry.participantId}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-5 py-4 text-center font-bold">{rankBadge}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100">{entry.name}</span>
                          <span className="font-mono text-xs text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border">
                            {entry.participantId}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-300">
                        {entry.amongUsUsername || "—"}
                      </td>
                      <td className="px-5 py-4 text-center font-mono text-slate-400">
                        {entry.roundsPlayed}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="font-mono text-lg font-black text-cyan-400">
                          {entry.totalScore}
                        </span>
                        <span className="ml-1 text-xs text-muted-foreground">pts</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

export default function LeaderboardPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Loading leaderboard...</span>
          </div>
        </div>
      }
    >
      <LeaderboardContent />
    </React.Suspense>
  );
}

