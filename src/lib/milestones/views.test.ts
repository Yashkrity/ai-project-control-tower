import { describe, expect, it } from "vitest";
import { makeData, makeMilestone, makeProject, makeTask, TODAY } from "@/test-utils/fixtures";
import { applyMilestoneFilters, buildMilestoneRows, milestoneFiltersToQuery, milestoneViewCounts, parseMilestoneFilters } from "./views";

// TODAY = 2026-06-15
const data = makeData({
  projects: [makeProject(), makeProject({ id: "p2" }), makeProject({ id: "p3", archivedAt: "2026-06-01T00:00:00.000Z" })],
  milestones: [
    makeMilestone({ id: "late", plannedDate: "2026-06-10", owner: "Ann" }),
    makeMilestone({ id: "risk", plannedDate: "2026-06-20", owner: "Bob" }),
    makeMilestone({ id: "later", plannedDate: "2026-08-30", projectId: "p2", owner: "Ann" }),
    makeMilestone({ id: "done", plannedDate: "2026-06-05", actualDate: "2026-06-04" }),
    makeMilestone({ id: "hidden", projectId: "p3" }),
  ],
  tasks: [makeTask({ id: "t", milestoneId: "risk" })],
});
const rows = buildMilestoneRows(data, TODAY);
const ids = (f: Parameters<typeof applyMilestoneFilters>[1]) => applyMilestoneFilters(rows, f).map((r) => r.milestone.id);

describe("milestone views", () => {
  it("excludes archived projects and orders open milestones first", () => {
    expect(ids({ view: "all" })).toEqual(["late", "risk", "later", "done"]);
  });

  it("filters by view", () => {
    expect(ids({ view: "upcoming" })).toEqual(["risk"]);
    expect(ids({ view: "overdue" })).toEqual(["late"]);
    expect(ids({ view: "at-risk" })).toEqual(["risk"]);
    expect(ids({ view: "completed" })).toEqual(["done"]);
  });

  it("filters by project, owner, status and planned-date range", () => {
    expect(ids({ view: "all", project: "p2" })).toEqual(["later"]);
    expect(ids({ view: "all", owner: "Ann" })).toEqual(["late", "later"]);
    expect(ids({ view: "all", status: "delayed" })).toEqual(["late"]);
    expect(ids({ view: "all", from: "2026-06-10", to: "2026-06-30" })).toEqual(["late", "risk"]);
  });

  it("counts every view with the other filters applied", () => {
    expect(milestoneViewCounts(rows, { view: "all", owner: "Ann" })).toEqual({ all: 2, upcoming: 0, overdue: 1, "at-risk": 0, completed: 0 });
  });

  it("parses filters, ignoring invalid values, and builds query strings", () => {
    const f = parseMilestoneFilters({ view: "at-risk", status: "nope", from: "2026-06-01", to: "06/30/2026", owner: "Ann" });
    expect(f).toEqual({ view: "at-risk", project: undefined, owner: "Ann", status: undefined, from: "2026-06-01", to: undefined });
    expect(milestoneFiltersToQuery(f, { view: "all" })).toBe("?owner=Ann&from=2026-06-01");
  });
});
