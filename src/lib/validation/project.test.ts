import { describe, expect, it } from "vitest";
import { parseProjectForm, projectToFormValues } from "./project";

const valid: Record<string, string> = {
  name: "  Payments Revamp  ",
  client: "Acme",
  description: "Rebuild checkout",
  projectManager: "Sam Lee",
  startDate: "2026-01-10",
  targetEndDate: "2026-06-30",
  budget: "250,000",
  actualSpend: "1000.50",
  status: "active",
  health: "amber",
};

const form = (over: Record<string, string | undefined> = {}) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...valid, ...over })) if (v !== undefined) fd.set(k, v);
  return fd;
};

describe("parseProjectForm", () => {
  it("accepts valid input, trims text and parses money", () => {
    const r = parseProjectForm(form());
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.name).toBe("Payments Revamp");
    expect(r.data.budget).toBe(250000);
    expect(r.data.actualSpend).toBe(1000.5);
  });

  it("treats a missing description as empty", () => {
    const r = parseProjectForm(form({ description: undefined }));
    expect(r.success && r.data.description).toBe("");
  });

  it("reports required fields with readable messages", () => {
    const r = parseProjectForm(form({ name: "   ", client: undefined, budget: "", startDate: "" }));
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.fieldErrors.name).toEqual(["Project name is required"]);
    expect(r.fieldErrors.client).toEqual(["Client is required"]);
    expect(r.fieldErrors.budget).toEqual(["Budget is required"]);
    expect(r.fieldErrors.startDate).toEqual(["Start date is required"]);
  });

  it("rejects bad numbers, dates and enum values", () => {
    const r = parseProjectForm(
      form({ budget: "abc", actualSpend: "-5", startDate: "2026-02-30", status: "archived", health: "blue" }),
    );
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.fieldErrors.budget).toEqual(["Budget must be a number"]);
    expect(r.fieldErrors.actualSpend).toEqual(["Actual expenditure cannot be negative"]);
    expect(r.fieldErrors.startDate).toEqual(["Start date must be a valid date"]);
    expect(r.fieldErrors.status).toEqual(["Choose a valid status"]);
    expect(r.fieldErrors.health).toEqual(["Choose a valid health rating"]);
  });

  it("rejects an end date before the start date", () => {
    const r = parseProjectForm(form({ targetEndDate: "2026-01-01" }));
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.fieldErrors.targetEndDate).toEqual(["Target end date cannot be before the start date"]);
  });

  it("reports date order even when other fields are also invalid", () => {
    const r = parseProjectForm(form({ name: "", targetEndDate: "2026-01-01" }));
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.fieldErrors.name).toBeDefined();
    expect(r.fieldErrors.targetEndDate).toEqual(["Target end date cannot be before the start date"]);
  });

  it("echoes submitted values so the form can be re-filled", () => {
    const r = parseProjectForm(form({ name: "X" }));
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.fieldErrors.name).toEqual(["Project name must be at least 2 characters"]);
    expect(r.values.client).toBe("Acme");
  });

  it("round-trips a stored project through form values", () => {
    const r = parseProjectForm(form());
    if (!r.success) throw new Error("expected valid");
    const fd = new FormData();
    for (const [k, v] of Object.entries(projectToFormValues(r.data))) fd.set(k, v ?? "");
    expect(parseProjectForm(fd)).toEqual({ success: true, data: r.data });
  });
});
