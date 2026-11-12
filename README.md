# Pharmacy Management System

A database-backed web application for running pharmacy operations with correctness at the core: **batch-level inventory, FEFO (first-expiry-first-out) selling, expiry blocking, returns and adjustments, an immutable stock-movement ledger, audit trail, server-side RBAC and reports**.

## What it does

- Tracks medicines in batches, each with its own expiry date and stock level.
- Sells using FEFO allocation so the earliest-expiring usable batch is consumed first.
- Blocks sale of expired batches and prevents negative stock.
- Records every stock change as an immutable ledger row (`stock_movements`), keeping `SUM(qty_delta) = quantity_on_hand` as an invariant.
- Supports partial/full returns and stock adjustments with validation and audit logging.
- Enforces role-based access control on the server (`ADMIN`, `PHARMACIST`, `INVENTORY_MANAGER`).
- Provides reports and a reconciliation view.

## Tech stack

| Layer | Stack |
|---|---|
| Backend (`/backend`) | Node.js + Express 5 + TypeScript (ESM) + Prisma + PostgreSQL (Neon) |
| Frontend (`/frontend`) | Next.js App Router + TypeScript + Tailwind CSS + shadcn/ui (light/dark themes via `next-themes`) |
| Testing | Vitest + Supertest against a separate test database |
| API docs | OpenAPI 3 spec served via Swagger UI at `/docs` |

## Project structure

```
/frontend   Next.js app
/backend    Node.js + Express + TypeScript + Prisma
/docs       ER diagram, OpenAPI spec, technical report, test evidence
```

## Documentation

Authoritative requirements and design notes live in:

- [`PRD.md`](./PRD.md) — product requirements and business rules.
- [`AGENTS.md`](./AGENTS.md) — architecture rules, conventions, and working agreements.
- [`PROGRESS.md`](./PROGRESS.md) — live task tracker and handoff notes.
- [`docs/README.md`](./docs/README.md) — documentation index.
- [`docs/er-diagram.md`](./docs/er-diagram.md) — entity-relationship diagram (Mermaid).
- `docs/openapi.yaml` — OpenAPI spec for every `/api/v1` endpoint.
- `docs/technical-report.md` — ledger design, FEFO, transactions/locking, idempotency, RBAC, trade-offs.
- `docs/test-evidence.md` — captured acceptance/regression test runs.

> **Status: work in progress.** Setup, demo credentials, API documentation links, test commands and known limitations will be added here (see `PROGRESS.md`).

Project memory and rules live in [`AGENTS.md`](./AGENTS.md), requirements in [`PRD.md`](./PRD.md), and the live task tracker/handoff in [`PROGRESS.md`](./PROGRESS.md).