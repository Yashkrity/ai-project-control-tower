import { describe, expect, it } from "vitest";
import { makeData, makeMilestone, makeProject, makeTask, taskInput, TODAY } from "@/test-utils/fixtures";
import {
  assertTaskDeletable,
  dependentsClosure,
  findCycle,
  indexTasks,
  isTaskDueSoon,
  resolveTaskWrite,
  taskBlockInfo,
  TaskRuleError,
} from "./rules";

const ctx = { today: TODAY };

/** Runs resolveTaskWrite and returns the rule errors it throws (or fails). */
function ruleErrors(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    if (e instanceof TaskRuleError) return e.fieldErrors;
    throw e;
  }
  throw new Error("expected a TaskRuleError");
}

// a <- b <- c  (b depends on a, c depends on b)
const chain = () =>
  makeData({
    tasks: [
      makeTask({ id: "a", title: "A" }),
      makeTask({ id: "b", title: "B", dependsOn: ["a"] }),
      makeTask({ id: "c", title: "C", dependsOn: ["b"] }),
    ],
  });

describe("project and milestone associations", () => {
  it("accepts a valid task", () => {
    const r = resolveTaskWrite(makeData(), null, taskInput(), ctx);
    expect(r.draft).toMatchObject({ title: "New task", completedDate: null, dependsOn: [] });
    expect(r.transition).toBeNull();
  });

  it("rejects a nonexistent project", () => {
    expect(ruleErrors(() => resolveTaskWrite(makeData(), null, taskInput({ projectId: "nope" }), ctx)).projectId).toEqual([
      "Choose a project that exists.",
    ]);
  });

  it("rejects an archived project", () => {
    const data = makeData({ projects: [makeProject({ archivedAt: "2026-06-02T00:00:00.000Z" })] });
    expect(ruleErrors(() => resolveTaskWrite(data, null, taskInput(), ctx)).projectId?.[0]).toMatch(/archived/);
  });

  it("rejects a milestone from another project or one that does not exist", () => {
    const data = makeData({
      projects: [makeProject(), makeProject({ id: "p2", name: "P2" })],
      milestones: [makeMilestone({ id: "m2", projectId: "p2" })],
    });
    expect(ruleErrors(() => resolveTaskWrite(data, null, taskInput({ milestoneId: "m2" }), ctx)).milestoneId).toEqual([
      "The milestone belongs to a different project.",
    ]);
    expect(ruleErrors(() => resolveTaskWrite(data, null, taskInput({ milestoneId: "zzz" }), ctx)).milestoneId).toEqual([
      "Choose a milestone that exists.",
    ]);
  });

  it("blocks moving a task to another project while tasks there would lose their predecessor", () => {
    const data = makeData({
      projects: [makeProject(), makeProject({ id: "p2", name: "P2" })],
      tasks: [makeTask({ id: "a", title: "A" }), makeTask({ id: "b", title: "B", dependsOn: ["a"] })],
    });
    const errors = ruleErrors(() => resolveTaskWrite(data, data.tasks[0], taskInput({ title: "A", projectId: "p2" }), ctx));
    expect(errors.projectId?.[0]).toMatch(/“B”/);
  });
});

describe("dependency validation", () => {
  it("rejects nonexistent, self and cross-project predecessors", () => {
    const data = makeData({
      projects: [makeProject(), makeProject({ id: "p2" })],
      tasks: [makeTask({ id: "a" }), makeTask({ id: "x", projectId: "p2", title: "Other" })],
    });
    const errors = ruleErrors(() => resolveTaskWrite(data, data.tasks[0], taskInput({ dependsOn: ["ghost", "a", "x"] }), ctx));
    expect(errors.dependsOn).toEqual([
      "Predecessor “ghost” does not exist.",
      "A task cannot depend on itself.",
      "“Other” is in another project. Dependencies must be within the same project.",
    ]);
  });

  it("removes duplicate predecessors", () => {
    const data = makeData({ tasks: [makeTask({ id: "a" })] });
    expect(resolveTaskWrite(data, null, taskInput({ dependsOn: ["a", "a"] }), ctx).draft.dependsOn).toEqual(["a"]);
  });

  it("rejects a direct cycle", () => {
    const data = chain();
    const a = data.tasks[0];
    const errors = ruleErrors(() => resolveTaskWrite(data, a, taskInput({ title: "A", dependsOn: ["b"] }), ctx));
    expect(errors.dependsOn).toEqual(["This would create a circular dependency: “A” → “B” → “A”."]);
  });

  it("rejects an indirect cycle and names every task on it", () => {
    const data = chain();
    const errors = ruleErrors(() => resolveTaskWrite(data, data.tasks[0], taskInput({ title: "A", dependsOn: ["c"] }), ctx));
    expect(errors.dependsOn).toEqual(["This would create a circular dependency: “A” → “C” → “B” → “A”."]);
  });

  it("findCycle returns null for an acyclic change and the path for a cyclic one", () => {
    const { tasks } = chain();
    expect(findCycle("c", ["a"], tasks)).toBeNull();
    expect(findCycle("a", ["c"], tasks)).toEqual(["a", "c", "b", "a"]);
  });

  it("dependentsClosure lists every transitive dependent", () => {
    expect([...dependentsClosure("a", chain().tasks)].sort()).toEqual(["b", "c"]);
  });
});

describe("done gate", () => {
  const data = () => makeData({ tasks: [makeTask({ id: "a", title: "A", status: "in_progress" }), makeTask({ id: "b", title: "B", dependsOn: ["a"] })] });

  it("refuses Done while a predecessor is incomplete", () => {
    const d = data();
    const errors = ruleErrors(() => resolveTaskWrite(d, d.tasks[1], taskInput({ title: "B", status: "done", dependsOn: ["a"] }), ctx));
    expect(errors.status?.[0]).toBe("Cannot mark as done: still waiting on “A” (In progress). Complete those first, or tick “Complete anyway”.");
  });

  it("allows Done with an explicit override and reports what was overridden", () => {
    const d = data();
    const r = resolveTaskWrite(d, d.tasks[1], taskInput({ title: "B", status: "done", dependsOn: ["a"] }), { ...ctx, overrideDependencies: true });
    expect(r.draft.status).toBe("done");
    expect(r.overriddenPredecessors.map((t) => t.id)).toEqual(["a"]);
  });

  it("allows Done once predecessors are done", () => {
    const d = data();
    d.tasks[0].status = "done";
    expect(resolveTaskWrite(d, d.tasks[1], taskInput({ status: "done", dependsOn: ["a"] }), ctx).transition).toBe("completed");
  });
});

describe("completion date", () => {
  const open = makeTask({ id: "t1", status: "in_progress" });
  const done = makeTask({ id: "t1", status: "done", completedDate: "2026-06-10" });

  it("records today when a task becomes done without a date", () => {
    const r = resolveTaskWrite(makeData({ tasks: [open] }), open, taskInput({ status: "done" }), ctx);
    expect(r.draft.completedDate).toBe(TODAY);
    expect(r.transition).toBe("completed");
  });

  it("uses the submitted date, which need not equal the due date", () => {
    const r = resolveTaskWrite(makeData({ tasks: [open] }), open, taskInput({ status: "done", completedDate: "2026-06-12" }), ctx);
    expect(r.draft.completedDate).toBe("2026-06-12");
    expect(r.draft.completedDate).not.toBe(r.draft.dueDate);
  });

  it("keeps the stored date when an already-done task is edited", () => {
    const r = resolveTaskWrite(makeData({ tasks: [done] }), done, taskInput({ status: "done", title: "Renamed" }), ctx);
    expect(r.draft.completedDate).toBe("2026-06-10");
    expect(r.transition).toBeNull();
  });

  it("rejects a completion date in the future", () => {
    const errors = ruleErrors(() => resolveTaskWrite(makeData({ tasks: [open] }), open, taskInput({ status: "done", completedDate: "2026-06-16" }), ctx));
    expect(errors.completedDate?.[0]).toMatch(/cannot be in the future/);
  });

  it("clears the date when a done task is reopened, and ignores a stray submitted date", () => {
    const r = resolveTaskWrite(makeData({ tasks: [done] }), done, taskInput({ status: "in_progress", completedDate: "2026-06-10" }), ctx);
    expect(r.draft.completedDate).toBeNull();
    expect(r.transition).toBe("reopened");
  });
});

describe("blocked and due-soon rules", () => {
  const tasks = [
    makeTask({ id: "a", title: "A", status: "in_progress" }),
    makeTask({ id: "b", dependsOn: ["a"], startDate: "2026-06-10" }), // underway, waiting -> blocked
    makeTask({ id: "c", dependsOn: ["a"], startDate: "2026-07-01" }), // future start -> waiting, not blocked
    makeTask({ id: "d", dependsOn: ["a"], status: "on_hold" }), // on hold -> not blocked
    makeTask({ id: "e", status: "blocked" }), // marked blocked
    makeTask({ id: "f", dependsOn: ["a"], status: "done", completedDate: "2026-06-01" }),
  ];
  const byId = indexTasks(tasks);
  const info = (id: string) => taskBlockInfo(byId.get(id)!, byId, TODAY);

  it("classifies each case", () => {
    expect(info("b")).toMatchObject({ blocked: true, byDependencies: true, byStatus: false });
    expect(info("b").waitingOn.map((t) => t.id)).toEqual(["a"]);
    expect(info("c")).toMatchObject({ blocked: false, byDependencies: false });
    expect(info("c").waitingOn).toHaveLength(1);
    expect(info("d").blocked).toBe(false);
    expect(info("e")).toMatchObject({ blocked: true, byStatus: true });
    expect(info("f")).toMatchObject({ blocked: false, waitingOn: [] });
  });

  it("due soon = open and due within 7 days", () => {
    expect(isTaskDueSoon(makeTask({ dueDate: TODAY }), TODAY)).toBe(true);
    expect(isTaskDueSoon(makeTask({ dueDate: "2026-06-22" }), TODAY)).toBe(true);
    expect(isTaskDueSoon(makeTask({ dueDate: "2026-06-23" }), TODAY)).toBe(false);
    expect(isTaskDueSoon(makeTask({ dueDate: "2026-06-14" }), TODAY)).toBe(false);
    expect(isTaskDueSoon(makeTask({ dueDate: TODAY, status: "done" }), TODAY)).toBe(false);
  });
});

describe("delete guard", () => {
  it("refuses to delete a task others depend on, and names them", () => {
    const data = chain();
    expect(() => assertTaskDeletable(data, data.tasks[0])).toThrow("Cannot delete: “B” depends on this task. Remove those dependencies first.");
    expect(() => assertTaskDeletable(data, data.tasks[2])).not.toThrow();
  });
});
