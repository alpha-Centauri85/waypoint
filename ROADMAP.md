# Waypoint — Roadmap

Build order is dependency-aware: each step unblocks the next and the app stays
usable throughout. Size is a rough estimate (S/M/L). Update statuses as you go.

Status key: `[ ]` todo · `[~]` in progress · `[x]` done

## Phase 0 — Harden the foundation (do first; cheap, prevents rework)

- [x] **1. Global error handler + async safety** (S) — central `errorHandler`
      (`server/src/middleware/errorHandler.js`) returns clean JSON for known
      (`HttpError`), malformed-JSON, and SQLite-constraint errors, and a generic 500
      (logged, no internals leaked) for anything else. `HttpError` helpers +
      `asyncHandler` live in `server/src/lib/errors.js`; routes now `throw`
      `badRequest`/`notFound`/`conflict`/`unauthorized` instead of hand-writing
      responses. Covered by `server/test/error-handling.test.js`.
- [x] **2. Input validation layer** (M) — adopted `zod` (v4). Per-resource
      schemas live in `server/src/schemas/`; a single `validateBody(schema)`
      middleware (`server/src/lib/validate.js`) parses each request body, replaces
      it with the coerced result (unknown keys stripped, defaults applied, emails
      trimmed + lower-cased), and throws a 400 with a readable message on failure.
      Routes no longer hand-check fields. Covered by `server/test/validation.test.js`.
- [x] **3. Security basics** (S) — `helmet()` sets security response headers
      (registered first in `app.js`); `express-rate-limit` guards the credential
      endpoints. A `makeRateLimiter` factory + preconfigured `authLimiter`
      (`server/src/middleware/rateLimit.js`) funnel a 429 through the central
      error handler; applied to `POST /auth/login` + `/auth/register` only (so
      `/me`/`/logout` stay unthrottled), disabled under test. Limits configurable
      via `AUTH_RATE_WINDOW_MS`/`AUTH_RATE_MAX` (default 20/15min). Covered by
      `server/test/security.test.js`.

## Phase 1 — Complete core task management (the actual product)

- [x] **4. Project editing UI** (S) — `ProjectEditModal` (pencil icon in the
      sidebar) renames a project and edits/clears its description via
      `PATCH /projects/:id` (`updateProject` added to `client/src/api.js`).
- [x] **5. Task detail + editing** (M) — `TaskEditModal` (pencil icon per task)
      edits title, status, due date, and notes. Backend `updateTask`/
      `updateProject` now merge by key presence, so an explicit `null` clears a
      nullable field (due date / notes / description) while omitted fields are
      left untouched.
- [x] **6. Due dates surfaced** (M) — Mantine `DatePickerInput` in the task
      modal; due dates show as a badge on each task row, highlighted red when
      overdue (past due and not done). Notes show a hover-preview icon.
- [x] **7. Sort & filter tasks** (M) — status filter (SegmentedControl: all/todo/
      doing/done) + sort (manual/due date/status/title) in `TaskList`, applied
      client-side by a pure `arrangeTasks(tasks, statusFilter, sortBy)` helper
      (due dates sort chronologically, no-due-date last; non-mutating). Covered by
      `client/src/components/TaskList.test.jsx`.
- [x] **8. Drag-to-reorder tasks** (L) — `PATCH /projects/:id/tasks/reorder`
      (`reorderTasks` model, transactional, validates a full permutation of the
      project's task ids) rewrites `position`; new tasks now append (position =
      max+1). Native HTML5 DnD in `TaskList` (grip handle, optimistic update via
      the pure `moveTask` helper), enabled only in Manual order + All filter.
      Covered server-side (`api.test.js`) and client-side (`TaskList.test.jsx`).

**Phase 1 is complete.** Phase 2 steps 9–10 done (11 partial).

## Phase 2 — UX polish (makes it feel finished)

- [x] **9. Loading / empty / error states + toasts** (M) — every mutation now
      routes failures through `notifyError` (`client/src/notify.js`) instead of
      failing silently; projects and tasks show loaders on first load and
      branded empty states.
- [x] **10. Progress indicators** (S) — `GET /projects` returns `task_count` /
      `done_count` rollups; the sidebar shows a per-project progress bar + count,
      and the task view header shows "X of Y done" + %. Kept in sync by a
      `onTasksChanged` callback from `TaskList` → `Dashboard`.
- [~] **11. Optimistic UI or debounced refresh** (M) — drag-reorder is already
  optimistic; other actions still refetch. Revisit if it feels sluggish.

## Phase 3 — Deploy on the Windows media server (can start after Phase 1)

- [x] **12. Serve the client from Express in production** (S) — with
      `NODE_ENV=production` (or `SERVE_CLIENT=true`), Express serves `client/dist` + an SPA fallback (non-`/api` paths → `index.html`); CORS is skipped
      (same-origin) and a SPA-tuned CSP is applied. Cookie `secure` and
      `trust proxy` are now config-driven (`SECURE_COOKIES`, `TRUST_PROXY`) for
      running behind a TLS proxy. Build with `npm run build`, then `npm start`.
- [ ] **13. Run as a Windows service** (M) — `nssm` or `node-windows` so it
      survives reboots.
- [ ] **14. HTTPS** (M) — reverse proxy (Caddy/IIS) so `secure` session cookies
      work. _Depends on 12–13._
- [x] **15. SQLite backup job** (S) — `npm run db:backup --workspace server`
      writes a WAL-safe snapshot (better-sqlite3 online `.backup()`) to
      `BACKUP_DIR` (default `server/data/backups`), keeping the newest
      `BACKUP_KEEP` (default 14). Schedule via cron / Task Scheduler (see README).
      Also stopped tracking the live DB in git (added `server/data/` to
      `.gitignore`). Covered by `server/test/backup.test.js`.

## Phase 4 — Bigger features (pick based on need)

- [x] **16. Labels/tags & priority** — task `priority` (0–4) with a select,
      row flag, and priority sort. **Per-user label library** (`labels`), shared
      across tasks (`task_labels`) **and projects** (`project_labels`) — one pool,
      no scope flag; scope lives in the association (see
      `docs/labels-sections-templates.md`). CRUD at `/api/labels`; assign/create
      from the task & project edit modals (`LabelPicker`), embedded in responses
      (foreign ids ignored), colored chips on rows. Labels are first-class (stable
      ids) so they can key future templates/modules. _Follow-ups:_ filter by
      label + a label management UI. Covered by `server/test/labels.test.js`.
- [x] **16b. Sections (task grouping)** — `sections` table + nullable
      `tasks.section_id` (deleting a section ungroups its tasks). Full CRUD +
      reorder at `/api/projects/:id/sections`; tasks carry a `sectionId`
      (validated to the same project). UI groups tasks under section headers
      (rename/delete inline, per-section add-task, "No section" group, add-section
      control); the task modal has a Section select. Full drag-and-drop: reorder
      tasks within a section, **drag tasks across sections** (drop on a task or a
      section's area), and **drag section headers to reorder** — all persisted and
      optimistic. Covered by `server/test/sections.test.js` +
      `client/src/components/TaskList.test.jsx` (within- and cross-section drag).
- [x] **Board (Kanban) view** — a List/Board toggle per project (`TaskList`);
      the board (`TaskBoard.jsx`) shows status columns (To do / In progress /
      Done) with counts. Cards are compact (title + priority/notes/due/labels) and
      open the edit modal on click; dragging a card to a column sets that status.
      Covered by a board drag test in `TaskList.test.jsx`. _Follow-up:_ section
      swimlanes on the board.
- [x] **17. Search** — global search over the user's projects (name/description)
      and tasks (title/notes), scoped by `user_id`, LIKE wildcards escaped.
      `GET /api/search?q=`; `SearchBar` in the dashboard debounces (2+ chars) and
      shows a results dropdown (projects + tasks with status/project); selecting a
      result opens the owning project. Covered by `server/test/search.test.js` +
      `client/src/components/SearchBar.test.jsx`. _Follow-up:_ jump straight to a
      task (open its detail), and label/status facets.
- [ ] **18. Comments / activity log**
- [ ] **19. Project sharing (multi-user collaboration)**
- [ ] **20. Due-date notifications / reminders**
- [~] **21. Templates & modules** — reusable project blueprints composed of
  modules (saved sections). Model: `templates` → `template_modules` →
  `modules` → `module_tasks`. **Save a project as a template** (sections →
  modules, ungrouped → a "General" module) and **start a new project from a
  template** (instantiates sections + tasks). API under `/api/templates`
  (`from-project`, `:id/instantiate`, list/get/delete). UI: "Save as template"
  in the project actions menu + "Start from a template" picker in the sidebar.
  Covered by `server/test/templates.test.js`. _Follow-ups:_ a dedicated
  module/template editor (edit modules, reorder, reuse a module across
  templates), and carrying labels/due dates into blueprints.

## Recommended next step

Phases 0–1 complete; brand design implemented; Phase 2 steps 9–10 done; Phase 3
steps 12 (single-origin serving) + 15 (backups) done. Remaining Phase 3 work —
**13 (Windows service)** and **14 (HTTPS reverse proxy)** — is host-specific
setup on the media server itself (scripts + a deploy guide, not app code). After
that: the **expanded product roadmap** (custom views, reporting/dashboards,
labels, search, comments, sharing) or step 11 (optimistic UI) polish.
