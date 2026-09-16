# Among Us: Live Deduction — Tournament Management Platform

An enterprise-grade, authoritative tournament orchestration and live scoring engine designed for live competitive **Among Us** deduction tournaments.

> **Disclaimer**: This is an independent open-source tournament management platform. *Among Us* is a registered trademark of Innersloth LLC. This platform is not affiliated with, endorsed by, or sponsored by Innersloth LLC. No proprietary game assets, graphics, or intellectual property are contained within this software.

---

## Key Features

- **Authoritative Backend Scoring**: All scoring calculations are performed server-side against dynamically configurable database rules with zero trust in client submissions.
- **Dynamic Scoring Rules**: Weightings, enable/disable toggles, and elimination boundaries for crewmates and impostors.
- **Real-Time Live Leaderboard**: Server-Sent Events (SSE) streaming with an exact **15-second heartbeat** and an automatic **10-second polling fallback** for maximum display reliability.
- **Scoped Volunteer System**: Role-based access control restricting volunteer scorekeepers strictly to assigned `(round_id, lobby_id)` pairs.
- **Participant Portal & IDOR Defense**: Secure self-service portal where participants view personal score breakdowns, schedules, and event info with server-enforced identity isolation.
- **Admin Command Center**: Complete tournament management including qualification cutoff detection, atomic tie-break resolution, finals weighting formulas (`SUM` / `WEIGHTED`), and audited result unlocking.
- **Option A Rerun Archival**: Safe tournament reruns that archive prior matches while preserving historical scoring entries and audit logs forever.
- **PostgreSQL Immutability Triggers**: Database triggers enforcing append-only guarantees on `audit_logs` and `score_history`.
- **4-Part CSV Export**: Instant exports for Participant Rosters, Round-by-Round Scores, Final Leaderboards, and Full Score Audit History.
- **Responsive & Accessible UI**: Enforced $\ge 44\text{px}$ touch targets, WCAG AA contrast, modal keyboard containment, and mobile podium hierarchy.
- **Production Hardened**: Least-permissive Content Security Policy (CSP), HSTS, rate-limited authentication, and Docker multi-stage containerization.

---

## Technology Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router, Server Components & Route Handlers)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Database**: [PostgreSQL 16](https://www.postgresql.org/)
- **ORM**: [Prisma 5](https://www.prisma.io/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [Lucide Icons](https://lucide.dev/)
- **Authentication**: [NextAuth.js](https://next-auth.js.org/) (JWT Strategy, bcryptjs hashing)
- **Real-Time**: Server-Sent Events (SSE) + Fallback Polling
- **Containerization**: Docker Multi-Stage Build & Docker Compose

---

## Getting Started

### Prerequisites

- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **PostgreSQL**: v16.x (or Docker Engine)

### Local Development Setup

1. **Clone the repository and install dependencies**:
   ```bash
   git clone https://github.com/your-org/among-us-live-deduction.git
   cd among-us-live-deduction
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to configure your database connection and NextAuth secret.

3. **Start PostgreSQL database** (using provided dev compose):
   ```bash
   docker compose up -d postgres
   ```

4. **Initialize database schema & triggers**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Seed tournament data**:
   ```bash
   npm run seed
   ```

6. **Start development server**:
   ```bash
   npm run dev
   ```
   Access the web application at `http://localhost:3000`.

---

## Seed Accounts (Local Testing)

The seed script creates default test accounts across all roles:

| Role | Username | Password | Purpose |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `adminpassword123` | Full tournament administration |
| **Volunteer** | `volunteer1` | `password123` | Assigned to Round 1, Lobby 1 |
| **Volunteer** | `volunteer2` | `password123` | Assigned to Round 1, Lobby 2 |
| **Participant** | `P001` | `password123` | Participant view & personal dashboard |

> **Security Warning**: Change all default passwords before deploying to any production or publicly accessible environment.

---

## Documentation Suite

Exhaustive guides and technical documentation are available in the `docs/` directory:

- [**System Architecture**](docs/ARCHITECTURE.md): Architectural topology, database schema, trigger immutability, scoring workflows, and real-time SSE design.
- [**Administrator Manual**](docs/ADMIN_MANUAL.md): Comprehensive operational guide for running tournaments, configuring scoring rules, resolving qualification ties, and publishing results.
- [**Volunteer Manual**](docs/VOLUNTEER_MANUAL.md): Step-by-step scorekeeper instructions, scope isolation rules, and match entry workflows.
- [**Participant Manual**](docs/PARTICIPANT_MANUAL.md): Player portal walkthrough, viewing personal scores, live leaderboard, and final podium standings.
- [**Deployment Guide**](docs/DEPLOYMENT.md): Production containerization, Docker Compose, Nginx reverse proxy configuration, TLS setup, database backups, and health monitoring.
- [**API Reference**](docs/API_REFERENCE.md): Full technical specification of all 35 route files and 45 distinct endpoint operations, DTO contracts, authentication scopes, and status codes.

---

## Production Deployment & Health Monitoring

### Production Docker Stack

Run the production multi-stage build:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Health Check Endpoint

The platform provides a non-mutating container health check at `/api/health`:
- **Healthy**: `HTTP 200` `{"status": "ok", "timestamp": "2026-09-16T05:00:00.000Z"}`
- **Unhealthy**: `HTTP 503` `{"status": "error"}`

---

## Verification & Testing

Execute the complete automated test suite:
```bash
npm test
```

Validate code formatting and TypeScript types:
```bash
npm run lint
npm run build
```

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.
