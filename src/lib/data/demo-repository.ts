import type { PortfolioData } from "@/lib/types";
import { buildDemoData } from "./demo-data";
import type { PortfolioRepository } from "./repository";

export class DemoRepository implements PortfolioRepository {
  readonly source = "demo" as const;

  constructor(private readonly today: string) {}

  async getPortfolio(): Promise<PortfolioData> {
    return buildDemoData(this.today);
  }
}
