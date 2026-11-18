import { describe, expect, it } from "vitest";
import { makeMilestone } from "@/test-utils/fixtures";
import { milestoneToFormValues, parseMilestoneForm } from "./milestone";

const base: Record<string, string> = {
  name: "  Go-live  ",
  description: "",
  projectId: "p1",
  owner: "Priya Sharma",
  priority: "critical",
  plannedStartDate: "2026-06-01",
  plannedDate: "2026-07-01",
  actualDate: "",
  notes: "",
};
const form = (over: Record<string, string | undefined> = {}) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...base, ...over })) if (v !== undefined) fd.set(k, v);
  return fd;
};

describe("parseMilestoneForm", () => {
  it("parses valid input; blank actual date becomes null", () => {
    const r = parseMilestoneForm(form());
    expect(r.success && r.data).toMatchObject({ name: "Go-live", actualDate: null, priority: "critical" });
  });

  it("reports required fields", () => {
    const r = parseMilestoneForm(form({ name: "", owner: undefined, projectId: "", plannedStartDate: "", plannedDate: "" }));
    if (r.success) throw new Error("expected failure");
    expect(r.fieldErrors).toMatchObject({
      name: ["Title is required"],
      owner: ["Owner is required"],
      projectId: ["Choose a project"],
      plannedStartDate: ["Planned start is required"],
      plannedDate: ["Planned completion is required"],
    });
  });

  it("validates dates and priority", () => {
    const r = parseMilestoneForm(form({ plannedDate: "2026-05-01", actualDate: "2026-02-30", priority: "urgent", name: "" }));
    if (r.success) throw new Error("expected failure");
    expect(r.fieldErrors.plannedDate).toEqual(["Planned completion cannot be before the planned start"]);
    expect(r.fieldErrors.actualDate).toEqual(["Actual completion must be a valid date"]);
    expect(r.fieldErrors.priority).toEqual(["Choose a valid priority"]);
  });

  it("round-trips a stored milestone", () => {
    const fd = new FormData();
    const values = milestoneToFormValues(makeMilestone({ actualDate: "2026-06-20", notes: "n" }));
    for (const [k, v] of Object.entries(values)) fd.set(k, v ?? "");
    expect(parseMilestoneForm(fd)).toMatchObject({ success: true, data: { actualDate: "2026-06-20", notes: "n" } });
  });
});
