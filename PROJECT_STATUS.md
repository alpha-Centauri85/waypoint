# Waypoint — Project Status

> Portable status summary. Safe to paste into another chat to bring it up to
> speed. Keep this current as the project evolves; see `ROADMAP.md` for the plan
> and `CLAUDE.md` for full architecture + conventions.

**Last updated:** 2026-07-06

## What it is

Waypoint is a self-hostable, multi-user project-management web app. Users sign
in, then manage **projects → tasks → subtasks**. Intended to run on a Windows
home media server. Lives at `~/waypoint`, git-initialized.

## Stack

npm-workspaces monorepo, plain JavaScript (no TypeScript), ES modules, Node ≥20.

- **client/** — Vite + React frontend
- **server/** — Express API + SQLite

## Data layer

SQLite via `better-sqlite3` (single native module, ships prebuilt Windows
binaries → `npm install` just works on Windows). One DB file:
`server/data/waypoint.db`. Schema: `users → projects → tasks → subtasks`, all
with `ON DELETE CASCADE`, foreign keys enforced. Every query is scoped to the
logged-in user, so users only see their own data. Plain SQL in per-table modules
under `server/src/models/` — no ORM.

## Auth

Cookie sessions (`express-session`), session store is the same SQLite file
(`better-sqlite3-session-store`), passwords hashed with `bcryptjs`. `requireAuth`
middleware guards protected routes via `req.session.userId`.

## API (all under `/api`)

- `POST /auth/register|login|logout`, `GET /auth/me`
- `GET/POST /projects`, `GET/PATCH/DELETE /projects/:id`
- `GET/POST /projects/:projectId/tasks`, `GET/PATCH/DELETE /projects/:projectId/tasks/:taskId`
- `GET/POST /tasks/:taskId/subtasks`, `PATCH/DELETE /tasks/:taskId/subtasks/:subtaskId`

## Frontend

Built with the **Mantine** v7 component library + **lucide-react** icons (and
`dayjs` for the upcoming date picker). `App.jsx` wraps everything in
`MantineProvider` + `Notifications`, checks `/auth/me`, then renders
login/register (`AuthForm`) or the `Dashboard` (projects sidebar). `TaskList`
shows tasks with a click-to-cycle status badge (todo→doing→done); `Subtasks` are
checklist items. All backend calls funnel through `client/src/api.js` (with
`credentials: 'include'`). Auto light/dark theme via Mantine.

## What works today

Full auth, project CRUD **incl. editing** (rename + description via
`ProjectEditModal`), task CRUD **incl. a full edit modal** (`TaskEditModal`:
title, status, due date, notes), subtask CRUD with done-toggle. Due dates are
shown on task rows as a badge (red when overdue); notes surface a hover-preview
icon. Only the `position` column remains unused (drag-reorder, step 8).

## Error handling

Central Express error handler (`server/src/middleware/errorHandler.js`),
registered last in `app.js`: returns clean JSON for `HttpError` (thrown via
`badRequest`/`notFound`/`conflict`/`unauthorized` helpers in
`server/src/lib/errors.js`), malformed JSON (400), and SQLite constraint
violations (409); unexpected errors are logged and return a generic 500 with no
internals leaked. `asyncHandler` is available for future async routes.

## Input validation

All request bodies are validated with **zod** (v4). Per-resource schemas live in
`server/src/schemas/` (`auth`, `projects`, `tasks`, `subtasks`); a single
`validateBody(schema)` middleware (`server/src/lib/validate.js`) parses the body,
**replaces `req.body`** with the coerced result (unknown keys stripped, defaults
applied, strings trimmed, emails lower-cased), and throws a 400 whose message
names the offending field(s). Routes no longer hand-check inputs, so bad data is
rejected before it reaches a model (e.g. an invalid task `status` is now a 400,
not a DB constraint 409). Task `dueDate` must be `YYYY-MM-DD`.

## Security

`helmet()` sets security response headers (registered first in `app.js`;
`X-Powered-By` removed). `express-rate-limit` guards the credential endpoints: a
`makeRateLimiter` factory + preconfigured `authLimiter`
(`server/src/middleware/rateLimit.js`) return a 429 (via the central error
handler) once the limit is hit; applied to `POST /auth/login` + `/auth/register`
only, so `/me` (called on every page load) and `/logout` stay unthrottled.
Disabled under test; limits set by `AUTH_RATE_WINDOW_MS`/`AUTH_RATE_MAX`
(default 20 attempts / 15 min per IP). **Phase 0 is now complete.**

## Verified

ESLint clean; Prettier clean; 26 passing tests (Vitest — 23 server incl. full
register→project→task→subtask flow, cross-user isolation, error-handling,
validation, security, and the presence-based null-clearing merge; 3 client incl.
a TaskEditModal open→edit→PATCH flow); client builds; live end-to-end run against
a real SQLite file confirmed auth/CRUD, editing (set/keep/clear due date+notes,
rename project + clear description), session persistence, helmet headers, and a
real 429 on the 3rd rapid login.

## Conventions

ES imports need file extensions; Prettier authoritative (single quotes,
semicolons, trailing commas, 100 cols); SQLite has no boolean → `done` stored as
0/1; server tests use in-memory DB, client tests stub `fetch`.

## Run

```bash
cd ~/waypoint
cp server/.env.example server/.env   # set a real SESSION_SECRET
npm run dev                          # http://localhost:5173
```

## Design foundation (installed)

Mantine v7 (`@mantine/core`, `@mantine/hooks`, `@mantine/dates`,
`@mantine/notifications`), `lucide-react`, `dayjs`. Toast infrastructure is
wired (Notifications provider + one usage on project create). jsdom polyfills
for `matchMedia`/`ResizeObserver` live in `client/src/setupTests.js`.

## Not yet built (see ROADMAP.md)

Phase 0 + Phase 1 steps 4–6 done. Next: sort/filter tasks (7), drag-reorder (8),
UX polish (loading/empty states, progress indicators), production static serving,
Windows service + HTTPS + backups.
