import { describe, expect, it } from "vitest";
import { makeAssumption, makeData, makeDependency, makeIssue, makeProject, makeRisk, makeTask, TODAY } from "@/test-utils/fixtures";
import { applyRaidFilters, buildRaidRows, parseRaidFilters, raidCounts, raidFiltersToQuery, type RaidFilters } from "./views";

const data = makeData({
  projects: [makeProject(), makeProject({ id: "p2", name: "Two" }), makeProject({ id: "p3", archivedAt: "2026-06-01T00:00:00.000Z" })],
  tasks: [makeTask({ id: "t1", title: "Cutover" })],
  raidItems: [
    makeRisk({ id: "r1", ref: "R-001", title: "Vendor delay", probability: 4, impact: 4, targetDate: "2026-06-20", owner: "Ann", taskId: "t1" }),
    makeRisk({ id: "r2", ref: "R-002", title: "Minor UI risk", probability: 1, impact: 2, targetDate: "2026-07-30", owner: "Bob" }),
    makeAssumption({ id: "a1", ref: "A-001", title: "Budget approved", targetDate: "2026-06-10", projectId: "p2" }),
    makeIssue({ id: "i1", ref: "I-001", title: "Outage", status: "escalated", escalationReason: "x", escalatedDate: "2026-06-12", targetDate: "2026-06-18", priority: "critical" }),
    makeIssue({ id: "i2", ref: "I-002", title: "Old bug", status: "closed", resolvedDate: "2026-06-01", targetDate: "2026-06-01" }),
    makeDependency({ id: "d1", ref: "D-001", title: "Licences", status: "blocked", escalationOwner: "P", targetDate: "2026-06-25" }),
    makeRisk({ id: "hidden", ref: "R-003", projectId: "p3" }),
  ],
});
const rows = buildRaidRows(data, TODAY);
const f = (over: Partial<RaidFilters> = {}): RaidFilters => ({ tab: "all", sort: "deadline", ...over });
const refs = (filters: RaidFilters) => applyRaidFilters(rows, filters).map((r) => r.item.ref);

describe("RAID register views", () => {
  it("excludes archived projects and resolves linked task names", () => {
    expect(rows).toHaveLength(6);
    expect(rows.find((r) => r.item.id === "r1")!.task).toEqual({ id: "t1", title: "Cutover" });
  });

  it("filters by type tab and focus views", () => {
    expect(refs(f({ tab: "risk" }))).toEqual(["R-001", "R-002"]);
    expect(refs(f({ focus: "high-risks" }))).toEqual(["R-001"]);
    expect(refs(f({ focus: "overdue" }))).toEqual(["A-001"]);
    expect(refs(f({ focus: "escalated" }))).toEqual(["I-001"]);
    expect(refs(f({ focus: "blocked" }))).toEqual(["D-001"]);
    expect(refs(f({ focus: "upcoming" }))).toEqual(["I-001", "R-001", "D-001"]);
  });

  it("filters by project, owner, state, status, severity, date range and search", () => {
    expect(refs(f({ project: "p2" }))).toEqual(["A-001"]);
    expect(refs(f({ owner: "Bob" }))).toEqual(["R-002"]);
    expect(refs(f({ state: "closed" }))).toEqual(["I-002"]);
    expect(refs(f({ tab: "issue", status: "escalated" }))).toEqual(["I-001"]);
    expect(refs(f({ severity: "critical" }))).toEqual(["I-001", "R-001"]);
    expect(refs(f({ from: "2026-06-15", to: "2026-06-21" }))).toEqual(["I-001", "R-001"]);
    expect(refs(f({ q: "licen" }))).toEqual(["D-001"]);
    expect(refs(f({ q: "r-002" }))).toEqual(["R-002"]);
  });

  it("sorts by deadline (open first), severity, and reference", () => {
    expect(refs(f()).at(-1)).toBe("I-002"); // closed last
    expect(refs(f({ sort: "severity" })).slice(0, 2)).toEqual(["R-001", "I-001"]); // risk 16 > issue critical (no score)
    expect(refs(f({ sort: "ref" }))).toEqual(["A-001", "D-001", "I-001", "I-002", "R-001", "R-002"]);
  });

  it("counts tabs and focus views with the other filters applied", () => {
    const c = raidCounts(rows, f({ project: "p1" }));
    expect(c.tabs).toEqual({ all: 5, risk: 2, assumption: 0, issue: 2, dependency: 1 });
    expect(c.focus).toEqual({ "high-risks": 1, overdue: 0, escalated: 1, blocked: 1, upcoming: 3 });
  });

  it("parses query strings safely and round-trips them", () => {
    const parsed = parseRaidFilters({ tab: "issue", status: "escalated", severity: "urgent", focus: "nope", sort: "severity", q: "  outage " });
    expect(parsed).toMatchObject({ tab: "issue", status: "escalated", severity: undefined, focus: undefined, sort: "severity", q: "outage" });
    expect(parseRaidFilters({ status: "escalated" }).status).toBeUndefined(); // status needs a type tab
    expect(raidFiltersToQuery(parsed)).toBe("?tab=issue&status=escalated&q=outage&sort=severity");
  });
});
