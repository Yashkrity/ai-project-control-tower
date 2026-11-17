import type { PortfolioData, Project, ProjectInput, ProjectUpdate, Task, TaskDraft } from "@/lib/types";

export type NewProjectUpdate = Omit<ProjectUpdate, "id" | "createdAt">;

/**
 * Builds the record to store from the current data. Runs inside the
 * repository's write lock (or transaction), so integrity checks and the write
 * are atomic. Throw to abort the write.
 */
export type TaskBuilder = (data: PortfolioData, existing: Task | null) => TaskDraft;
export type TaskDeleteGuard = (data: PortfolioData, existing: Task) => void;

/**
 * The only way pages, services and actions touch data. Implementations:
 *  - FileRepository: JSON file on local disk, seeded from the demo portfolio
 *  - Supabase repository: planned
 *
 * Mutations return `null` when the target record does not exist.
 */
export interface PortfolioRepository {
  readonly source: "local" | "supabase";

  getPortfolio(): Promise<PortfolioData>;
  getProject(id: string): Promise<Project | null>;

  createProject(input: ProjectInput): Promise<Project>;
  updateProject(id: string, input: ProjectInput): Promise<Project | null>;
  setProjectArchived(id: string, archived: boolean): Promise<Project | null>;

  addProjectUpdate(update: NewProjectUpdate): Promise<ProjectUpdate>;

  getTask(id: string): Promise<Task | null>;
  createTask(build: TaskBuilder): Promise<Task>;
  updateTask(id: string, build: TaskBuilder): Promise<Task | null>;
  /** Returns the deleted task, or null if it did not exist. */
  deleteTask(id: string, guard: TaskDeleteGuard): Promise<Task | null>;
}
