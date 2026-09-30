# Metalix web (frontend)

The browser app for the Metal Scrap Management System. It talks to the backend in
`../Backend` (`/api/v1`) and follows the design in `../Backend/reports/Metalix UI UX System.pdf`.

**Stack:** Vite 8 · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui on **Base UI** (`base-nova`)
· TanStack Router (file routes) / Query / Table · React Hook Form + Zod 4 · big.js · Recharts 3 · Sonner.

## Run it with the backend

1. Start the backend (in `../Backend`):
   ```bash
   npm run dev
   ```
   It listens on `http://localhost:4000`. If no one can log in yet, create the owner once:
   ```bash
   node scripts/create-owner.js you@example.com "Your-Strong-Password" --name "Your Name"
   ```
2. Start the frontend (in this folder):
   ```bash
   npm install
   npm run dev
   ```
3. Open `http://localhost:5173` and log in with the owner account.

In development the browser only talks to `localhost:5173`; Vite forwards `/api/*` to the backend
(`VITE_DEV_API_TARGET`, default `http://localhost:4000`), so no CORS setup is needed.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 5173 with hot reload |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the built app on port 4173 (also proxies `/api`) |
| `npm run check` | Type-check + lint + unit tests (run before handing over) |
| `npm run test` / `test:watch` | Vitest unit tests |
| `npm run format` | Prettier on `src/` (vendored `components/ui` excluded) |

## Configuration

Copy `.env.example` to `.env.local` when you need to change something. Only `VITE_*` values reach the
browser, so never put secrets there.

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/v1` | API base used by the browser. For a production build served from another origin, set the full URL and add the frontend origin to the backend's `CORS_ORIGINS`. |
| `VITE_DEV_API_TARGET` | `http://localhost:4000` | Where the dev/preview server proxies `/api` |
| `VITE_BUSINESS_TIMEZONE` | `Asia/Kolkata` | Must match the backend's `BUSINESS_TIMEZONE` |

## How sign-in works

- `POST /auth/login` returns a 15-minute access token and a rotating 7-day refresh token.
- The access token lives in memory only. The refresh token is kept in `localStorage` so a reload or
  new tab stays signed in (the backend returns it in the JSON body, so there is no cookie option).
- When a request gets `TOKEN_EXPIRED`, the client refreshes once and retries. Refresh is single-flight
  and serialised across tabs with the Web Locks API, so the rotating token is never used twice.
- Logging out in one tab logs out every tab. When a session ends, the app returns to `/login?redirect=…`
  and goes back to the same page after login.
- OWNER sees write actions; VIEWER sees the same screens with write actions hidden ("View only").

## Code layout

```
src/
  routes/            TanStack file routes (__root, login, _app layout + one folder per section)
  components/ui/     shadcn CLI output only (vendored; edits logged in CHANGES.md)
  components/layout/ app shell: sidebar, header, phone bottom bar, Ctrl+K palette, shortcuts
  components/common/ app composites: DataTable, FilterBar, FormSheet, FormField, ErrorSummary,
                     TonsInput/RateInput, ConfirmDialog, StatusBadge, RecordCard, StatCard, EmptyState, …
  features/<area>/   screen code and API queries (auth, dashboard, sales-orders, …)
  lib/               api-client, format (₹ / tons / dates), decimal (big.js), fy presets, errors, notify
  types/api.ts       response shapes of the backend
```

Rules the code follows:

- Numbers: all display formatting goes through `lib/format.ts` (en-IN grouping, 3 dp tons, 2 dp ₹,
  custom lakh/crore compact on KPI tiles only). All arithmetic on tons/rates/money uses `lib/decimal.ts`.
- Dates: business dates are `YYYY-MM-DD` strings and are never passed through `toISOString()`.
- Toasts only through `lib/notify.ts`; Base UI only through `components/ui` (enforced by ESLint).

## Keyboard

The same list is in the app: press `?`, or open "Help & shortcuts" (sidebar, account menu, phone "More").

| Keys | Action |
|---|---|
| Ctrl+K | Search or jump to a page |
| Alt+P / Alt+O / Alt+D (F9 / F8) | New purchase / sales order / delivery |
| Ctrl+B | Collapse or expand the sidebar |
| ? | Help & shortcuts |
| / | Focus the list search |
| Enter | In a form: next field (the last field saves) |
| Ctrl+Enter or Ctrl+S | Save the open form |
| Alt+C | In a supplier/buyer/material picker: add the typed name as a new record |
| Esc | Close the form (asks first when something was typed) |

## Work is never lost

- **Drafts:** new purchases, sales orders and deliveries are kept in `localStorage` while you type
  (per user, per form, for 7 days) and come back with a "Start over" option the next time that form
  opens. Saving, or choosing "Leave" after the unsaved-changes warning, forgets the draft.
- **Session expiry:** when the session ends while the app is open, a "Log in again to continue" dialog
  appears over the page instead of leaving it, so an open form keeps what was typed. Logging in again in
  any tab resumes the others; logging out in one tab still logs out all of them.

## Production hosting

The simplest setup is one Node process: build this app (`npm run build`), then start the backend with
`WEB_DIST_DIR=../Frontend/dist` and open the backend's address. The page and the API share one
origin, so there is no CORS to configure. Details, caching and the static-host alternative are in
`../Backend/README.md`, section "Production deployment". The theme is applied before first paint by
`public/theme-init.js` (a file, not an inline script, so a strict Content-Security-Policy can allow
only the app's own scripts).

## Build progress

| Phase | Scope | Status |
|---|---|---|
| 1 | Project setup, design tokens, API client + auth, app shell, login, live dashboard KPIs | Done |
| 2 | Shared table / filter / form building blocks; Companies and Materials (list, create/edit, deactivate, detail pages) | Done |
| 3 | Purchases (last rate, repeat, save & add another); Sales Orders with quick views, detail page, cancel/reopen | Done |
| 4 | Deliveries: list, record/edit form with the live limits panel, order picker, smart defaults (+ backend `GET /sales/capacity`) | Done |
| 5 | Full dashboard (period control, comparisons, needs attention, stock vs orders, trend chart, recent activity); Supplier stock; Company report (+ backend `GET /reports/trend`) | Done |
| 6 | Polish: form drafts, re-login dialog, Enter-to-next, inline "+ Add" in pickers (Alt+C), Help & shortcuts, focus/mobile pass, production hosting (+ backend `WEB_DIST_DIR`) | Done |
