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

## Template model v2 — fixed skeleton + label-injected modules (roadmap item 25)

**Proposed target** (supersedes the shipped v1, where a template is just ordered
"modules = sections" with no subtasks). A template is a blueprint for a repeatable
project holding two kinds of content:

1. **Fixed structure** — ordered **sections**, each with **fixed tasks**, each
   with **subtasks**. Always created on instantiation.
2. **Modular injection** — a section can be flagged with **labels**; on
   instantiation, every library **module** carrying a matching label has its tasks
   injected into that section (appended after the fixed tasks).

This keeps D2: a module's contents stay explicit; the label is the deliberate
"inject modules here" wiring between a section slot and the module library (24).

Instantiate = for each section: create it → add fixed tasks (+subtasks) → for each
section label, append the tasks (+subtasks) of every module tagged with it.

Schema sketch (retires the v1 `template_modules`/module-as-section mapping):

- `template_sections` (id, template_id, name, position)
- `template_section_labels` (template_section_id, label_id) — injection slots
- `template_tasks` (id, template_section_id, title, status, priority, notes, position)
- `template_subtasks` (id, template_task_id, title, position)
- Module library: `modules` (id, user_id, name), `module_labels` (module_id,
  label_id), `module_tasks` (+ `module_subtasks`).

Migration: convert each existing template's modules → `template_sections` with
their `module_tasks` → `template_tasks` (no labels/subtasks); the module library
starts empty.

Open decisions: injection **automatic** (all matching modules) vs
**pick-at-instantiation** (choose optional modules per project); confirm injected
tasks append after fixed ones.

## Templates v3 — apply labels at project-creation (roadmap item 26)

Refines v2 (see `docs/templates-v3/` for the flow diagram). Two changes:

**Section kinds.** A template section is either **standard** (fixed tasks baked in,
carried through as-is) or **module-based** (a placeholder filled by modules at
creation). The client treats a section as module-based when it has label slots
_or_ no fixed tasks — no schema change; a section can still be both.

**Who applies the labels, and when — resolves the v2 open decision toward
pick-at-instantiation.** The label→module wiring can live in _two_ places:

- **On the template** (stored slots) — for a section that always needs the same
  modules; still injected automatically.
- **At project creation** (the new default) — the "Start a project from template"
  dialog (`InstantiateTemplateModal`) shows each module-based section with an
  editable label picker (pre-filled from the stored slots) and a live preview of
  which library modules will be pulled in. The chosen labels are sent as
  `sectionLabels: [{ sectionId, labelIds }]` and override the stored slots per
  section; unlisted sections fall back to their slots.

Server: `instantiateTemplate(userId, templateId, name, sectionLabels)` builds the
effective label set per section (override else slots) before injecting
`modulesForLabels`. Schema `instantiateSchema.sectionLabels` is optional, so the
old auto-only behavior still works.

**Entry points.** Templates and the module library are **dedicated full pages**
(header user menu → `TemplatesPage` / `ModulesPage`, each a list + a full-width
inline editor — the old cramped modals were retired). The editor can **Save &
start a project** directly, and
"Save as template" from a project offers **new** _or_ **overwrite an existing**
template (`POST /templates/from-project` with an optional `templateId`; a warning
precedes overwrite since it replaces the whole structure and clears label slots).

## Module library (roadmap item 24)

Shipped templates treat modules as **template-private** (save-as-template and the
editor create fresh modules per template; the editor saves via full-replace). A
follow-up promotes modules to a **reusable library**: manage them independently,
bulk-create, and **label them** (shared pool → a `module_labels` join, scope in
the association per D1). Templates then compose by linking library modules
(`template_modules`) rather than owning copies. Decision to make first: **shared
modules** (edit once → propagates to every template using it) vs keeping
**template-private copies**. Shared is the intent behind labeling/organizing a
library; it changes the editor from full-replace to link/unlink.
