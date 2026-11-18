import { describe, expect, it } from "vitest";
import type { RaidInput } from "@/lib/types";
import {
  makeAssumption,
  makeData,
  makeDependency,
  makeIssue,
  makeMilestone,
  makeProject,
  makeRisk,
  makeTask,
  TODAY,
} from "@/test-utils/fixtures";
import {
  escalationNote,
  isHighOrCriticalRisk,
  isOverdue,
  isUpcomingReview,
  RaidRuleError,
  resolveRaidWrite,
  riskLevel,
  riskScore,
  severityOf,
} from "./rules";
import { nextRaidRef } from "./refs";

// TODAY = 2026-06-15
const strip = <T extends { id: string; ref: string; createdAt: string; updatedAt: string }>(x: T) => {
  const { id, ref, createdAt, updatedAt, ...rest } = x;
  void id; void ref; void createdAt; void updatedAt;
  return rest as unknown as RaidInput;
};
const data = () =>
  makeData({
    projects: [makeProject(), makeProject({ id: "p2" }), makeProject({ id: "arch", name: "Old", archivedAt: "2026-06-01T00:00:00.000Z" })],
    milestones: [makeMilestone({ id: "m1" }), makeMilestone({ id: "m2", projectId: "p2" })],
    tasks: [makeTask({ id: "t1" }), makeTask({ id: "t2", projectId: "p2" })],
  });

function ruleErrors(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    if (e instanceof RaidRuleError) return e.fieldErrors;
    throw e;
  }
  throw new Error("expected a RaidRuleError");
}

describe("risk scoring", () => {
  it("score = probability × impact", () => {
    expect(riskScore({ probability: 3, impact: 4 })).toBe(12);
    expect(riskScore({ probability: 5, impact: 5 })).toBe(25);
  });
  it("levels follow the documented thresholds at every boundary", () => {
    expect([1, 4, 5, 9, 10, 14, 15, 25].map(riskLevel)).toEqual(["low", "low", "medium", "medium", "high", "high", "critical", "critical"]);
  });
  it("severity is the risk level for risks and the recorded priority otherwise", () => {
    expect(severityOf(makeRisk({ probability: 5, impact: 4 }))).toBe("critical");
    expect(severityOf(makeIssue({ priority: "low" }))).toBe("low");
  });
  it("high/critical counts only open risks at level high or above", () => {
    expect(isHighOrCriticalRisk(makeRisk({ probability: 2, impact: 5 }))).toBe(true); // 10
    expect(isHighOrCriticalRisk(makeRisk({ probability: 3, impact: 3 }))).toBe(false); // 9
    expect(isHighOrCriticalRisk(makeRisk({ probability: 5, impact: 5, status: "closed" }))).toBe(false);
  });
});

describe("overdue, upcoming and escalation", () => {
  it("uses each type's own deadline and ignores closed records", () => {
    expect(isOverdue(makeRisk({ targetDate: "2026-06-14" }), TODAY)).toBe(true); // review date
    expect(isOverdue(makeAssumption({ targetDate: "2026-06-14" }), TODAY)).toBe(true); // validation deadline
    expect(isOverdue(makeIssue({ targetDate: "2026-06-14" }), TODAY)).toBe(true);
    expect(isOverdue(makeDependency({ targetDate: "2026-06-14" }), TODAY)).toBe(true); // required-by
    expect(isOverdue(makeRisk({ targetDate: TODAY }), TODAY)).toBe(false);
    expect(isOverdue(makeAssumption({ targetDate: "2026-06-01", status: "validated" }), TODAY)).toBe(false);
    expect(isOverdue(makeDependency({ targetDate: "2026-06-01", status: "fulfilled" }), TODAY)).toBe(false);
  });
  it("upcoming = open with a deadline in the next 14 days", () => {
    expect(isUpcomingReview(makeRisk({ targetDate: TODAY }), TODAY)).toBe(true);
    expect(isUpcomingReview(makeRisk({ targetDate: "2026-06-29" }), TODAY)).toBe(true);
    expect(isUpcomingReview(makeRisk({ targetDate: "2026-06-30" }), TODAY)).toBe(false);
    expect(isUpcomingReview(makeRisk({ targetDate: "2026-06-20", status: "closed" }), TODAY)).toBe(false);
  });
  it("flags escalated issues and blocked dependencies", () => {
    expect(escalationNote(makeIssue({ status: "escalated", escalatedDate: "2026-06-12", escalationReason: "Vendor silent" }))).toBe("Escalated on 12 Jun 2026: Vendor silent");
    expect(escalationNote(makeDependency({ status: "blocked", escalationOwner: "Pat" }))).toBe("Blocked · escalation owner Pat");
    expect(escalationNote(makeIssue())).toBeNull();
  });
  it("assigns per-type references without reusing numbers", () => {
    expect(nextRaidRef("risk", [{ ref: "R-001" }, { ref: "R-009" }, { ref: "I-020" }])).toBe("R-010");
    expect(nextRaidRef("dependency", [])).toBe("D-001");
  });
});

describe("associations", () => {
  it("validates project, milestone and task", () => {
    const d = data();
    expect(ruleErrors(() => resolveRaidWrite(d, null, strip(makeRisk({ projectId: "nope" })), TODAY)).projectId).toEqual(["Choose a project that exists."]);
    expect(ruleErrors(() => resolveRaidWrite(d, null, strip(makeRisk({ projectId: "arch" })), TODAY)).projectId?.[0]).toMatch(/archived/);
    const e = ruleErrors(() => resolveRaidWrite(d, null, strip(makeRisk({ milestoneId: "m2", taskId: "t2" })), TODAY));
    expect(e.milestoneId).toEqual(["The milestone belongs to a different project."]);
    expect(e.taskId).toEqual(["The task belongs to a different project."]);
    expect(ruleErrors(() => resolveRaidWrite(d, null, strip(makeRisk({ milestoneId: "ghost" })), TODAY)).milestoneId).toEqual(["Choose a milestone that exists."]);
    expect(resolveRaidWrite(d, null, strip(makeRisk({ milestoneId: "m1", taskId: "t1" })), TODAY).draft).toMatchObject({ milestoneId: "m1", taskId: "t1" });
  });
  it("refuses changing the type or using another type's status", () => {
    const d = data();
    const existing = makeRisk();
    expect(ruleErrors(() => resolveRaidWrite(d, existing, strip(makeIssue()), TODAY)).type?.[0]).toMatch(/cannot be changed/);
    expect(ruleErrors(() => resolveRaidWrite(d, null, strip(makeRisk({ status: "fulfilled" as never })), TODAY)).status?.[0]).toMatch(/not a valid status for a risk/);
  });
});

describe("status transitions and requirements", () => {
  it("rejects invalid transitions and names the allowed ones", () => {
    const d = data();
    expect(ruleErrors(() => resolveRaidWrite(d, makeIssue(), strip(makeIssue({ status: "closed" })), TODAY)).status).toEqual([
      "An issue cannot move from Open to Closed. Allowed next: Investigating, Escalated, Resolved.",
    ]);
    expect(ruleErrors(() => resolveRaidWrite(d, makeRisk({ status: "materialized" }), strip(makeRisk({ status: "open" })), TODAY)).status?.[0]).toMatch(/cannot move from Materialized to Open/);
    expect(() => resolveRaidWrite(d, makeDependency({ status: "fulfilled" }), strip(makeDependency({ status: "blocked", escalationOwner: "X" })), TODAY)).toThrow(/Fulfilled to Blocked/);
  });

  it("escalation needs a reason and records the escalation date", () => {
    const d = data();
    expect(ruleErrors(() => resolveRaidWrite(d, makeIssue(), strip(makeIssue({ status: "escalated" })), TODAY)).escalationReason).toEqual(["Give a reason when escalating an issue."]);
    const r = resolveRaidWrite(d, makeIssue(), strip(makeIssue({ status: "escalated", escalationReason: "Vendor missed fix" })), TODAY);
    expect(r.draft).toMatchObject({ status: "escalated", escalatedDate: TODAY });
    expect(r.changes).toEqual(["Escalated: Vendor missed fix."]);
    // staying escalated keeps the original date
    const again = resolveRaidWrite(d, makeIssue({ status: "escalated", escalatedDate: "2026-06-10", escalationReason: "x" }), strip(makeIssue({ status: "escalated", escalationReason: "x" })), TODAY);
    expect(again.draft).toMatchObject({ escalatedDate: "2026-06-10" });
  });

  it("validating an assumption needs evidence; blocking a dependency needs an escalation owner", () => {
    const d = data();
    expect(ruleErrors(() => resolveRaidWrite(d, makeAssumption(), strip(makeAssumption({ status: "validated" })), TODAY)).validationNotes?.[0]).toMatch(/Record the evidence/);
    expect(ruleErrors(() => resolveRaidWrite(d, makeDependency(), strip(makeDependency({ status: "blocked" })), TODAY)).escalationOwner).toEqual(["Name an escalation owner for a blocked dependency."]);
  });
});

describe("resolution dates", () => {
  const d = data();
  it("records today, or the given date, when a record closes", () => {
    expect(resolveRaidWrite(d, makeIssue({ status: "investigating" }), strip(makeIssue({ status: "resolved" })), TODAY).draft.resolvedDate).toBe(TODAY);
    expect(resolveRaidWrite(d, makeRisk(), strip(makeRisk({ status: "closed", resolvedDate: "2026-06-12" })), TODAY).draft.resolvedDate).toBe("2026-06-12");
    expect(resolveRaidWrite(d, makeDependency(), strip(makeDependency({ status: "fulfilled" })), TODAY).draft.resolvedDate).toBe(TODAY);
  });
  it("keeps the stored date when closed records are edited, moving between closed states", () => {
    const resolved = makeIssue({ status: "resolved", resolvedDate: "2026-06-10" });
    expect(resolveRaidWrite(d, resolved, strip(makeIssue({ status: "closed" })), TODAY).draft.resolvedDate).toBe("2026-06-10");
  });
  it("clears the date on reopen and logs it; rejects future dates", () => {
    const r = resolveRaidWrite(d, makeRisk({ status: "closed", resolvedDate: "2026-06-10" }), strip(makeRisk({ status: "open", resolvedDate: "2026-06-10" })), TODAY);
    expect(r.draft.resolvedDate).toBeNull();
    expect(r.changes[0]).toBe("Status changed from Closed to Open; reopened (was resolved on 10 Jun 2026).");
    expect(ruleErrors(() => resolveRaidWrite(d, makeRisk(), strip(makeRisk({ status: "closed", resolvedDate: "2026-06-16" })), TODAY)).resolvedDate?.[0]).toMatch(/cannot be in the future/);
  });
});

describe("activity descriptions", () => {
  const d = data();
  it("describes creation with the score or priority", () => {
    expect(resolveRaidWrite(d, null, strip(makeRisk({ probability: 4, impact: 4 })), TODAY).changes).toEqual(["Created (score 16, Critical)."]);
    expect(resolveRaidWrite(d, null, strip(makeIssue({ priority: "critical" })), TODAY).changes).toEqual(["Created (Open, Critical)."]);
  });
  it("describes score, deadline, owner and update changes in one entry", () => {
    const before = makeRisk({ probability: 3, impact: 3, targetDate: "2026-06-20", owner: "Ann" });
    const r = resolveRaidWrite(d, before, strip(makeRisk({ probability: 4, impact: 4, targetDate: "2026-06-25", owner: "Bob", latestUpdate: "Vendor responded." })), TODAY);
    expect(r.changes).toEqual([
      "Risk score 9 (Medium) → 16 (Critical); Review date moved from 20 Jun 2026 to 25 Jun 2026; Risk owner changed from Ann to Bob; Update: Vendor responded.",
    ]);
  });
  it("records nothing for an unchanged save", () => {
    expect(resolveRaidWrite(d, makeRisk(), strip(makeRisk()), TODAY).changes).toEqual([]);
  });
});
