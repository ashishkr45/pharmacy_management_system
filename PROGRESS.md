# PROGRESS.md: Living project tracker and agent handoff

> **For any new agent:** read `AGENTS.md` → `PRD.md` → this file. Then run "Verify current state" and continue from **Handoff → Next action**. Update this file after every phase (and immediately if credits/context are running low).

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked

---

## HANDOFF BLOCK (rewrite this every session)

| Field | Value |
|---|---|
| Last updated | Sun 8 Nov 2026 (planning; schedule compressed to 7 days) |
| Current phase | **B1: Backend scaffold** (not started). Today's target: P0 + B1 + B2 (see Schedule) |
| Last completed | Phase 0 (partly): repo created, frontend initialised with shadcn (single Next.js app in `/frontend`, monorepo option OFF, RTL OFF) |
| Half-done / in flight | none |
| **Next action (exact)** | Create `backend/`, `npm init`, install deps, tsconfig (ESM), add `/health` route, run it |
| Failing commands / errors | none |
| Open questions for the human | Node version? OS? Exact deadline time + timezone from the invitation (assumed: Sat 14 Nov 2026, end of day) |
| Uncommitted work | unknown: check `git status` |

**Environment facts** (fill in as learned): Node ___ · OS ___ · Neon project created: ☐ · Neon pooled URL in `.env`: ☐ · Neon direct URL in `.env`: ☐ · Test DB (Neon branch or Docker): ☐

**Project dates:** Start **Sun 8 Nov 2026** · Hard deadline **Sat 14 Nov 2026, end of day (EOD)** (confirm exact time + timezone in the invitation; the invitation overrides everything here) · **Feature freeze: Fri 13 Nov, night** · **Target submit: Sat 14 Nov by ~6 PM** (leave buffer for upload/link problems). Total working window: **7 days** (8–14 Nov), not the 15 days in the original brief, so scope is trimmed (see "7-day schedule").

### Verify current state (update commands as the project grows)
```bash
git status && git log --oneline -5
cd backend && npm run build            # should compile
npm test                               # once tests exist
npx prisma migrate status              # once Prisma exists
curl http://localhost:4000/health      # with `npm run dev` running
cd ../frontend && npm run build        # once frontend has real code
```

---

## PHASE OVERVIEW (7-day schedule: Sun 8 Nov → Sat 14 Nov 2026, EOD)

| Phase | Name | Planned date | Status |
|---|---|---|---|
| P0 | Repo, planning, docs skeleton | Sun 8 Nov | [~] |
| B1 | Backend scaffold | Sun 8 Nov | [ ] |
| B2 | Prisma schema, Neon, migrations, seed | Sun 8 Nov (may spill to Mon morning) | [ ] |
| B3 | Auth + RBAC | Mon 9 Nov | [ ] |
| B4 | Catalogue (minimal) | Mon 9 Nov | [ ] |
| B5 | Stock-movement service + Purchases + Batches | Mon 9 → Tue 10 Nov | [ ] |
| B6 | Sales: FEFO, expiry block, tax, idempotency, invoice | Tue 10 Nov | [ ] |
| B7 | Returns + Adjustments | Wed 11 Nov | [ ] |
| B8 | Alerts, dashboard, reports, reconciliation, audit coverage | Wed 11 Nov | [ ] |
| D1a | **Smoke deploy** (hello-world level, flush out env/CORS/build issues) | Tue 10 Nov | [ ] |
| F1 | Frontend foundation: API client, auth, layout, guards | Wed 11 (evening) → Thu 12 Nov | [ ] |
| F2 | Catalogue screens (minimal) | Thu 12 Nov | [ ] |
| F3 | Purchases + inventory screens | Thu 12 Nov | [ ] |
| F4 | Sales (POS) + invoice print | Thu 12 Nov | [ ] |
| F5 | Returns, adjustments, alerts screens | Fri 13 Nov | [ ] |
| F6 | Dashboard + reports screens | Fri 13 Nov | [ ] |
| F7 | UX polish: states, responsive, accessibility (focused pass) | Fri 13 Nov | [ ] |
| B9 | Backend hardening, test gaps, OpenAPI | Fri 13 Nov | [ ] |
| D1b | Final deployment | Fri 13 Nov | [ ] |
| D2 | End-to-end acceptance run + regression (**feature freeze after this**) | Fri 13 Nov night | [ ] |
| D3 | Docs: README, ER diagram, report, test evidence | Sat 14 Nov morning | [ ] |
| D4 | Demo video | Sat 14 Nov midday | [ ] |
| D5 | Submission form + final checks (**submit by ~6 PM**) | Sat 14 Nov afternoon | [ ] |
| I | Interview prep (ongoing; short rehearsal after submit) | ongoing | [ ] |

> **7 days is tight.** Rules: (1) never cut backend correctness phases (B5, B6, B7, B9 tests); (2) use the trims and cut order below the moment you're ~half a day behind; (3) no new features after Fri night; Saturday is documentation, video and submission only; (4) if a phase overruns by more than a couple of hours, stop polishing, record it under Known limitations, and move on.

### 7-day schedule (daily goals and end-of-day checkpoints)

| Day | Date | Goal | End-of-day checkpoint |
|---|---|---|---|
| 1 | Sun 8 Nov | P0, B1, B2: repo docs committed, backend scaffold, Neon + Prisma schema + migration (with CHECK constraints) + seed | `/health` works; `migrate` + `seed` repeatable; ledger sum = batch qty for seeded data |
| 2 | Mon 9 Nov | B3 auth/RBAC, B4 minimal catalogue, start B5 (stock service) | login works for 3 roles; 401/403 verified; medicines CRUD works |
| 3 | Tue 10 Nov | Finish B5 purchases; **B6 sales (core)**; smoke deploy (D1a) | A1 + A2 passing; smoke deploy of both apps builds |
| 4 | Wed 11 Nov | B7 returns/adjustments, B8 alerts + reports + reconciliation; start F1 | A3, A4, A5 passing; all backend endpoints in PRD §7 exist (admin extras may be minimal) |
| 5 | Thu 12 Nov | F1 to F4: login, layout, medicines, purchases, inventory, **POS sale + invoice** | full journey works in the UI: purchase → sale → invoice |
| 6 | Fri 13 Nov | F5 to F7, B9 hardening + OpenAPI, final deploy, D2 acceptance run | **FEATURE FREEZE**: all 5 acceptance tests pass on the deployed/local app |
| 7 | Sat 14 Nov | D3 docs, D4 video, D5 submit by ~6 PM | submitted, links verified in incognito |

### 7-day scope trims (apply from the start; these supersede the fuller task lists in PHASE DETAILS where they conflict)
- **Catalogue:** medicines get full create/edit; categories and suppliers get **create + list only** (edit/deactivate via API only if time).
- **Admin extras:** no user-management UI/endpoint beyond seeded users; settings are **API only** (GET/PUT) with seeded defaults, no settings screen; audit log gets a simple read-only table (written for all material actions regardless).
- **Reports/dashboard:** plain tables and summary cards, **no charts**.
- **OpenAPI:** hand-write the core endpoints (auth, medicines, purchases, batches, sales, returns, adjustments, alerts, reports); lighter detail on the rest.
- **Docker Compose:** skip; README gives exact local steps with a Neon or local Postgres.
- **Tests:** concentrate on A1–A5 + oversell + duplicate idempotency key + concurrency + RBAC 403 + validation 400 + FEFO/tax unit tests. No exhaustive coverage.
- **Frontend styling:** stock shadcn components, no custom design work; priority is working journeys, clear states, and responsive layout.
- **Keep (graded under integrity/correctness):** FEFO, expiry block, ledger + invariant, transactions/locking, idempotency, RBAC, audit trail, DB CHECK constraints.

---

## PHASE DETAILS

### P0: Repo, planning, docs skeleton
- [x] GitHub repo created
- [x] Frontend initialised with shadcn (monorepo OFF, RTL OFF)
- [ ] Add `AGENTS.md`, `PRD.md`, `PROGRESS.md` to repo root and commit
- [ ] Root `.gitignore` (node_modules, .env*, dist, generated/, .next) + keep `.env.example` files tracked
- [ ] Create `docs/` folder; empty `README.md` placeholder
- [ ] Confirm brief's deadline and write it in the Handoff block
- **Checkpoint:** repo has `frontend/`, `docs/`, the three md files; `.env` ignored.

### B1: Backend scaffold
- [ ] `backend/` with `npm init`; install runtime deps (`express cors helmet zod dotenv jsonwebtoken bcrypt`) and dev deps (`typescript tsx @types/*`)
- [ ] TS/ESM config; scripts: `dev`, `build`, `start`, `test`, `db:migrate`, `db:seed`
- [ ] Folder skeleton per `AGENTS.md §6`; `app.ts` vs `server.ts` split; `PORT` from env
- [ ] `config/env.ts` (Zod-validated), `utils/AppError`, central error handler (one error shape), `validate(schema)` middleware
- [ ] `GET /api/v1/health` (and `/health`)
- [ ] `backend/.env.example`
- **Checkpoint:** `npm run dev` serves `/health`; invalid route returns the standard 404 error shape; missing env var fails fast with a clear message.
- **Understanding questions:** Why split `app.ts`/`server.ts`? Why validate env at startup?

### B2: Prisma schema, Neon, migrations, seed
- [ ] Neon project created; pooled + direct URLs in local `.env` (never committed)
- [ ] Install Prisma (current setup: `prisma.config.ts`, `prisma-client` generator with output, `@prisma/adapter-pg`, `pg`)
- [ ] Write `schema.prisma` for all tables in `PRD.md §6` (enums, relations, `@@map`, unique + indexes)
- [ ] `prisma migrate dev --name init`; **edit migration SQL** to add `CHECK (quantity_on_hand >= 0)` and `CHECK (quantity > 0)` where listed
- [ ] `db/prisma.ts` client using the pooled URL
- [ ] `utils/clock.ts` and `utils/money.ts` (decimal + single rounding rule)
- [ ] `seed.ts`: 3 demo users (one per role, dummy passwords), categories, suppliers, ~15 fictional medicines, batches including **one expired** and **one near-expiry** and **one low-stock** medicine, `OPENING` ledger rows matching batch quantities, default settings
- [ ] Test database ready (Neon branch or Docker Postgres) + `.env.test.example`
- [ ] ER diagram draft (Mermaid from PRD is the starting point)
- **Checkpoint:** fresh DB → `migrate` + `seed` works repeatably; Prisma Studio shows data; manual SQL attempt to set negative quantity is rejected by the CHECK; ledger sum equals batch quantity for every seeded batch.
- **Understanding questions:** Why a `CHECK` in addition to code checks? Why direct vs pooled URL?

### B3: Auth + RBAC
- [ ] `POST /auth/login` (bcrypt compare, JWT with userId+role+expiry), `GET /auth/me`
- [ ] `authenticate` and `requireRole(...)` middleware; apply to a sample protected route
- [ ] Login rate limit + generic error message
- [ ] Tests: login success/fail, 401 without token, 403 wrong role
- **Checkpoint:** protected route → 401 (no token), 403 (wrong role), 200 (right role).

### B4: Catalogue
- [ ] Categories, suppliers, medicines: CRUD with Zod validation, search, filters, pagination (standard `meta` shape)
- [ ] Deactivate instead of delete when referenced; duplicate SKU/name → `CONFLICT`
- [ ] Audit log helper (`auditService.log(...)`) used by catalogue changes
- [ ] RBAC per PRD matrix
- [ ] Tests: validation 400, duplicate 409, RBAC 403
- **Checkpoint:** all catalogue endpoints work via Postman/curl with correct roles.

### B5: Stock-movement service + Purchases + Batches
- [ ] **`stockMovementService`**: single function(s) to apply a delta to a batch inside a transaction (lock row, check `>= 0`, update quantity, insert ledger row). *Human writes this; agent designs and reviews.*
- [ ] `POST /purchases` (create/merge batches, `PURCHASE` movements, validations: future expiry, qty > 0, matching expiry on merge)
- [ ] `GET /purchases`, `GET /purchases/:id`, `GET /batches` (filters), `GET /batches/:id`, `GET /stock-movements`
- [ ] Audit log on purchase creation
- [ ] Tests: purchase creates batch + movement; merge rules; ledger invariant; RBAC
- **Checkpoint:** receive stock → batch + movement visible; invariant `SUM(delta) = quantity_on_hand` holds (test).
- **Understanding questions:** Why is the ledger append-only? What does `FOR UPDATE` prevent?

### B6: Sales (core business logic, highest marks)
- [ ] FEFO allocation function (pure, unit-testable): input batches + requested qty → allocations or insufficient-stock error. *Human writes this.*
- [ ] `POST /sales`: validate → lock candidate batches in consistent order → allocate → compute tax/totals server-side → create sale + `sale_items` + `SALE` movements → invoice number → audit, all in one transaction
- [ ] Expired-batch block; inactive-medicine block
- [ ] `Idempotency-Key` handling (unique key + request hash; same key/same payload → original; different payload → `IDEMPOTENCY_CONFLICT`)
- [ ] `GET /sales`, `GET /sales/:id`, `GET /sales/:id/invoice`
- [ ] Unit tests: FEFO (single batch, spill across batches, ties, expired skipped, insufficient), tax/rounding
- [ ] Integration tests: **A1**, **A2**, oversell rejected, duplicate idempotency key, **concurrent sales on last units** (one succeeds, one fails, stock never negative), RBAC
- **Checkpoint:** sale spanning two batches deducts correctly and writes two `SALE` movements; expired-only stock → rejected; ledger invariant still holds.

### B7: Returns + Adjustments
- [ ] `POST /sales/:id/returns`: sale item + qty + mandatory reason; cap = sold − returned; restock original batch via stock service; update sale status; audit
- [ ] `POST /adjustments`: batch + delta + reason code (+ note); reject if result < 0; ledger + audit
- [ ] `GET /returns`, `GET /adjustments`
- [ ] Tests: **A4** (reason required → 400; auditable), over-return rejected, negative-result adjustment rejected, status transitions
- **Checkpoint:** return and adjustment flows leave ledger invariant intact and appear in audit logs.

### B8: Alerts, dashboard, reports, reconciliation
- [ ] `GET /alerts/low-stock|near-expiry|expired`; settings-driven `nearExpiryDays`
- [ ] `GET /dashboard/summary`
- [ ] `GET /reports/sales`, `/stock-valuation`, `/expiry`
- [ ] `GET /reports/reconciliation` (opening + purchases − sales + returns ± adjustments = closing, vs current quantity). *Human writes the query logic.*
- [ ] `GET /audit-logs`, `GET/PUT /settings`, `GET /users` (admin)
- [ ] Tests: **A3**, **A5**, report RBAC
- **Checkpoint:** seeded + exercised data → reconciliation shows zero mismatch.

### B9: Backend hardening, tests, OpenAPI
- [ ] Review every route: auth, role, validation, error handling; Helmet, CORS (frontend origin only), rate limit
- [ ] Confirm no secrets in git history; `.env.example` complete
- [ ] Test suite green from a clean test DB; coverage gaps on core rules closed
- [ ] `docs/openapi.yaml` covering all endpoints (+ Swagger UI at `/docs`)
- [ ] Capture test run output into `docs/test-evidence.md`
- **Checkpoint:** `npm test` green; `/docs` renders; fresh-clone backend setup works from README steps.

### F1: Frontend foundation
- [ ] Env: `NEXT_PUBLIC_API_URL`; typed API client (attaches Bearer token, normalises the standard error shape)
- [ ] Login page, auth state, logout, route guards, role-aware nav (cosmetic only)
- [ ] App layout: sidebar/topbar, responsive shell; shadcn components (button, input, table, dialog, toast, form)
- [ ] Shared UI pieces: `DataTable` with pagination, `EmptyState`, `ErrorState`, `LoadingState`
- **Checkpoint:** log in with each demo role; guarded pages redirect; API errors show nicely.

### F2: Catalogue screens
- [ ] Medicines (list with search/filter/pagination, create/edit form with validation), Categories, Suppliers
- **Checkpoint:** create/edit a medicine end to end.

### F3: Purchases + inventory screens
- [ ] Purchase form (multi-line items), purchases list/detail
- [ ] Inventory/batches list with filters (active, near-expiry, expired, low-stock) and visual expiry badges; movements view
- **Checkpoint:** receive stock in UI → appears in inventory with a movement.

### F4: Sales (POS) + invoice
- [ ] New Sale: medicine search, line items, qty validation messages, submit with generated `Idempotency-Key` (disable button while submitting)
- [ ] Show allocation result and invoice; print-friendly invoice page (`@media print`)
- [ ] Sales list/detail
- **Checkpoint:** sale in UI deducts stock; expired-only medicine shows a clear error; double-click doesn't create two sales.

### F5: Returns, adjustments, alerts
- [ ] Return flow from sale detail (qty + required reason)
- [ ] Adjustment form (batch, delta, reason)
- [ ] Alerts page (low-stock, near-expiry, expired)
- **Checkpoint:** reasons enforced in UI and by server; alerts match seeded data.

### F6: Dashboard + reports
- [ ] Dashboard cards + recent activity (role-aware)
- [ ] Reports pages: sales, stock valuation, expiry, reconciliation (date-range filters); admin audit log + settings
- **Checkpoint:** reconciliation screen displays zero mismatch on seeded + exercised data.

### F7: UX polish
- [ ] Loading/empty/error/success states audited on every screen
- [ ] Responsive check at ~375px, 768px, desktop; keyboard navigation; labels, focus, contrast
- [ ] Confirmation dialogs for irreversible actions
- **Checkpoint:** manual pass through every journey on phone width.

### D1: Deployment (free tiers only)
- [ ] **Smoke deploy early (Tue 10 Nov, phase D1a):** hello-world level backend on Render (root `backend`) + frontend on Vercel (root `frontend`) + Neon, to flush out env/CORS/build issues
- [ ] Render: build `npm ci --include=dev && npm run build && npm run db:migrate`; start `npm run start`; health check `/health`; env vars set (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `FRONTEND_URL`, `NODE_ENV`)
- [ ] Vercel: root `frontend`; `NEXT_PUBLIC_API_URL` → Render URL
- [ ] CORS allows only the Vercel origin; seed demo data once on Neon
- [ ] Full journey on the live URLs; note cold-start behaviour in README
- **Fallback:** if hosting misbehaves, declare local-only demo and provide exact local run steps (Docker Compose optional).

### D2: End-to-end acceptance + regression
- [ ] Run A1–A5 manually on the demo/local app and via automated tests
- [ ] Fresh-clone test: follow the README exactly on a clean machine/folder
- [ ] Fix defects; re-run all tests

### D3: Documentation
- [ ] README: overview, architecture, stack, setup, env vars, DB setup/migrate/seed, demo credentials, test commands, deployment notes, **known limitations**
- [ ] ER diagram exported (`docs/er-diagram.png` + Mermaid source), `docs/openapi.yaml`
- [ ] `docs/technical-report.md` (1–2 pages): ledger design, FEFO, transactions/locking, idempotency, RBAC, trade-offs, what's unfinished
- [ ] `docs/test-evidence.md`

### D4: Demo video (3–5 min)
- [ ] Script: login → receive stock (2 batches) → FEFO sale spanning batches → expired-batch rejection → alerts → return → adjustment with reason → reconciliation report → show tests passing → brief architecture mention
- [ ] Warm up the free-tier backend first; upload; confirm the link opens when logged out

### D5: Submission + final checks
- [ ] Final regression; record **final commit ID** and primary branch name
- [ ] Verify every link works logged out / incognito: repo (reviewer access if private), video, docs, demo URL
- [ ] Fill the form: identity, assignment confirmation (exact project title), repo + branch + commit, demo + video, docs links, stack + limitations, **AI tools used and purpose + library attribution**, declarations
- [ ] Submit with buffer time before the deadline

### I: Interview prep (ongoing)
- [ ] Can explain: layering, ledger + invariant, FEFO algorithm, transaction + locking, idempotency, RBAC flow, schema choices, test strategy
- [ ] Practice a 15-minute walkthrough and a live change (e.g. change the near-expiry window, add a field, add a validation rule, fix a seeded bug)

---

## DECISIONS LOG

| # | Date | Decision | Why |
|---|---|---|---|
| 1 | _(date)_ | Single repo with `/frontend` and `/backend`, no Turborepo | One repo URL/commit for the form; simpler deploys and setup |
| 2 | _(date)_ | Stack: Express + TS + Prisma + Neon; Next.js + shadcn | Candidate's choice |
| 3 | _(date)_ | Frontend initialised without the monorepo and RTL options | Avoid nested monorepo complexity; English-only app |
| 4 | _(default)_ | Auth via Bearer JWT (revisit cookies/proxy later if time) | Fewest moving parts across two domains |
| 5 | 8 Nov 2026 | Schedule compressed to 7 days: start Sun 8 Nov, deadline Sat 14 Nov EOD, feature freeze Fri night, target submit ~6 PM Sat; scope trims adopted | Brief assumed 15 days; actual window is 7 |

## KNOWN LIMITATIONS (feed into README, keep honest)
- _(add as discovered, e.g. free-tier cold starts, integer quantities only, no payment processing, no PO workflow)_

## INTERVIEW NOTES (tricky points to remember)
- _(add per phase: bugs found, design trade-offs, "why did we do X")_

## SESSION LOG

| Date | Agent/tool | Phase | What was done | Result / checkpoint | Notes |
|---|---|---|---|---|---|
| 8 Nov 2026 | _(agent)_ | P0 | Planning docs created (`AGENTS.md`, `PRD.md`, `PROGRESS.md`); frontend initialised; schedule re-planned to 7 days | n/a | Backend starts at B1 |