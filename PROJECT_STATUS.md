# Waypoint — Project Status

> Portable status summary. Safe to paste into another chat to bring it up to
> speed. Keep this current as the project evolves; see `ROADMAP.md` for the plan
> and `CLAUDE.md` for full architecture + conventions.

**Last updated:** 2026-07-05

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

`App.jsx` checks `/auth/me` then renders login/register (`AuthForm`) or the
`Dashboard` (projects sidebar). `TaskList` shows tasks with a click-to-cycle
status pill (todo→doing→done); `Subtasks` are checklist items. All backend calls
funnel through `client/src/api.js` (with `credentials: 'include'`).

## What works today

Full auth, project CRUD, task CRUD (title + status in UI; `notes`/`due_date`/
`position` columns exist but are **not yet used in the UI**), subtask CRUD with
done-toggle.

## Verified

ESLint clean; 8 passing tests (Vitest — 6 server incl. full
register→project→task→subtask flow and cross-user isolation, 2 client); client
builds; live end-to-end run against a real SQLite file confirmed all of the above
plus session persistence.

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

## Not yet built (see ROADMAP.md)

Global error handling, validation library, security headers/rate limiting,
project/task editing UI, due-date UI, sorting/filtering, drag-reorder, production
static serving, Windows service + HTTPS + backups.
