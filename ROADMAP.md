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
- [ ] **3. Security basics** (S) — `helmet` for headers + `express-rate-limit`
      on `/api/auth/*` (login/register are the abuse surface).

## Phase 1 — Complete core task management (the actual product)

- [ ] **4. Project editing UI** (S) — rename/edit description. API
      (`PATCH /projects/:id`) already exists; only the UI is missing.
- [ ] **5. Task detail + editing** (M) — edit title, notes, due date. The DB
      columns (`notes`, `due_date`) already exist but are unused in the UI.
      _Depends on 2._
- [ ] **6. Due dates surfaced** (M) — date picker, display due dates, highlight
      overdue. _Depends on 5._
- [ ] **7. Sort & filter tasks** (M) — by status and due date. _Depends on 6._
- [ ] **8. Drag-to-reorder tasks** (L) — the `position` column exists but is
      never written; add a reorder endpoint + DnD in the UI. _Depends on 7._

## Phase 2 — UX polish (makes it feel finished)

- [ ] **9. Loading / empty / error states + toasts** (M) — failures are
      currently silent. _Depends on 1._
- [ ] **10. Progress indicators** (S) — task counts / % done per project in the
      sidebar.
- [ ] **11. Optimistic UI or debounced refresh** (M) — app refetches after every
      action today; smooth this out.

## Phase 3 — Deploy on the Windows media server (can start after Phase 1)

- [ ] **12. Serve the client from Express in production** (S) — single origin
      removes CORS/HTTPS cookie friction. Big self-hosting simplification.
- [ ] **13. Run as a Windows service** (M) — `nssm` or `node-windows` so it
      survives reboots.
- [ ] **14. HTTPS** (M) — reverse proxy (Caddy/IIS) so `secure` session cookies
      work. _Depends on 12–13._
- [ ] **15. SQLite backup job** (S) — scheduled WAL-safe copy of `waypoint.db`.
      Do before relying on real data.

## Phase 4 — Bigger features (pick based on need)

- [ ] **16. Labels/tags & priority**
- [ ] **17. Search**
- [ ] **18. Comments / activity log**
- [ ] **19. Project sharing (multi-user collaboration)**
- [ ] **20. Due-date notifications / reminders**

## Recommended next step

Phase 0, then **step 4 or 5** — due dates and notes are already in the schema
and just need UI, so they're fast, visible wins.
