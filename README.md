# Pharmacy Management System

A database-backed pharmacy operations app built around **batch-level inventory, FEFO selling, expiry blocking, an immutable stock-movement ledger, auditable returns/adjustments, server-side RBAC and reports**.

This is an individual internship assessment project. It is intentionally small enough to explain end to end: every stock change goes through one transactional service, and the API remains the authority on prices, tax, totals and permissions.

## Demo accounts

The seed creates three fictional accounts. All use the password **`Demo@1234`**.

| Role | Email | Scope |
|---|---|---|
| Administrator | `admin@pharmacy.test` | Everything, including settings and audit logs |
| Pharmacist | `pharmacist@pharmacy.test` | Sales, invoices, returns and inventory view |
| Inventory manager | `inventory@pharmacy.test` | Catalogue, purchases, adjustments and stock reports |

The login screen lists the accounts and fills the form when one is selected. No real customer or medical data is included.

## Run with Docker (recommended for reviewers)

Prerequisites: Docker Desktop (Linux containers) or Docker Engine with Compose v2. Node.js, PostgreSQL, a Neon account and a `.env` file are **not** required for this path.

From the repository root:

```bash
docker compose up --build
```

The first build pulls the Node, PostgreSQL and Alpine images and compiles both apps. On the verification machine a cold first build took **899 s**; a fresh working copy with a warm BuildKit cache took **113.7 s**, and a later one-line source change rebuilt in **40.7 s**. The stack is ready when `docker compose ps` shows `db`, `backend` and `frontend` as `healthy` (the backend can take ~30–45 s on first start).

| Service | URL |
|---|---|
| Web app | `http://localhost:3000/login` |
| API health | `http://localhost:4000/api/v1/health` |
| Swagger UI | `http://localhost:4000/docs` |

Use the demo accounts above; all three passwords are `Demo@1234`.

What Compose sets up:

- `db`: PostgreSQL on the named `pharmacy_db_data` volume. Port 5432 is not published to the host.
- `backend`: waits for `db`, runs `prisma migrate deploy`, then the Docker-only `seed-if-empty` guard (it seeds only when there are no users), then starts the API as the non-root `node` user (uid 1000).
- `frontend`: built with `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1` as a **build arg**, waits for backend health, and runs the Next standalone server as `node`.
- Compose supplies demo-only database credentials and `JWT_SECRET=demo-only-change-me-please-1234567890`; CORS allows `http://localhost:3000`. Do not reuse these credentials or this secret outside local Docker.
- No `.env` is read. The browser uses `localhost:4000`, not the Compose service name `backend`.
- Build stages delete source maps, and the runtime images exclude app `.env` files, tests, docs and `.git`.

### Reset or stop

```bash
docker compose down       # stop; keep the demo data volume
docker compose down -v    # stop and delete the volume; the next up starts a clean seed
docker compose up --build # after a reset (or add -d to run in the background)
```

The seed guard matters: restarting with the volume intact prints `Seed skipped: 3 user(s) already exist.` and keeps reviewer-created purchases, sales and returns. `down -v` is the explicit clean reset.

### Docker troubleshooting

- **Port already in use:** stop local dev servers on 3000/4000, then rerun.
- **`db` unhealthy:** inspect `docker compose logs db`; the first database initialization can take a few seconds.
- **Stale or half-seeded data:** `docker compose down -v`, then `docker compose up --build`.
- **Transient network failure while building:** rerun the same command; the BuildKit npm cache mounts resume the download.
- **Check what is running:** `docker compose ps` and `docker compose logs -f backend`.
- **Windows:** use Docker Desktop with Linux containers. Compose uses an inline `sh -c` command, so there is no entrypoint script with CRLF line endings.

### Measured image sizes

Measured with `docker images` on Docker Desktop (Linux engine, November 2026). The assessment targets were backend 300–400 MB, frontend ≤250 MB and database ~250 MB.

| Service | Image | Measured | Target |
|---|---|---:|---:|
| Database | `postgres:18.2-alpine` | 409 MB | ~250 MB |
| Backend | `pharmacy_management_systeml-backend` | 817 MB | 300–400 MB |
| Frontend | `pharmacy_management_systeml-frontend` | 258 MB | ≤250 MB |

The misses are documented trade-offs, not hidden: the backend keeps the Prisma CLI because it runs `prisma migrate deploy` at startup, and Prisma's CLI dependency tree (studio/dev) is large; the official PostgreSQL image is 409 MB; the minimal Alpine frontend runtime is 8 MB over target after copying only the pinned Node binary and the standalone app. Moving migrations to a separate one-shot image could shrink the backend at the cost of another moving part; that is not worth the risk for a local reviewer path.

Docker is a local reviewer path only. The Render/Vercel/Neon deployment instructions below are unchanged. The frontend's normal (non-Docker) build remains the default: `NEXT_OUTPUT=standalone` is set only in `frontend/Dockerfile`, and a host/Vercel build without it was verified.

### Docker and tests

Docker starts the demo database; it does not run the backend Vitest suite. Run tests on the host with the separate test database described in [Tests](#tests), never against the Compose volume.

## Features

- **Batch inventory** with unique `(medicine, batch number)`, expiry dates and a non-negative quantity check.
- **FEFO (first-expiry-first-out)** allocation across batches; expired stock is excluded before a sale starts.
- **Expiry blocking** — a batch expiring today is already expired and cannot be sold.
- **Immutable ledger** — every stock change writes a `stock_movements` row; for every batch, `SUM(qty_delta) = quantity_on_hand`.
- **Purchases** create or merge batches and calculate all money on the server.
- **Sales** send only medicine ids and quantities. The server locks stock, allocates FEFO, snapshots prices/tax and generates the invoice number.
- **Idempotent sales** through a required `Idempotency-Key`; a replay returns the original sale instead of booking stock twice.
- **Returns and adjustments** with required reasons, cap checks under row locks and audit entries.
- **Server-enforced RBAC** for `ADMIN`, `PHARMACIST` and `INVENTORY_MANAGER`; hiding a UI button is never the security boundary.
- **Reports** for sales, stock valuation, expiry exposure and ledger reconciliation.
- **Admin audit log and typed settings** (`defaultTaxRate`, `nearExpiryDays`).
- **Light/dark/system themes**, responsive screens and a print-friendly invoice.

## Tech stack

| Layer | Stack |
|---|---|
| Backend (`/backend`) | Node.js + Express 5 + TypeScript (ESM), Prisma 7, PostgreSQL (Neon or local), Zod, JWT + bcrypt, Vitest + Supertest |
| Frontend (`/frontend`) | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/ui (Base UI), `next-themes` |
| Database | PostgreSQL with hand-added `CHECK` constraints and an append-only stock ledger |
| Docs | OpenAPI 3 + Swagger UI, Mermaid ER diagram, technical report, captured test evidence |

## Project structure

```text
/frontend              Next.js application (no business rules)
/backend               Express API and Prisma schema/migrations/seed
/docs                  ER diagram, OpenAPI spec, technical report, test evidence, demo script, submission checklist
AGENTS.md              Architecture rules and working agreements
PRD.md                 Product requirements and acceptance criteria
PROGRESS.md            Living task tracker, decisions and handoff notes
```

Backend layering is deliberate:

```text
routes (HTTP) → services (business rules) → db (Prisma)
```

Routes do not call Prisma directly. `app.ts` builds the Express app; `server.ts` only binds the port. All environment access is validated once in `backend/src/config/env.ts`.

## Prerequisites

- Node.js **20.9+** (Node 22/24 tested)
- npm
- A PostgreSQL database. **Neon** is the intended free-tier provider; a local Postgres instance also works.
- Two connection strings for Neon:
  - `DATABASE_URL` — pooled connection used by the runtime `PrismaPg` adapter.
  - `DIRECT_URL` — non-pooled connection used by the Prisma CLI for migrations.

## Local setup

> This manual path is for development and for running the test suite. For the reviewer demo, use the one-command Docker path above.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `backend/.env`:

```dotenv
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://...pooler.../neondb?sslmode=require
DIRECT_URL=postgresql://...direct.../neondb?sslmode=require
JWT_SECRET=replace-with-at-least-32-random-characters
JWT_EXPIRES_IN=8h
```

Apply the schema and seed the demo data:

```bash
npm run db:deploy   # applies committed migrations
npm run db:seed     # demo users, catalogue, batches, opening ledger rows, settings
npm run db:verify   # checks the ledger invariant and seed counts
npm run dev         # http://localhost:4000
```

Health check: `http://localhost:4000/health` and `http://localhost:4000/api/v1/health`.

> For a brand-new local database, `npm run db:migrate` is the development alternative to `db:deploy`. The seed is fictional; do not point tests at the demo database.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

`frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

Open `http://localhost:3000/login` and use one of the demo accounts above.

The API URL is read at build time. If it changes, rebuild/redeploy the frontend.

## Tests

Backend tests use a **separate database** configured in `backend/.env.test` (copy `.env.test.example`). Never run them against the demo database.

```bash
cd backend
npm test
```

The suite covers auth/RBAC, catalogue, purchases, FEFO sales, idempotency, concurrent last-unit sales, returns, adjustments, alerts, reports, reconciliation corruption detection and settings audit. It includes negative, conflict/concurrency and `403` cases.

Frontend static checks:

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
```

The complete test evidence and known flaky/cold-start notes are in [`docs/test-evidence.md`](./docs/test-evidence.md). The last full recorded backend run is **58/58 passing**; targeted report checks are recorded in `PROGRESS.md`.

## API documentation

- OpenAPI source: [`docs/openapi.yaml`](./docs/openapi.yaml) (a copy lives at `backend/openapi.yaml` for the Render root-directory deployment).
- Swagger UI is served by the backend at `http://localhost:4000/docs` after starting the API.
- All endpoints are under `/api/v1`.
- Authentication: `Authorization: Bearer <JWT>`; obtain a token from `POST /api/v1/auth/login`.
- Error shape: `{ "error": { "code": "...", "message": "...", "details": {...} } }`.
- `POST /api/v1/sales` requires an `Idempotency-Key` header.

## Architecture and correctness notes

- **One stock writer:** `applyStockMovement` locks the batch row, checks the resulting quantity and writes the ledger row inside the caller's transaction. Nothing else may modify `batches.quantity_on_hand` (the seed is the only documented exception).
- **Transactions and locking:** sales lock all usable candidate batches in ascending id order (`SELECT ... FOR UPDATE`), then allocate. Returns lock the sale, sale items and affected batches before checking the remaining quantity.
- **FEFO is pure:** `backend/src/services/fefo.ts` has no database or clock dependency, so its unit tests are deterministic.
- **Money:** Prisma `Decimal(12,2)`/string values, rounded once through the money helper; the frontend never performs payable arithmetic.
- **Expiry is a calendar date:** `expiry_date` is a PostgreSQL `DATE`; a batch expiring today is treated as expired.
- **Settings are typed:** `defaultTaxRate` and `nearExpiryDays` are validated; each changed key writes its own audit entry.

The full design rationale, trade-offs and interview-ready explanations are in [`docs/technical-report.md`](./docs/technical-report.md). The schema diagram is [`docs/er-diagram.png`](./docs/er-diagram.png), with editable Mermaid source in [`docs/er-diagram.md`](./docs/er-diagram.md). The video walkthrough script and final submission checklist are in [`docs/demo-script.md`](./docs/demo-script.md) and [`docs/submission-checklist.md`](./docs/submission-checklist.md).

## Deployment notes

The repo is deployment-ready for the intended free-tier split:

- **Backend on Render** (root directory `backend`): build `npm ci --include=dev && npm run build && npm run db:deploy`; start `npm run start`; set `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `FRONTEND_URL`, `NODE_ENV=production`, and `PORT` if required.
- **Frontend on Vercel** (root directory `frontend`): set `NEXT_PUBLIC_API_URL` to the deployed API URL **including `/api/v1`**, then deploy.
- **Database on Neon:** run the migration and seed once, then keep the pooled URL for runtime and direct URL for migrations.

No public deployment URL is committed in this snapshot. If hosting is unavailable, the local steps above are the complete demo path. The Docker Compose stack is a **local reviewer path only**; it is not a production deployment and its demo credentials must not be reused. See `PROGRESS.md` for the latest deployment status.

## Known limitations

These are deliberate scope decisions, not hidden gaps:

- No refresh-token rotation; the access token lasts `JWT_EXPIRES_IN` and the user signs in again after expiry.
- The JWT is stored in `localStorage`; a production app should use an httpOnly cookie plus CSRF protection.
- No user-management screen. The admin `GET /users` endpoint exists, but create/deactivate UI was cut under the 7-day scope.
- Categories and suppliers are list + create only; medicines have no delete (deactivate instead).
- Purchases and returns/adjustments are not idempotent; sales are. The UI disables repeated submission, but the server only guarantees idempotency for `POST /sales`.
- Report payloads are unpaginated at demo scale; alerts and audit logs are paginated.
- Reconciliation only compares current quantities for ranges ending today or later; past ranges are marked historical rather than falsely reporting mismatches.
- No PDF/email generation; the invoice is a print-friendly browser view.
- No automated frontend browser tests; the F2–F6 journeys were checked with builds, route smoke requests, API contracts and a human walkthrough.
- No chart library; reports use cards and tables.
- **Docker image sizes exceed the aspirational targets** (backend 817 MB vs 300–400 MB, frontend 258 MB vs ≤250 MB, PostgreSQL 409 MB vs ~250 MB). The backend needs the Prisma CLI at startup for `prisma migrate deploy`; the other gaps are base-image costs. The Compose credentials and JWT secret are demo-only.
- Docker Compose is a local reviewer convenience; the production deployment path remains Render + Vercel + Neon.

A longer, continuously updated list is in [`PROGRESS.md`](./PROGRESS.md).

## AI usage

AI tools were used for planning, code review, test design and documentation during the assessment. The candidate remains responsible for understanding and defending every line. The submission form should contain the exact tool names, purposes and any library attribution required by the invitation.
