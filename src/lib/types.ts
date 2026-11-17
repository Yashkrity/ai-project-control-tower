/**
 * Core domain model for the Control Tower.
 *
 * Dates are ISO calendar dates ("YYYY-MM-DD") unless the field name ends in
 * `At`, in which case it is a full ISO timestamp. Keeping calendar dates as
 * strings avoids timezone drift when comparing due dates.
 */

export type ISODate = string;
export type ISODateTime = string;

export const PROJECT_STATUSES = ["planning", "active", "on_hold", "completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const HEALTH_VALUES = ["green", "amber", "red"] as const;
export type Health = (typeof HEALTH_VALUES)[number];

export const TASK_STATUSES = ["todo", "in_progress", "blocked", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const MILESTONE_STATUSES = ["not_started", "in_progress", "completed"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const RAID_TYPES = ["risk", "assumption", "issue", "dependency"] as const;
export type RaidType = (typeof RAID_TYPES)[number];

export const RAID_STATUSES = ["open", "monitoring", "resolved", "closed"] as const;
export type RaidStatus = (typeof RAID_STATUSES)[number];

export const RATINGS = ["low", "medium", "high"] as const;
export type Rating = (typeof RATINGS)[number];

export interface Project {
  id: string;
  name: string;
  client: string;
  description: string;
  projectManager: string;
  startDate: ISODate;
  targetEndDate: ISODate;
  /** Approved budget in the portfolio's base currency. */
  budget: number;
  actualSpend: number;
  status: ProjectStatus;
  /** RAG health as judged by the project manager. */
  health: Health;
  /**
   * Archiving is independent of status, so restoring a project brings it
   * back exactly as it was (e.g. still "completed").
   */
  archivedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Fields a user can set when creating or editing a project. */
export type ProjectInput = Pick<
  Project,
  | "name"
  | "client"
  | "description"
  | "projectManager"
  | "startDate"
  | "targetEndDate"
  | "budget"
  | "actualSpend"
  | "status"
  | "health"
>;

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  plannedDate: ISODate;
  actualDate: ISODate | null;
  status: MilestoneStatus;
}

export interface Task {
  id: string;
  projectId: string;
  milestoneId: string | null;
  title: string;
  owner: string;
  priority: Priority;
  status: TaskStatus;
  startDate: ISODate;
  dueDate: ISODate;
  completedDate: ISODate | null;
  /** IDs of tasks that must finish before this one can start. */
  dependsOn: string[];
}

export interface RaidItem {
  id: string;
  projectId: string;
  type: RaidType;
  title: string;
  description: string;
  owner: string;
  severity: Rating;
  probability: Rating;
  impact: Rating;
  mitigation: string;
  status: RaidStatus;
  targetDate: ISODate | null;
}

export const UPDATE_KINDS = ["status", "milestone", "risk", "decision", "general"] as const;
export type UpdateKind = (typeof UPDATE_KINDS)[number];

export interface ProjectUpdate {
  id: string;
  projectId: string;
  author: string;
  kind: UpdateKind;
  summary: string;
  createdAt: ISODateTime;
}

/** Everything the portfolio dashboard needs, loaded in one call. */
export interface PortfolioData {
  projects: Project[];
  tasks: Task[];
  milestones: Milestone[];
  raidItems: RaidItem[];
  updates: ProjectUpdate[];
}
