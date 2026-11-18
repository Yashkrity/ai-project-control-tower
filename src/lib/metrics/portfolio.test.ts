import { describe, expect, it } from "vitest";
import type { Milestone, PortfolioData, Project, Task } from "@/lib/types";
import { buildDemoData } from "@/lib/data/demo-data";
import { makeMilestone } from "@/test-utils/fixtures";
import {
  budgetBurnPercent,
  buildPortfolioSummary,
  isTaskOverdue,
  scheduleElapsedPercent,
  taskCompletion,
} from "./portfolio";

const TODAY = "2026-06-15";

const project = (over: Partial<Project> = {}): Project => ({
  id: "p1",
  name: "P1",
  client: "C",
  description: "",
  projectManager: "PM",
  startDate: "2026-06-01",
  targetEndDate: "2026-07-01",
  budget: 1000,
  actualSpend: 250,
  status: "active",
  health: "green",
  archivedAt: null,
  createdAt: "2026-06-01T09:00:00.000Z",
  updatedAt: "2026-06-14T09:00:00.000Z",
  ...over,
});

const task = (over: Partial<Task> = {}): Task => ({
  id: "t1",
  projectId: "p1",
  milestoneId: null,
  title: "T",
  description: "",
  owner: "O",
  priority: "medium",
  status: "not_started",
  startDate: "2026-06-01",
  dueDate: "2026-06-20",
  completedDate: null,
  dependsOn: [],
  createdAt: "2026-06-01T09:00:00.000Z",
  updatedAt: "2026-06-01T09:00:00.000Z",
  ...over,
});

const milestone = (over: Partial<Milestone> = {}): Milestone => makeMilestone({ plannedDate: "2026-06-20", ...over });

describe("isTaskOverdue", () => {
  it("is overdue only when open and due strictly before today", () => {
    expect(isTaskOverdue(task({ dueDate: "2026-06-14" }), TODAY)).toBe(true);
    expect(isTaskOverdue(task({ dueDate: TODAY }), TODAY)).toBe(false);
    expect(isTaskOverdue(task({ dueDate: "2026-06-14", status: "done" }), TODAY)).toBe(false);
    expect(isTaskOverdue(task({ dueDate: "2026-06-01", status: "blocked" }), TODAY)).toBe(true);
  });
});


describe("taskCompletion", () => {
  it("returns 0% for no tasks instead of dividing by zero", () => {
    expect(taskCompletion([])).toEqual({ completed: 0, total: 0, percent: 0 });
  });
  it("weights tasks equally and rounds to one decimal", () => {
    const tasks = [task({ status: "done" }), task({ id: "t2" }), task({ id: "t3" })];
    expect(taskCompletion(tasks)).toEqual({ completed: 1, total: 3, percent: 33.3 });
  });
});

describe("schedule and budget", () => {
  it("computes schedule elapsed and clamps to 0-100", () => {
    expect(scheduleElapsedPercent(project(), "2026-06-16")).toBe(50);
    expect(scheduleElapsedPercent(project(), "2026-05-01")).toBe(0);
    expect(scheduleElapsedPercent(project(), "2026-09-01")).toBe(100);
  });
  it("reports overspend above 100%", () => {
    expect(budgetBurnPercent(project({ actualSpend: 1200 }))).toBe(120);
    expect(budgetBurnPercent(project({ budget: 0 }))).toBe(0);
  });
});

describe("buildPortfolioSummary", () => {
  const data: PortfolioData = {
    projects: [
      project(),
      project({ id: "p2", name: "P2", health: "red" }),
      project({ id: "p3", name: "P3", status: "completed" }),
      project({ id: "p4", name: "P4", archivedAt: "2026-06-02T09:00:00.000Z", health: "red" }),
    ],
    tasks: [
      task({ id: "a", status: "done" }),
      task({ id: "b", dueDate: "2026-06-10" }),
      task({ id: "c", projectId: "p2", dueDate: "2026-06-01", priority: "critical" }),
      task({ id: "d", projectId: "p3", status: "done" }),
      task({ id: "e", projectId: "p4", dueDate: "2026-01-01" }), // archived: excluded
    ],
    milestones: [
      milestone({ plannedDate: "2026-06-20" }),
      milestone({ id: "m2", plannedDate: "2026-08-01" }), // beyond 30d
      milestone({ id: "m3", plannedDate: "2026-06-01" }), // open, past due
      milestone({ id: "m4", plannedDate: "2026-06-01", actualDate: "2026-06-03" }), // completed (no tasks), late
    ],
    raidItems: [],
    updates: [],
  };

  const s = buildPortfolioSummary(data, TODAY);

  it("excludes completed and archived projects from active counts", () => {
    expect(s.activeProjects).toBe(2);
    expect(s.healthCounts).toEqual({ green: 1, amber: 0, red: 1 });
  });
  it("leaves archived projects out of the project table", () => {
    expect(s.projects.map((p) => p.project.id)).toEqual(["p1", "p2", "p3"]);
  });
  it("excludes archived projects from task metrics", () => {
    expect(s.taskCompletion).toEqual({ completed: 2, total: 4, percent: 50 });
    expect(s.overdueTaskCount).toBe(2);
  });
  it("sorts overdue tasks most-late first", () => {
    expect(s.overdueTasks.map((r) => [r.task.id, r.daysOverdue])).toEqual([
      ["c", 14],
      ["b", 5],
    ]);
  });
  it("lists upcoming milestones within the horizon and counts past-due (Delayed) ones", () => {
    expect(s.upcomingMilestones.map((r) => r.milestone.id)).toEqual(["m1"]);
    expect(s.pastDueMilestoneCount).toBe(1); // m3; m4 is completed even though it finished late
    expect(s.atRiskMilestoneCount).toBe(0);
  });
});

describe("demo data", () => {
  it("has at least five non-archived projects and consistent references", () => {
    const d = buildDemoData(TODAY);
    expect(d.projects.filter((p) => p.archivedAt === null).length).toBeGreaterThanOrEqual(5);
    expect(d.projects.some((p) => p.archivedAt !== null)).toBe(true);
    const projectIds = new Set(d.projects.map((p) => p.id));
    const taskIds = new Set(d.tasks.map((t) => t.id));
    const milestoneIds = new Set(d.milestones.map((m) => m.id));
    for (const t of d.tasks) {
      expect(projectIds.has(t.projectId)).toBe(true);
      if (t.milestoneId) expect(milestoneIds.has(t.milestoneId)).toBe(true);
      for (const dep of t.dependsOn) expect(taskIds.has(dep)).toBe(true);
    }
    expect(taskIds.size).toBe(d.tasks.length);
  });
  it("is deterministic for a given date", () => {
    expect(buildDemoData(TODAY)).toEqual(buildDemoData(TODAY));
  });
});
