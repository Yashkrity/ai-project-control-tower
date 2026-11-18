import { describe, expect, it } from "vitest";
import type { MilestoneInput } from "@/lib/types";
import { makeData, makeMilestone, makeProject, makeTask, TODAY } from "@/test-utils/fixtures";
import {
  assertTasksLinkable,
  formatProgress,
  milestoneProgress,
  milestoneState,
  MilestoneRuleError,
  planMilestoneDelete,
  resolveMilestoneWrite,
} from "./rules";

// TODAY = 2026-06-15
const m = (over = {}) => makeMilestone({ id: "m1", plannedDate: "2026-08-01", ...over });
const t = (id: string, over = {}) => makeTask({ id, milestoneId: "m1", ...over });
const state = (milestone = m(), tasks = [t("a")]) => milestoneState(milestone, tasks, TODAY);

function ruleErrors(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    if (e instanceof MilestoneRuleError) return e.fieldErrors;
    throw e;
  }
  throw new Error("expected a MilestoneRuleError");
}

describe("task-based progress", () => {
  it("shows 'No tasks linked' instead of 0% when nothing is linked", () => {
    const p = milestoneProgress([]);
    expect(p).toEqual({ completed: 0, total: 0, percent: null });
    expect(formatProgress(p)).toBe("No tasks linked");
  });

  it("is 0% with no completed tasks, partial, and 100% when all are done", () => {
    expect(milestoneProgress([t("a"), t("b")]).percent).toBe(0);
    expect(milestoneProgress([t("a", { status: "done" }), t("b"), t("c")])).toEqual({ completed: 1, total: 3, percent: 33 });
    expect(milestoneProgress([t("a", { status: "done" })]).percent).toBe(100);
  });

  it("only counts tasks linked to this milestone", () => {
    expect(state(m(), [t("a", { status: "done" }), makeTask({ id: "x", milestoneId: "other" })]).progress.total).toBe(1);
  });
});

describe("calculated status", () => {
  it("Not started: no linked task has started, or no tasks are linked", () => {
    expect(state(m(), [t("a"), t("b", { status: "on_hold" })]).status).toBe("not_started");
    expect(state(m(), []).status).toBe("not_started");
    expect(state(m(), []).explanation).toBe("No tasks linked.");
  });

  it("In progress: at least one linked task has started", () => {
    expect(state(m(), [t("a", { status: "in_progress" }), t("b")]).status).toBe("in_progress");
    expect(state(m(), [t("a", { status: "done" }), t("b")]).status).toBe("in_progress");
  });

  it("At risk: due within 14 days with open tasks (boundary at 14 days)", () => {
    expect(state(m({ plannedDate: "2026-06-29" }), [t("a")]).status).toBe("at_risk"); // 14 days
    expect(state(m({ plannedDate: "2026-06-30" }), [t("a")]).status).toBe("not_started"); // 15 days
    expect(state(m({ plannedDate: TODAY }), [t("a")]).status).toBe("at_risk"); // due today
    expect(state(m({ plannedDate: "2026-06-20" }), []).status).toBe("not_started"); // nothing open
  });

  it("At risk: a linked task is blocked, even when the date is far away", () => {
    const s = state(m(), [t("a", { status: "blocked", title: "Vendor API" }), t("b", { status: "done" })]);
    expect(s.status).toBe("at_risk");
    expect(s.explanation).toBe("A linked task is blocked (“Vendor API”).");
  });

  it("At risk: blocked by an open predecessor counts too", () => {
    const pred = makeTask({ id: "p", milestoneId: null, status: "in_progress" });
    const waiting = t("a", { dependsOn: ["p"], startDate: "2026-06-01", status: "in_progress" });
    expect(state(m(), [pred, waiting]).blockedTasks.map((x) => x.id)).toEqual(["a"]);
  });

  it("Delayed: planned completion has passed and it is not completed (beats At risk)", () => {
    const s = state(m({ plannedDate: "2026-06-10" }), [t("a", { status: "blocked" }), t("b", { status: "done" })]);
    expect(s.status).toBe("delayed");
    expect(s.explanation).toBe("Planned completion (10 Jun 2026) passed 5 days ago with 1 of 2 tasks done.");
    expect(state(m({ plannedDate: "2026-06-10" }), []).status).toBe("delayed");
  });

  it("Completed: needs a recorded date AND every linked task done", () => {
    const done = [t("a", { status: "done" }), t("b", { status: "done" })];
    expect(state(m({ actualDate: "2026-06-12" }), done).status).toBe("completed");
    expect(state(m({ actualDate: "2026-06-12" }), done).explanation).toBe("Completed on 12 Jun 2026, 50 days early.");
    // All done but no date: not completed, flagged as ready
    const ready = state(m(), done);
    expect(ready.status).toBe("in_progress");
    expect(ready.readyToComplete).toBe(true);
    // Date recorded but a task reopened: not completed, explained
    const reopened = state(m({ actualDate: "2026-06-12" }), [t("a", { status: "done" }), t("b", { status: "in_progress" })]);
    expect(reopened.status).not.toBe("completed");
    expect(reopened.explanation).toMatch(/A completion date is recorded, but 1 linked task is not done/);
  });

  it("Completed with no tasks once the date is recorded; late completion reports slip", () => {
    const s = state(m({ plannedDate: "2026-06-01", actualDate: "2026-06-04" }), []);
    expect(s.status).toBe("completed");
    expect(s.slipDays).toBe(3);
  });
});

describe("write rules", () => {
  const input = (over: Partial<MilestoneInput> = {}): MilestoneInput => ({
    projectId: "p1",
    name: "Go-live",
    description: "",
    owner: "Sam",
    priority: "high",
    plannedStartDate: "2026-06-01",
    plannedDate: "2026-07-01",
    actualDate: null,
    notes: "",
    ...over,
  });

  it("validates the project association", () => {
    expect(ruleErrors(() => resolveMilestoneWrite(makeData(), null, input({ projectId: "nope" }), TODAY)).projectId).toEqual(["Choose a project that exists."]);
    const archived = makeData({ projects: [makeProject({ archivedAt: "2026-06-02T00:00:00.000Z" })] });
    expect(ruleErrors(() => resolveMilestoneWrite(archived, null, input(), TODAY)).projectId?.[0]).toMatch(/archived/);
  });

  it("refuses to change the project while tasks are linked", () => {
    const data = makeData({ projects: [makeProject(), makeProject({ id: "p2" })], milestones: [m()], tasks: [t("a")] });
    expect(ruleErrors(() => resolveMilestoneWrite(data, data.milestones[0], input({ projectId: "p2" }), TODAY)).projectId?.[0]).toMatch(/1 task is linked/);
  });

  it("only records completion when every linked task is done, and never in the future", () => {
    const data = makeData({ milestones: [m()], tasks: [t("a", { title: "Cutover", status: "in_progress" })] });
    expect(ruleErrors(() => resolveMilestoneWrite(data, data.milestones[0], input({ actualDate: "2026-06-10" }), TODAY)).actualDate).toEqual([
      "Cannot record completion: 1 linked task is not done (“Cutover”).",
    ]);
    data.tasks[0].status = "done";
    expect(ruleErrors(() => resolveMilestoneWrite(data, data.milestones[0], input({ actualDate: "2026-06-16" }), TODAY)).actualDate?.[0]).toMatch(/cannot be in the future/);
    const ok = resolveMilestoneWrite(data, data.milestones[0], input({ actualDate: "2026-06-14" }), TODAY);
    expect(ok.transition).toBe("completed");
  });

  it("allows completing a milestone with no tasks, and reports reopen and date changes", () => {
    expect(resolveMilestoneWrite(makeData(), null, input({ actualDate: TODAY }), TODAY).transition).toBe("completed");
    const existing = m({ actualDate: "2026-06-10", plannedDate: "2026-06-30" });
    const r = resolveMilestoneWrite(makeData({ milestones: [existing] }), existing, input({ plannedDate: "2026-07-15" }), TODAY);
    expect(r.transition).toBe("reopened");
    expect(r.dateChanges).toEqual(["planned completion moved from 30 Jun 2026 to 15 Jul 2026"]);
  });
});

describe("delete plan", () => {
  const data = () =>
    makeData({
      projects: [makeProject(), makeProject({ id: "p2" })],
      milestones: [m(), m({ id: "m2", name: "Next" }), m({ id: "done", name: "Closed", actualDate: "2026-06-01" }), m({ id: "far", projectId: "p2" })],
      tasks: [t("a", { title: "Open task" })],
    });

  it("requires an explicit choice when tasks are linked", () => {
    expect(ruleErrors(() => planMilestoneDelete(data(), data().milestones[0], { mode: "none" })).form?.[0]).toMatch(/Choose whether to unlink it or move it/);
  });
  it("supports unlinking or moving within the project", () => {
    expect(planMilestoneDelete(data(), data().milestones[0], { mode: "unlink" })).toEqual({ reassignTo: null });
    expect(planMilestoneDelete(data(), data().milestones[0], { mode: "reassign", target: "m2" })).toEqual({ reassignTo: "m2" });
  });
  it("refuses other projects, itself, unknown targets, and completed targets for open tasks", () => {
    const d = data();
    expect(() => planMilestoneDelete(d, d.milestones[0], { mode: "reassign", target: "far" })).toThrow(/same project/);
    expect(() => planMilestoneDelete(d, d.milestones[0], { mode: "reassign", target: "m1" })).toThrow(/Choose another milestone/);
    expect(() => planMilestoneDelete(d, d.milestones[0], { mode: "reassign", target: "" })).toThrow(/Choose another milestone/);
    expect(() => planMilestoneDelete(d, d.milestones[0], { mode: "reassign", target: "done" })).toThrow(/“Closed” is completed/);
  });
  it("needs no choice when nothing is linked", () => {
    expect(planMilestoneDelete(data(), data().milestones[1], { mode: "none" })).toEqual({ reassignTo: null });
  });
});

describe("task linking", () => {
  const data = makeData({
    projects: [makeProject(), makeProject({ id: "p2" })],
    milestones: [m(), m({ id: "done", actualDate: "2026-06-01", name: "Closed" })],
    tasks: [makeTask({ id: "a" }), makeTask({ id: "b", status: "done" }), makeTask({ id: "x", projectId: "p2", title: "Elsewhere" })],
  });
  const pick = (...ids: string[]) => data.tasks.filter((x) => ids.includes(x.id));

  it("links tasks from the same project", () => {
    expect(() => assertTasksLinkable(data, pick("a", "b"), ["a", "b"], "m1")).not.toThrow();
  });
  it("rejects other projects, missing tasks, and open work on a completed milestone", () => {
    expect(() => assertTasksLinkable(data, pick("x"), ["x"], "m1")).toThrow(/same project/);
    expect(() => assertTasksLinkable(data, pick("a"), ["a", "ghost"], "m1")).toThrow(/no longer exist/);
    expect(() => assertTasksLinkable(data, pick("a"), ["a"], "done")).toThrow(/“Closed” is completed/);
    expect(() => assertTasksLinkable(data, pick("b"), ["b"], "done")).not.toThrow(); // done work is fine
  });
});
