import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black" />

      <div className="max-w-3xl space-y-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 md:p-12 shadow-2xl backdrop-blur-md">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold tracking-wider text-cyan-400 uppercase">
          University E-Sports Championship
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-slate-50">
          AMONG US <br />
          <span className="bg-gradient-to-r from-red-500 via-purple-500 to-cyan-400 bg-clip-text text-transparent">
            LIVE DEDUCTION
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-xl mx-auto">
          The real-time deduction tournament management, performance scoring, and live leaderboard platform.
        </p>

        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <Link
            href="/login"
            className="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white shadow-lg shadow-red-600/30 transition hover:bg-red-500 hover:shadow-red-600/50"
          >
            Access Portal
          </Link>
          <Link
            href="/leaderboard"
            className="rounded-lg border border-slate-700 bg-slate-800 px-6 py-3 font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white"
          >
            Live Leaderboard
          </Link>
        </div>

        <div className="pt-6 border-t border-slate-800/80 text-xs text-slate-500">
          Built for tournament organizers, participants, and volunteers.
        </div>
      </div>
    </main>
  );
}
