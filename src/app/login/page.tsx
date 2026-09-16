"use client";

import React, { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Shield, User, AlertCircle, Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const urlError = searchParams.get("error");

  const [activeTab, setActiveTab] = useState<"participant" | "staff">("participant");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    urlError === "unauthorized"
      ? "You do not have permission to access that area."
      : urlError === "deactivated"
      ? "Your account has been deactivated."
      : null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        username: username.trim(),
        password,
      });

      if (!res) {
        setErrorMessage("An unexpected authentication error occurred.");
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        setErrorMessage(res.error || "Invalid credentials.");
        setIsLoading(false);
        return;
      }

      // Successful login - determine redirect based on session or callbackUrl
      if (callbackUrl) {
        router.push(callbackUrl);
      } else {
        // Fetch session to determine role-based redirect
        const sessionRes = await fetch("/api/auth/session");
        const session = await sessionRes.json();
        const role = session?.user?.role;

        if (role === "ADMIN") {
          router.push("/admin/dashboard");
        } else if (role === "VOLUNTEER") {
          router.push("/volunteer/dashboard");
        } else {
          router.push("/participant/dashboard");
        }
      }
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to connect to authentication server.");
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="text-center space-y-2">
        <Link href="/" className="inline-block text-xs font-bold tracking-widest text-cyan-400 uppercase">
          Among Us: Live Deduction
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100">
          Tournament Sign In
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Enter your tournament credentials to access your portal.
        </p>
      </div>

      {/* Role Toggle Tabs */}
      <div className="grid grid-cols-2 rounded-lg border border-slate-800 bg-slate-950/60 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => {
            setActiveTab("participant");
            setErrorMessage(null);
          }}
          className={`flex items-center justify-center gap-2 rounded-md py-2 transition ${
            activeTab === "participant"
              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <User className="h-4 w-4" />
          Participant
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("staff");
            setErrorMessage(null);
          }}
          className={`flex items-center justify-center gap-2 rounded-md py-2 transition ${
            activeTab === "staff"
              ? "bg-red-500/20 text-red-400 border border-red-500/40 shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Shield className="h-4 w-4" />
          Staff (Vol / Admin)
        </button>
      </div>

      {/* Error Notification */}
      {errorMessage && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span className="leading-snug">{errorMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
            {activeTab === "participant" ? "Participant ID (e.g. P001)" : "Staff Username"}
          </label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={activeTab === "participant" ? "P001" : "admin or volunteer1"}
            className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white shadow-lg transition disabled:opacity-50 ${
            activeTab === "participant"
              ? "bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/30"
              : "bg-red-600 hover:bg-red-500 shadow-red-600/30"
          }`}
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? "Authenticating..." : `Sign In as ${activeTab === "participant" ? "Participant" : "Staff"}`}
        </button>
      </form>

      {/* Helper Footer */}
      <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-500">
        Trouble signing in? Report to the event administration desk.
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black" />
      <Suspense
        fallback={
          <div className="flex items-center justify-center text-cyan-400 gap-2 text-sm">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading sign in portal...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
