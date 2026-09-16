"use client";

import React, { useState, useEffect } from "react";
import { History, X, Loader2, AlertCircle, Clock } from "lucide-react";

interface HistoryItem {
  id: string;
  version: number;
  oldTotalScore: number | null;
  newTotalScore: number;
  oldValues: any;
  newValues: any;
  reason: string | null;
  createdAt: string;
}

interface ScoreHistoryModalProps {
  scoreId: string;
  roundName: string;
  onClose: () => void;
}

export function ScoreHistoryModal({ scoreId, roundName, onClose }: ScoreHistoryModalProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/participants/me/scores/" + scoreId + "/history");
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Score history not found.");
          }
          throw new Error("Failed to load score history.");
        }
        const json = await res.json();
        setHistory(json.data?.history || []);
      } catch (err: any) {
        setError(err.message || "An error occurred.");
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [scoreId]);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
    >
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-6 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 id="history-modal-title" className="text-lg font-bold text-slate-100">
                Score Revision History
              </h2>
              <p className="text-xs text-muted-foreground">
                Official audit trail for {roundName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            aria-label="Close score history dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
              <p className="text-xs text-muted-foreground">Loading immutable score trail...</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive space-y-1 flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-semibold">Error retrieving history</p>
                <p>{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-xs">
              No change history recorded for this round score.
            </div>
          )}

          {!loading && !error && history.length > 0 && (
            <div className="relative border-l border-border/80 ml-3 space-y-6">
              {history.map((item) => (
                <div key={item.id} className="relative pl-6 space-y-2">
                  {/* Dot */}
                  <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full border-2 border-card bg-cyan-500" />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-xs font-bold text-cyan-300">
                        Version {item.version}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>

                    <div className="font-mono text-sm font-black">
                      {item.oldTotalScore !== null && (
                        <span className="text-muted-foreground line-through mr-2 text-xs">
                          {item.oldTotalScore} pts
                        </span>
                      )}
                      <span className="text-cyan-400">{item.newTotalScore} pts</span>
                    </div>
                  </div>

                  {/* Reason */}
                  {item.reason && (
                    <div className="rounded-xl border border-border bg-slate-900/60 p-3 text-xs space-y-1">
                      <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                        Referee Modification Reason
                      </p>
                      <p className="text-slate-200 font-medium">{item.reason}</p>
                    </div>
                  )}

                  {/* Key values summary */}
                  {item.newValues && (
                    <div className="text-[11px] text-muted-foreground space-y-0.5">
                      <p>Role: <strong className="text-slate-300">{item.newValues.role}</strong></p>
                      {item.newValues.tasksCompleted > 0 && (
                        <p>Tasks Completed: <strong className="text-slate-300">{item.newValues.tasksCompleted}</strong></p>
                      )}
                      {item.newValues.successfulElimination > 0 && (
                        <p>Eliminations: <strong className="text-slate-300">{item.newValues.successfulElimination}</strong></p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border bg-slate-900 px-5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
