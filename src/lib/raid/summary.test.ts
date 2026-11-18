import { describe, expect, it } from "vitest";
import { makeAssumption, makeDependency, makeIssue, makeRisk, TODAY } from "@/test-utils/fixtures";
import { projectRaidSummary, raidSignals, summarizeRaid } from "./summary";

// TODAY = 2026-06-15
const items = [
  makeRisk({ id: "r1", probability: 4, impact: 4 }), // 16 critical, open
  makeRisk({ id: "r2", probability: 2, impact: 2, status: "mitigating", targetDate: "2026-06-20" }), // low, upcoming
  makeRisk({ id: "r3", probability: 5, impact: 5, status: "closed" }),
  makeAssumption({ id: "a1", targetDate: "2026-06-10" }), // overdue validation
  makeAssumption({ id: "a2", targetDate: "2026-06-10", status: "validated", validationNotes: "ok" }),
  makeIssue({ id: "i1", status: "escalated", escalationReason: "x", targetDate: "2026-06-12" }), // overdue
  makeIssue({ id: "i2", status: "resolved" }),
  makeDependency({ id: "d1", status: "blocked", escalationOwner: "P", projectId: "p2" }),
];

describe("RAID summary", () => {
  it("counts every governance figure deterministically", () => {
    expect(summarizeRaid(items, TODAY)).toEqual({
      openRisks: 2,
      highCriticalRisks: 1,
      openIssues: 1,
      escalatedIssues: 1,
      blockedDependencies: 1,
      overdueAssumptions: 1,
      overdueItems: 2,
      upcomingReviews: 1,
      openTotal: 5,
    });
  });

  it("scopes to one project", () => {
    expect(projectRaidSummary("p2", { raidItems: items }, TODAY)).toMatchObject({ blockedDependencies: 1, openTotal: 1, openRisks: 0 });
  });

  it("produces readable signals and none when clean", () => {
    expect(raidSignals(summarizeRaid(items, TODAY))).toEqual([
      "1 high or critical risk open",
      "1 escalated issue",
      "1 blocked dependency",
      "2 RAID items past their deadlines",
    ]);
    expect(raidSignals(summarizeRaid([], TODAY))).toEqual([]);
  });
});
