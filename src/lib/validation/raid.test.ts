import { describe, expect, it } from "vitest";
import { makeAssumption, makeDependency, makeIssue, makeRisk } from "@/test-utils/fixtures";
import { parseRaidForm, raidToFormValues } from "./raid";

const form = (values: Record<string, string | undefined>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) if (v !== undefined) fd.set(k, v);
  return fd;
};
const base = { projectId: "p1", title: "Vendor delay", owner: "Ann Lee", targetDate: "2026-07-01" };

describe("parseRaidForm", () => {
  it("parses each type with its own fields", () => {
    expect(parseRaidForm(form({ ...base, type: "risk", status: "open", probability: "4", impact: "5" }))).toMatchObject({
      success: true,
      data: { type: "risk", probability: 4, impact: 5, milestoneId: null, resolvedDate: null },
    });
    expect(parseRaidForm(form({ ...base, type: "assumption", status: "pending", priority: "high", description: "Budget is approved in Q3" }))).toMatchObject({ success: true });
    expect(parseRaidForm(form({ ...base, type: "issue", status: "open", priority: "critical" }))).toMatchObject({ success: true, data: { escalatedDate: null } });
    expect(parseRaidForm(form({ ...base, type: "dependency", status: "pending", priority: "low", direction: "internal", requiredFrom: "Platform team" }))).toMatchObject({ success: true });
  });

  it("rejects invalid ratings, missing type-specific fields and wrong statuses", () => {
    const risk = parseRaidForm(form({ ...base, type: "risk", status: "escalated", probability: "6", impact: "2.5" }));
    if (risk.success) throw new Error("expected failure");
    expect(risk.fieldErrors.probability).toEqual(["Probability must be from 1 to 5"]);
    expect(risk.fieldErrors.impact).toEqual(["Impact must be a whole number from 1 to 5"]);
    expect(risk.fieldErrors.status).toEqual(["Choose a valid status"]);

    const assumption = parseRaidForm(form({ ...base, type: "assumption", status: "pending", priority: "high" }));
    if (assumption.success) throw new Error("expected failure");
    expect(assumption.fieldErrors.description).toEqual(["Assumption statement is required"]);

    const dep = parseRaidForm(form({ ...base, type: "dependency", status: "pending", priority: "low", direction: "sideways", targetDate: "" }));
    if (dep.success) throw new Error("expected failure");
    expect(dep.fieldErrors).toMatchObject({ requiredFrom: ["Required from is required"], direction: ["Choose internal or external"], targetDate: ["Required-by date is required"] });
  });

  it("requires a valid type and the common fields", () => {
    const r = parseRaidForm(form({ type: "opportunity" }));
    if (r.success) throw new Error("expected failure");
    expect(r.fieldErrors.type?.[0]).toMatch(/Choose a type/);
    const missing = parseRaidForm(form({ type: "issue", status: "open", priority: "high" }));
    if (missing.success) throw new Error("expected failure");
    expect(missing.fieldErrors).toMatchObject({ title: ["Title is required"], owner: ["Owner is required"], projectId: ["Choose a project"] });
  });

  it("round-trips every type through form values", () => {
    for (const item of [
      makeRisk({ probability: 2, impact: 5, contingency: "c" }),
      makeAssumption({ description: "We assume X holds", status: "validated", validationNotes: "seen", resolvedDate: "2026-06-10" }),
      makeIssue({ status: "escalated", escalationReason: "slow", escalatedDate: "2026-06-11" }),
      makeDependency({ direction: "internal", escalationOwner: "Pat" }),
    ]) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(raidToFormValues(item))) fd.set(k, v ?? "");
      const r = parseRaidForm(fd);
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.type).toBe(item.type);
    }
  });
});
