"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Award,
  Clock,
  MapPin,
  RefreshCw,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  History,
  AlertCircle,
  HelpCircle,
  User,
  Zap,
} from "lucide-react";
import { ScoreHistoryModal } from "@/components/participant/score-history-modal";

interface Lobby {
  id: string;
  name: string;
  type: string;
}

interface Qualification {
  preliminaryScore: number;
  rank: number;
  qualified: boolean;
}

interface ScoreEntry {
  id: string;
  role: "CREWMATE" | "IMPOSTER";
  totalScore: number;
  correctVote: boolean;
  correctIdentification: boolean;
  tasksCompleted: number;
  survived: boolean;
  wonAsCrewmate: boolean;
  wonAsImposter: boolean;
  successfulElimination: number;
  avoidedIdentification: boolean;
  votedOutAsImposter: boolean;
  hasHistory: boolean;
  historyCount: number;
}

interface RoundItem {
  roundId: string;
  name: string;
  roundNumber: number;
  type: string;
  status: string;
  scoreLocked: boolean;
  lobbyName: string;
  scoreEntry: ScoreEntry | null;
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: number;
  createdAt: string;
}

interface DashboardData {
  participant: {
    id: string;
    participantId: string;
    name: string;
    amongUsUsername: string | null;
    status: string;
    lobby: Lobby | null;
  };
  event: {
    eventName: string;
    eventStatus: string;
    venue: string | null;
    eventStart: string | null;
    eventEnd: string | null;
    eventDate: string | null;
    eventDescription: string | null;
    resultsPublished?: boolean;
  } | null;
  currentRound: {
    id: string;
    name: string;
    roundNumber: number;
    type: string;
    status: string;
    scoreLocked: boolean;
    assignedLobby: Lobby;
  } | null;
  rounds: RoundItem[];
  cumulativeScore: number;
  qualification: Qualification | null;
  announcements: Announcement[];
}

export default function ParticipantDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Score breakdown accordion state (map of roundId -> boolean)
  const [expandedRounds, setExpandedRounds] = useState<Record<string, boolean>>({});

  // Score history modal state
  const [historyModal, setHistoryModal] = useState<{ scoreId: string; roundName: string } | null>(null);

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await fetch("/api/participants/me/dashboard");
      if (!res.ok) {
        if (res.status === 401) throw new Error("Session expired. Please log in again.");
        if (res.status === 403) throw new Error("Access denied. Participant account required.");
        throw new Error("Unable to load participant dashboard.");
      }

      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const toggleRound = (roundId: string) => {
    setExpandedRounds((prev) => ({ ...prev, [roundId]: !prev[roundId] }));
  };

  if (loading) {
    return (
      <main className="container mx-auto p-4 sm:p-6 max-w-6xl space-y-6">
        <div className="h-24 w-full bg-muted animate-pulse rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-44 bg-card border border-border rounded-2xl animate-pulse" />
          <div className="h-44 bg-card border border-border rounded-2xl animate-pulse" />
          <div className="h-44 bg-card border border-border rounded-2xl animate-pulse" />
        </div>
        <div className="h-64 bg-card border border-border rounded-2xl animate-pulse" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="container mx-auto p-4 sm:p-6 max-w-6xl">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-destructive space-y-3">
          <div className="flex items-center gap-2 font-bold text-lg">
            <AlertCircle className="h-5 w-5" />
            <h2>Dashboard Notice</h2>
          </div>
          <p className="text-sm">{error || "Unable to find participant profile."}</p>
          <button
            type="button"
            onClick={() => fetchDashboard()}
            className="rounded-xl bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
          >
            Retry Connection
          </button>
        </div>
      </main>
    );
  }

  const { participant, event, currentRound, rounds, cumulativeScore, qualification, announcements } = data;

  return (
    <main className="container mx-auto p-4 sm:p-6 max-w-6xl space-y-6">
      {/* Top Banner: Participant Identity & Tournament Header */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-cyan-950 border border-cyan-500/40 text-cyan-400 font-mono text-2xl font-black shadow-lg shadow-cyan-500/20">
              {participant.participantId}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-50">
                  {participant.name}
                </h1>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                  {participant.status}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground flex flex-wrap items-center gap-2">
                <span>Among Us ID: <strong className="text-slate-200">{participant.amongUsUsername || "Unassigned"}</strong></span>
                <span>•</span>
                <span>Station: <strong className="text-cyan-400">{participant.lobby?.name || "Lobby Assigned Per Round"}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fetchDashboard(true)}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl border border-border bg-slate-900/90 px-4 py-2.5 min-h-[44px] text-xs font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-50"
              aria-label="Refresh tournament scores and status"
            >
              <RefreshCw className={"h-3.5 w-3.5 " + (refreshing ? "animate-spin text-cyan-400" : "")} />
              <span>{refreshing ? "Refreshing..." : "Refresh Scores"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Read-Only Official Announcements Banner */}
      {announcements && announcements.length > 0 && (
        <div className="space-y-3" role="region" aria-label="Official Tournament Announcements">
          {announcements.map((ann) => (
            <div
              key={ann.id}
              className={`rounded-2xl border p-4 shadow-sm flex items-start gap-3.5 transition-colors ${
                ann.priority > 0
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                  : "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
              }`}
            >
              <Bell className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-slate-100">{ann.title}</h2>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {new Date(ann.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{ann.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Highlights Grid: Cumulative Score, Current Status, Qualification */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Cumulative Preliminary Score */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Award className="h-4 w-4 text-cyan-400" /> Preliminary Points
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">Excludes Practice</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl font-black text-cyan-400">
              {cumulativeScore}
            </span>
            <span className="text-sm font-semibold text-muted-foreground">total pts</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Authoritative sum of all scored preliminary rounds.
          </p>
        </div>

        {/* Current Active Round Station */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-400" /> Active Round
            </span>
            {currentRound && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
            )}
          </div>
          {currentRound ? (
            <div>
              <p className="text-lg font-bold text-slate-100">{currentRound.name}</p>
              <p className="text-xs text-amber-400 font-semibold mt-0.5">
                Report to: {currentRound.assignedLobby?.name} ({currentRound.status})
              </p>
            </div>
          ) : (
            <div>
              <p className="text-lg font-bold text-slate-100">Between Rounds</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Stand by in your assigned area for next round call.
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Tournament Phase: <strong className="text-slate-200">{event?.eventStatus.replace(/_/g, " ") || "ACTIVE"}</strong>
          </p>
        </div>

        {/* Qualification / Cutoff Status */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-3 shadow-sm sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-purple-400" /> Qualification Standby
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">Top 8 Advance</span>
          </div>
          {qualification ? (
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-purple-400">Rank #{qualification.rank}</span>
                <span className={"text-xs font-bold px-2 py-0.5 rounded-full " + (qualification.qualified ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-muted text-muted-foreground")}>
                  {qualification.qualified ? "QUALIFIED FOR FINAL" : "NOT QUALIFIED"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Official preliminary standing calculated.
              </p>
              {event?.resultsPublished && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <a href="/results" className="text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1">
                    🏆 View Published Final Results & Podium →
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-lg font-bold text-slate-200">Preliminary Phase In Progress</p>
              <p className="text-xs text-muted-foreground mt-1">
                Final standings will be finalized following completion of preliminary rounds.
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Venue: <strong className="text-slate-300">{event?.venue || "Main Campus Arena"}</strong>
          </p>
        </div>
      </div>

      {/* Round Breakdown Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Round Performance & Scores</h2>
            <p className="text-xs text-muted-foreground">
              Official score entries recorded by tournament referees
            </p>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {rounds.filter((r) => Boolean(r.scoreEntry)).length} of {rounds.length} rounds recorded
          </span>
        </div>

        {rounds.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No rounds assigned to your participant profile yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {rounds.map((round) => {
              const score = round.scoreEntry;
              const isExpanded = Boolean(expandedRounds[round.roundId]);

              return (
                <div key={round.roundId} className="transition hover:bg-slate-900/30">
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left: Round Info */}
                    <div className="flex items-center gap-3">
                      <div className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xs font-mono font-bold " + (
                        round.type === "PRACTICE"
                          ? "border-muted bg-muted/40 text-muted-foreground"
                          : round.type === "FINAL"
                          ? "border-purple-500/30 bg-purple-500/10 text-purple-400"
                          : "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
                      )}>
                        R{round.roundNumber}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm sm:text-base font-bold text-slate-100">
                            {round.name}
                          </h3>
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md border border-border bg-slate-900 text-muted-foreground">
                            {round.type}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Lobby: <strong className="text-slate-300">{round.lobbyName}</strong> • Status: {round.status}
                        </p>
                      </div>
                    </div>

                    {/* Right: Score & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      {score ? (
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="font-mono text-xl font-black text-cyan-400">
                              {score.totalScore}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">pts</span>
                            <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                              Played as {score.role}
                            </p>
                          </div>

                          {score.hasHistory && (
                            <button
                              type="button"
                              onClick={() => setHistoryModal({ scoreId: score.id, roundName: round.name })}
                              className="rounded-xl border border-border bg-slate-900 p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:bg-slate-800 hover:text-cyan-400 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                              title={"View revision history (v" + score.historyCount + ")"}
                              aria-label={"View revision history for " + round.name}
                            >
                              <History className="h-4 w-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => toggleRound(round.roundId)}
                            className="flex items-center gap-1.5 rounded-xl border border-border bg-slate-900 px-3.5 py-2 min-h-[44px] text-xs font-semibold text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                            aria-expanded={isExpanded}
                          >
                            <span>Breakdown</span>
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>Awaiting referee score entry</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Breakdown Drawer */}
                  {isExpanded && score && (
                    <div className="px-5 pb-5 pt-1 border-t border-border/60 bg-slate-950/40">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-3 text-xs">
                        <div className="rounded-xl border border-border bg-card/60 p-2.5 space-y-0.5">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase">Correct Vote</span>
                          <p className="font-bold text-slate-200">{score.correctVote ? "+3 pts (Yes)" : "0 pts (No)"}</p>
                        </div>
                        <div className="rounded-xl border border-border bg-card/60 p-2.5 space-y-0.5">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase">Imposter Identified</span>
                          <p className="font-bold text-slate-200">{score.correctIdentification ? "+1 pt (Yes)" : "0 pts (No)"}</p>
                        </div>
                        <div className="rounded-xl border border-border bg-card/60 p-2.5 space-y-0.5">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase">Survival</span>
                          <p className="font-bold text-slate-200">{score.survived ? "+2 pts (Survived)" : "0 pts (Died)"}</p>
                        </div>
                        {score.role === "CREWMATE" ? (
                          <>
                            <div className="rounded-xl border border-border bg-card/60 p-2.5 space-y-0.5">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Tasks Completed</span>
                              <p className="font-bold text-slate-200">+{score.tasksCompleted} pts ({score.tasksCompleted} tasks)</p>
                            </div>
                            <div className="rounded-xl border border-border bg-card/60 p-2.5 space-y-0.5">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Crewmate Win</span>
                              <p className="font-bold text-slate-200">{score.wonAsCrewmate ? "+3 pts (Won)" : "0 pts (Lost)"}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="rounded-xl border border-border bg-card/60 p-2.5 space-y-0.5">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Eliminations</span>
                              <p className="font-bold text-slate-200">+{score.successfulElimination * 2} pts ({score.successfulElimination} kills)</p>
                            </div>
                            <div className="rounded-xl border border-border bg-card/60 p-2.5 space-y-0.5">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Imposter Win</span>
                              <p className="font-bold text-slate-200">{score.wonAsImposter ? "+5 pts (Won)" : "0 pts (Lost)"}</p>
                            </div>
                            <div className="rounded-xl border border-border bg-card/60 p-2.5 space-y-0.5">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Avoided Identification</span>
                              <p className="font-bold text-slate-200">{score.avoidedIdentification ? "+3 pts (Yes)" : "0 pts"}</p>
                            </div>
                            <div className="rounded-xl border border-border bg-card/60 p-2.5 space-y-0.5">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Voted Out</span>
                              <p className="font-bold text-slate-200">{score.votedOutAsImposter ? "-2 pts (Ejected)" : "0 pts"}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Announcements Feed Card */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan-400">
            <Bell className="h-5 w-5" />
            <h2 className="text-lg font-bold text-slate-100">Active Tournament Announcements</h2>
          </div>
          <span className="text-xs text-muted-foreground">{announcements.length} posted</span>
        </div>

        {announcements.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No active announcements. Check back during round transitions.
          </p>
        ) : (
          <div className="space-y-3">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className="rounded-xl border border-border bg-slate-900/60 p-4 space-y-1.5 transition hover:border-cyan-500/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-100">{ann.title}</h3>
                  {ann.priority > 0 && (
                    <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400 uppercase">
                      High Priority
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{ann.message}</p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  Posted: {new Date(ann.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History Modal */}
      {historyModal && (
        <ScoreHistoryModal
          scoreId={historyModal.scoreId}
          roundName={historyModal.roundName}
          onClose={() => setHistoryModal(null)}
        />
      )}
    </main>
  );
}
