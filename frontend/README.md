# MediTrack frontend

Next.js App Router frontend for the Pharmacy Management System. The API lives in
`../backend`; this app contains no business rules. The server is always the
authority on stock, prices, totals and permissions.

## Requirements

- Node.js 20.9+ (Node 22 recommended)
- The backend running at `http://localhost:4000`

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

`.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

The base URL must include `/api/v1`. The variable is read at build time, so set
it in Vercel before deploying.

## Demo accounts

All three accounts use the password `Demo@1234`.

| Role | Email | Scope |
|---|---|---|
| Administrator | `admin@pharmacy.test` | Everything, settings, audit log |
| Pharmacist | `pharmacist@pharmacy.test` | Sales, invoices, returns, inventory view |
| Inventory manager | `inventory@pharmacy.test` | Catalogue, purchases, adjustments, stock reports |

The login screen lists the same accounts and fills the form when one is picked.

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm run start      # serve the production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```

## Structure

```
app/
  login/           public sign-in screen
  (app)/           protected routes (auth guard + app shell)
    dashboard/     API-backed landing page
    categories/    catalogue categories: list + create
    suppliers/     catalogue suppliers: list + create
    medicines/     catalogue medicines: list + create/edit
    purchases/     receive stock, purchase history and detail
    inventory/     batch stock, expiry/low-stock views, adjustments and movement ledger
    sales/         POS, sale history/detail, returns and role-gated checkout
    alerts/        low-stock, near-expiry and expired alert workspace
    reports/       role-filtered sales, valuation, expiry and reconciliation reports
    audit-logs/    admin-only audit browser with filters and snapshots
    settings/      admin-only tax and near-expiry defaults
  (print)/         printable invoice route outside the app shell
    sales/[id]/invoice/
components/
  auth/            route guards and access-denied state
  catalogue/       catalogue dialogs and status badge
  inventory/       batch/expiry/low-stock panels, adjustment dialog/history and ledger badges
  purchases/       multi-line purchase receiving form
  sales/           POS form, return dialog/history and sale status badge
  reports/         date filter, stats and the four report panels
  layout/          sidebar, topbar, brand, theme toggle, user menu
  shared/          DataTable, stat card, search input, page header and states
  ui/              shadcn/ui primitives
lib/
  api/             typed fetch client, path-keyed cache, shared API types and form-error mapping
  auth/            session storage and auth provider
  hooks/           cached list/item hooks and debounced-value hook
  navigation.ts    role-aware navigation config
  reports.ts       default report range and date-range validation
  roles.ts         role labels, helpers and report role groups
```

## Auth and permissions

- The JWT is stored in `localStorage` and attached as `Authorization: Bearer`.
- On load, `GET /auth/me` re-reads the user so role changes and deactivation take
  effect immediately.
- A `401` clears the local session and returns the user to `/login`.
- Navigation and route guards are cosmetic. Every endpoint enforces RBAC.
- There are no refresh tokens: an expired token means signing in again.

## Theme

The app supports light, dark and system themes through `next-themes` (class
strategy). The choice is available from the header and the login screen, follows
the OS preference by default, and persists in `localStorage`.

Every current and future component must use semantic tokens (`bg-background`,
`text-foreground`, `bg-card`, `border-border`, `text-muted-foreground`, …)
instead of fixed light-only colors. Add `dark:` variants only for accents that
have no semantic token, and verify new UI in both themes at phone and desktop
widths. Printable views must force light/ink-friendly styles.

## Data fetching and cache

`useApiList` and `useApiItem` use a small in-memory, path-keyed cache
(`lib/api/cache.ts`). A cached list or detail page renders immediately; fresh
entries (30 s for lists, 5 minutes for dropdown reference data) skip the network
and older entries revalidate in the background. Entries are capped at 100 and
the cache is cleared on login, logout and `401`.

After a successful write, invalidate every affected path prefix so mounted
screens refresh and other screens do not reuse stale data:

```ts
invalidateApiCache(["/purchases", "/batches", "/alerts", "/stock-movements"]);
```

The cache is per browser tab and is not persisted. The server remains the
authority for stock, prices and totals.

## Phase status

F1 (foundation) is complete: API client, login, auth state, guards, responsive
shell, shared table/state components and light/dark/system theming. F2 catalogue
screens are implemented: categories and suppliers list/create, and medicines
list/create/edit with search, filters and pagination. F3 purchases and inventory
are implemented: multi-line receiving, purchase list/detail, batch views,
near-expiry/expired/low-stock views and the stock movement ledger. F4 sales are
implemented: a POS with cached medicine search and idempotent submission, sales
list/detail with FEFO batch lines, and a print-friendly invoice outside the app
shell. F5 returns, adjustments and alerts are implemented: a return dialog with a
required reason and return history on the sale detail, a batch-search adjustment
form with signed quantities and adjustment history, and an alerts workspace that
reuses the server-side alert endpoints. F6 is implemented: the dashboard leads
with sales or stock depending on role; reports are filtered by role (sales for
counter roles, valuation/expiry/reconciliation for stock roles); and the admin
audit log and settings screens are live. User management remains out of scope
under the 7-day cut order.

## Sales and invoices

`/sales/new` keeps customer name and phone optional, matching PRD FR-4; if a
name is provided it appears on the invoice. It sends only medicine ids and
quantities. The API performs FEFO, pricing, tax and invoice numbering; the UI
never calculates a payable total. The form disables submission while pending
and reuses one `Idempotency-Key` for a retry, so a double-click or lost response
cannot create a second sale. After a successful sale the form clears the basket
and replaces the history entry with the sale detail, so starting the next sale
begins empty.

`/sales/[id]` shows one row per batch allocation, proving which FEFO batches
were used. `/sales/[id]/invoice` is outside the `(app)` shell and forces a
light, ink-friendly print layout; use the browser print dialog to print or save
as PDF. There is no server-side PDF generation.

## Returns, adjustments and alerts

On a sale detail, ADMIN and PHARMACIST users can open **Return items**. The
dialog sends one return request with a required reason and the chosen quantities;
the API locks the sale and sale items, checks each remaining quantity, returns
stock to the original batch and updates the sale status. Return history and
reasons appear below the invoice lines. A fully returned line cannot be selected
again.

`/inventory` has an **Adjustments** view and an **Adjust stock** action for ADMIN
and INVENTORY_MANAGER. The adjustment dialog searches batches by medicine or
batch number, then asks for a signed whole-number change and a reason. A note is
required for `OTHER`. The API writes the adjustment and its `ADJUSTMENT` ledger
movement in one transaction and rejects a result below zero; the preview in the
dialog is not authoritative.

`/alerts` shows the three server-calculated alert views (low stock, near expiry
and expired) with counts from the dashboard summary. Search and pagination are
server-side; the alert counts and lists use the same service rules.

## Reports, audit log and settings

`/reports` is role-filtered. ADMIN sees all four reports; PHARMACIST sees the
sales report; INVENTORY_MANAGER sees stock valuation, expiry and reconciliation.
The sales report shows gross totals plus returns for a date range; valuation
shows cost and retail value per batch; expiry groups stock by medicine and
window; reconciliation rebuilds each batch from the ledger and displays a clear
zero-mismatch success state. Dates use the server's UTC calendar, and the API
recalculates every figure.

`/audit-logs` is ADMIN-only. It supports search, action/entity filters, date
filters, server pagination and expandable before/after JSON snapshots.
`/settings` is ADMIN-only and edits `defaultTaxRate` and `nearExpiryDays`; each
change is validated, saved through `PUT /settings`, invalidates affected cache
prefixes and is written to the audit trail.

## Next.js version

This project uses Next.js 16 with Cache Components enabled. Read the
version-matched docs in `node_modules/next/dist/docs/` before changing routing,
data fetching or caching; older Next.js tutorials may describe removed APIs.
