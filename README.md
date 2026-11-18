# AI Project Delivery Control Tower

A portfolio control tower for Technical Project Managers and PMOs running many technology projects at once. It brings project health, delivery progress, milestones, tasks, dependencies and RAID (risks, assumptions, issues, dependencies) into one workspace.

> **Status: Phase 5 (RAID management).** The portfolio dashboard, Projects, Tasks, Milestones and the RAID register (risks, assumptions, issues, dependencies) work against a **local JSON data store** that persists across refreshes and restarts. Supabase persistence, authentication and AI features are not wired up yet.

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Cache Components, Turbopack) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Icons | lucide-react |
| Validation | zod (shared by forms and server actions) |
| Local persistence | JSON file in `.data/` (development only) |
| Database / auth | Supabase (schema drafted in `supabase/schema.sql`; adapter not built yet) |
| Tests | Vitest |
| Deploy target | Vercel |

## Getting started

Requirements: Node.js 20.9+ (developed on Node 24) and npm.

```bash
npm install
cp .env.example .env.local   # optional: the defaults work without it
npm run dev
```

Then open http://localhost:3000.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm test` | Unit and integration tests: metrics, validation, task rules and views, local data store, services |
| `npm run data:reset` | Delete the local data file; it is re-seeded from demo data on the next request |
| `npm run typecheck` | Generate Next route types, then `tsc --noEmit` |
| `npm run lint` | ESLint |

## Environment variables

See `.env.example`. Never commit `.env.local`.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `DATA_SOURCE` | server | `local` (default): JSON file at `.data/portfolio.json`. The old value `demo` is accepted as an alias. `supabase` is reserved and currently shows an error. |
| `APP_TIMEZONE` | server | IANA timezone that decides what "today" is for overdue and upcoming calculations. Default `UTC`. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Next phase. Safe in the browser; Row Level Security protects the data. |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Next phase (seeding/admin). Never prefix with `NEXT_PUBLIC_`. |
| `ANTHROPIC_API_KEY` | server only | Future AI features. |

> Next's dev server reloads env when `.env.local` is created or edited, but not when it is deleted. Restart `npm run dev` after removing variables.

## Architecture

```
src/
  app/
    layout.tsx                 Root HTML, fonts, metadata
    not-found.tsx
    (workspace)/               Route group that wraps every screen in the app shell
      layout.tsx               Persistent sidebar + content area
      page.tsx                 Portfolio dashboard ("/")
      error.tsx                Error boundary with retry
      projects/                List, new, [id] detail, [id]/edit, and actions.ts (server actions)
      tasks/                   List (views + filters), new, [id] detail, [id]/edit, and actions.ts
      milestones/              List (views + filters), new, [id] detail with linked tasks, [id]/edit, actions.ts
      raid/                    Register (tabs, focus views, filters, search, sort), new, [id] detail with history, [id]/edit, actions.ts
  components/
    layout/                    Sidebar (desktop + mobile drawer), page header, placeholder
    ui/                        Card, Badge, Button, FormField, ProgressBar, EmptyState, Skeleton
    dashboard/                 KPI cards, health breakdown, progress chart, tables, lists
    projects/                  Project form, detail view, list table, archive button
    tasks/                     Task form, detail view, table, filters, delete button
  lib/
    tasks/                     Task rules (dependencies, cycles, blocked, completion) and list views
    milestones/                Milestone rules (progress, calculated status, write checks) and list views
    raid/                      RAID governance rules, per-project summary, register views, references
    types.ts                   Domain model (Project, Task, Milestone, RaidItem, ProjectUpdate)
    data/                      Repository interface, local file store, demo seed data
    services/                  Use-cases (writes + activity log), called by server actions
    validation/                zod schemas shared by forms and actions
    metrics/                   Pure, deterministic portfolio calculations + tests
    config/navigation.ts       Sidebar items
    utils/                     Date and formatting helpers
supabase/schema.sql            Draft Postgres schema with RLS
```

### Key decisions

- **Repository boundary.** Pages, services and actions reach data only through `getRepository()` in `src/lib/data`, which is marked `server-only`. Swapping the local file store for Supabase is a change in one place, and data access and secrets never reach the browser bundle.
- **Local file store (development only).** `FileRepository` keeps everything in `.data/portfolio.json` (ignored by Git), created from the demo portfolio on first use; after that, dates are fixed like real data. All reads and writes for the file run through one queue, and writes are atomic (temp file + rename). Vercel's filesystem is read-only, so deployment needs the Supabase data source.
- **Mutations.** Forms post to server actions, which validate with zod (field-level errors are returned and the form keeps its values), write through a service, log material changes to the activity feed, then revalidate and redirect. Archiving is a separate `archivedAt` timestamp, not a status, so restoring returns a project exactly as it was.
- **Deterministic metrics, no AI.** `src/lib/metrics/portfolio.ts` holds pure functions that take the data plus `today` and return every number on the dashboard. Nothing is hardcoded, and the functions are unit-tested.
- **Request-time rendering for date-dependent figures.** With Cache Components, the page header and a skeleton are prerendered as a static shell. The dashboard figures stream in per request inside `<Suspense>`, because they depend on "today" (`connection()` keeps them out of the build-time prerender).
- **Relative demo dates.** Seed dates are offsets from the day the local store is created, so a fresh store has a realistic mix of overdue, upcoming and completed work. Run `npm run data:reset` to re-seed.
- **AI-ready, AI-free core.** AI features will live in a separate server-only module that calls the Anthropic API with `ANTHROPIC_API_KEY`. They will consume the same repository and metrics and will not replace them.

### Metric definitions

| Metric | Rule |
| --- | --- |
| Active project | Not archived and status is not `completed` |
| Project progress | Tasks done ÷ total tasks (equal weight); 0% when a project has no tasks |
| Overdue task | Status ≠ `done` and due date is before today (unchanged; on-hold tasks still count) |
| Blocked task | Status is `blocked`, **or** status is not `done`/`on_hold`, the start date has arrived, and a predecessor is not done |
| Due soon | Not done and due between today and today + 7 days |
| Milestone progress | Completed linked tasks ÷ total linked tasks × 100; “No tasks linked” (not 0%) when none |
| Milestone status | Calculated, never typed in. First match wins: **Completed** (actual date recorded and every linked task done) → **Delayed** (planned completion passed) → **At risk** (due within 14 days with open tasks, or a linked task is blocked) → **In progress** (a linked task is in progress, blocked or done) → **Not started** |
| Upcoming milestone | Not completed, planned completion between today and today + 30 days |
| Past-due milestone | Status Delayed: not completed and planned completion is before today (unchanged definition; “completed” is now calculated) |
| Risk score / level | Probability (1–5) × impact (1–5). Level: 1–4 Low, 5–9 Medium, 10–14 High, 15–25 Critical |
| Overdue RAID item | Open and past its type's deadline (risk review date, assumption validation deadline, issue target resolution date, dependency required-by date) |
| Upcoming RAID review | Open with its deadline between today and today + 14 days |
| Schedule elapsed | (today − start) ÷ (target end − start), clamped to 0–100% |
| Budget used | Actual spend ÷ budget (may exceed 100%) |

Archived projects are excluded everywhere. Completed projects count toward task completion and appear in the project table, but are not counted as active.

## Demo data

`src/lib/data/demo-data.ts` seeds 8 projects (4 active, 1 planning, 1 on hold, 1 completed, 1 completed and archived) with 47 tasks, including dependencies, plus 21 milestones, 17 RAID records (6 risks, 3 assumptions, 4 issues, 4 dependencies; several linked to tasks or milestones) and 9 project updates. Health spans Green, Amber and Red.

## Projects module

| Route | Purpose |
| --- | --- |
| `/projects` | List with Current / Archived / All tabs, progress and budget per project |
| `/projects/new` | Create a project |
| `/projects/[id]` | Detail: progress vs schedule, budget, milestones, activity; Archive / Restore |
| `/projects/[id]/edit` | Edit a project |

Progress is never typed in: it is calculated from the project's tasks. Changes to status, health, target end date and budget are written to the activity feed; cosmetic edits (such as the description) are not. Until authentication exists, the author is recorded as "Workspace user".

## Tasks module

| Route | Purpose |
| --- | --- |
| `/tasks` | Views: All, Overdue, Due soon, Blocked, Completed. Filters: project, owner, priority, status (in the URL, so views can be bookmarked) |
| `/tasks?project=<id>` | Project-specific task view (also shown on each project's detail page) |
| `/tasks/new` | Create a task (`?project=<id>` preselects the project) |
| `/tasks/[id]` | Detail: predecessors, tasks waiting on it, why it is blocked, completion timing; Edit / Delete |
| `/tasks/[id]/edit` | Edit a task |

Statuses: Not started, In progress, Blocked, On hold, Done. Priorities: Critical, High, Medium, Low.

Rules, all enforced on the server inside the store's write lock (the form mirrors some of them for faster feedback):

- **Project and milestone.** The project must exist and not be archived. A milestone must belong to the same project.
- **Dependencies.** Predecessors must exist, be in the same project, and not be the task itself. Circular dependencies are rejected with the full cycle named (for example “A” → “B” → “A”). A task cannot move to another project while tasks there depend on it.
- **Done gate.** A task cannot be marked Done while a predecessor is incomplete, unless “Complete anyway” is ticked. The override is written to the project's activity log.
- **Completion date.** Becoming Done records the submitted date, or today if blank. Staying Done keeps the stored date. Reopening clears it, and the previous date stays in the activity log. Dates in the future are rejected.
- **Delete.** Refused while other tasks depend on the task; the dependents are named.

Activity log entries: completed (with days early or late), reopened, marked blocked, completed via override, deleted.

## Milestones module

| Route | Purpose |
| --- | --- |
| `/milestones` | Views: All, Upcoming, Overdue, At risk, Completed. Filters: project, owner, status, planned-completion date range |
| `/milestones/new` | Create a milestone (`?project=<id>` preselects the project and owner) |
| `/milestones/[id]` | Status explanation, task-derived progress, linked tasks (open, unlink), link more tasks, Edit / Delete |
| `/milestones/[id]/edit` | Edit; the calculated status is shown read-only |

Status is calculated and cannot be set by hand, so it can never contradict the tasks. It is shown as a squared tag with a flag, distinct from the project's manual RAG health (round pill).

Rules, enforced on the server:

- **Project.** Must exist and not be archived. The project cannot change while tasks are linked.
- **Completion.** The actual completion date can be recorded only when every linked task is done (a milestone with no tasks can be completed directly), and never in the future. Clearing it reopens the milestone.
- **Consistency.** Reopening a linked task reopens a completed milestone automatically, with a log entry. Unfinished tasks cannot be added to a completed milestone, from the milestone page or the task form.
- **Delete.** With tasks linked, you must choose to unlink them or move them to another milestone in the same project.

Activity log entries: milestone created, planned dates changed, completed, reopened (manually or because a task reopened), deleted (with what happened to its tasks), tasks added to or removed from a milestone.

## RAID register

| Route | Purpose |
| --- | --- |
| `/raid` | Tabs: All records, Risks, Assumptions, Issues, Dependencies. Focus views: open high/critical risks, overdue, escalated issues, blocked dependencies, upcoming reviews. Filters: project, owner, open/closed, status, severity, deadline range; search; sort by deadline, severity, updated or reference |
| `/raid/new` | Create a record; `?type=`, `?project=`, `?task=`, `?milestone=` pre-fill the form |
| `/raid/[id]` | Record detail: escalation/overdue banners, type-specific facts, impacted milestone/task, activity history |
| `/raid/[id]/edit` | Edit; the type is fixed and status options follow the allowed transitions |

Each record has a readable reference (R-001, A-001, I-001, D-001), shared fields (project, owner, deadline, resolution date, impacted milestone/task, plan, latest update) and type-specific fields: risks have probability, impact and a contingency plan; assumptions have evidence notes; issues have severity, business impact and escalation details; dependencies have internal/external, required-from party, impact if unfulfilled and an escalation owner. RAID dependencies (needs from other teams, vendors or stakeholders) are separate from task predecessors.

Governance rules, enforced on the server:

- **Status transitions** per type. For example, an issue must be Resolved before it is Closed, and a materialized risk can only be closed.
- **Requirements.** Escalating an issue needs a reason (the escalation date is recorded); validating or invalidating an assumption needs evidence; a blocked dependency needs an escalation owner.
- **Resolution date** recorded when a record reaches a closed state (risk closed/materialized, assumption validated/invalidated, issue resolved/closed, dependency fulfilled), cleared on reopen, never in the future.
- **Associations.** The project must exist and not be archived; the impacted milestone and task must be in the same project. Deleting a task or milestone clears RAID links to it.
- **Activity history** for every create, status change, escalation, resolution, score or priority change, deadline or owner change, latest update and delete.

Project pages show open risks, high/critical risks, open and escalated issues, blocked dependencies, overdue assumptions and upcoming reviews, each linking to the filtered register, plus calculated warnings. These never change the project's RAG health, which stays manual. `projectRaidSummary()` in `src/lib/raid/summary.ts` returns the same figures as a structured object for reporting and future AI features.

## Roadmap

1. ~~**Projects module.**~~ Done (local store).
2. ~~**Tasks module.**~~ Done (local store).
3. **Supabase data source.** Apply `supabase/schema.sql`, add a seed script, implement the Supabase repository (with the task rules in a transaction or RPC), and add auth with workspace-scoped access rules.
4. ~~**Milestones module.**~~ Done (local store).
5. ~~**RAID module.**~~ Done (local store).
6. **AI features.** For example status-report drafting and RAID suggestions, server-side via the Anthropic API.

## Deploying to Vercel

Deployment needs the Supabase data source first: the local file store cannot write on Vercel. After that, import the repository in Vercel and set `DATA_SOURCE` and `APP_TIMEZONE` (and the Supabase/Anthropic variables once those features exist) under Project → Settings → Environment Variables. The default build settings (`next build`) work as-is.
