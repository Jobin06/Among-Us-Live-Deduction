"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Shield,
  ShieldAlert,
  Users,
  Trophy,
  Award,
  Layers,
  Calendar,
  Settings,
  Bell,
  Lock,
  Unlock,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit2,
  AlertCircle,
  Clock,
  UserCheck,
  ExternalLink,
} from "lucide-react";

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<
    "overview" | "rounds" | "volunteers" | "finals" | "rules" | "announcements" | "lifecycle"
  >("overview");

  // Data states
  const [stats, setStats] = useState<any>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [lobbies, setLobbies] = useState<any[]>([]);
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [eventSettings, setEventSettings] = useState<any>(null);
  // Phase 6 Data states
  const [qualifications, setQualifications] = useState<any[]>([]);
  const [finalsRoster, setFinalsRoster] = useState<any[]>([]);
  const [resultsPreview, setResultsPreview] = useState<any>(null);
  const [targetFinalRoundId, setTargetFinalRoundId] = useState("");
  const [targetFinalLobbyId, setTargetFinalLobbyId] = useState("");
  const [selectedTieWinnerId, setSelectedTieWinnerId] = useState("");
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");


  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form modals / state
  const [showRoundModal, setShowRoundModal] = useState(false);
  const [newRound, setNewRound] = useState({
    name: "",
    roundNumber: 1,
    type: "PRELIMINARY",
    status: "UPCOMING",
  });

  const [showLobbyModal, setShowLobbyModal] = useState(false);
  const [newLobby, setNewLobby] = useState({
    name: "",
    type: "PRELIMINARY",
    capacity: 10,
  });

  const [newAssignment, setNewAssignment] = useState({
    volunteerId: "",
    roundId: "",
    lobbyId: "",
  });

  const [editingRule, setEditingRule] = useState<any>(null);
  const [newRulePoints, setNewRulePoints] = useState<number>(0);

  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    message: "",
    priority: 0,
    isActive: true,
  });

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");

  // Check auth
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Load all admin data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setMessage(null);

      const [
        statsRes,
        roundsRes,
        lobbiesRes,
        volunteersRes,
        assignmentsRes,
        rulesRes,
        announcementsRes,
        settingsRes,
        qualRes,
        finalsRosterRes,
      ] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/qualification"),
        fetch("/api/finals/roster"),
        fetch("/api/rounds?includeArchived=true"),
        fetch("/api/lobbies"),
        fetch("/api/volunteers"),
        fetch("/api/volunteers/assignments"),
        fetch("/api/scoring-rules"),
        fetch("/api/announcements?all=true"),
        fetch("/api/event/settings"),
      ]);

      if (statsRes.ok) setStats((await statsRes.json()).data);
      if (roundsRes.ok) setRounds((await roundsRes.json()).data || []);
      if (lobbiesRes.ok) setLobbies((await lobbiesRes.json()).data || []);
      if (volunteersRes.ok) setVolunteers((await volunteersRes.json()).data || []);
      if (assignmentsRes.ok) setAssignments((await assignmentsRes.json()).data || []);
      if (rulesRes.ok) setRules((await rulesRes.json()).data || []);
      if (announcementsRes.ok) setAnnouncements((await announcementsRes.json()).data || []);
      if (settingsRes.ok) setEventSettings((await settingsRes.json()).data);
    } catch {
      setMessage({ type: "error", text: "Failed to load admin management data." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user?.role === "ADMIN") {
      loadDashboardData();
    }
  }, [session, loadDashboardData]);

  if (status === "loading" || loading) {
    return (
      <main className="min-h-screen bg-background p-6 flex flex-col items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-10 w-48 bg-muted rounded-xl" />
          <div className="h-64 w-full max-w-4xl bg-muted/40 rounded-2xl" />
        </div>
      </main>
    );
  }

  if (session?.user?.role !== "ADMIN") {
    return (
      <main className="min-h-screen bg-background p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center space-y-3">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold text-destructive">Administrative Access Denied</h1>
          <p className="text-sm text-muted-foreground">
            Your current account role does not possess permissions to access the tournament administration console.
          </p>
        </div>
      </main>
    );
  }

  // Handle Event Status Change
  const handleEventStatusChange = async (newStatus: string) => {
    try {
      setActionLoading(true);
      const res = await fetch("/api/event/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...eventSettings, eventStatus: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to transition event state.");
      setMessage({ type: "success", text: `Event state transitioned to ${newStatus}` });
      await loadDashboardData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to update event state." });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Score Lock Toggle
  const handleToggleScoreLock = async (round: any) => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/rounds/${round.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scoreLocked: !round.scoreLocked }),
      });
      if (!res.ok) throw new Error("Failed to update round score lock.");
      setMessage({
        type: "success",
        text: `Round ${round.name} ${!round.scoreLocked ? "locked" : "unlocked"} successfully.`,
      });
      await loadDashboardData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to toggle score lock." });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Round Status Change
  const handleRoundStatusChange = async (roundId: string, status: string) => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/rounds/${roundId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update round status.");
      setMessage({ type: "success", text: "Round status updated." });
      await loadDashboardData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to update round status." });
    } finally {
      setActionLoading(false);
    }
  };

    // Phase 6: Calculate Qualification
  const handleCalculateQualification = async () => {
    try {
      setActionLoading(true);
      const res = await fetch("/api/qualification/calculate", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to calculate qualification.");
      }
      setMessage({
        type: "success",
        text: `Qualification calculated: ${json.data.qualifiedCount} of ${json.data.qualificationCount} finalists qualified.`,
      });
      await loadDashboardData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to calculate qualification." });
    } finally {
      setActionLoading(false);
    }
  };

  // Phase 6: Resolve Cutoff Tie
  const handleResolveTie = async (participantId: string) => {
    try {
      setActionLoading(true);
      const res = await fetch("/api/qualification/resolve-tie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to resolve tie.");
      }
      setMessage({ type: "success", text: "Cutoff boundary tie successfully resolved." });
      await loadDashboardData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to resolve tie." });
    } finally {
      setActionLoading(false);
    }
  };

  // Phase 6: Enroll Finals Roster
  const handleEnrollFinalsRoster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetFinalRoundId || !targetFinalLobbyId) {
      setMessage({ type: "error", text: "Please select both a target final round and a target lobby." });
      return;
    }
    try {
      setActionLoading(true);
      const res = await fetch("/api/finals/roster/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId: targetFinalRoundId, lobbyId: targetFinalLobbyId }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to enroll finals roster.");
      }
      setMessage({
        type: "success",
        text: `Successfully enrolled ${json.data.result.enrolledCount} finalists into round.`,
      });
      await loadDashboardData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to enroll finals roster." });
    } finally {
      setActionLoading(false);
    }
  };

  // Phase 6: Load Results Preview
  const handleLoadResultsPreview = async () => {
    try {
      setActionLoading(true);
      const res = await fetch("/api/results?preview=true");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to load results preview.");
      }
      setResultsPreview(json.data);
      setMessage({ type: "success", text: "Results preview refreshed." });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to load results preview." });
    } finally {
      setActionLoading(false);
    }
  };

  // Phase 6: Publish Results
  const handlePublishResults = async () => {
    try {
      setActionLoading(true);
      const res = await fetch("/api/results/publish", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to publish results.");
      }
      setShowPublishModal(false);
      setMessage({ type: "success", text: "Tournament results have been published and locked successfully." });
      await loadDashboardData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to publish results." });
    } finally {
      setActionLoading(false);
    }
  };

  // Phase 6: Unlock Results
  const handleUnlockResults = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockReason.trim()) {
      setMessage({ type: "error", text: "Please provide an explicit reason for unlocking results." });
      return;
    }
    try {
      setActionLoading(true);
      const res = await fetch("/api/results/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: unlockReason }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to unlock results.");
      }
      setShowUnlockModal(false);
      setUnlockReason("");
      setMessage({ type: "success", text: "Tournament results unlocked successfully." });
      await loadDashboardData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to unlock results." });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Create Round
  const handleCreateRound = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await fetch("/api/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRound),
      });
      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.error?.message || "Failed to create round.");
      }
      setShowRoundModal(false);
      setNewRound({ name: "", roundNumber: (rounds.length || 0) + 1, type: "PRELIMINARY", status: "UPCOMING" });
      setMessage({ type: "success", text: "New round created successfully." });
      await loadDashboardData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to create round." });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Create Lobby
  const handleCreateLobby = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await fetch("/api/lobbies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLobby),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || "Failed to create lobby.");
      }
      setShowLobbyModal(false);
      setNewLobby({ name: "", type: "PRELIMINARY", capacity: 10 });
      setMessage({ type: "success", text: "Lobby created successfully." });
      await loadDashboardData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to create lobby." });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Create Volunteer Assignment
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await fetch("/api/volunteers/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAssignment),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || "Failed to assign volunteer.");
      }
      setNewAssignment({ volunteerId: "", roundId: "", lobbyId: "" });
      setMessage({ type: "success", text: "Volunteer assigned successfully." });
      await loadDashboardData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to assign volunteer." });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Revoke Volunteer Assignment
  const handleRevokeAssignment = async (assignmentId: string) => {
    if (!confirm("Are you sure you want to revoke this volunteer assignment?")) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/volunteers/assignments/${assignmentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to revoke assignment.");
      setMessage({ type: "success", text: "Volunteer assignment revoked." });
      await loadDashboardData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to revoke assignment." });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Update Scoring Rule
  const handleUpdateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/scoring-rules/${editingRule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: Number(newRulePoints) }),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || "Failed to update scoring rule.");
      }
      setEditingRule(null);
      setMessage({ type: "success", text: `Rule "${editingRule.ruleName}" updated successfully.` });
      await loadDashboardData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to update scoring rule." });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Create Announcement
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAnnouncement),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || "Failed to post announcement.");
      }
      setNewAnnouncement({ title: "", message: "", priority: 0, isActive: true });
      setMessage({ type: "success", text: "Announcement created successfully." });
      await loadDashboardData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to create announcement." });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Soft-Deactivate Announcement
  const handleToggleAnnouncementActive = async (announcement: any) => {
    try {
      setActionLoading(true);
      if (announcement.isActive) {
        // Soft deactivate
        const res = await fetch(`/api/announcements/${announcement.id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to deactivate announcement.");
      } else {
        // Reactivate
        const res = await fetch(`/api/announcements/${announcement.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: true }),
        });
        if (!res.ok) throw new Error("Failed to reactivate announcement.");
      }
      setMessage({
        type: "success",
        text: `Announcement ${announcement.isActive ? "deactivated" : "reactivated"}.`,
      });
      await loadDashboardData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to update announcement." });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Prepare New Event Run (Reset)
  const handlePrepareNewRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetConfirmation !== "RESET") {
      alert('Please type "RESET" to confirm this operation.');
      return;
    }
    try {
      setActionLoading(true);
      const res = await fetch("/api/event/prepare-new-run", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to reset event run.");
      setShowResetModal(false);
      setResetConfirmation("");
      setMessage({
        type: "success",
        text: "New event run prepared. Previous rounds archived and historical data preserved intact.",
      });
      await loadDashboardData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to reset event run." });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <main className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-red-500 mb-1">
            <Shield className="h-5 w-5" />
            <span className="text-xs font-black tracking-widest uppercase">Official Administration Console</span>
          </div>
          <h1 className="text-3xl font-black text-slate-100 tracking-tight">Tournament Control Center</h1>
          <p className="text-sm text-slate-400">
            Head Tournament Controller &mdash; <span className="text-slate-200 font-semibold">{session?.user?.name || session?.user?.username}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/leaderboard")}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 px-3.5 py-2 text-xs font-bold text-cyan-300 transition"
          >
            <ExternalLink className="h-4 w-4" /> View Public Leaderboard
          </button>
          <button
            onClick={() => loadDashboardData()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card hover:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 transition"
            title="Refresh All Data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {message && (
        <div
          className={`rounded-2xl border p-4 text-sm flex items-center justify-between ${
            message.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Prominent Formula Warning Banner */}
      {stats && !stats.isFormulaConfigured && (
        <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/30 to-slate-900 p-5 shadow-lg flex items-start gap-4 text-amber-200">
          <AlertTriangle className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-bold text-amber-300">Final Scoring Formula Unconfigured</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              The tournament final scoring formula is currently unconfigured (NULL). An administrator must configure the formula before finals orchestration can begin or results can ever be published.
            </p>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div
        role="tablist"
        aria-label="Admin console navigation tabs"
        className="flex overflow-x-auto gap-2 border-b border-border pb-2 scrollbar-none"
      >
        {[
          { id: "overview", label: "Overview & Stats", icon: Shield },
          { id: "rounds", label: "Rounds & Lobbies", icon: Layers },
          { id: "volunteers", label: "Volunteer Assignments", icon: UserCheck },
          { id: "finals", label: "Finals & Results", icon: Award },
          { id: "rules", label: "Scoring Rules", icon: Trophy },
          { id: "announcements", label: "Announcements", icon: Bell },
          { id: "lifecycle", label: "Event Lifecycle", icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={"tabpanel-" + tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 min-h-[44px] text-xs sm:text-sm font-bold transition whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                isActive
                  ? "bg-red-500/15 text-red-400 border border-red-500/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 1: OVERVIEW & STATS */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Operational Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase font-bold">
                <Users className="h-3.5 w-3.5 text-cyan-400" /> Active Players
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-100">{stats?.totalParticipants ?? 0}</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase font-bold">
                <Clock className="h-3.5 w-3.5 text-emerald-400" /> Active Round
              </div>
              <p className="text-base sm:text-lg font-bold text-slate-100 truncate">
                {stats?.activeRound ? stats.activeRound.name : "None active"}
              </p>
              {stats?.activeRound && (
                <span className="text-[10px] uppercase font-bold text-cyan-400">
                  Round #{stats.activeRound.roundNumber}
                </span>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase font-bold">
                <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" /> Scored / Pending
              </div>
              <p className="text-xl sm:text-2xl font-black text-slate-100">
                {stats?.participantsScored ?? 0} <span className="text-xs text-slate-500 font-normal">/ {stats?.participantsPending ?? 0} left</span>
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase font-bold">
                <Trophy className="h-3.5 w-3.5 text-amber-400" /> Current Leader
              </div>
              <p className="text-lg font-black text-amber-300 truncate">
                {stats?.currentLeader ? stats.currentLeader.name : "N/A"}
              </p>
              {stats?.currentLeader && (
                <span className="text-xs font-mono text-cyan-400 font-bold">
                  {stats.currentLeader.totalScore} pts ({stats.currentLeader.participantId})
                </span>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase font-bold">
                <Layers className="h-3.5 w-3.5 text-purple-400" /> Active Lobbies
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-100">{stats?.lobbiesCount ?? 0}</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase font-bold">
                <UserCheck className="h-3.5 w-3.5 text-blue-400" /> Active Staff
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-100">{stats?.volunteersCount ?? 0}</p>
            </div>
          </div>

          {/* Event State Workflow Controller */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Global Tournament Workflow State</h3>
                <p className="text-xs text-slate-400">
                  Governs tournament stage visibility across participant portals, volunteer boards, and leaderboards.
                </p>
              </div>
              <span className="rounded-full bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 text-xs font-black text-cyan-300 uppercase">
                Current: {stats?.eventStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 pt-2">
              {[
                "NOT_STARTED",
                "REGISTRATION",
                "BRIEFING",
                "PRACTICE",
                "PRELIMINARY",
                "RESULTS",
                "FINAL",
                "COMPLETED",
              ].map((stage) => {
                const isCurrent = stats?.eventStatus === stage;
                return (
                  <button
                    key={stage}
                    disabled={actionLoading || isCurrent}
                    onClick={() => handleEventStatusChange(stage)}
                    className={`rounded-xl p-3 text-xs font-bold border transition text-center flex flex-col items-center justify-center gap-1 ${
                      isCurrent
                        ? "border-cyan-500 bg-cyan-500/20 text-cyan-300 shadow-md ring-1 ring-cyan-400"
                        : "border-border bg-muted/40 hover:bg-muted text-slate-300 disabled:opacity-50"
                    }`}
                  >
                    <span>{stage.replace(/_/g, " ")}</span>
                    {isCurrent && <span className="text-[10px] text-cyan-400 font-mono">ACTIVE</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 2: ROUNDS & LOBBIES */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "rounds" && (
        <div className="space-y-8">
          {/* Rounds Management */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-100">Tournament Rounds</h2>
                <p className="text-xs text-slate-400">Manage round progression, score locking, and statuses.</p>
              </div>
              <button
                onClick={() => setShowRoundModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-500 px-3.5 py-2 text-xs font-bold text-white transition shadow-md"
              >
                <Plus className="h-4 w-4" /> Create Round
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rounds.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-2xl border p-5 space-y-4 bg-card transition ${
                    r.isArchived ? "opacity-60 border-dashed border-slate-700" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold bg-muted px-2 py-0.5 rounded border border-border">
                          #{r.roundNumber}
                        </span>
                        <h3 className="text-base font-bold text-slate-100">{r.name}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Type: <span className="font-semibold text-slate-300">{r.type}</span>
                        {r.isArchived && <span className="ml-2 text-amber-400 font-bold">(ARCHIVED)</span>}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                        r.status === "ACTIVE"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : r.status === "SCORING"
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs bg-muted/40 p-2.5 rounded-xl border border-border/60">
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase">Assigned</span>
                      <span className="font-bold text-slate-200">{r._count?.roundParticipants ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase">Scores</span>
                      <span className="font-bold text-slate-200">{r._count?.scoreEntries ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block uppercase">Staff</span>
                      <span className="font-bold text-slate-200">{r._count?.volunteerAssignments ?? 0}</span>
                    </div>
                  </div>

                  {!r.isArchived && (
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <button
                        onClick={() => handleToggleScoreLock(r)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                          r.scoreLocked
                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
                            : "bg-muted text-slate-300 hover:bg-slate-800 border border-border"
                        }`}
                      >
                        {r.scoreLocked ? <Lock className="h-3.5 w-3.5 text-amber-400" /> : <Unlock className="h-3.5 w-3.5 text-slate-400" />}
                        <span>{r.scoreLocked ? "Scores Locked" : "Lock Scores"}</span>
                      </button>

                      <select
                        value={r.status}
                        onChange={(e) => handleRoundStatusChange(r.id, e.target.value)}
                        className="rounded-xl border border-border bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      >
                        <option value="UPCOMING">UPCOMING</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="SCORING">SCORING</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="LOCKED">LOCKED</option>
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Lobbies Management */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-100">Tournament Lobbies</h2>
                <p className="text-xs text-slate-400">Gaming rooms and parallel lobby configuration.</p>
              </div>
              <button
                onClick={() => setShowLobbyModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-border px-3.5 py-2 text-xs font-bold text-slate-200 transition shadow-sm"
              >
                <Plus className="h-4 w-4" /> Create Lobby
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {lobbies.map((l) => (
                <div key={l.id} className="rounded-2xl border border-border bg-card p-4 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-slate-100">{l.name}</h3>
                    <span className="rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold px-2 py-0.5 uppercase">
                      {l.type}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-border/60">
                    <span>Capacity: {l.capacity ?? "Unlimited"}</span>
                    <span>Players: {l._count?.participants ?? 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 3: VOLUNTEER ASSIGNMENTS */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "volunteers" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Assignment Creation Card */}
          <div className="lg:col-span-1 rounded-2xl border border-border bg-card p-6 space-y-4 shadow-sm h-fit">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-100">Assign Volunteer</h3>
              <p className="text-xs text-slate-400">
                Volunteers are scoped to exact <span className="text-cyan-400 font-semibold">(Round, Lobby)</span> pairs.
              </p>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Select Volunteer</label>
                <select
                  required
                  value={newAssignment.volunteerId}
                  onChange={(e) => setNewAssignment({ ...newAssignment, volunteerId: e.target.value })}
                  className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">-- Choose Volunteer --</option>
                  {volunteers.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.user?.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Select Active Round</label>
                <select
                  required
                  value={newAssignment.roundId}
                  onChange={(e) => setNewAssignment({ ...newAssignment, roundId: e.target.value })}
                  className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">-- Choose Round --</option>
                  {rounds
                    .filter((r) => !r.isArchived)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        Round #{r.roundNumber} - {r.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Select Lobby</label>
                <select
                  required
                  value={newAssignment.lobbyId}
                  onChange={(e) => setNewAssignment({ ...newAssignment, lobbyId: e.target.value })}
                  className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">-- Choose Lobby --</option>
                  {lobbies.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.type})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2.5 text-sm font-bold text-white transition shadow-md disabled:opacity-50"
              >
                Create Assignment
              </button>
            </form>
          </div>

          {/* Existing Assignments Table */}
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-100">Active Volunteer Assignments</h3>
                <p className="text-xs text-slate-400">Referees authorized to submit score entries for specific lobbies.</p>
              </div>
              <span className="text-xs font-mono font-bold bg-muted px-2 py-0.5 rounded text-slate-300">
                {assignments.length} Total
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-3">Volunteer</th>
                    <th className="px-4 py-3">Round</th>
                    <th className="px-4 py-3">Lobby</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {assignments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground text-xs">
                        No volunteer assignments recorded for the current event run.
                      </td>
                    </tr>
                  ) : (
                    assignments.map((a) => (
                      <tr key={a.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-semibold text-slate-200">
                          {a.volunteer?.name}
                        </td>
                        <td className="px-4 py-3 text-cyan-400 font-medium">
                          {a.round?.name}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {a.lobby?.name}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRevokeAssignment(a.id)}
                            className="text-xs text-destructive hover:underline font-semibold"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 4: SCORING RULES */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-100">Database-Backed Scoring Rules</h2>
              <p className="text-xs text-slate-400">
                Canonical tournament rules authoritative in the PostgreSQL database. The backend calculates all scores dynamically.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-3">Rule Name</th>
                    <th className="px-4 py-3">Canonical Key</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Field Type</th>
                    <th className="px-4 py-3 text-right">Points</th>
                    <th className="px-4 py-3 text-right">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-bold text-slate-200">{rule.ruleName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-cyan-400">{rule.ruleKey}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold bg-muted px-2 py-0.5 rounded border border-border">
                          {rule.applicableRole}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{rule.fieldType}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-lg text-emerald-400">
                        {rule.points > 0 ? `+${rule.points}` : rule.points}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setEditingRule(rule);
                            setNewRulePoints(rule.points);
                          }}
                          className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline font-semibold"
                        >
                          <Edit2 className="h-3.5 w-3.5" /> Adjust
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 5: ANNOUNCEMENTS */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "announcements" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Announcement Form */}
          <div className="lg:col-span-1 rounded-2xl border border-border bg-card p-6 space-y-4 shadow-sm h-fit">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-100">Broadcast Announcement</h3>
              <p className="text-xs text-slate-400">Visible on active participant and volunteer dashboards.</p>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Preliminary Round 2 Commencing"
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                  className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Message</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Official instructions or urgent alerts..."
                  value={newAnnouncement.message}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })}
                  className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Priority (0 - 10)</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={newAnnouncement.priority}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, priority: Number(e.target.value) })}
                  className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2.5 text-sm font-bold text-white transition shadow-md disabled:opacity-50"
              >
                Publish Announcement
              </button>
            </form>
          </div>

          {/* Announcement Feed */}
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-100">All Tournament Announcements</h3>

            <div className="space-y-3">
              {announcements.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No announcements created yet.</p>
              ) : (
                announcements.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 transition space-y-2 ${
                      item.isActive
                        ? "border-border bg-slate-900/60"
                        : "border-dashed border-slate-800 bg-slate-950/40 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${item.isActive ? "bg-emerald-400" : "bg-slate-600"}`}
                        />
                        <h4 className="font-bold text-slate-200 text-sm">{item.title}</h4>
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          P:{item.priority}
                        </span>
                      </div>

                      <button
                        onClick={() => handleToggleAnnouncementActive(item)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition ${
                          item.isActive
                            ? "text-destructive hover:bg-destructive/10"
                            : "text-emerald-400 hover:bg-emerald-500/10"
                        }`}
                      >
                        {item.isActive ? "Deactivate (Soft)" : "Reactivate"}
                      </button>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{item.message}</p>
                    <span className="text-[10px] text-muted-foreground block pt-1">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 6: EVENT LIFECYCLE ("DANGER ZONE") */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "lifecycle" && (
        <div className="space-y-6">
          {/* Tournament Specifications Form */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-100">Tournament Configuration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-muted-foreground uppercase font-bold">Event Name</span>
                <p className="font-semibold text-slate-200">{eventSettings?.eventName || "Not configured"}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground uppercase font-bold">Venue</span>
                <p className="font-semibold text-slate-200">{eventSettings?.venue || "Not configured"}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground uppercase font-bold">Scheduled Window</span>
                <p className="font-semibold text-slate-200">
                  {eventSettings?.eventStart && eventSettings?.eventEnd
                    ? `${eventSettings.eventStart} - ${eventSettings.eventEnd}`
                    : "Not configured"}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground uppercase font-bold">Configured Qualification Count</span>
                <p className="font-semibold text-cyan-400">{eventSettings?.qualificationCount ?? 8} Finalists</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground uppercase font-bold">Tie-Break Method</span>
                <p className="font-semibold text-slate-200">{eventSettings?.tieBreakMethod ?? "ADMIN_DECISION"}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground uppercase font-bold">Final Formula Status</span>
                <p className={`font-bold ${eventSettings?.finalScoreFormula ? "text-emerald-400" : "text-amber-400"}`}>
                  {eventSettings?.finalScoreFormula ?? "UNCONFIGURED (NULL)"}
                </p>
              </div>
            </div>
          </div>

          {/* Soft Reset / Prepare New Run Card */}
          <div className="rounded-2xl border border-destructive/40 bg-gradient-to-br from-destructive/10 via-slate-900 to-slate-950 p-6 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-destructive">Prepare New Event Run (Soft Archival Reset)</h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
                  Initiates a clean tournament run for the next iteration. All existing rounds are marked as archived (<code>is_archived = true</code>), event status is reset to <code>NOT_STARTED</code>, and preliminary qualifications are cleared.
                </p>
                <div className="rounded-xl border border-border/80 bg-slate-950/60 p-3 mt-3 text-xs text-slate-300 space-y-1">
                  <span className="font-bold text-emerald-400 block">✓ Historical Data Preservation Guarantee:</span>
                  <p>
                    All historical <code>audit_logs</code>, <code>score_history</code>, and <code>score_entries</code> are preserved completely intact in the PostgreSQL database.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowResetModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-destructive hover:bg-destructive/90 px-4 py-2.5 text-xs font-bold text-white shadow-md transition"
              >
                <RefreshCw className="h-4 w-4" /> Prepare New Event Run
              </button>
            </div>
          </div>
        </div>
      )}

            {/* ---------------------------------------------------------------------- */}
      {/* TAB: FINALS & RESULTS (PHASE 6) */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "finals" && (
        <div className="space-y-6">
          {/* Top Status Banner */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Consolidated Phase 6 — Finals & Championship Management
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                  Championship Orchestration
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Manage preliminary qualification, enroll the qualified finalists roster, and publish final locked standings.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleCalculateQualification}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${actionLoading ? "animate-spin" : ""}`} />
                  Calculate Qualification
                </button>
                <button
                  onClick={handleLoadResultsPreview}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50"
                >
                  <Trophy className="h-3.5 w-3.5" /> Preview Results
                </button>
                {eventSettings?.resultsPublished ? (
                  <button
                    onClick={() => setShowUnlockModal(true)}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-4 py-2 text-xs font-bold text-amber-300 transition disabled:opacity-50"
                  >
                    Unlock Results
                  </button>
                ) : (
                  <button
                    onClick={() => setShowPublishModal(true)}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 px-4 py-2 text-xs font-black text-slate-950 transition disabled:opacity-50 shadow-md"
                  >
                    <Trophy className="h-3.5 w-3.5" /> Publish Final Results
                  </button>
                )}
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
              <div>
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Configured Cutoff</span>
                <p className="text-lg font-black text-purple-400">{eventSettings?.qualificationCount ?? 8} Finalists</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Qualified Count</span>
                <p className="text-lg font-black text-emerald-400">
                  {qualifications.filter((q) => q.qualified).length} Players
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Final Formula</span>
                <p className={`text-lg font-black ${eventSettings?.finalScoreFormula ? "text-cyan-400" : "text-amber-400"}`}>
                  {eventSettings?.finalScoreFormula ?? "UNCONFIGURED"}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Results Status</span>
                <p className={`text-lg font-black ${eventSettings?.resultsPublished ? "text-amber-400" : "text-slate-400"}`}>
                  {eventSettings?.resultsPublished ? "PUBLISHED & LOCKED" : "UNPUBLISHED"}
                </p>
              </div>
            </div>
          </div>

          {/* Cutoff Tie-Break Alert if any */}
          {qualifications.some((q) => q.isTieAtCutoff && !q.adminOverride) && (
            <div className="rounded-2xl border border-amber-500/50 bg-amber-950/30 p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                <span>Cutoff Boundary Tie Detected — Administrator Decision Required</span>
              </div>
              <p className="text-xs text-slate-300">
                Multiple participants share the exact cutoff score. Per REQUIREMENTS.md §17, select which participant advances:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {qualifications
                  .filter((q) => q.isTieAtCutoff)
                  .map((q) => (
                    <button
                      key={q.id}
                      onClick={() => handleResolveTie(q.participantId)}
                      disabled={actionLoading}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                        q.adminOverride && q.qualified
                          ? "bg-emerald-600 text-white border-emerald-500"
                          : "bg-slate-900 text-slate-200 border-amber-500/40 hover:bg-slate-800"
                      }`}
                    >
                      {q.name} ({q.participantCode}) — {q.preliminaryScore} pts
                      {q.adminOverride && q.qualified ? " (Selected ✓)" : " → Qualify"}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Section 1: Qualification Standings Table */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-100">Preliminary Qualification Standings</h3>
                <p className="text-xs text-muted-foreground">
                  Authoritative cumulative preliminary totals evaluated against cutoff of {eventSettings?.qualificationCount ?? 8}.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 uppercase tracking-wider text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-5 py-3 w-16">Rank</th>
                    <th className="px-5 py-3">Participant</th>
                    <th className="px-5 py-3">In-Game</th>
                    <th className="px-5 py-3 text-center">Prelim Score</th>
                    <th className="px-5 py-3">Qualification Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {qualifications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                        No qualification standings calculated yet. Click &quot;Calculate Qualification&quot; above.
                      </td>
                    </tr>
                  ) : (
                    qualifications.map((q) => (
                      <tr key={q.id} className="hover:bg-muted/20">
                        <td className="px-5 py-3 font-bold text-slate-300">#{q.rank}</td>
                        <td className="px-5 py-3">
                          <span className="font-semibold text-white mr-1.5">{q.name}</span>
                          <span className="font-mono text-muted-foreground">({q.participantCode})</span>
                        </td>
                        <td className="px-5 py-3 text-slate-300">{q.amongUsUsername || "—"}</td>
                        <td className="px-5 py-3 text-center font-mono font-bold text-cyan-400">
                          {q.preliminaryScore}
                        </td>
                        <td className="px-5 py-3">
                          {q.qualified ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-[10px]">
                              QUALIFIED FOR FINAL
                            </span>
                          ) : q.isTieAtCutoff ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-[10px]">
                              TIED AT CUTOFF
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold text-[10px]">
                              NOT QUALIFIED
                            </span>
                          )}
                          {q.adminOverride && (
                            <span className="ml-1 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-mono">
                              OVERRIDE
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {q.isTieAtCutoff && !q.qualified && (
                            <button
                              onClick={() => handleResolveTie(q.participantId)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px]"
                            >
                              Qualify
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Finals Roster & Match Enrollment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Enrollment Form */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-sm">
              <h3 className="text-base font-bold text-slate-100">Enroll Finals Roster into Match</h3>
              <p className="text-xs text-muted-foreground">
                Assign all qualified finalists to a designated Final Round and Final Lobby.
              </p>
              <form onSubmit={handleEnrollFinalsRoster} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 uppercase">Target Final Round</label>
                  <select
                    required
                    value={targetFinalRoundId}
                    onChange={(e) => setTargetFinalRoundId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="">-- Select Final Round --</option>
                    {rounds
                      .filter((r) => r.type === "FINAL" && !r.isArchived)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} (Round #{r.roundNumber}) {r.scoreLocked ? "🔒 Locked" : ""}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 uppercase">Target Final Lobby</label>
                  <select
                    required
                    value={targetFinalLobbyId}
                    onChange={(e) => setTargetFinalLobbyId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="">-- Select Final Lobby --</option>
                    {lobbies
                      .filter((l) => l.status === "ACTIVE")
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.type}) — Cap: {l.capacity ?? "Unlimited"}
                        </option>
                      ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full mt-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2.5 text-xs font-bold text-white transition disabled:opacity-50 shadow-md"
                >
                  Enroll Qualified Finalists
                </button>
              </form>
            </div>

            {/* Qualified Finalists List */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-100">Qualified Finalists Roster</h3>
                <span className="text-xs font-mono font-bold text-purple-400">
                  {finalsRoster.length} Players
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {finalsRoster.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    No qualified finalists yet. Calculate qualification to populate roster.
                  </p>
                ) : (
                  finalsRoster.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border bg-slate-950/60 p-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-white mr-2">{item.name}</span>
                        <span className="font-mono text-muted-foreground">({item.participantId})</span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          In-Game: {item.amongUsUsername || "—"} • Prelim: {item.preliminaryScore} pts
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                        Rank #{item.rank}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Results Preview Table (if loaded) */}
          {resultsPreview && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Championship Results Standings Preview</h3>
                  <p className="text-xs text-muted-foreground">
                    Overall score formula: {resultsPreview.formula}
                  </p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  Admin Preview
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 uppercase tracking-wider text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-5 py-3 w-16">Rank</th>
                      <th className="px-5 py-3">Participant</th>
                      <th className="px-5 py-3">Among Us Username</th>
                      <th className="px-5 py-3 text-center">Preliminary</th>
                      <th className="px-5 py-3 text-center">Final Score</th>
                      <th className="px-5 py-3 text-right">Overall Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {resultsPreview.standings?.map((s: any) => (
                      <tr key={s.participantId} className="hover:bg-muted/20">
                        <td className="px-5 py-3 font-black text-sm">
                          {s.rank === 1 ? "🥇 1" : s.rank === 2 ? "🥈 2" : s.rank === 3 ? "🥉 3" : s.rank ? `#${s.rank}` : (
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">
                              TIED
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 font-semibold text-white">{s.name} ({s.participantId})</td>
                        <td className="px-5 py-3 text-muted-foreground">{s.amongUsUsername || "—"}</td>
                        <td className="px-5 py-3 text-center font-mono">{s.preliminaryScore}</td>
                        <td className="px-5 py-3 text-center font-mono font-bold text-amber-400">{s.finalScore}</td>
                        <td className="px-5 py-3 text-right font-mono font-black text-white text-sm">
                          {s.overallScore} pts
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODALS */}
      {/* ---------------------------------------------------------------------- */}

      {/* Create Round Modal */}
      {showRoundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full rounded-2xl border border-border bg-slate-900 p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100">Create New Tournament Round</h3>
            <form onSubmit={handleCreateRound} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 uppercase">Round Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Preliminary Round 1"
                  value={newRound.name}
                  onChange={(e) => setNewRound({ ...newRound, name: e.target.value })}
                  className="w-full rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 uppercase">Round Number</label>
                <input
                  required
                  type="number"
                  min={1}
                  value={newRound.roundNumber}
                  onChange={(e) => setNewRound({ ...newRound, roundNumber: Number(e.target.value) })}
                  className="w-full rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 uppercase">Stage Type</label>
                <select
                  value={newRound.type}
                  onChange={(e) => setNewRound({ ...newRound, type: e.target.value })}
                  className="w-full rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="PRACTICE">PRACTICE (Unranked)</option>
                  <option value="PRELIMINARY">PRELIMINARY (Competitive)</option>
                  <option value="FINAL">FINAL (Grand Finals)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRoundModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50"
                >
                  Create Round
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Lobby Modal */}
      {showLobbyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full rounded-2xl border border-border bg-slate-900 p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100">Create New Lobby</h3>
            <form onSubmit={handleCreateLobby} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 uppercase">Lobby Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Lobby C"
                  value={newLobby.name}
                  onChange={(e) => setNewLobby({ ...newLobby, name: e.target.value })}
                  className="w-full rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 uppercase">Capacity</label>
                <input
                  type="number"
                  min={1}
                  value={newLobby.capacity}
                  onChange={(e) => setNewLobby({ ...newLobby, capacity: Number(e.target.value) })}
                  className="w-full rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowLobbyModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50"
                >
                  Create Lobby
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Rule Points Modal */}
      {editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full rounded-2xl border border-border bg-slate-900 p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100">Adjust Scoring Rule Points</h3>
            <p className="text-xs text-slate-400">
              Updating <span className="text-cyan-400 font-semibold">{editingRule.ruleName}</span> ({editingRule.ruleKey}).
            </p>
            <form onSubmit={handleUpdateRule} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 uppercase">Points Value</label>
                <input
                  required
                  type="number"
                  value={newRulePoints}
                  onChange={(e) => setNewRulePoints(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-slate-950 px-3 py-2 text-base font-bold text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50"
                >
                  Save Points
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

            {/* Publish Results Confirmation Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full rounded-2xl border border-amber-500/50 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-400">
              <Trophy className="h-6 w-6" />
              <h3 className="text-lg font-bold">Publish Final Tournament Results</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to publish the final championship standings? Once published, results will be publicly visible and locked.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handlePublishResults}
                disabled={actionLoading}
                className="rounded-xl bg-amber-500 hover:bg-amber-600 px-4 py-2 text-xs font-black text-slate-950 transition disabled:opacity-50 shadow-md"
              >
                Confirm & Publish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Results Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full rounded-2xl border border-amber-500/50 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-bold">Unlock Tournament Results</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Unlocking results allows score adjustments or recalculation. A mandatory administrative reason is required for the audit trail.
            </p>
            <form onSubmit={handleUnlockResults} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 uppercase">Reason for Unlocking</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Disputed score entry corrected by referee"
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  className="w-full rounded-xl border border-border bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnlockModal(false);
                    setUnlockReason("");
                  }}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !unlockReason.trim()}
                  className="rounded-xl bg-amber-500 hover:bg-amber-600 px-4 py-2 text-xs font-bold text-slate-950 transition disabled:opacity-50"
                >
                  Confirm Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Prepare New Run Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="max-w-md w-full rounded-2xl border border-destructive/50 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-bold">Confirm Event Reset</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This action archives all rounds and resets the event state for a fresh run. All audit records and score histories are permanently preserved in the database.
            </p>
            <p className="text-xs text-slate-400">
              Type <strong className="text-white">RESET</strong> below to confirm:
            </p>

            <form onSubmit={handlePrepareNewRun} className="space-y-4">
              <input
                required
                type="text"
                placeholder="RESET"
                value={resetConfirmation}
                onChange={(e) => setResetConfirmation(e.target.value)}
                className="w-full rounded-xl border border-destructive/40 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-destructive uppercase font-mono"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setResetConfirmation("");
                  }}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || resetConfirmation !== "RESET"}
                  className="rounded-xl bg-destructive hover:bg-destructive/90 px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50 shadow-md"
                >
                  Confirm Soft Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
