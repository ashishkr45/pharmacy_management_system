# Technical report — Pharmacy Management System

**Project:** MediTrack pharmacy operations app
**Scope:** individual internship take-home assessment
**Code:** `/backend` (Express + Prisma), `/frontend` (Next.js)

## 1. What the system does

The app runs the stock side of a small pharmacy: catalogue and suppliers, stock
receipts, FEFO sales, returns, adjustments, alerts, reports and an admin audit
trail. The design is deliberately centred on one correctness property:

> For every batch, the sum of its immutable stock-movement rows equals its
> current `quantity_on_hand`.

Everything else is built around protecting that invariant. The server owns all
business decisions; the browser only sends intent (for example medicine ids and
quantities) and renders the result.

## 2. Architecture and layering

```text
Next.js screens ──HTTP──▶ routes (HTTP only)
                              │
                              ▼
                         services (all rules)
                              │
                              ▼
                         Prisma / PostgreSQL
```

- `routes/*.routes.ts` validate HTTP input and translate results to JSON. They
  never call Prisma.
- `services/*-service.ts` contain FEFO, pricing, stock rules, transactions,
  locking, returns, reporting and audit behaviour.
- `db/prisma.ts` owns the singleton Prisma client. The runtime uses the pooled
  `DATABASE_URL` through `@prisma/adapter-pg`; the Prisma CLI uses `DIRECT_URL`
  from `prisma.config.ts`.
- `utils/` holds the one error type, injectable UTC clock, money/rounding helper
  and other pure utilities.
- `app.ts` builds Express without listening, so Supertest can import it.
  `server.ts` only opens the port.
- Environment variables are parsed once by Zod in `config/env.ts`; the process
  fails fast if a required value is missing.

The frontend mirrors the same separation. It has no payable arithmetic and no
stock decisions. Shared API hooks handle loading, error, empty and refresh
states; role checks hide navigation, while the server remains the security
boundary.

## 3. Data model and database guarantees

The Prisma schema models users, categories, suppliers, medicines, batches,
purchases/purchase items, sales/sale items, returns, stock adjustments,
stock movements, audit logs and typed settings. Important constraints:

- `users.email`, `medicines.sku`, `categories.name` and `suppliers.name` are
  unique.
- `(medicine_id, batch_no)` is unique, so receiving the same batch twice merges
  into one batch rather than creating ambiguous stock.
- `sales.invoice_no` and `sales.idempotency_key` are unique.
- Indexes cover expiry date, medicine name/category, sale date, movement
  batch/date and audit entity/date.
- Hand-written migration SQL adds the safety checks Prisma cannot express:
  `quantity_on_hand >= 0`, positive quantities, `returned_quantity <= quantity`,
  non-zero movement/adjustment deltas, non-negative totals and a tax-rate range.

Money is `Decimal(12,2)`, never a JavaScript float. `utils/money.ts` defines the
single rounding rule: half-up to two decimal places at the point each amount is
computed (per line), then exact Decimal addition for totals. The invoice number
is derived from the sale id (`INV-YYYY-NNNNNN`); a temporary unique placeholder
is replaced inside the same transaction.

Dates are calendar dates, not instants. `utils/clock.ts` normalises to UTC
midnight; “today” is injectable so tests can freeze time. A batch expiring today
is already expired (`expiry_date <= today`), matching BR-3.

## 4. The stock-movement service

`services/stock-movement-service.ts` exposes the only function allowed to change
`batches.quantity_on_hand`. It must receive the caller's transaction, locks the
batch row with `SELECT ... FOR UPDATE`, calculates the resulting quantity, rejects
a negative result and updates the batch plus inserts the ledger row atomically.

This gives three properties:

1. No service can silently update stock without a ledger entry.
2. Concurrent deductions serialise on the batch row.
3. The ledger is append-only; corrections are new movement rows, never edits.

The seed is the only deliberate exception (it writes opening quantities and
matching `OPENING` rows directly). Integration tests assert the invariant after
purchases, sales, returns and adjustments; `npm run db:verify` checks it on the
seeded database.

## 5. FEFO sale creation

The FEFO allocator itself is a pure function in `services/fefo.ts`: it takes
candidate batches (id, expiry, quantity), sorts by expiry then id, and returns
allocations or `INSUFFICIENT_STOCK`. It has no database or clock dependency and
is unit-tested deterministically.

`createSale` runs inside one interactive transaction:

1. Validate medicines exist and are active; reject duplicate medicine ids.
2. Read the default tax rate from settings.
3. In **one SQL statement**, select every usable batch for the requested
   medicines (`quantity_on_hand > 0`, `expiry_date > today`), ordered by id, and
   lock the rows with `FOR UPDATE`. Expired batches are excluded before
   allocation, so they can never be sold. One shared ascending-id lock order
   prevents two sales from deadlocking each other.
4. Allocate FEFO per medicine.
5. Read the unit price from each locked batch and the tax rate from each
   medicine (falling back to the setting). Compute line subtotal, tax and
   tax-inclusive line total on the server.
6. Insert the sale (with a placeholder invoice number), replace it with the final
   number, insert sale items and write one negative `SALE` movement per
   allocated batch through the stock-movement service.
7. Write the audit row and return the fully populated sale.

If any line fails, the transaction rolls back; no partial deduction is visible.
The API rejects a client-supplied batch, price, tax or total by simply not
accepting those fields.

## 6. Idempotency and concurrency

`POST /sales` requires an `Idempotency-Key`. The service hashes a deterministic
JSON representation of the logical request (sorted keys, no `undefined`) with
SHA-256 and stores both key and hash on the sale.

- Fast retry: the key already exists with the same hash → return the original
  sale with HTTP 200 and `Idempotent-Replay: true`.
- Key reused with a different payload → `IDEMPOTENCY_CONFLICT` (409).
- Two identical requests race past the fast path: the unique key lets one
  transaction win; the loser catches the unique-constraint error, re-reads the
  winner and returns the same sale.

The automated suite includes a two-request race for the last unit of stock and a
two-request return race that together exceed the return cap. Exactly one request
wins in each case.

`TRANSACTION_OPTIONS` raises Prisma's interactive-transaction limits to 10 s wait
/ 20 s timeout because Neon free-tier round trips are slower than a local
database; the limit still bounds a genuinely hung transaction.

## 7. Returns and adjustments

A return locks the sale, the requested sale items and the affected batches (in a
stable order) before validating the cap `quantity - returned_quantity`. It writes
positive `RETURN` movements back to the original batch, increments
`returned_quantity`, recomputes the sale status (`COMPLETED`,
`PARTIALLY_RETURNED`, `FULLY_RETURNED`) and logs an audit entry. A reason of at
least three characters is mandatory.

An adjustment requires a batch, a non-zero signed `delta` and one of
`DAMAGED`, `EXPIRED`, `COUNT_CORRECTION`, `LOST`, `OTHER`; `OTHER` requires a
note. It writes the adjustment row and the matching `ADJUSTMENT` movement in one
transaction. Both operations are intentionally **not** idempotent; the UI
disables repeated submission, but a unique operation key was out of the 7-day
scope.

## 8. RBAC and audit

JWTs carry the user id and role. `authenticate` verifies the signature and loads
the user state; `requireRole` performs server-side checks. The role split is:

| Capability | ADMIN | PHARMACIST | INVENTORY_MANAGER |
|---|:---:|:---:|:---:|
| Sales / returns | ✓ | ✓ | — |
| Catalogue / purchases / adjustments | ✓ | read | ✓ |
| Stock reports / reconciliation | ✓ | — | ✓ |
| Sales reports | ✓ | ✓ | — |
| Audit log / settings | ✓ | — | — |

Hiding a button is cosmetic only. The test suite includes `403` checks for stock
reports as a pharmacist, sales reports as an inventory manager, and admin
screens as both non-admin roles.

Material actions write an `audit_logs` row with actor, action, entity, timestamp
and before/after snapshots. The admin screen renders snapshots as escaped text,
never HTML. Settings changes audit each changed key separately.

## 9. Reports and reconciliation

- **Sales report:** gross sales, tax and totals plus returned units/value per
  UTC calendar day for a validated `from`/`to` range.
- **Stock valuation:** current batches at cost and retail value, optionally
  including zero-quantity batches.
- **Expiry report:** expired and near-expiry exposure grouped by medicine.
- **Reconciliation:** rebuilds each batch from movements. Opening is the sum of
  movements before `from` plus `OPENING` rows inside the range; purchases, sales,
  returns and adjustments are summed by type; closing is compared with
  `quantity_on_hand` **only when the range ends today or later**. Past ranges
  return `checksCurrent: false` rather than falsely claiming a mismatch.

The live demo checkpoint reports 19 checked batches, zero mismatches and
`checksCurrent: true`. A negative test corrupts a batch directly and proves the
report detects the difference.

## 10. Testing and verification

Backend tests run with Vitest + Supertest against a separate test database.
The suite covers auth and RBAC, catalogue rules, purchases, FEFO allocation,
pricing, idempotent replay and conflict, last-unit concurrency, returns and their
cap, concurrent returns, adjustments, alerts, reports, reconciliation corruption
detection, settings audit, and the five acceptance criteria A1–A5. Each relevant
suite includes negative, conflict/concurrency and `403` cases. The final recorded
run is **8 files / 58 tests passed in 500.9 s** (a prior full run took 557.4 s); the compiled API also serves
`/docs` and `/openapi.yaml`.

Frontend checks are `eslint`, `tsc --noEmit` and a production `next build`.
There is no browser automation in the submission environment; the candidate
walked the screens manually at phone and desktop widths in light and dark themes.
Captured evidence is in `docs/test-evidence.md` and `PROGRESS.md`.

## 11. Trade-offs and unfinished work

- **JWT in localStorage** keeps the demo simple but is weaker than an httpOnly
  cookie with CSRF protection. Token refresh/rotation was not built.
- **No user-management UI.** The admin list endpoint exists; create/deactivate
  screens were cut under the deadline.
- **Categories and suppliers are list + create.** Medicine deactivation replaces
  delete so historical sales remain valid.
- **Only sales are idempotent.** Purchases, returns and adjustments rely on UI
  disabling plus transaction/lock checks.
- **Report payloads are unpaginated** at demo scale; alerts and audit logs are
  paginated.
- **Reconciliation is a live check**, not a historical snapshot. It deliberately
  refuses to certify past ranges.
- **No PDF/email invoice.** The invoice is a print-friendly browser view.
- **No chart library.** Reports use stat cards and tables to keep the bundle and
  review surface small.
- **Deployment:** the app is configured for Render + Vercel + Neon, but no public
  URL is committed in this snapshot; the README gives exact local steps as the
  fallback.

## 12. AI use

AI tools were used for planning, boilerplate/scaffolding, code review, test-case
design and documentation. Business-critical code was designed and reviewed
against the PRD, and the candidate must be able to explain and modify it live.
The submission form contains the honest tool/purpose disclosure.
