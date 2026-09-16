"use client";

import React, { useState, useEffect, useMemo } from "react";
import { PlayerRole, ScoringRule } from "@prisma/client";

interface ParticipantItem {
  id: string;
  participantId: string;
  name: string;
  amongUsUsername?: string | null;
  roundId: string;
  roundName: string;
  roundNumber: number;
  scoreLocked: boolean;
  lobbyId: string;
  lobbyName: string;
  status: "COMPLETED" | "PENDING";
  scoreEntry?: {
    id: string;
    totalScore: number;
    role: PlayerRole;
    correctVote: boolean;
    correctIdentification: boolean;
    tasksCompleted: number;
    survived: boolean;
    wonAsCrewmate: boolean;
    wonAsImposter: boolean;
    successfulElimination: number;
    avoidedIdentification: boolean;
    votedOutAsImposter: boolean;
  } | null;
}

interface ScoreEntryModalProps {
  participant: ParticipantItem | null;
  scoringRules: ScoringRule[];
  onClose: () => void;
  onSuccess: () => void;
}

export function ScoreEntryModal({
  participant,
  scoringRules,
  onClose,
  onSuccess,
}: ScoreEntryModalProps) {
  const isEditing = Boolean(participant?.scoreEntry);

  const [role, setRole] = useState<PlayerRole>(participant?.scoreEntry?.role || PlayerRole.CREWMATE);
  const [correctVote, setCorrectVote] = useState(participant?.scoreEntry?.correctVote || false);
  const [correctIdentification, setCorrectIdentification] = useState(
    participant?.scoreEntry?.correctIdentification || false
  );
  const [tasksCompleted, setTasksCompleted] = useState(participant?.scoreEntry?.tasksCompleted || 0);
  const [survived, setSurvived] = useState(participant?.scoreEntry?.survived || false);
  const [wonAsCrewmate, setWonAsCrewmate] = useState(participant?.scoreEntry?.wonAsCrewmate || false);
  const [wonAsImposter, setWonAsImposter] = useState(participant?.scoreEntry?.wonAsImposter || false);
  const [successfulElimination, setSuccessfulElimination] = useState(
    participant?.scoreEntry?.successfulElimination || 0
  );
  const [avoidedIdentification, setAvoidedIdentification] = useState(
    participant?.scoreEntry?.avoidedIdentification || false
  );
  const [votedOutAsImposter, setVotedOutAsImposter] = useState(
    participant?.scoreEntry?.votedOutAsImposter || false
  );
  const [reason, setReason] = useState("");

  const [isConfirming, setIsConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state when participant changes
  useEffect(() => {
    if (participant?.scoreEntry) {
      setRole(participant.scoreEntry.role);
      setCorrectVote(participant.scoreEntry.correctVote);
      setCorrectIdentification(participant.scoreEntry.correctIdentification);
      setTasksCompleted(participant.scoreEntry.tasksCompleted);
      setSurvived(participant.scoreEntry.survived);
      setWonAsCrewmate(participant.scoreEntry.wonAsCrewmate);
      setWonAsImposter(participant.scoreEntry.wonAsImposter);
      setSuccessfulElimination(participant.scoreEntry.successfulElimination);
      setAvoidedIdentification(participant.scoreEntry.avoidedIdentification);
      setVotedOutAsImposter(participant.scoreEntry.votedOutAsImposter);
      setReason("");
    } else {
      setRole(PlayerRole.CREWMATE);
      setCorrectVote(false);
      setCorrectIdentification(false);
      setTasksCompleted(0);
      setSurvived(false);
      setWonAsCrewmate(false);
      setWonAsImposter(false);
      setSuccessfulElimination(0);
      setAvoidedIdentification(false);
      setVotedOutAsImposter(false);
      setReason("");
    }
    setErrorMessage(null);
    setIsConfirming(false);
  }, [participant]);

  // Keyboard Escape listener for modal dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Handle role switch — clear opposing role specific values
  const handleRoleChange = (newRole: PlayerRole) => {
    setRole(newRole);
    if (newRole === PlayerRole.CREWMATE) {
      setWonAsImposter(false);
      setSuccessfulElimination(0);
      setAvoidedIdentification(false);
      setVotedOutAsImposter(false);
    } else {
      setTasksCompleted(0);
      setWonAsCrewmate(false);
    }
  };

  // Rule point map
  const rulesMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of scoringRules) {
      if (r.isActive) {
        map.set(r.ruleKey, r.points);
      }
    }
    return map;
  }, [scoringRules]);

  // Non-authoritative client preview calculation
  const previewScore = useMemo(() => {
    let score = 0;
    if (correctVote) score += rulesMap.get("correct_vote") ?? 3;
    if (correctIdentification) score += rulesMap.get("correct_identification") ?? 1;
    if (survived) score += rulesMap.get("survived") ?? 2;

    if (role === PlayerRole.CREWMATE) {
      if (wonAsCrewmate) score += rulesMap.get("won_as_crewmate") ?? 3;
      score += (tasksCompleted || 0) * (rulesMap.get("task_completed") ?? 1);
    } else if (role === PlayerRole.IMPOSTER) {
      if (wonAsImposter) score += rulesMap.get("won_as_imposter") ?? 5;
      score += (successfulElimination || 0) * (rulesMap.get("successful_elimination") ?? 2);
      if (avoidedIdentification) score += rulesMap.get("avoided_identification") ?? 3;
      if (votedOutAsImposter) score += rulesMap.get("voted_out_as_imposter") ?? -2;
    }
    return score;
  }, [
    role,
    correctVote,
    correctIdentification,
    tasksCompleted,
    survived,
    wonAsCrewmate,
    wonAsImposter,
    successfulElimination,
    avoidedIdentification,
    votedOutAsImposter,
    rulesMap,
  ]);

  if (!participant) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate reason if editing
    if (isEditing && reason.trim().length < 3) {
      setErrorMessage("Please enter a valid edit reason (at least 3 characters).");
      return;
    }

    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && participant.scoreEntry) {
        const res = await fetch(`/api/scores/${participant.scoreEntry.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role,
            correctVote,
            correctIdentification,
            tasksCompleted: role === PlayerRole.CREWMATE ? tasksCompleted : 0,
            survived,
            wonAsCrewmate: role === PlayerRole.CREWMATE ? wonAsCrewmate : false,
            wonAsImposter: role === PlayerRole.IMPOSTER ? wonAsImposter : false,
            successfulElimination: role === PlayerRole.IMPOSTER ? successfulElimination : 0,
            avoidedIdentification: role === PlayerRole.IMPOSTER ? avoidedIdentification : false,
            votedOutAsImposter: role === PlayerRole.IMPOSTER ? votedOutAsImposter : false,
            reason: reason.trim(),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || "Failed to update score.");
        }
      } else {
        const res = await fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roundId: participant.roundId,
            participantId: participant.id,
            lobbyId: participant.lobbyId,
            role,
            correctVote,
            correctIdentification,
            tasksCompleted: role === PlayerRole.CREWMATE ? tasksCompleted : 0,
            survived,
            wonAsCrewmate: role === PlayerRole.CREWMATE ? wonAsCrewmate : false,
            wonAsImposter: role === PlayerRole.IMPOSTER ? wonAsImposter : false,
            successfulElimination: role === PlayerRole.IMPOSTER ? successfulElimination : 0,
            avoidedIdentification: role === PlayerRole.IMPOSTER ? avoidedIdentification : false,
            votedOutAsImposter: role === PlayerRole.IMPOSTER ? votedOutAsImposter : false,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || "Failed to submit score.");
        }
      }

      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
      setIsConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="score-modal-title"
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-primary">
                {participant.participantId}
              </span>
              <span className="text-muted-foreground">•</span>
              <h2 id="score-modal-title" className="text-xl font-bold text-foreground">{participant.name}</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {participant.roundName} ({participant.lobbyName})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close score entry modal"
            className="text-muted-foreground hover:text-foreground text-xl font-bold p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive font-medium" role="alert">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Role Toggle */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Observed Role
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleRoleChange(PlayerRole.CREWMATE)}
                className={`py-3 px-4 min-h-[48px] rounded-xl font-medium text-sm border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  role === PlayerRole.CREWMATE
                    ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm shadow-cyan-500/10 font-bold"
                    : "bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted/70"
                }`}
              >
                Crewmate
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange(PlayerRole.IMPOSTER)}
                className={`py-3 px-4 min-h-[48px] rounded-xl font-medium text-sm border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  role === PlayerRole.IMPOSTER
                    ? "bg-red-500/20 border-red-500 text-red-300 shadow-sm shadow-red-500/10 font-bold"
                    : "bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted/70"
                }`}
              >
                Imposter
              </button>
            </div>
          </div>

          {/* Role-Specific Fields */}
          <div className="space-y-4 rounded-xl bg-background/60 border border-border/40 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {role === PlayerRole.CREWMATE ? "Crewmate Performance" : "Imposter Performance"}
            </h3>

            {role === PlayerRole.CREWMATE ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label htmlFor="tasksCompleted" className="text-sm font-medium">
                    Tasks Completed (+1 pt each)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTasksCompleted(Math.max(0, tasksCompleted - 1))}
                      disabled={tasksCompleted <= 0}
                      className="h-12 w-12 rounded-xl bg-card border border-border text-foreground font-bold text-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label="Decrease tasks completed"
                    >
                      −
                    </button>
                    <input
                      id="tasksCompleted"
                      type="number"
                      min="0"
                      max="50"
                      value={tasksCompleted}
                      onChange={(e) => setTasksCompleted(Math.max(0, parseInt(e.target.value) || 0))}
                      className="h-12 w-20 rounded-xl bg-card border border-border px-3 py-1.5 text-center font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                      aria-label="Tasks completed count"
                    />
                    <button
                      type="button"
                      onClick={() => setTasksCompleted(Math.min(50, tasksCompleted + 1))}
                      disabled={tasksCompleted >= 50}
                      className="h-12 w-12 rounded-xl bg-card border border-border text-foreground font-bold text-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label="Increase tasks completed"
                    >
                      +
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer min-h-[44px] py-1">
                  <input
                    type="checkbox"
                    checked={wonAsCrewmate}
                    onChange={(e) => setWonAsCrewmate(e.target.checked)}
                    className="h-5 w-5 rounded border-border bg-card text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Won as Crewmate (+3 pts)</span>
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label htmlFor="successfulElimination" className="text-sm font-medium">
                    Successful Eliminations (+2 pts each)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSuccessfulElimination(Math.max(0, successfulElimination - 1))}
                      disabled={successfulElimination <= 0}
                      className="h-12 w-12 rounded-xl bg-card border border-border text-foreground font-bold text-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label="Decrease successful eliminations"
                    >
                      −
                    </button>
                    <input
                      id="successfulElimination"
                      type="number"
                      min="0"
                      max="50"
                      value={successfulElimination}
                      onChange={(e) =>
                        setSuccessfulElimination(Math.max(0, parseInt(e.target.value) || 0))
                      }
                      className="h-12 w-20 rounded-xl bg-card border border-border px-3 py-1.5 text-center font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                      aria-label="Successful eliminations count"
                    />
                    <button
                      type="button"
                      onClick={() => setSuccessfulElimination(Math.min(50, successfulElimination + 1))}
                      disabled={successfulElimination >= 50}
                      className="h-12 w-12 rounded-xl bg-card border border-border text-foreground font-bold text-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label="Increase successful eliminations"
                    >
                      +
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer min-h-[44px] py-1">
                  <input
                    type="checkbox"
                    checked={wonAsImposter}
                    onChange={(e) => setWonAsImposter(e.target.checked)}
                    className="h-5 w-5 rounded border-border bg-card text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Won as Imposter (+5 pts)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer min-h-[44px] py-1">
                  <input
                    type="checkbox"
                    checked={avoidedIdentification}
                    onChange={(e) => setAvoidedIdentification(e.target.checked)}
                    className="h-5 w-5 rounded border-border bg-card text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Avoided Identification (+3 pts)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer min-h-[44px] py-1">
                  <input
                    type="checkbox"
                    checked={votedOutAsImposter}
                    onChange={(e) => {
                      setVotedOutAsImposter(e.target.checked);
                      if (e.target.checked) setSurvived(false);
                    }}
                    className="h-5 w-5 rounded border-border bg-card text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-red-300">Voted Out as Imposter (-2 pts)</span>
                </label>
              </div>
            )}
          </div>

          {/* Shared Performance Fields */}
          <div className="space-y-3 rounded-xl bg-background/60 border border-border/40 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              General Gameplay
            </h3>

            <label className="flex items-center gap-3 cursor-pointer min-h-[44px] py-1">
              <input
                type="checkbox"
                checked={correctVote}
                onChange={(e) => setCorrectVote(e.target.checked)}
                className="h-5 w-5 rounded border-border bg-card text-primary focus:ring-primary"
              />
              <span className="text-sm">Correctly Voted Out Imposter (+3 pts)</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer min-h-[44px] py-1">
              <input
                type="checkbox"
                checked={correctIdentification}
                onChange={(e) => setCorrectIdentification(e.target.checked)}
                className="h-5 w-5 rounded border-border bg-card text-primary focus:ring-primary"
              />
              <span className="text-sm">Correctly Identified Imposter (+1 pt)</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer min-h-[44px] py-1">
              <input
                type="checkbox"
                checked={survived}
                disabled={votedOutAsImposter}
                onChange={(e) => setSurvived(e.target.checked)}
                className="h-5 w-5 rounded border-border bg-card text-primary focus:ring-primary disabled:opacity-50"
              />
              <span className={`text-sm ${votedOutAsImposter ? "line-through text-muted-foreground" : ""}`}>
                Survived Round (+2 pts)
              </span>
            </label>
          </div>

          {/* Edit Reason (Mandatory when editing) */}
          {isEditing && (
            <div>
              <label htmlFor="reason" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                Reason for Edit <span className="text-destructive">*</span>
              </label>
              <textarea
                id="reason"
                required
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Corrected tasks completed from stream replay inspection"
                className="w-full rounded-xl bg-background/80 border border-border p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          {/* Live Preview Box */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Live Preview
              </p>
              <p className="text-xs text-muted-foreground">
                Preview only — server calculates authoritative score upon submission.
              </p>
            </div>
            <div className="text-right">
              <span className="font-mono text-2xl font-black text-primary">
                {previewScore}
              </span>
              <span className="text-xs text-muted-foreground ml-1">pts</span>
            </div>
          </div>

          {/* Confirmation Warning Modal / Buttons */}
          {isConfirming ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
              <p className="text-sm font-semibold text-amber-300">
                Confirm Score Submission
              </p>
              <p className="text-xs text-muted-foreground">
                You are about to save score for <strong>{participant.name}</strong> as{" "}
                <strong>{role}</strong> with estimated <strong>{previewScore} points</strong>. The
                backend will compute and persist the authoritative score.
              </p>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 rounded-lg bg-primary font-semibold text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Yes, Save Score"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirming(false)}
                  className="py-2 px-4 rounded-lg bg-muted text-sm font-medium hover:bg-muted/80"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl border border-border bg-card text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="py-2.5 px-6 rounded-xl bg-primary font-semibold text-sm text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20"
              >
                {isEditing ? "Review & Update" : "Review & Submit"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
