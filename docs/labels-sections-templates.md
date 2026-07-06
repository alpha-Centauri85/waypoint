# Design note — Labels, Sections, Modules & Templates

Status: **accepted** (2026-07-06). Captures the product/data model behind labels
and the planned templates system, so later work stays consistent. See
`ROADMAP.md` for sequencing.

## The three roles (keep them separate)

Early discussion bundled several ideas under "labels." They are distinct:

1. **Annotation labels** — freeform tags for filter/search (`#legal`,
   `#client-acme`, `#urgent`). _Shipped._
2. **Sections** — a named grouping of tasks _inside_ a project ("Customer
   Introduction"). Structural, everyday organization. _Planned._
3. **Modules & Templates** — a **module** is a reusable **section blueprint** (a
   named bundle of task blueprints); a **template** is an ordered set of modules.
   Instantiating a template builds a project whose sections come from its
   modules. _Planned (Waypoint 5)._

Key insight: **a module is a section blueprint; a section is what a module
becomes when instantiated.** So a "category header" like _Customer Introduction_
is a **section**, not a label.

```
Project
 └─ Section  ("Customer Introduction")     ← runtime grouping
     └─ Task
         └─ Subtask

Template                                    ← blueprint
 └─ Module   ("Customer Introduction")      ← reusable section
     └─ Task blueprint

Labels: one shared pool, attached to Project / Section / Task for filter + search
```

## Decisions

### D1 — One shared label pool; scope lives in the association, not a flag

There is a single per-user `labels` table. The same label attaches to projects,
tasks (and later sections) via separate join tables (`task_labels`,
`project_labels`, …). **No `scope`/`applies_to` flag on the label.**

Why: the value of tags is that one concept can annotate anything — filtering
`#client-acme` should surface the project _and_ its tasks. A scope flag
fragments that, adds a decision at creation time, and complicates every picker,
for little gain. If picker clutter becomes a real problem, add a _soft_
"recently used here" hint — not a hard constraint.

### D2 — Modules are explicit structures, not "tasks sharing a label"

A module owns its member task-blueprints by reference. It is **not** defined as
"every task tagged `#legal`" — otherwise casually tagging a task `#legal` would
silently pull it into the module. Labels _annotate_; module membership is
_explicit_. A template may still offer "add the modules tagged `#onboarding`" as
a convenience, but membership underneath is explicit.

### D3 — Sections are the structural unlock

Add a `sections` layer (project → sections → tasks, `tasks.section_id`
nullable so ungrouped tasks keep working) before/with modules. Sections are
useful on their own and are the runtime form a module instantiates into.

## Planned data model (incremental)

- **Now:** `project_labels` (project_id, label_id) — project-level annotation,
  reusing the existing `labels` table. Shared pool, no scope flag (D1).
- **Next:** `sections` (id, project_id, name, position); `tasks.section_id`
  nullable FK.
- **Later (WP5):** `templates`, `modules` (a module ≈ a saved section +
  task-blueprints), `template_modules` (ordered). Instantiation = create project
  → for each module create a section + its tasks.

## Open questions (revisit when we get there)

- Do sections need their own labels, or is project+task enough?
- Can a module be shared across users/workspaces (when sharing lands)?
- Instantiation: copy-once (snapshot) vs. keep a live link to the template?
