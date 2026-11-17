# AI Project Delivery Control Tower

A portfolio control tower for Technical Project Managers and PMOs running many technology projects at once. It brings project health, delivery progress, milestones, tasks, dependencies and RAID (risks, assumptions, issues, dependencies) into one workspace.

> **Status: Phase 2 (Projects module).** The portfolio dashboard and full Projects CRUD (create, edit, archive, restore) work against a **local JSON data store** that persists across refreshes and restarts. Tasks, Milestones and RAID screens are placeholders for the next phases. Supabase persistence and auth are not wired up yet.

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
| `npm test` | Unit tests: metrics, validation, local data store, activity log |
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
      tasks/ milestones/ raid/ Placeholders for upcoming modules
  components/
    layout/                    Sidebar (desktop + mobile drawer), page header, placeholder
    ui/                        Card, Badge, Button, FormField, ProgressBar, EmptyState, Skeleton
    dashboard/                 KPI cards, health breakdown, progress chart, tables, lists
    projects/                  Project form, detail view, list table, archive button
  lib/
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
| Overdue task | Status ≠ `done` and due date is before today |
| Upcoming milestone | Not completed, planned date between today and today + 30 days |
| Past-due milestone | Not completed and planned date is before today |
| Delayed milestone | Past due, **or** completed after its planned date |
| Schedule elapsed | (today − start) ÷ (target end − start), clamped to 0–100% |
| Budget used | Actual spend ÷ budget (may exceed 100%) |

Archived projects are excluded everywhere. Completed projects count toward task completion and appear in the project table, but are not counted as active.

## Demo data

`src/lib/data/demo-data.ts` seeds 8 projects (4 active, 1 planning, 1 on hold, 1 completed, 1 completed and archived) with 47 tasks, including dependencies, plus 21 milestones, 9 RAID items and 9 project updates. Health spans Green, Amber and Red.

## Projects module

| Route | Purpose |
| --- | --- |
| `/projects` | List with Current / Archived / All tabs, progress and budget per project |
| `/projects/new` | Create a project |
| `/projects/[id]` | Detail: progress vs schedule, budget, milestones, activity; Archive / Restore |
| `/projects/[id]/edit` | Edit a project |

Progress is never typed in: it is calculated from the project's tasks. Changes to status, health, target end date and budget are written to the activity feed; cosmetic edits (such as the description) are not. Until authentication exists, the author is recorded as "Workspace user".

## Roadmap

1. ~~**Projects module.**~~ Done (local store).
2. **Supabase data source.** Apply `supabase/schema.sql`, add a seed script, implement the Supabase repository, and add auth with workspace-scoped access rules.
3. **Tasks module.** CRUD, owners, priorities, overdue filter, dependency management.
4. **Milestones module.** Planned vs actual dates, delayed detection.
5. **RAID module.** Full RAID log with severity/probability/impact and mitigation tracking.
6. **AI features.** For example status-report drafting and RAID suggestions, server-side via the Anthropic API.

## Deploying to Vercel

Deployment needs the Supabase data source first: the local file store cannot write on Vercel. After that, import the repository in Vercel and set `DATA_SOURCE` and `APP_TIMEZONE` (and the Supabase/Anthropic variables once those features exist) under Project → Settings → Environment Variables. The default build settings (`next build`) work as-is.
