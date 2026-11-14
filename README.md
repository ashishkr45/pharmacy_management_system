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

No public deployment URL is committed in this snapshot. If hosting is unavailable, the local steps above are the complete demo path. See `PROGRESS.md` for the latest deployment status.

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

A longer, continuously updated list is in [`PROGRESS.md`](./PROGRESS.md).

## AI usage

AI tools were used for planning, code review, test design and documentation during the assessment. The candidate remains responsible for understanding and defending every line. The submission form should contain the exact tool names, purposes and any library attribution required by the invitation.
