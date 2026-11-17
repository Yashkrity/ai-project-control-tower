import type { PortfolioData, Project, ProjectInput, ProjectUpdate } from "@/lib/types";

export type NewProjectUpdate = Omit<ProjectUpdate, "id" | "createdAt">;

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
}
