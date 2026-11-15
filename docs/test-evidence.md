# Test evidence

Captured on **Saturday 14 November 2026** for the final submission; the Docker
reviewer path and the post-rename regression were verified on **Sunday 15
November 2026** (sections 1 and 7). The backend test suite runs with Vitest +
Supertest against a **separate Neon test database** (`backend/.env.test`), never
the demo database.

## 1. Full backend regression

Command:

```bash
cd backend
npm test
```

Result: **8 test files, 58 tests passed, 0 failed** (all suites green; latest
post-seed-rename run **688.8 s** on the slow Neon test branch; earlier runs took
500.9 s and 557.4 s).

> Two test descriptions in `reports-alerts.test.ts` were later aligned with PRD
> §9 (`A5` = reconciliation; the RBAC case is not an acceptance criterion).
> Only the strings changed; the reports/alerts suite was rerun afterward and
> passed **7/7 in 121.8 s**.

| Suite | Tests | What it proves |
|---|---:|---|
| `tests/unit/fefo.test.ts` | 10 | FEFO order, expiry/today exclusion, tie-break, exact quantities, no input mutation; 3 parameterised invalid quantities |
| `tests/unit/money.test.ts` | 5 | Decimal half-up rounding per line, tax base, no float drift |
| `tests/integration/auth.test.ts` | 9 | Login, generic failures, token validation, deactivation, admin RBAC |
| `tests/integration/catalogue.test.ts` | 9 | Pagination, filters, create/update, duplicate 409, validation 400, role 403, no delete |
| `tests/integration/purchases.test.ts` | 7 | Batch creation/merge, expiry rules, duplicate lines, ledger invariant, role 403 |
| `tests/integration/sales.test.ts` | 7 | FEFO across batches, server tax, idempotent replay/conflict, oversell, expired block, last-unit race, invoice/RBAC |
| `tests/integration/returns-adjustments.test.ts` | 4 | Return-to-batch, return cap, concurrent return race, signed adjustments and floor |
| `tests/integration/reports-alerts.test.ts` | 7 | Alerts, settings window, reconciliation (A5), corruption detection, sales/valuation/expiry reports, RBAC/invalid ranges, settings audit |

> Neon cold starts can make the first test file slow. The suite uses longer
> Prisma transaction limits (10 s wait / 20 s timeout) for this reason; the local
> run completed without retries.
>
> The current seed uses `106 Gyūnyū` / `106-MILK` with batches `MILK-2601` and
> `MILK-2602`. The 15 Nov regression above was rerun after that rename; earlier
> checkpoint values that mention Fevra-500/FEV-2601 are retained as history.

## 2. Acceptance criteria map (PRD §9)

| Criterion | Automated evidence | Additional manual/API evidence |
|---|---|---|
| **A1** FEFO sale deducts the correct batches and writes `SALE` movements | `sales.test.ts` › “allocates FEFO across two batches and computes tax server-side” | Demo sale `INV-2026-000001` consumed the earliest batches; reconciliation ties to current quantities |
| **A2** Expired batches cannot be sold | `sales.test.ts` › “never sells expired stock”; `fefo.test.ts` › “skips expired batches, today-expiring batches and empty batches” | Expiry alert screen shows expired stock separately; API rejects an expired-only medicine |
| **A3** Low-stock and near-expiry warnings | `reports-alerts.test.ts` › “lists low-stock, near-expiry and expired alerts and matches dashboard counts” and “honours the near-expiry setting” | Dashboard alert cards and `/alerts` tabs checked against API counts |
| **A4** Returns/adjustments require a reason and are auditable | `returns-adjustments.test.ts` (all four cases); validation tests reject missing reasons | Demo sale #3 is `PARTIALLY_RETURNED` with 1 returned unit; the return appears in the movement ledger and audit log. The adjustment path is covered by automated tests; the demo DB has 0 adjustments. |
| **A5** Stock report reconciles with opening, purchases, sales and adjustments | `reports-alerts.test.ts` › “reconciles … zero mismatch (A5)”, “detects a corrupted batch balance …”, “enforces report and admin RBAC …” | Live demo report: **19 checked batches, 0 mismatches, `checksCurrent: true`** |

Every relevant suite includes at least one negative case, one
conflict/duplicate/concurrency case and one `403`/RBAC case.

## 3. F6 checkpoint captured on the demo database

API checkpoint (last 30 UTC days, current server date):

| Check | Result |
|---|---|
| Reconciliation | **19 batches checked, mismatchCount 0, checksCurrent true** |
| Stock valuation | 18 in-stock batches; 19 with `includeZero=true` |
| Expiry report | near-expiry window **60 days** |
| Sales report | total **₹2,374.05**; **₹115.50** returned |
| Audit log | 5 entries at the checkpoint |
| Demo sales | `INV-2026-000001` ₹1,181.25; `INV-2026-000002` ₹967.05; `INV-2026-000003` ₹225.75 (partially returned) |
| Adjustments | 0 demo adjustments; return path exercised through sale #3 |
| `npm run db:verify` | **19 batches, 27 ledger rows, invariant OK**; 1 expired-with-stock, 2 near-expiry (≤60d), 8 low-stock medicines |

### RBAC spot checks (server responses)

| Request | Expected | Observed |
|---|---|---|
| Pharmacist → stock valuation / expiry / reconciliation | `403 FORBIDDEN` | `403 FORBIDDEN` |
| Inventory manager → sales report | `403 FORBIDDEN` | `403 FORBIDDEN` |
| Inventory manager → audit logs / settings | `403 FORBIDDEN` | `403 FORBIDDEN` |
| Pharmacist → audit logs / settings | `403 FORBIDDEN` | `403 FORBIDDEN` |
| Admin → all report and admin screens | allowed | allowed |

### Negative validation checks

| Request | Expected | Observed |
|---|---|---|
| Invalid report date range (`from > to`) | `400 VALIDATION_ERROR` | `400 VALIDATION_ERROR` |
| `nearExpiryDays=0` | `400 VALIDATION_ERROR` | `400 VALIDATION_ERROR` |
| `defaultTaxRate=101` | `400 VALIDATION_ERROR` | `400 VALIDATION_ERROR` |
| Settings after rejected writes | unchanged `5.00 / 60` | unchanged `5.00 / 60` |

The F6 negative checks used the API/form validation path; no real settings save
was made on the demo database.

## 4. Targeted F6 backend suite

After the F6 report/admin work:

```bash
npx vitest run tests/integration/reports-alerts.test.ts
```

Result: **7/7 passed**, including A3 reconciliation, corruption detection, A5
RBAC and settings audit.

## 5. Frontend checks

Command:

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
```

Results at the F6 checkpoint: **lint clean, typecheck clean, production build
passed with 21 routes**. The F7 polish edits were rechecked with lint and
typecheck; the final build was rerun before submission.

## 6. Route/API smoke checks

- API health: `GET http://localhost:4000/api/v1/health` → `200`.
- Frontend: `GET http://localhost:3000/reports` → `200` (served the reports shell;
  authenticated data is loaded client-side).
- Report endpoints checked with an admin token; role-restricted endpoints checked
  with each demo role and rejected with `403` as above.
- Swagger UI: `GET http://localhost:4000/docs` serves the OpenAPI spec from
  `backend/openapi.yaml` (a copy of `docs/openapi.yaml`); `/docs/swagger-ui.css`
  and `/docs/swagger-ui-bundle.js` returned `200`. The compiled `dist/server.js`
  was also smoke-tested on port 4100: health, `/docs/` and `/openapi.yaml` all
  returned `200`.
- `npx @redocly/cli lint docs/openapi.yaml` → **valid**, 65 style warnings only
  (missing `operationId`, tag descriptions, localhost server and license metadata),
  no structural errors.

## 7. Docker reviewer-path verification (15 Nov 2026)

Host: **Docker Desktop 28.3.2**, Linux engine. This is a local demo path, not a
replacement for the automated Vitest suite; the suite still runs on the separate
Neon test branch.

Commands:

```bash
docker compose up -d --build
docker compose ps
docker compose down -v
docker compose up -d --no-build
```

Results:

- **Cold first build:** 899 s (one transient npm `ECONNRESET` required a retry;
  BuildKit cache resumed).
- **Fresh working copy**, no `.env` and no `node_modules`: `docker compose up -d --build`
  passed in **113.7 s** with a warm BuildKit cache; backend and frontend reached
  `healthy`; all migrations applied.
- **Clean volume seed:** 3 users, 7 categories, 5 suppliers, 15 medicines,
  18 batches, 18 `OPENING` movements, settings `defaultTaxRate=5` /
  `nearExpiryDays=60`.
- **Seed contents check (15 Nov):** `GET /api/v1/medicines?search=106` returned
  exactly one row, `106 Gyūnyū` / `106-MILK`; `GET /api/v1/batches?search=MILK-2601`
  returned 40 units at purchase/sale `180.00` / `245.00`; the ledger invariant
  query returned **0 mismatches**.
- **Logins/CORS:** all three demo accounts returned their expected roles;
  preflight from `Origin: http://localhost:3000` returned **204** with
  `Access-Control-Allow-Origin: http://localhost:3000`.
- **Journey:** purchase `FRESH-DEMO-001` (Painex, batch `PNG-FRESH-01`, qty 10);
  sale `INV-2026-000001` for **₹4,928** split across two FEFO batches; invoice
  returned the same total; 2-unit return produced `PARTIALLY_RETURNED`;
  reconciliation **19 batches / 0 mismatches / checksCurrent true**; ledger
  invariant query returned **0** violations.
- **Restart:** `docker compose restart backend` printed
  `Seed skipped: 3 user(s) already exist.` and kept 3 users / 15 medicines /
  18 batches.
- **Non-root:** `docker compose exec backend id` and `... frontend id` both report
  `uid=1000(node)`.
- **Cached source-change rebuild:** **40.7 s** for both images; after adding source-map deletion to the build stages, a rebuild took **31.9 s** and `find /app -name '*.map'` returned nothing in either runtime container.
- **Host builds:** frontend `npm run build` **163.5 s** without
  `NEXT_OUTPUT` (no `.next/standalone`), backend `npm run build` **96.7 s**.
- **Image sizes** (targets in parentheses): backend **817 MB** (300–400 MB),
  frontend **258 MB** (≤250 MB), `postgres:18.2-alpine` **409 MB** (~250 MB).
  The misses are documented in the README and `PROGRESS.md`.

## 8. Manual visual walkthrough

The candidate walked the app with all three demo accounts:

- F5 returns/adjustments/alerts flow — accepted.
- F6 dashboard, reports, audit log and settings — accepted.
- Checked phone (~375 px) and desktop widths, light and dark themes, loading,
  empty, error and success states.
- The F6 settings form was validated but not saved on the demo database.

The environment available to the implementation session had no connected desktop
browser, so browser automation was not used; this is recorded honestly as a
limitation. Automated API, build and test evidence above is reproducible from the
commands in the README.
