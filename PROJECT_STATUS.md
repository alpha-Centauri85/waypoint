# Waypoint — Project Status

> Portable status summary. Safe to paste into another chat to bring it up to
> speed. Keep this current as the project evolves; see `ROADMAP.md` for the plan
> and `CLAUDE.md` for full architecture + conventions.

**Last updated:** 2026-07-08

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
- `PATCH /projects/:projectId/tasks/reorder` (body `{ orderedIds }`)
- `GET/POST /projects/:projectId/sections`, `PATCH/DELETE .../sections/:id`, `PATCH .../sections/reorder`
- `GET/POST /labels`, `PATCH/DELETE /labels/:id`
- `GET/POST /templates`, `GET/PATCH/DELETE /templates/:id`, `POST /templates/from-project` (body `{ projectId, name }` to create or `{ projectId, templateId }` to overwrite), `POST /templates/:id/instantiate` (body `{ name, sectionLabels? }`)
- `GET/POST /modules`, `POST /modules/bulk`, `GET/PATCH/DELETE /modules/:id`
- `GET /search?q=` (projects + tasks, user-scoped)
- `GET/POST /statuses`, `PATCH/DELETE /statuses/:id`, `PATCH /statuses/reorder`
- `GET/POST /tasks/:taskId/subtasks`, `PATCH/DELETE /tasks/:taskId/subtasks/:subtaskId`

## Frontend

Built with the **Mantine** v7 component library + **lucide-react** icons (and
`dayjs` for the upcoming date picker). `App.jsx` wraps everything in
`MantineProvider` + `Notifications`, checks `/auth/me`, then renders
login/register (`AuthForm`) or the `Dashboard` (projects sidebar). `TaskList`
shows tasks with a click-to-pick status badge (choose any status); `Subtasks` are
checklist items. All backend calls funnel through `client/src/api.js` (with
`credentials: 'include'`). Auto light/dark theme via Mantine.

## What works today

Full auth, project CRUD **incl. editing** (rename + description via
`ProjectEditModal`), task CRUD **incl. a full edit modal** (`TaskEditModal`:
title, status, priority, due date, notes, labels), subtask CRUD with done-toggle.
Due dates are shown on task rows as a badge (red when overdue); notes surface a
hover-preview icon. Tasks can be **filtered by status and sorted** (manual /
priority / due date / status / title) client-side, and **drag-reordered** (native
HTML5 DnD) in Manual-order view — persisted via a transactional reorder endpoint
that writes `position`; new tasks append. **Phase 1 is complete** (all
task-management features shipped).

**Labels & priority (Waypoint 1):** tasks have a **priority** (0–4: none→urgent)
shown as a colored flag and sortable. A **per-user label library** (`labels` +
`task_labels`, colored) is managed at `/api/labels`; labels are assigned/created
from the task edit modal (`LabelPicker`), embedded in task responses, and shown
as colored chips on rows. Labels are first-class entities (stable ids) — the
foundation for future templates/modules. Tasks can be **filtered by label** (a
Labels popover in both list and board views) and the whole label library can be
**managed** (`LabelManagerModal`: rename / recolor / delete, from the project
actions menu).

**Sections (task grouping):** projects can have **sections** (`sections` +
nullable `tasks.section_id`; deleting a section ungroups its tasks). The task
view renders grouped under section headers (inline rename/delete, per-section
add-task, a "No section" group, add-section control); the task modal has a
Section select. Full drag-and-drop: reorder within a section, drag tasks across
sections, and drag section headers to reorder — all persisted/optimistic. This is
the structural base for modules/templates (see `docs/labels-sections-templates.md`).

**Templates v2 + module library:** a template is a real project blueprint —
`templates` → `template_sections` → `template_tasks` → `template_subtasks`, plus
per-section label "slots" (`template_section_labels`). **Modules** are a separate
reusable library (`modules` → `module_tasks` → `module_subtasks` + `module_labels`),
managed from the header menu → **Module library**: bulk-create (one name per line),
edit, delete, assign labels, edit tasks/subtasks. **Save a project as a template**
captures its sections + tasks + subtasks (ungrouped → "General"). **Instantiate**
builds the fixed skeleton, then **injects** the tasks of every library module whose
labels match a section's slots (appended after fixed tasks). Blueprint task status
is stored as a key and mapped to the user's workflow on instantiate. Editors
(`TemplateEditorModal` = sections + label slots; `ModuleEditorModal`) share a
`BlueprintTasksEditor`; saves are one full-structure POST/PATCH the server rebuilds
transactionally. A one-time v1→v2 data migration runs on startup. Follow-ups:
reorder sections/tasks in the editor, drag between sections.

**Templates v3 — apply labels at project-creation:** templates and the module
library are now **dedicated full pages** (header user menu → `TemplatesPage` /
`ModulesPage`), each a list + a full-width inline editor (`TemplateEditor` /
`ModuleEditor`) — no more cramped modal. A section reads as **standard** (fixed
tasks) or **module-based** (label slots / no fixed tasks).
Starting a project opens `InstantiateTemplateModal`: each module-based section
gets an editable label picker (pre-filled from the template's slots) with a live
preview of which modules will be injected; the choices are sent as `sectionLabels`
overrides so labels can be applied **at creation time**, not just baked into the
template. The editor can **Save & start a project**, and "Save as template" from a
project offers **new or overwrite an existing** template (with a warning). See
`docs/templates-v3/`.

**Board (Kanban) view:** a List/Board toggle per project. The board shows status
columns (To do / In progress / Done) with counts; compact cards (priority, due,
labels, notes) open the edit modal on click; dragging a card between columns
changes its status (`TaskBoard.jsx`). Follow-up: section swimlanes.

**Search:** a debounced global search (`SearchBar`, dashboard) over projects
(name/description) and tasks (title/notes), user-scoped with LIKE wildcards
escaped (`GET /api/search`); the dropdown groups projects + tasks and selecting a
result opens the owning project.

**Custom statuses + Settings:** statuses are **per-user, user-defined** workflow
states (`statuses` table + `tasks.status_id`), seeded lazily (To do / In progress
/ Done) and backfilled from legacy status text by key. A `StatusesProvider`
context feeds board columns, the status filter/sort, the row status picker, the edit
select, search, and progress/overdue (via each status's `is_done`). Managed in a
new **Settings screen** (`SettingsScreen`, from the header menu) alongside global
label management. Migrates to per-account when sharing lands. Templates/modules
store blueprint status as a key and map it to the user's workflow on instantiate.

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

ESLint clean; Prettier clean; 77 passing tests (Vitest — 58 server incl. full
register→project→task→subtask flow, cross-user isolation, error-handling,
validation, security, null-clearing merge, and reorder/append; 19 client incl.
TaskEditModal open→edit→PATCH, `arrangeTasks` sort/filter, and a `moveTask`/DnD
drop→reorder flow); client builds; live end-to-end runs against a real SQLite
file confirmed auth/CRUD, editing, drag-reorder (persisted positions + append +
400 on a bad set), session persistence, helmet headers, and a real 429.

## Conventions

ES imports need file extensions; Prettier authoritative (single quotes,
semicolons, trailing commas, 100 cols); SQLite has no boolean → `done` stored as
0/1; server tests use in-memory DB, client tests stub `fetch`.

## Run

```bash
cd ~/waypoint
cp server/.env.example server/.env   # set a real SESSION_SECRET
npm run dev                          # http://localhost:5173

# Production (single origin — Express serves the built client):
npm run build                        # -> client/dist
NODE_ENV=production npm start         # serves app + API on http://localhost:3000
```

In production Express serves `client/dist` with an SPA fallback (no CORS needed).
`secure` cookies require HTTPS — behind a TLS reverse proxy set `TRUST_PROXY=1`;
for a quick plain-HTTP LAN trial set `SECURE_COOKIES=false`.

## Visual design

The app now implements the **Waypoint brand system** (from `Logo design.png`):
dark-only navy UI, teal primary + amber secondary, Satoshi (display) + Inter
(body), both self-hosted (offline-friendly). Theme in `client/src/theme.js`
(`forceColorScheme="dark"` in `App.jsx`); inline-SVG logo mark in
`components/Logo.jsx`; sticky brand header (`AppFrame`) wraps the dashboard.
Auth, sidebar, task cards, status pills (todo=gray / doing=amber / done=teal),
and modals are all restyled to brand. Verified via headless-Chromium screenshots.

**UX polish (Phase 2):** per-project progress bars in the sidebar + an "X of Y
done / %" summary in the task header (backed by `task_count`/`done_count`
rollups on `GET /projects`, kept live via an `onTasksChanged` callback); first-
load loaders and branded empty states; and every mutation surfaces failures via
`notifyError` toasts instead of failing silently. Drag-reorder is optimistic;
other actions refetch (step 11 optimistic UI still open).

## Design foundation (installed)

Mantine v7 (`@mantine/core`, `@mantine/hooks`, `@mantine/dates`,
`@mantine/notifications`), `lucide-react`, `dayjs`. Toast infrastructure is
wired (Notifications provider + one usage on project create). jsdom polyfills
for `matchMedia`/`ResizeObserver` live in `client/src/setupTests.js`.

## Not yet built (see ROADMAP.md)

Phases 0 + 1 + brand design + Phase 2 (9–10) done. Phase 3: single-origin
production serving ✅ and WAL-safe backups (`npm run db:backup`, git-ignored
`server/data/`) ✅. Remaining: Windows service (13) + HTTPS reverse proxy (14) —
host-specific setup on the media server. Then the expanded product roadmap
(views, reporting/dashboards, labels, search, comments, sharing) or step 11
(optimistic UI).
