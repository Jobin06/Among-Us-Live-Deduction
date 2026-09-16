"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ScoringRule } from "@prisma/client";
import { ScoreEntryModal } from "@/components/volunteer/score-entry-modal";

interface Assignment {
  id: string;
  roundId: string;
  roundName: string;
  lobbyId: string;
  lobbyName: string;
}

interface Round {
  id: string;
  name: string;
  roundNumber: number;
  type: string;
  status: string;
  scoreLocked: boolean;
}

interface Lobby {
  id: string;
  name: string;
  type: string;
}

interface ParticipantStatusItem {
  id: string;
  participantId: string;
  name: string;
  amongUsUsername?: string | null;
  roundId: string;
  roundName: string;
  roundNumber: number;
  roundType: string;
  scoreLocked: boolean;
  lobbyId: string;
  lobbyName: string;
  status: "COMPLETED" | "PENDING";
  scoreEntry?: any;
}

interface DashboardData {
  assignments: Assignment[];
  rounds: Round[];
  lobbies: Lobby[];
  participantsWithStatus: ParticipantStatusItem[];
}

export default function VolunteerDashboardPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedRoundId, setSelectedRoundId] = useState<string>("");
  const [selectedLobbyId, setSelectedLobbyId] = useState<string>("");

  // Modal state
  const [activeParticipant, setActiveParticipant] = useState<ParticipantStatusItem | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashRes, rulesRes] = await Promise.all([
        fetch("/api/volunteers/me/dashboard"),
        fetch("/api/scoring-rules"),
      ]);

      if (!dashRes.ok) {
        throw new Error("Failed to load volunteer assignments.");
      }

      const dashJson = await dashRes.json();
      const rulesJson = await rulesRes.json();

      setData(dashJson.data);
      setScoringRules(rulesJson.data || []);

      // Initialize selectors from assigned pairs
      if (dashJson.data?.assignments?.length > 0) {
        setSelectedRoundId((prev) => prev || dashJson.data.assignments[0].roundId);
        setSelectedLobbyId((prev) => prev || dashJson.data.assignments[0].lobbyId);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle score save success
  const handleScoreSaved = () => {
    setActiveParticipant(null);
    fetchDashboardData();
  };

  // Compute available lobbies for selected round strictly from assignments
  const availableLobbiesForRound = React.useMemo(() => {
    if (!data || !selectedRoundId) return [];
    return data.assignments
      .filter((a) => a.roundId === selectedRoundId)
      .map((a) => ({ id: a.lobbyId, name: a.lobbyName }));
  }, [data, selectedRoundId]);

  // Filter participants by exact assigned round and lobby
  const filteredParticipants = React.useMemo(() => {
    if (!data) return [];
    return data.participantsWithStatus.filter(
      (p) => p.roundId === selectedRoundId && p.lobbyId === selectedLobbyId
    );
  }, [data, selectedRoundId, selectedLobbyId]);

  if (loading) {
    return (
      <main className="container mx-auto p-6 max-w-6xl space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded-lg" />
        <div className="h-64 bg-card border border-border rounded-2xl animate-pulse" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto p-6 max-w-6xl">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-destructive space-y-2">
          <h2 className="text-lg font-bold">Error Loading Volunteer Portal</h2>
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-3 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  const hasAssignments = data && data.assignments.length > 0;

  return (
    <main className="container mx-auto p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Volunteer Scoring Portal
            </h1>
            <span className="rounded-md bg-secondary/80 px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
              Staff
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Logged in as <span className="font-semibold text-foreground">{session?.user?.name || session?.user?.username}</span>
          </p>
        </div>

        {hasAssignments && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border px-3 py-1.5 rounded-xl">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{data.assignments.length} Active Assignment{data.assignments.length > 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* Empty State when volunteer has no assignments */}
      {!hasAssignments ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center text-xl text-muted-foreground">
            📋
          </div>
          <h2 className="text-lg font-bold text-foreground">No Assignments Found</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            You do not currently have any active round and lobby assignments. Please contact the tournament administrator to be assigned to a game lobby.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Assignment Selector Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-card border border-border p-4 rounded-2xl">
            <div>
              <label htmlFor="roundSelect" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                Select Round
              </label>
              <select
                id="roundSelect"
                value={selectedRoundId}
                onChange={(e) => {
                  setSelectedRoundId(e.target.value);
                  // Default to first lobby for this round
                  const firstLobby = data.assignments.find((a) => a.roundId === e.target.value);
                  if (firstLobby) setSelectedLobbyId(firstLobby.lobbyId);
                }}
                className="w-full rounded-xl bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {data.rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="lobbySelect" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                Select Lobby (Assigned Scope)
              </label>
              <select
                id="lobbySelect"
                value={selectedLobbyId}
                onChange={(e) => setSelectedLobbyId(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {availableLobbiesForRound.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Participant Scoring Table */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Lobby Roster & Score Status
                </h2>
                <p className="text-xs text-muted-foreground">
                  Showing {filteredParticipants.length} participant{filteredParticipants.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            {filteredParticipants.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No participants registered for this round and lobby.
              </div>
            ) : (
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Lobby roster table">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th scope="col" className="p-4">Participant</th>
                      <th scope="col" className="p-4">Among Us Handle</th>
                      <th scope="col" className="p-4">Status</th>
                      <th scope="col" className="p-4">Score</th>
                      <th scope="col" className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredParticipants.map((p) => {
                      const isCompleted = p.status === "COMPLETED";
                      const isLocked = p.scoreLocked;

                      return (
                        <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-muted">
                                {p.participantId}
                              </span>
                              <span className="font-medium text-foreground">{p.name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground font-mono text-xs">
                            {p.amongUsUsername || "—"}
                          </td>
                          <td className="p-4">
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                Completed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="p-4 font-mono font-bold">
                            {isCompleted ? (
                              <span className="text-primary text-base">
                                {p.scoreEntry?.totalScore} pts
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {isLocked ? (
                              <span className="text-xs text-muted-foreground italic">
                                Locked
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setActiveParticipant(p)}
                                className={`px-4 py-2 min-h-[44px] rounded-xl font-medium text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                                  isCompleted
                                    ? "border border-border bg-card hover:bg-muted text-foreground"
                                    : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20"
                                }`}
                              >
                                {isCompleted ? "Edit Score" : "Enter Score"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Score Entry & Edit Modal */}
      {activeParticipant && (
        <ScoreEntryModal
          participant={activeParticipant}
          scoringRules={scoringRules}
          onClose={() => setActiveParticipant(null)}
          onSuccess={handleScoreSaved}
        />
      )}
    </main>
  );
}
