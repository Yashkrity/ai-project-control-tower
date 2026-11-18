/**
 * Deterministic RAID summary for a project (or the whole portfolio). A plain,
 * structured object: suitable for dashboards today and as input to future AI
 * features (reporting, status drafting) without any re-derivation.
 */
import type { ISODate, PortfolioData, RaidItem } from "@/lib/types";
import { isHighOrCriticalRisk, isOpen, isOverdue, isUpcomingReview } from "./rules";

export interface RaidSummary {
  openRisks: number;
  highCriticalRisks: number;
  openIssues: number;
  escalatedIssues: number;
  blockedDependencies: number;
  overdueAssumptions: number;
  /** All open records past their type-specific deadline. */
  overdueItems: number;
  /** Open records due for review / resolution in the next 14 days. */
  upcomingReviews: number;
  openTotal: number;
}

export function summarizeRaid(items: RaidItem[], today: ISODate): RaidSummary {
  const open = items.filter(isOpen);
  return {
    openRisks: open.filter((r) => r.type === "risk").length,
    highCriticalRisks: items.filter(isHighOrCriticalRisk).length,
    openIssues: open.filter((r) => r.type === "issue").length,
    escalatedIssues: items.filter((r) => r.type === "issue" && r.status === "escalated").length,
    blockedDependencies: items.filter((r) => r.type === "dependency" && r.status === "blocked").length,
    overdueAssumptions: items.filter((r) => r.type === "assumption" && isOverdue(r, today)).length,
    overdueItems: items.filter((r) => isOverdue(r, today)).length,
    upcomingReviews: items.filter((r) => isUpcomingReview(r, today)).length,
    openTotal: open.length,
  };
}

export function projectRaidSummary(projectId: string, data: Pick<PortfolioData, "raidItems">, today: ISODate): RaidSummary {
  return summarizeRaid(data.raidItems.filter((r) => r.projectId === projectId), today);
}

/** Calculated warnings shown next to (never instead of) the manual RAG health. */
export function raidSignals(s: RaidSummary): string[] {
  const signals: string[] = [];
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  if (s.highCriticalRisks) signals.push(n(s.highCriticalRisks, "high or critical risk open", "high or critical risks open"));
  if (s.escalatedIssues) signals.push(n(s.escalatedIssues, "escalated issue", "escalated issues"));
  if (s.blockedDependencies) signals.push(n(s.blockedDependencies, "blocked dependency", "blocked dependencies"));
  if (s.overdueItems) signals.push(n(s.overdueItems, "RAID item past its deadline", "RAID items past their deadlines"));
  return signals;
}
