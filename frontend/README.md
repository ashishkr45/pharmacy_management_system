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
    ...            phase placeholders for operations and reports
components/
  auth/            route guards and access-denied state
  catalogue/       catalogue dialogs and status badge
  layout/          sidebar, topbar, brand, theme toggle, user menu
  shared/          DataTable, search input, page header, loading/empty/error states
  ui/              shadcn/ui primitives
lib/
  api/             typed fetch client, shared API types and form-error mapping
  auth/            session storage and auth provider
  hooks/           paginated-list and debounced-value hooks
  navigation.ts    role-aware navigation config
  roles.ts         role labels and helpers
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

## Phase status

F1 (foundation) is complete: API client, login, auth state, guards, responsive
shell, shared table/state components and light/dark/system theming. F2 catalogue
screens are implemented: categories and suppliers list/create, and medicines
list/create/edit with search, filters and pagination. F3 purchases and inventory
are implemented: multi-line receiving, purchase list/detail, batch views,
near-expiry/expired/low-stock views and the stock movement ledger. Sales (F4),
returns/alerts (F5), reports (F6) and the remaining admin screens are scaffolded
placeholders and are implemented in their phases.

## Next.js version

This project uses Next.js 16 with Cache Components enabled. Read the
version-matched docs in `node_modules/next/dist/docs/` before changing routing,
data fetching or caching; older Next.js tutorials may describe removed APIs.
