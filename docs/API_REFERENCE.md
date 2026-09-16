# API Reference — Among Us: Live Deduction

This document provides an exhaustive, authoritative specification of all **35 route files** and **45 distinct endpoint operations** implemented across `src/app/api/**/route.ts`.

---

## Metric Summary & Terminology Reconciliation

To avoid ambiguity, this platform distinguishes between:
- **Route Files**: Exactly **35 `route.ts` files** situated in the Next.js App Router API directory.
- **Endpoint Operations (Method + Path Pairs)**: Exactly **45 callable HTTP actions** mapped across those 35 files.

### Overview of HTTP Status Codes

- `200 OK`: Request completed successfully.
- `201 Created`: Resource created successfully.
- `400 Bad Request`: Malformed request, invalid parameters, or domain validation rejection.
- `401 Unauthorized`: Unauthenticated request (valid NextAuth session required).
- `403 Forbidden`: Insufficient role privileges or volunteer assignment scope mismatch.
- `404 Not Found`: Target resource does not exist.
- `409 Conflict`: State conflict (e.g., duplicate registration or conflicting assignment).
- `500 Internal Server Error`: Unexpected server-side failure (sanitized to `"Internal server error"` in production).
- `503 Service Unavailable`: Upstream dependency or database health check failure.

---

## Complete Inventory of Route Files & Operations

| # | HTTP Method | API Path | Handler Source File | Auth Required | Role / Scope |
|---|---|---|---|---|---|
| 1 | `GET` | `/api/admin/stats` | `src/app/api/admin/stats/route.ts` | Yes | `ADMIN` |
| 2 | `GET` | `/api/announcements` | `src/app/api/announcements/route.ts` | No | Public |
| 3 | `POST` | `/api/announcements` | `src/app/api/announcements/route.ts` | Yes | `ADMIN` |
| 4 | `PUT` | `/api/announcements/[id]` | `src/app/api/announcements/[id]/route.ts` | Yes | `ADMIN` |
| 5 | `DELETE` | `/api/announcements/[id]` | `src/app/api/announcements/[id]/route.ts` | Yes | `ADMIN` |
| 6 | `GET` | `/api/audit-logs` | `src/app/api/audit-logs/route.ts` | Yes | `ADMIN` |
| 7 | `GET` | `/api/auth/[...nextauth]` | `src/app/api/auth/[...nextauth]/route.ts` | No | NextAuth Session / CSRF |
| 8 | `POST` | `/api/auth/[...nextauth]` | `src/app/api/auth/[...nextauth]/route.ts` | No | Credentials Callback / Signin |
| 9 | `PUT` | `/api/event/formula` | `src/app/api/event/formula/route.ts` | Yes | `ADMIN` |
| 10 | `POST` | `/api/event/prepare-new-run` | `src/app/api/event/prepare-new-run/route.ts` | Yes | `ADMIN` |
| 11 | `GET` | `/api/event/settings` | `src/app/api/event/settings/route.ts` | Yes | `ADMIN` |
| 12 | `PUT` | `/api/event/settings` | `src/app/api/event/settings/route.ts` | Yes | `ADMIN` |
| 13 | `GET` | `/api/finals/roster` | `src/app/api/finals/roster/route.ts` | Yes | `ADMIN` |
| 14 | `POST` | `/api/finals/roster/enroll` | `src/app/api/finals/roster/enroll/route.ts` | Yes | `ADMIN` |
| 15 | `GET` | `/api/health` | `src/app/api/health/route.ts` | No | Public (Liveness/Readiness) |
| 16 | `GET` | `/api/leaderboard` | `src/app/api/leaderboard/route.ts` | No | Public (10s Polling Fallback) |
| 17 | `GET` | `/api/leaderboard/sse` | `src/app/api/leaderboard/sse/route.ts` | No | Public (15s Heartbeat SSE) |
| 18 | `GET` | `/api/lobbies` | `src/app/api/lobbies/route.ts` | Yes | `ADMIN`, `VOLUNTEER` |
| 19 | `POST` | `/api/lobbies` | `src/app/api/lobbies/route.ts` | Yes | `ADMIN` |
| 20 | `PUT` | `/api/lobbies/[id]` | `src/app/api/lobbies/[id]/route.ts` | Yes | `ADMIN` |
| 21 | `GET` | `/api/participants/me/dashboard` | `src/app/api/participants/me/dashboard/route.ts` | Yes | `PARTICIPANT` (IDOR-Isolated) |
| 22 | `GET` | `/api/participants/me/scores/[id]/history` | `src/app/api/participants/me/scores/[id]/history/route.ts` | Yes | `PARTICIPANT` (IDOR-Isolated) |
| 23 | `GET` | `/api/qualification` | `src/app/api/qualification/route.ts` | Yes | `ADMIN` |
| 24 | `POST` | `/api/qualification/calculate` | `src/app/api/qualification/calculate/route.ts` | Yes | `ADMIN` |
| 25 | `POST` | `/api/qualification/resolve-tie` | `src/app/api/qualification/resolve-tie/route.ts` | Yes | `ADMIN` |
| 26 | `GET` | `/api/results` | `src/app/api/results/route.ts` | Conditional | Public if published, else `ADMIN` |
| 27 | `POST` | `/api/results/publish` | `src/app/api/results/publish/route.ts` | Yes | `ADMIN` |
| 28 | `POST` | `/api/results/unlock` | `src/app/api/results/unlock/route.ts` | Yes | `ADMIN` (Mandatory Reason) |
| 29 | `GET` | `/api/rounds` | `src/app/api/rounds/route.ts` | No | Public / Authenticated |
| 30 | `POST` | `/api/rounds` | `src/app/api/rounds/route.ts` | Yes | `ADMIN` |
| 31 | `GET` | `/api/rounds/[id]` | `src/app/api/rounds/[id]/route.ts` | Yes | Authenticated |
| 32 | `PUT` | `/api/rounds/[id]` | `src/app/api/rounds/[id]/route.ts` | Yes | `ADMIN` |
| 33 | `GET` | `/api/schedule` | `src/app/api/schedule/route.ts` | No | Public |
| 34 | `GET` | `/api/scores` | `src/app/api/scores/route.ts` | Yes | `ADMIN` or assigned `VOLUNTEER` |
| 35 | `POST` | `/api/scores` | `src/app/api/scores/route.ts` | Yes | `ADMIN` or assigned `(round, lobby)` |
| 36 | `GET` | `/api/scores/[id]` | `src/app/api/scores/[id]/route.ts` | Yes | `ADMIN` or assigned `VOLUNTEER` |
| 37 | `PUT` | `/api/scores/[id]` | `src/app/api/scores/[id]/route.ts` | Yes | `ADMIN` or assigned `(round, lobby)` |
| 38 | `GET` | `/api/scoring-rules` | `src/app/api/scoring-rules/route.ts` | No | Public / Authenticated |
| 39 | `PUT` | `/api/scoring-rules/[id]` | `src/app/api/scoring-rules/[id]/route.ts` | Yes | `ADMIN` |
| 40 | `GET` | `/api/volunteers` | `src/app/api/volunteers/route.ts` | Yes | `ADMIN` |
| 41 | `GET` | `/api/volunteers/assignments` | `src/app/api/volunteers/assignments/route.ts` | Yes | `ADMIN` |
| 42 | `POST` | `/api/volunteers/assignments` | `src/app/api/volunteers/assignments/route.ts` | Yes | `ADMIN` |
| 43 | `DELETE` | `/api/volunteers/assignments/[id]` | `src/app/api/volunteers/assignments/[id]/route.ts` | Yes | `ADMIN` |
| 44 | `GET` | `/api/volunteers/me/assignments` | `src/app/api/volunteers/me/assignments/route.ts` | Yes | `VOLUNTEER` |
| 45 | `GET` | `/api/volunteers/me/dashboard` | `src/app/api/volunteers/me/dashboard/route.ts` | Yes | `VOLUNTEER` |

---

## Detailed Specifications by Functional Domain

### 1. System & Container Health
- **`GET /api/health`**: Container liveness/readiness probe. Performs `SELECT 1` via Prisma. Returns `200 OK` `{"status": "ok", "timestamp": "..."}` on success, or `503 Service Unavailable` `{"status": "error"}` on failure with zero database details leaked.

### 2. Authentication & Session Management
- **`ALL /api/auth/[...nextauth]`**: Handles login, CSRF tokens, session verification, and signout via NextAuth Credentials Provider.

### 3. Leaderboard & Real-Time Sync
- **`GET /api/leaderboard`**: Returns sanitized preliminary leaderboard. Used for public viewing and 10-second polling fallback.
- **`GET /api/leaderboard/sse`**: Server-Sent Events stream transmitting live updates with an exact **15-second heartbeat** comment (`: heartbeat`).

### 4. Participant Portal & Privacy (IDOR Defense)
- **`GET /api/participants/me/dashboard`**: Resolves identity from `session.user.id`, returning personal rounds and cumulative score breakdown.
- **`GET /api/participants/me/scores/[id]/history`**: Verifies participant ownership before returning version history for a specific score entry.

### 5. Volunteer Scoring & Scope Isolation
- **`POST /api/scores`**: Authoritatively computes and records participant score. Enforces tuple match `(round_id, lobby_id)` against `volunteer_assignments`.
- **`PUT /api/scores/[id]`**: Updates score with mandatory reason; appends version record to immutable `score_history`.
- **`GET /api/volunteers/me/assignments`**: Returns matches assigned to the caller.
- **`GET /api/volunteers/me/dashboard`**: Aggregates scoring tasks for the caller.

### 6. Administration, Qualification & Lifecycle
- **`GET /api/admin/stats`**: Tournament statistics counter.
- **`GET /api/audit-logs`**: Query append-only audit trail.
- **`POST /api/qualification/calculate`**: Calculates top-N cutoff and detects ties.
- **`POST /api/qualification/resolve-tie`**: Resolves boundary ties via admin selection or expansion.
- **`POST /api/finals/roster/enroll`**: Enrolls qualifiers into finals match.
- **`PUT /api/event/formula`**: Configures final score formula (`SUM` or `WEIGHTED`).
- **`POST /api/results/publish`**: Publishes final standings and locks scorecards.
- **`POST /api/results/unlock`**: Unlocks results with mandatory reason.
- **`POST /api/event/prepare-new-run`**: Option A archival of current run for a clean rerun.
