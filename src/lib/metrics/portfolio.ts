/**
 * Deterministic portfolio metrics.
 *
 * Every function here is pure: same inputs + same `today` => same output.
 * No AI and no hardcoded figures; the dashboard renders only what these
 * functions derive from project, task and milestone records.
 */
import type {
  Health,
  ISODate,
  Milestone,
  PortfolioData,
  Project,
  ProjectUpdate,
  Task,
} from "@/lib/types";
import { daysBetween } from "@/lib/utils/dates";
import { indexTasks, taskBlockInfo } from "@/lib/tasks/rules";
import { isUpcoming, milestoneState, milestoneStates, type MilestoneState } from "@/lib/milestones/rules";
import { projectRaidSummary, type RaidSummary } from "@/lib/raid/summary";

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

export function isArchived(project: Project): boolean {
  return project.archivedAt !== null;
}

/** A project counts as "active" until it is completed or archived. */
export function isActiveProject(project: Project): boolean {
  return !isArchived(project) && project.status !== "completed";
}

/** Overdue = not done and the due date is strictly before today. */
export function isTaskOverdue(task: Task, today: ISODate): boolean {
  return task.status !== "done" && task.dueDate < today;
}

/*
 * Milestone status (completed / delayed / at risk / ...) is calculated in
 * src/lib/milestones/rules.ts from linked tasks and dates. "Past due" on the
 * dashboard is exactly the Delayed status: not completed and the planned
 * completion date has passed.
 */

export interface Completion {
  completed: number;
  total: number;
  /** 0-100, rounded to one decimal. 0 when there are no tasks. */
  percent: number;
}

/** Progress = share of tasks marked done. Each task carries equal weight. */
export function taskCompletion(tasks: Task[]): Completion {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "done").length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 1000) / 10;
  return { completed, total, percent };
}

/** Share of the planned schedule that has elapsed, clamped to 0-100. */
export function scheduleElapsedPercent(project: Project, today: ISODate): number {
  const duration = daysBetween(project.startDate, project.targetEndDate);
  if (duration <= 0) return 100;
  const elapsed = daysBetween(project.startDate, today);
  return Math.min(100, Math.max(0, Math.round((elapsed / duration) * 100)));
}

/** Actual spend as a percentage of budget (not clamped: >100 means overspend). */
export function budgetBurnPercent(project: Project): number {
  if (project.budget <= 0) return 0;
  return Math.round((project.actualSpend / project.budget) * 100);
}

/* ------------------------------------------------------------------ */
/* Portfolio summary                                                   */
/* ------------------------------------------------------------------ */

export interface ProjectSummary {
  project: Project;
  progress: Completion;
  overdueTasks: number;
  /** Status Blocked, or underway but waiting on incomplete predecessors. */
  blockedTasks: number;
  milestones: { total: number; completed: number; delayed: number; atRisk: number };
  /** Deterministic RAID summary (see src/lib/raid/summary.ts). */
  raid: RaidSummary;
  scheduleElapsed: number;
  budgetBurn: number;
}

export interface OverdueTaskRow {
  task: Task;
  projectName: string;
  daysOverdue: number;
}

export interface MilestoneRow {
  milestone: Milestone;
  state: MilestoneState;
  projectName: string;
  daysUntil: number;
}

export interface UpdateRow {
  update: ProjectUpdate;
  projectName: string;
}

export interface PortfolioSummary {
  today: ISODate;
  activeProjects: number;
  activeByStatus: { planning: number; active: number; on_hold: number };
  healthCounts: Record<Health, number>;
  taskCompletion: Completion;
  overdueTaskCount: number;
  overdueTasks: OverdueTaskRow[];
  blockedTaskCount: number;
  upcomingMilestones: MilestoneRow[];
  /** Open milestones past their planned date. */
  /** Milestones with calculated status Delayed (not completed, planned date passed). */
  pastDueMilestoneCount: number;
  atRiskMilestoneCount: number;
  totalBudget: number;
  totalSpend: number;
  projects: ProjectSummary[];
  recentUpdates: UpdateRow[];
}

export interface SummaryOptions {
  /** Days ahead (inclusive) that count as "upcoming". Default 30. */
  milestoneHorizonDays?: number;
  recentUpdateLimit?: number;
}

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 } as const;

/** Derived metrics for a single project (works for archived projects too). */
export function summarizeProject(
  project: Project,
  data: Pick<PortfolioData, "tasks" | "milestones" | "raidItems">,
  today: ISODate,
): ProjectSummary {
  const pTasks = data.tasks.filter((t) => t.projectId === project.id);
  const byId = indexTasks(pTasks); // dependencies are always within one project
  const states = data.milestones
    .filter((m) => m.projectId === project.id)
    .map((m) => milestoneState(m, pTasks, today).status);
  return {
    project,
    progress: taskCompletion(pTasks),
    overdueTasks: pTasks.filter((t) => isTaskOverdue(t, today)).length,
    blockedTasks: pTasks.filter((t) => taskBlockInfo(t, byId, today).blocked).length,
    milestones: {
      total: states.length,
      completed: states.filter((s) => s === "completed").length,
      delayed: states.filter((s) => s === "delayed").length,
      atRisk: states.filter((s) => s === "at_risk").length,
    },
    raid: projectRaidSummary(project.id, data, today),
    scheduleElapsed: scheduleElapsedPercent(project, today),
    budgetBurn: budgetBurnPercent(project),
  };
}

/**
 * Builds the portfolio dashboard summary.
 * Scope: archived projects are excluded entirely; completed projects count
 * toward task completion and the progress table but not "active" totals.
 */
export function buildPortfolioSummary(
  data: PortfolioData,
  today: ISODate,
  { milestoneHorizonDays = 30, recentUpdateLimit = 8 }: SummaryOptions = {},
): PortfolioSummary {
  const projects = data.projects.filter((p) => !isArchived(p));
  const projectIds = new Set(projects.map((p) => p.id));
  const nameOf = new Map(projects.map((p) => [p.id, p.name]));

  const tasks = data.tasks.filter((t) => projectIds.has(t.projectId));
  const milestones = data.milestones.filter((m) => projectIds.has(m.projectId));

  const active = projects.filter(isActiveProject);
  const healthCounts: Record<Health, number> = { green: 0, amber: 0, red: 0 };
  const activeByStatus = { planning: 0, active: 0, on_hold: 0 };
  for (const p of active) {
    healthCounts[p.health] += 1;
    if (p.status === "planning" || p.status === "active" || p.status === "on_hold") {
      activeByStatus[p.status] += 1;
    }
  }

  const overdueTasks: OverdueTaskRow[] = tasks
    .filter((t) => isTaskOverdue(t, today))
    .map((task) => ({
      task,
      projectName: nameOf.get(task.projectId) ?? "Unknown project",
      daysOverdue: daysBetween(task.dueDate, today),
    }))
    .sort(
      (a, b) =>
        b.daysOverdue - a.daysOverdue ||
        PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority],
    );

  const states = milestoneStates({ milestones, tasks }, today);
  const upcomingMilestones: MilestoneRow[] = milestones
    .filter((m) => isUpcoming(m, states.get(m.id)!, today, milestoneHorizonDays))
    .map((milestone) => ({
      milestone,
      state: states.get(milestone.id)!,
      projectName: nameOf.get(milestone.projectId) ?? "Unknown project",
      daysUntil: daysBetween(today, milestone.plannedDate),
    }))
    .sort((a, b) => a.daysUntil - b.daysUntil);
  const countStatus = (status: string) => [...states.values()].filter((s) => s.status === status).length;

  const projectSummaries = projects.map((project) =>
    summarizeProject(project, { tasks, milestones, raidItems: data.raidItems }, today),
  );

  const recentUpdates: UpdateRow[] = data.updates
    .filter((u) => projectIds.has(u.projectId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, recentUpdateLimit)
    .map((update) => ({ update, projectName: nameOf.get(update.projectId) ?? "Unknown project" }));

  return {
    today,
    activeProjects: active.length,
    activeByStatus,
    healthCounts,
    taskCompletion: taskCompletion(tasks),
    overdueTaskCount: overdueTasks.length,
    overdueTasks,
    blockedTaskCount: projectSummaries.reduce((sum, p) => sum + p.blockedTasks, 0),
    upcomingMilestones,
    pastDueMilestoneCount: countStatus("delayed"),
    atRiskMilestoneCount: countStatus("at_risk"),
    totalBudget: active.reduce((sum, p) => sum + p.budget, 0),
    totalSpend: active.reduce((sum, p) => sum + p.actualSpend, 0),
    projects: projectSummaries,
    recentUpdates,
  };
}
