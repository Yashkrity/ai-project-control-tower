import { describe, expect, it } from "vitest";
import { parseTaskForm, taskToFormValues } from "./task";
import { makeTask } from "@/test-utils/fixtures";

const base: Record<string, string> = {
  title: "  Configure GL  ",
  description: "",
  projectId: "p1",
  milestoneId: "",
  owner: "Leah Chen",
  priority: "high",
  status: "in_progress",
  startDate: "2026-06-01",
  dueDate: "2026-06-30",
  completedDate: "",
};

const form = (over: Record<string, string | undefined> = {}, dependsOn: string[] = [], override = false) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...base, ...over })) if (v !== undefined) fd.set(k, v);
  for (const id of dependsOn) fd.append("dependsOn", id);
  if (override) fd.set("overrideDependencies", "on");
  return fd;
};

describe("parseTaskForm", () => {
  it("parses valid input: trims, nulls blank milestone and completion date, reads all predecessors", () => {
    const r = parseTaskForm(form({}, ["a", "b"], true));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).toMatchObject({ title: "Configure GL", milestoneId: null, completedDate: null, dependsOn: ["a", "b"] });
    expect(r.overrideDependencies).toBe(true);
  });

  it("reports missing required fields", () => {
    const r = parseTaskForm(form({ title: "", owner: " ", projectId: "", startDate: "", dueDate: undefined }));
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.fieldErrors.title).toEqual(["Title is required"]);
    expect(r.fieldErrors.owner).toEqual(["Owner is required"]);
    expect(r.fieldErrors.projectId).toEqual(["Choose a project"]);
    expect(r.fieldErrors.startDate).toEqual(["Start date is required"]);
    expect(r.fieldErrors.dueDate).toEqual(["Due date is required"]);
  });

  it("rejects invalid priority, status and dates", () => {
    const r = parseTaskForm(form({ priority: "urgent", status: "todo", completedDate: "2026-13-01" }));
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.fieldErrors.priority).toEqual(["Choose a valid priority"]);
    expect(r.fieldErrors.status).toEqual(["Choose a valid status"]);
    expect(r.fieldErrors.completedDate).toEqual(["Completion date must be a valid date"]);
  });

  it("reports due-before-start together with other errors", () => {
    const r = parseTaskForm(form({ title: "", dueDate: "2026-05-01" }));
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.fieldErrors.title).toBeDefined();
    expect(r.fieldErrors.dueDate).toEqual(["Due date cannot be before the start date"]);
  });

  it("caps the number of predecessors", () => {
    const r = parseTaskForm(form({}, Array.from({ length: 51 }, (_, i) => `t${i}`)));
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.fieldErrors.dependsOn).toEqual(["A task can have at most 50 predecessors"]);
  });

  it("echoes values (including predecessors) so the form keeps them", () => {
    const r = parseTaskForm(form({ title: "" }, ["a"]));
    if (r.success) throw new Error("expected failure");
    expect(r.values.dependsOn).toEqual(["a"]);
    expect(r.values.owner).toBe("Leah Chen");
  });

  it("round-trips a stored task through form values", () => {
    const task = makeTask({ status: "done", completedDate: "2026-06-10", dependsOn: ["x"], milestoneId: "m1" });
    const fd = new FormData();
    const values = taskToFormValues(task);
    for (const [k, v] of Object.entries(values)) if (typeof v === "string") fd.set(k, v);
    for (const id of values.dependsOn ?? []) fd.append("dependsOn", id);
    const r = parseTaskForm(fd);
    expect(r.success && r.data).toMatchObject({ status: "done", completedDate: "2026-06-10", dependsOn: ["x"], milestoneId: "m1" });
  });
});
