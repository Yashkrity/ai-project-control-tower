import type { PortfolioData } from "@/lib/types";

/**
 * The only way pages and components read data. Implementations:
 *  - DemoRepository: in-memory, seeded demo portfolio (default)
 *  - Supabase repository: planned for the next phase
 *
 * Write methods (create/update/archive) will be added per module as the
 * Projects, Tasks, Milestones and RAID modules are built.
 */
export interface PortfolioRepository {
  readonly source: "demo" | "supabase";
  getPortfolio(): Promise<PortfolioData>;
}
