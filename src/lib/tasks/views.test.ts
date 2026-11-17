import { describe, expect, it } from "vitest";
import { makeData, makeProject, makeTask, TODAY } from "@/test-utils/fixtures";
import { applyTaskFilters, buildTaskRows, filtersToQuery, parseTaskFilters, viewCounts } from "./views";

const data = makeData({
  projects: [makeProject(), makeProject({ id: "p2", name: "Two" }), makeProject({ id: "p3", archivedAt: "2026-06-01T00:00:00.000Z" })],
  tasks: [
    makeTask({ id: "late", dueDate: "2026-06-10", owner: "Ann", priority: "critical", status: "in_progress" }),
    makeTask({ id: "soon", dueDate: "2026-06-18", owner: "Bob" }),
    makeTask({ id: "blocked", status: "blocked", projectId: "p2", owner: "Ann" }),
    makeTask({ id: "done", status: "done", completedDate: "2026-06-12", dueDate: "2026-06-11" }),
    makeTask({ id: "archived", projectId: "p3", dueDate: "2026-06-01" }),
  ],
});
const rows = buildTaskRows(data, TODAY);
const ids = (f: Parameters<typeof applyTaskFilters>[1]) => applyTaskFilters(rows, f).map((r) => r.task.id);

describe("task views", () => {
  it("hides tasks in archived projects", () => {
    expect(rows.map((r) => r.task.id)).not.toContain("archived");
  });

  it("filters by view", () => {
    expect(ids({ view: "overdue" })).toEqual(["late"]);
    expect(ids({ view: "due-soon" })).toEqual(["soon"]);
    expect(ids({ view: "blocked" })).toEqual(["blocked"]);
    expect(ids({ view: "completed" })).toEqual(["done"]);
    expect(ids({ view: "all" }).at(-1)).toBe("done"); // open work first
  });

  it("filters by project, owner, priority and status, combined with a view", () => {
    expect(ids({ view: "all", project: "p2" })).toEqual(["blocked"]);
    expect(ids({ view: "all", owner: "Ann" }).sort()).toEqual(["blocked", "late"]);
    expect(ids({ view: "all", priority: "critical" })).toEqual(["late"]);
    expect(ids({ view: "all", status: "done" })).toEqual(["done"]);
    expect(ids({ view: "overdue", owner: "Bob" })).toEqual([]);
  });

  it("counts each view with the other filters applied", () => {
    expect(viewCounts(rows, { view: "all", owner: "Ann" })).toEqual({ all: 2, overdue: 1, "due-soon": 0, blocked: 1, completed: 0 });
  });

  it("parses and serialises filters, ignoring unknown values", () => {
    const f = parseTaskFilters({ view: "blocked", project: "p1", priority: "urgent", status: "on_hold", owner: ["Ann", "Bob"] });
    expect(f).toEqual({ view: "blocked", project: "p1", owner: "Ann", priority: undefined, status: "on_hold" });
    expect(parseTaskFilters({ view: "nonsense" }).view).toBe("all");
    expect(filtersToQuery(f, { view: "all" })).toBe("?project=p1&owner=Ann&status=on_hold");
  });
});
