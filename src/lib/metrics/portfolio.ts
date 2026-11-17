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
  RaidItem,
  Task,
} from "@/lib/types";
import { addDays, daysBetween } from "@/lib/utils/dates";

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

/**
 * Delayed = still open past its planned date, or completed later than planned.
 */
export function isMilestoneDelayed(milestone: Milestone, today: ISODate): boolean {
  if (milestone.status === "completed") {
    return milestone.actualDate !== null && milestone.actualDate > milestone.plannedDate;
  }
  return isMilestonePastDue(milestone, today);
}

/** Past due = still open and its planned date is before today (actionable now). */
export function isMilestonePastDue(milestone: Milestone, today: ISODate): boolean {
  return milestone.status !== "completed" && milestone.plannedDate < today;
}

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

function isOpenRaid(item: RaidItem): boolean {
  return item.status === "open" || item.status === "monitoring";
}

/* ------------------------------------------------------------------ */
/* Portfolio summary                                                   */
/* ------------------------------------------------------------------ */

export interface ProjectSummary {
  project: Project;
  progress: Completion;
  overdueTasks: number;
  delayedMilestones: number;
  openRisks: number;
  openIssues: number;
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
  upcomingMilestones: MilestoneRow[];
  /** Open milestones past their planned date. */
  pastDueMilestoneCount: number;
  /** Past due + completed late (includes historical slippage). */
  delayedMilestoneCount: number;
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
  const pRaid = data.raidItems.filter((r) => r.projectId === project.id && isOpenRaid(r));
  return {
    project,
    progress: taskCompletion(pTasks),
    overdueTasks: pTasks.filter((t) => isTaskOverdue(t, today)).length,
    delayedMilestones: data.milestones.filter(
      (m) => m.projectId === project.id && isMilestoneDelayed(m, today),
    ).length,
    openRisks: pRaid.filter((r) => r.type === "risk").length,
    openIssues: pRaid.filter((r) => r.type === "issue").length,
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

  const horizon = addDays(today, milestoneHorizonDays);
  const upcomingMilestones: MilestoneRow[] = milestones
    .filter((m) => m.status !== "completed" && m.plannedDate >= today && m.plannedDate <= horizon)
    .map((milestone) => ({
      milestone,
      projectName: nameOf.get(milestone.projectId) ?? "Unknown project",
      daysUntil: daysBetween(today, milestone.plannedDate),
    }))
    .sort((a, b) => a.daysUntil - b.daysUntil);

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
    upcomingMilestones,
    pastDueMilestoneCount: milestones.filter((m) => isMilestonePastDue(m, today)).length,
    delayedMilestoneCount: milestones.filter((m) => isMilestoneDelayed(m, today)).length,
    totalBudget: active.reduce((sum, p) => sum + p.budget, 0),
    totalSpend: active.reduce((sum, p) => sum + p.actualSpend, 0),
    projects: projectSummaries,
    recentUpdates,
  };
}
