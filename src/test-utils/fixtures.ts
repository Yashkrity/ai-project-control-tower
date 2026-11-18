import type { Milestone, PortfolioData, Project, Task, TaskInput } from "@/lib/types";

export const TODAY = "2026-06-15";

export const makeProject = (over: Partial<Project> = {}): Project => ({
  id: "p1",
  name: "Project One",
  client: "Client",
  description: "",
  projectManager: "PM",
  startDate: "2026-06-01",
  targetEndDate: "2026-09-30",
  budget: 1000,
  actualSpend: 100,
  status: "active",
  health: "green",
  archivedAt: null,
  createdAt: "2026-06-01T09:00:00.000Z",
  updatedAt: "2026-06-01T09:00:00.000Z",
  ...over,
});

export const makeTask = (over: Partial<Task> = {}): Task => ({
  id: "t1",
  projectId: "p1",
  milestoneId: null,
  title: "Task",
  description: "",
  owner: "Sam",
  priority: "medium",
  status: "not_started",
  startDate: "2026-06-01",
  dueDate: "2026-06-30",
  completedDate: null,
  dependsOn: [],
  createdAt: "2026-06-01T09:00:00.000Z",
  updatedAt: "2026-06-01T09:00:00.000Z",
  ...over,
});

export const makeMilestone = (over: Partial<Milestone> = {}): Milestone => ({
  id: "m1",
  projectId: "p1",
  name: "Milestone",
  description: "",
  owner: "Owner",
  priority: "medium",
  plannedStartDate: "2026-06-01",
  plannedDate: "2026-07-01",
  actualDate: null,
  notes: "",
  createdAt: "2026-06-01T09:00:00.000Z",
  updatedAt: "2026-06-01T09:00:00.000Z",
  ...over,
});

export const makeData = (over: Partial<PortfolioData> = {}): PortfolioData => ({
  projects: [makeProject()],
  tasks: [],
  milestones: [],
  raidItems: [],
  updates: [],
  ...over,
});

export const taskInput = (over: Partial<TaskInput> = {}): TaskInput => ({
  projectId: "p1",
  milestoneId: null,
  title: "New task",
  description: "",
  owner: "Sam",
  priority: "medium",
  status: "not_started",
  startDate: "2026-06-01",
  dueDate: "2026-06-30",
  completedDate: null,
  dependsOn: [],
  ...over,
});
