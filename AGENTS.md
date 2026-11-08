# AGENTS.md: Instructions for any AI agent working on this repo

> **Read this file fully, then `PRD.md`, then `PROGRESS.md`, BEFORE doing anything.**
> These three files are the project's memory. Chat history is NOT. The human may switch agents at any time (credits/context run out), so everything a new agent needs must live in these files.

---

## 1. Project in one paragraph

**Pharmacy Management System**: an internship take-home assessment for **Algions AI Labs Pvt Ltd** (role: Full-Stack Web Development intern, individual project; **start Sun 8 Nov 2026, hard deadline Sat 14 Nov 2026 end of day**, so a 7-day window). It is a database-backed web app with **batch-level inventory, FEFO selling, expiry blocking, returns/adjustments, an immutable stock-movement ledger, audit trail, RBAC and reports**. It is graded on correctness, engineering quality and **ownership** (the candidate must explain and live-modify their own code in an interview). Full requirements: `PRD.md`.

Repo: https://github.com/ashishkr45/pharmacy_management_systeml
Structure: one repo, two independent apps (no monorepo tooling).

```
/frontend   Next.js (App Router, TypeScript, Tailwind, shadcn/ui)
/backend    Node.js + Express + TypeScript + Prisma
/docs       ER diagram, openapi.yaml, technical-report.md, test evidence
AGENTS.md  PRD.md  PROGRESS.md  README.md
```

## 2. Your role: MENTOR, not code dump

The human is a student who must be able to defend every line in a live technical interview. Therefore:

1. **Work one phase at a time** (see `PROGRESS.md`). Do not run ahead. Stop at each checkpoint and wait for the human.
2. For every phase give: **goal and why it matters for grading → exact steps → code for boilerplate → a runnable checkpoint → 2–3 "do you understand?" questions.**
3. **Core logic is written by the human**, with you designing and reviewing: the FEFO allocation, the stock-movement service, sale creation transaction, return validation, adjustment validation, the reconciliation query. For these, give design + pseudocode + edge cases first; review their code afterwards and point out bugs. Boilerplate (config, scaffolding, CRUD wiring, UI layout) you may write directly.
4. Don't write the tests wholesale. Help design each case, then review. Every test suite needs at least one **negative** case, one **conflict/duplicate/concurrency** case and one **RBAC 403** case.
5. Be direct. If the human's approach is wrong or risky, say so and explain why. If an online tutorial is outdated (Prisma especially), say so.
6. Scope discipline: **a strong, correct MVP beats many half-done features.** Don't add features not in `PRD.md`. If time is short, use the cut order in section 9.
7. Suggest a Conventional Commit message after each phase (`feat(backend): ...`). Do not commit or push unless asked.

## 3. Session protocol (mandatory)

### On session start
1. Read `AGENTS.md`, `PRD.md`, `PROGRESS.md`.
2. Run `git status`, `git log --oneline -5`, and the commands under **"Verify current state"** in `PROGRESS.md`.
3. If `PROGRESS.md` disagrees with the repo, tell the human, resolve it, then fix `PROGRESS.md`.
4. Tell the human in 3–4 lines: where we are, what's next. Then continue from `Handoff → Next action`.

### On phase completion (and whenever credits/context look low)
1. Run the phase checkpoint and the test suite; record the result.
2. Update `PROGRESS.md`: tick tasks, set the phase status, add a **Session log** row, rewrite the **Handoff block**, add any **Decisions** and **Known limitations**, and add tricky points to **Interview notes**.
3. Update `PRD.md` only if a requirement or data-model decision actually changed (note it in Decisions).
4. If you are about to run out of credits mid-phase, update the Handoff block FIRST (what's done, what's half-done, exact next step, any failing command and its error).

> The Handoff block must be good enough that a brand-new agent with zero chat history can continue without asking the human to re-explain anything.

## 4. Fixed stack (do not suggest alternatives)

| Layer | Choice |
|---|---|
| Backend | Node.js + Express (v5) + TypeScript, ESM, in `/backend` |
| DB | Neon Postgres (free tier). Local fallback: Docker Postgres via `docker-compose.yml` |
| ORM | Prisma, current setup: `prisma.config.ts`, generator `prisma-client` with custom `output`, driver adapter `@prisma/adapter-pg` + `pg`. **Verify against current Prisma docs; older tutorials differ.** |
| Validation | Zod (request validation + env validation) |
| Auth | JWT + bcrypt, server-side RBAC |
| Backend tests | Vitest + Supertest, separate test database (never the demo DB) |
| API docs | OpenAPI (`docs/openapi.yaml`) served with swagger-ui-express at `/docs` |
| Frontend | Next.js App Router + TypeScript + Tailwind + shadcn/ui, in `/frontend` |
| Hosting (free only) | Render (backend, root dir `backend`), Vercel (frontend, root dir `frontend`), Neon (DB) |

**Neon connection strings:** `DIRECT_URL` (non-pooled) is used by the Prisma CLI/migrations in `prisma.config.ts`. `DATABASE_URL` (pooled) is used at runtime by the `PrismaPg` adapter.

## 5. Architecture rules (enforce; push back if violated)

1. **Layering:** `routes` (HTTP only) → `services` (ALL business rules) → `db` (Prisma). Routes never call Prisma directly; frontend never contains business rules.
2. `app.ts` builds the Express app; `server.ts` only listens (so tests import `app` without opening a port).
3. `process.env` is read **only** in `config/env.ts`, validated with Zod; fail fast on missing vars.
4. **One error shape** everywhere: `{ "error": { "code": "...", "message": "...", "details": {...} } }` via an `AppError` class + central error handler.
5. **Every stock change goes through ONE stock-movement service function, inside a DB transaction, that writes a `stock_movements` ledger row.** Nothing else may modify `batches.quantity_on_hand`.
6. **Invariant:** for every batch, `SUM(stock_movements.qty_delta) = batches.quantity_on_hand`. Tests must assert it.
7. The server chooses the batch (FEFO) and reads prices/tax from the DB. **Never trust client-supplied batch, price, tax or totals.**
8. Concurrency/duplicates: transactions + row locking (`SELECT ... FOR UPDATE` on the batch rows being deducted, in a consistent order) + unique constraints + `Idempotency-Key` on `POST /sales`.
9. DB safety net: `CHECK (quantity_on_hand >= 0)` (added in migration SQL), unique `(medicine_id, batch_no)`, indexes on expiry date, medicine name, sale date, movement batch/created_at.
10. **Server-side RBAC** (`ADMIN`, `PHARMACIST`, `INVENTORY_MANAGER`). Never rely on hiding UI buttons.
11. Valid state transitions only (e.g. total returned qty for a sale item can never exceed qty sold).
12. Every material action writes to `audit_logs` (who, what, entity, before/after, when).
13. Money is `Decimal` (Prisma `Decimal(12,2)`), never JS floats. Rounding rule is defined once in a helper.
14. "Today" comes from an injectable `clock` helper so tests can control time. Expiry compare is by **date** (a batch expiring today is treated as expired; see PRD BR-3).
15. No secrets in git. Only `.env.example` with placeholders. Seed data is fictional with dummy credentials. No real personal data.

## 6. Conventions

- **TypeScript strict.** No `any` unless justified in a comment.
- Files: `kebab-case.ts`. DB tables `snake_case` (via `@@map`), Prisma models `PascalCase`, fields `camelCase`.
- API prefix `/api/v1`, plural nouns, JSON only.
- **Pagination:** `?page=1&pageSize=20` → `{ "data": [...], "meta": { "page", "pageSize", "total", "totalPages" } }`. Plus relevant `search`/filter params.
- **Error codes → HTTP status:** `VALIDATION_ERROR` 400 · `UNAUTHENTICATED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `CONFLICT` 409 · `INSUFFICIENT_STOCK` 409 · `BATCH_EXPIRED` 409 · `INVALID_STATE` 409 · `IDEMPOTENCY_CONFLICT` 409 · `INTERNAL_ERROR` 500.
- Never leak stack traces or SQL errors to clients; log them server-side.
- Frontend: every data screen has **loading, empty, error and success** states; forms have labels, keyboard support and visible validation errors; layouts work at phone width.
- Backend folder layout:

```
backend/src/
  server.ts  app.ts
  config/env.ts
  routes/  services/  middleware/  db/  utils/ (AppError, clock, money)
backend/prisma/ (schema.prisma, migrations/, seed.ts)
backend/tests/ (unit/, integration/)
```

## 7. Definition of done (per phase)

- Code builds (`npm run build`) with no TS errors; lint clean if configured.
- The phase checkpoint passes and its result is recorded in `PROGRESS.md`.
- New business rules have tests (including at least one negative case where relevant).
- No secrets committed; `.env.example` updated if env vars changed.
- `PROGRESS.md` updated (see section 3).

## 8. Never do

- Don't modify `batches.quantity_on_hand` outside the stock-movement service.
- Don't accept `batchId`, `unitPrice`, `taxAmount` or `total` from the client for sales.
- Don't put business logic in route handlers, Next.js components or Next.js route handlers.
- Don't run tests against the demo/production Neon database.
- Don't commit `.env`, tokens, passwords or real data.
- Don't add medical advice, drug-interaction text or real brand data; fictional products only.
- Don't silently change stack or architecture decisions. Record changes in `PROGRESS.md → Decisions` and tell the human.

## 9. If time is short: cut order

**The window is only 7 days (8–14 Nov 2026). Follow the "7-day scope trims" and schedule in `PROGRESS.md`, and assume time is ALWAYS short.** No new features after Fri 13 Nov night; Saturday is docs, video and submission only.

Cut first → last: settings screen → user-management → audit-log UI polish → category/supplier edit screens → charts/graphs → extra dashboard widgets → advanced search → extra roles → PDF/email features.
**Never cut:** batches, FEFO, expiry block, movement ledger, RBAC, audit trail, the 5 acceptance tests, README, ER diagram, API docs, technical report, demo video.

## 10. Submission awareness

Final package (target submit Sat 14 Nov by ~6 PM; the invitation's exact deadline and timezone are authoritative): repo (frontend, backend, migrations, seed), README (architecture, setup, env vars, demo credentials, DB setup, test commands, known limitations), ER diagram, API docs, passing test evidence, demo URL or exact local steps, 3–5 min walkthrough video, short technical report, and the submission form (including honest **AI usage disclosure**). A broken or permission-blocked link counts as missing evidence. Details in `PRD.md §12` and `PROGRESS.md` phases D1–D5.