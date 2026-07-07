# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Waypoint is a multi-user project-management web app: users sign in, then manage
**projects → tasks → subtasks**. It is organized as npm workspaces:

- `client/` — Vite + React frontend (plain JS/JSX)
- `server/` — Express JSON API backed by SQLite (plain JS)

Everything is ES modules (`"type": "module"`) and requires Node >= 20. There is
no TypeScript. Data lives in a single SQLite file (`server/data/waypoint.db`);
sessions are stored in the same file, so there is no separate database service
to run — this is intended to be self-hosted (e.g. on a Windows media server),
where `npm install` fetches a prebuilt `better-sqlite3` binary.

## Commands

Run from the repo root unless noted.

- `npm install` — install all workspace deps (once, from root)
- `npm run dev` — run client (:5173) and server (:3000) together
- `npm run dev:client` / `npm run dev:server` — run one side only
- `npm run build` — production build of the client → `client/dist`
- `npm start` — run the API server
- `npm test` — run tests in every workspace
- `npm run lint` — ESLint over the whole repo
- `npm run format` / `npm run format:check` — Prettier write / verify
- `npm run db:migrate --workspace server` — create/upgrade the SQLite file

Running a single test (Vitest):

- Client: `npm test --workspace client -- src/App.test.jsx`
- Server: `npm test --workspace server -- api`
- Filter by name: append `-t "partial test name"`

## Architecture

**Client ↔ server contract:** the client calls the API under `/api`. In dev,
Vite proxies `/api` → `http://localhost:3000` (`client/vite.config.js`), so
requests are same-origin and the session cookie flows without CORS config.

**Production (single origin):** with `NODE_ENV=production` (or `SERVE_CLIENT=true`)
the server serves the built `client/dist` plus an SPA fallback (any non-`/api`
GET → `index.html`, registered after the `/api` 404 so the API never returns
HTML), and skips CORS since everything is same-origin. A SPA-tuned CSP is applied
only when serving the client. Cookie `secure` (`SECURE_COOKIES`) and Express
`trust proxy` (`TRUST_PROXY`) are config-driven so it can run behind a
TLS-terminating reverse proxy. Split-origin deploys (separate client host) still
work: leave `SERVE_CLIENT` off, set `VITE_API_URL`, and CORS is restricted to
`CLIENT_ORIGIN` with `credentials: true`.

**Auth & sessions:** cookie sessions via `express-session`, stored in SQLite
(`better-sqlite3-session-store`) except under test (in-memory). Passwords are
hashed with `bcryptjs` (pure JS — no native build). `requireAuth` guards
protected routers by checking `req.session.userId`.

**Data model (SQLite):** `users` 1—* `projects` 1—* `tasks` 1—* `subtasks`,
each child with `ON DELETE CASCADE`. A project also 1—* `sections` (task
groupings); `tasks.section_id` is a nullable FK with `ON DELETE SET NULL`
(deleting a section ungroups its tasks). Tasks carry a `priority` (0–4) and link
many-to-many to a per-user label library (`labels` + `task_labels`); the same
pool tags projects via `project_labels`. Task/project API responses embed a
`labels` array; `labelIds` on create/update replaces the labels (ids the user
doesn't own are ignored). A task's `sectionId` is validated to the same project.
Task status is a **per-user custom workflow**: a `statuses` table (name, color,
position, `is_done`, `key`) with `tasks.status_id` FK — not a fixed enum. Defaults
(To do/In progress/Done) are seeded lazily by `models/statuses.js` (`ensureStatuses`,
called from `/auth/me`, login, register) and legacy `tasks.status` text is
backfilled by key; the client reads status display from a `StatusesProvider`
context by `status_id`. `is_done` drives progress + overdue. Additive column
changes use the idempotent `ensureColumn` helper in `db/index.js` (a fuller
versioned-migration system is still on the roadmap).
**Templates (v2)** are reusable project blueprints: `templates` →
`template_sections` → `template_tasks` → `template_subtasks`, plus per-section
label "slots" (`template_section_labels`). Blueprint task status is stored as a
key and mapped to the user's workflow on instantiate. **Modules** are a separate
reusable library — `modules` → `module_tasks` → `module_subtasks` + labels
(`module_labels`) — not template-private. "Save as template" captures a project's
sections + tasks + subtasks (ungrouped tasks → a "General" section). "Instantiate"
creates the fixed skeleton, then **injects** the tasks of every library module
whose labels match a section's slots (appended after the fixed tasks). Both reuse
`createProject`/`createSection`/`createTask`/`createSubtask` inside a
`db.transaction` (models may compose other models, but only labels/sections/tasks/
subtasks are leaf modules — avoid import cycles). Templates and the module library
are **dedicated full pages** (header user menu → `TemplatesPage`/`ModulesPage`,
switched via `App`'s `view` state), each a list + a full-width inline editor
(`TemplateEditor`/`ModuleEditor`) sharing a `BlueprintTasksEditor`. Starting a
project from a template opens `InstantiateTemplateModal` (apply labels per
module-based section); it returns the new project so `App` selects it on the
dashboard. "Save as template" from a project is `SaveAsTemplateModal` (new or
overwrite).
**Activity log:** an append-only `activities` table (user-scoped; `project_id`
cascades, `task_id` `ON DELETE SET NULL`). Route handlers call
`logActivity(userId, {...})` (`models/activities.js`) after a successful mutation
with a human summary composed at that point (it has the task/status/project
context); logging swallows its own errors so it can never break the mutation.
`GET /api/activities?projectId=&taskId=&limit=` reads it back
(`listActivities`, always user-scoped); the client renders a per-project
`ActivityDrawer`. When you add a new mutation worth surfacing, add a
`logActivity` call in its route handler — don't log from models (they stay pure
DB). **Comments** are a per-task thread (`comments` table, cascades with the task;
`user_id` author + `updated_at`), a nested router at
`/api/tasks/:taskId/comments` (guarded by `getTaskForUser` like subtasks;
edit/delete are author-scoped by `user_id`); adding one also logs a
`comment.added` activity. The client renders them in `TaskEditModal` via
`Comments.jsx`. Foreign keys are enforced per-connection
via `PRAGMA foreign_keys = ON` in `server/src/db/index.js`. **Ownership is
enforced in every query**: project reads/writes are scoped by `user_id`, task
queries by `project_id`, and subtask authorization joins task→project→user
(`getTaskForUser`). Never trust an id from the URL without this scoping.

**Sharing / access control:** projects can be shared (owner/editor/viewer). The
owner is `projects.user_id`; `project_members` holds editor/viewer collaborators;
`project_invites` are shareable tokens (`models/members.js`). Authorize with
`getProjectAccess(projectId, userId) → { project, role } | null` — **every**
project/task/section/subtask/comment guard uses it (not the old owner-only
`getProject`). Viewers are read-only: guards throw `forbidden` (403) on non-GET.
Delete + member management are owner-only. Because statuses and labels are
per-user, a shared project resolves them against the **owner**: task routes
validate/default status + assign labels against `req.project.user_id`, and
`GET /projects/:id/statuses` + `/labels` expose the owner's sets (client wraps the
project view in `ProjectStatusesProvider` and passes `projectId` to `LabelPicker`).
When adding project-scoped reads/writes, authorize via `getProjectAccess` and
scope statuses/labels to the owner — don't reintroduce a bare `user_id` check.

**Server layout (`server/src`):**

- `index.js` — entry point; only starts the HTTP listener.
- `app.js` — `createApp()` wires middleware + routers and returns the app
  (no port binding, so tests drive it with supertest).
- `config.js` — all env read here into a `config` object, not `process.env`.
- `db/` — `index.js` opens the connection and applies `schema.sql` on load
  (idempotent, so prepared statements in models always have their tables);
  `migrate.js` backs `npm run db:migrate`.
- `models/` — one module per table; each prepares its SQL statements at import
  time and exposes plain functions. This is the only place that touches the DB.
- `routes/` — one router per resource, mounted in `app.js`. Nested routers
  (`tasks`, `subtasks`) use `Router({ mergeParams: true })` and a `router.use`
  guard that loads+authorizes the parent and attaches it to `req`.
- `middleware/requireAuth.js` — session gate.
- `middleware/rateLimit.js` — `express-rate-limit`. `makeRateLimiter(opts)`
  funnels a 429 through the central error handler; the preconfigured
  `authLimiter` guards `POST /auth/login` + `/auth/register` (the abuse surface)
  and is skipped under test. `helmet()` (security headers) is registered first in
  `app.js`.
- `schemas/` — one zod (v4) module per resource. Routes pass a schema to the
  `validateBody(...)` middleware (`lib/validate.js`), which parses `req.body`,
  **replaces it** with the coerced result (unknown keys stripped, defaults
  applied, strings trimmed), and throws a 400 with a readable message on failure.
  Handlers therefore trust `req.body` and never hand-check fields. Because
  validation runs before models, bad input yields a 400 (not a DB-constraint 409).

**Client layout (`client/src`):**

- `api.js` — every backend call lives here (all use `credentials: 'include'`);
  components never call `fetch` directly.
- `App.jsx` — wraps everything in `<MantineProvider>` + `<Notifications />`,
  checks `/api/auth/me` on load, and renders `AuthForm` or `Dashboard`.
- `components/` — `AuthForm`, `Dashboard` (projects sidebar) + `ProjectEditModal`,
  `TaskList` (status filter / sort via the pure `arrangeTasks` helper; native
  HTML5 drag-reorder via the pure `moveTask` helper + `PATCH .../tasks/reorder`,
  optimistic, enabled only in Manual-order + All view) with a **List/Board view
  toggle** (`TaskBoard.jsx` = Kanban status columns; drag a card to change
  status) + `TaskEditModal` (title/status/priority/section/due-date/notes/labels),
  `TaskCard`, `Subtasks`. Edit
  modals take the row being edited (or `null` when closed), seed local state from
  it in an effect, and call an `onSaved` refresh + `onClose` after a successful
  PATCH. Due dates use `@mantine/dates` `DatePickerInput` (Date ↔ `YYYY-MM-DD`
  string via `dayjs`).

**UI / design:** [Mantine](https://mantine.dev) v7 component library +
`lucide-react` icons + `dayjs`. Build UIs from Mantine components rather than raw
HTML/CSS; toasts go through `notifications.show(...)` from `@mantine/notifications`.

The app follows a **defined brand system** (see `Logo design.png`). The Mantine
theme lives in `client/src/theme.js`: brand navy mapped onto the `dark` scale
(index 7 = app bg, 6 = cards, 5 = inputs/hover, 4 = borders), **teal** primary +
**amber** secondary custom palettes, and the type scale (Satoshi headings, Inter
body). It is **dark-only** — `App.jsx` sets `forceColorScheme="dark"`; do not
reintroduce a light theme without a brief for it. Fonts are **self-hosted** (no
CDN, so it works offline on the media server): Inter via `@fontsource-variable/inter`,
Satoshi as woff2 in `src/assets/fonts/` (`satoshi.css`), both imported in
`main.jsx`. The logo is `components/Logo.jsx` (inline-SVG mark + Satoshi wordmark);
the signed-in shell (sticky brand header) is `AppFrame` inside `App.jsx`.
`MantineProvider` (with the theme) lives in `App.jsx` so tests that render `<App />`
get theme context for free. `setupTests.js` polyfills `matchMedia`/`ResizeObserver`.
Prefer theme tokens (`c="dark.2"`, `color="teal"`, `var(--mantine-color-*)`) over
hard-coded hex so the brand stays consistent.

## Adding features

- **New resource:** add a table to `schema.sql`, a module in `models/`, a zod
  schema in `schemas/`, a router in `routes/` (guard write routes with
  `validateBody(schema)`), mount it in `app.js`, and add calls to
  `client/src/api.js`.
- **Schema changes:** `schema.sql` only uses `IF NOT EXISTS`; it does not alter
  existing tables. For a real migration, add a versioned step rather than
  editing table definitions in place.

## Conventions

- ES module imports must include the file extension (`./app.js`, `./App.jsx`).
- Prettier is authoritative (single quotes, semicolons, trailing commas, 100
  cols). Run `npm run format` before committing.
- SQLite has no boolean type: `done` is stored as `0`/`1`.
- Tests use Vitest. Server tests run against an in-memory DB configured in
  `server/test/setup.js`; client tests run in jsdom with Testing Library and
  stub `fetch`.
