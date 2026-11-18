/**
 * Integration tests: RAID services + rules + the real FileRepository.
 * A new repository instance on the same file stands in for a server restart.
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileRepository } from "@/lib/data/file-repository";
import { buildPortfolioSummary } from "@/lib/metrics/portfolio";
import { RaidRuleError } from "@/lib/raid/rules";
import type { RaidInput } from "@/lib/types";
import { TODAY } from "@/test-utils/fixtures";
import { deleteMilestone } from "./milestones";
import { createRaidItem, deleteRaidItem, updateRaidItem } from "./raid";
import { deleteTask } from "./tasks";

let dir: string;
let file: string;
const repo = () => new FileRepository(file, TODAY, () => new Date(`${TODAY}T10:00:00.000Z`));

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "ct-raid-"));
  file = path.join(dir, "portfolio.json");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const ERP = "prj-erp";
const common = { projectId: ERP, description: "", owner: "Ravi Patel", targetDate: "2026-07-01", resolvedDate: null, milestoneId: null, taskId: null, plan: "", latestUpdate: "" };
const risk = (over = {}): RaidInput => ({ ...common, type: "risk", title: "Key engineer leaving", status: "open", probability: 3, impact: 4, contingency: "", ...over });
const assumption = (over = {}): RaidInput => ({ ...common, type: "assumption", title: "UAT users available", description: "Two users full-time", status: "pending", priority: "high", validationNotes: "", ...over });
const issue = (over = {}): RaidInput => ({ ...common, type: "issue", title: "Interface failing", status: "open", priority: "high", businessImpact: "", escalationReason: "", escalatedDate: null, ...over });
const dependency = (over = {}): RaidInput => ({ ...common, type: "dependency", title: "Firewall change", status: "pending", priority: "medium", direction: "external", requiredFrom: "Network team", impactIfUnfulfilled: "", escalationOwner: "", ...over });
const history = async (id: string) => (await repo().getPortfolio()).updates.filter((u) => u.raidItemId === id).map((u) => u.summary);

describe("CRUD for all four types, with persistence", () => {
  it("creates each type with the next reference and reads them back after a restart", async () => {
    const r = repo();
    const created = [
      await createRaidItem(r, risk(), TODAY),
      await createRaidItem(r, assumption(), TODAY),
      await createRaidItem(r, issue(), TODAY),
      await createRaidItem(r, dependency(), TODAY),
    ];
    // The demo seed already holds R-001..R-006, A-001..A-003, I-001..I-004, D-001..D-004.
    expect(created.map((c) => c.ref)).toEqual(["R-007", "A-004", "I-005", "D-005"]);
    for (const c of created) expect(await repo().getRaidItem(c.id)).toEqual(c); // restart
  });

  it("updates, keeps the reference, records history, and deletes", async () => {
    const r = repo();
    const item = await createRaidItem(r, risk(), TODAY);
    const updated = await updateRaidItem(r, item.id, risk({ probability: 5, impact: 4, latestUpdate: "Resignation confirmed." }), TODAY);
    expect(updated).toMatchObject({ ref: item.ref, probability: 5, createdAt: item.createdAt });
    await deleteRaidItem(r, item.id);
    expect(await repo().getRaidItem(item.id)).toBeNull();
    expect(await history(item.id)).toEqual([
      "R-007 Risk “Key engineer leaving”: Created (score 12, High).",
      "R-007 Risk “Key engineer leaving”: Risk score 12 (High) → 20 (Critical); Update: Resignation confirmed.",
      "R-007 Risk “Key engineer leaving”: Deleted.",
    ]);
  });

  it("returns null for records that do not exist", async () => {
    expect(await updateRaidItem(repo(), "ghost", risk(), TODAY)).toBeNull();
    expect(await deleteRaidItem(repo(), "ghost")).toBeNull();
  });
});

describe("workflows", () => {
  it("issue: investigate, escalate with reason, resolve (date recorded), close, reopen (date cleared)", async () => {
    const r = repo();
    const i = await createRaidItem(r, issue(), TODAY);
    await updateRaidItem(r, i.id, issue({ status: "investigating" }), TODAY);
    await expect(updateRaidItem(r, i.id, issue({ status: "escalated" }), TODAY)).rejects.toThrow("Give a reason when escalating an issue.");
    const esc = await updateRaidItem(r, i.id, issue({ status: "escalated", escalationReason: "Vendor unresponsive" }), TODAY);
    expect(esc).toMatchObject({ status: "escalated", escalatedDate: TODAY });
    await expect(updateRaidItem(r, i.id, issue({ status: "closed", escalationReason: "Vendor unresponsive" }), TODAY)).rejects.toThrow(/cannot move from Escalated to Closed/);
    const resolved = await updateRaidItem(r, i.id, issue({ status: "resolved", escalationReason: "Vendor unresponsive", escalatedDate: TODAY }), TODAY);
    expect(resolved!.resolvedDate).toBe(TODAY);
    await updateRaidItem(r, i.id, issue({ status: "closed", escalationReason: "Vendor unresponsive", escalatedDate: TODAY }), TODAY);
    const reopened = await updateRaidItem(r, i.id, issue({ status: "open", escalationReason: "Vendor unresponsive", escalatedDate: TODAY }), TODAY);
    expect(reopened!.resolvedDate).toBeNull();
    expect(await history(i.id)).toContain("I-005 Issue “Interface failing”: Escalated: Vendor unresponsive.");
  });

  it("assumption needs evidence to validate; dependency needs an escalation owner when blocked", async () => {
    const r = repo();
    const a = await createRaidItem(r, assumption(), TODAY);
    await expect(updateRaidItem(r, a.id, assumption({ status: "validated" }), TODAY)).rejects.toBeInstanceOf(RaidRuleError);
    expect((await updateRaidItem(r, a.id, assumption({ status: "validated", validationNotes: "Confirmed by finance director" }), TODAY))!.resolvedDate).toBe(TODAY);

    const d = await createRaidItem(r, dependency(), TODAY);
    await expect(updateRaidItem(r, d.id, dependency({ status: "blocked" }), TODAY)).rejects.toThrow("Name an escalation owner for a blocked dependency.");
    expect((await updateRaidItem(r, d.id, dependency({ status: "blocked", escalationOwner: "Priya Sharma" }), TODAY))!.status).toBe("blocked");
  });

  it("rejects invalid associations and writes nothing", async () => {
    await repo().getPortfolio();
    const before = await readFile(file, "utf8");
    await expect(createRaidItem(repo(), risk({ projectId: "nope" }), TODAY)).rejects.toThrow("Choose a project that exists.");
    await expect(createRaidItem(repo(), risk({ taskId: "t-mob-01" }), TODAY)).rejects.toThrow("The task belongs to a different project.");
    await expect(createRaidItem(repo(), risk({ milestoneId: "ms-mob-1" }), TODAY)).rejects.toThrow("The milestone belongs to a different project.");
    expect(await readFile(file, "utf8")).toBe(before);
  });
});

describe("referential integrity", () => {
  it("clears RAID links when the linked task or milestone is deleted", async () => {
    const r = repo();
    const item = await createRaidItem(r, risk({ taskId: "t-erp-09", milestoneId: "ms-erp-3" }), TODAY);
    await deleteTask(r, "t-erp-09"); // nothing depends on Hypercare rota
    expect((await r.getRaidItem(item.id))!.taskId).toBeNull();
    await deleteMilestone(r, "ms-erp-3", { mode: "unlink" });
    expect((await r.getRaidItem(item.id))!.milestoneId).toBeNull();
    // Demo record I-003 was linked to milestone ms-erp-2 and stays linked.
    expect((await r.getRaidItem("raid-i3"))!.milestoneId).toBe("ms-erp-2");
  });
});

describe("dashboard metrics follow RAID changes", () => {
  it("updates the project RAID summary", async () => {
    const r = repo();
    const erp = async () => buildPortfolioSummary(await r.getPortfolio(), TODAY).projects.find((p) => p.project.id === ERP)!.raid;
    const before = await erp();

    const crit = await createRaidItem(r, risk({ probability: 5, impact: 5 }), TODAY);
    let after = await erp();
    expect(after.openRisks).toBe(before.openRisks + 1);
    expect(after.highCriticalRisks).toBe(before.highCriticalRisks + 1);

    const late = await createRaidItem(r, assumption({ targetDate: "2026-06-01" }), TODAY);
    after = await erp();
    expect(after.overdueAssumptions).toBe(before.overdueAssumptions + 1);
    expect(after.overdueItems).toBe(before.overdueItems + 1);

    await updateRaidItem(r, crit.id, risk({ probability: 5, impact: 5, status: "closed" }), TODAY);
    await updateRaidItem(r, late.id, assumption({ targetDate: "2026-06-01", status: "invalidated", validationNotes: "Users not available" }), TODAY);
    after = await erp();
    expect(after).toMatchObject({ openRisks: before.openRisks, highCriticalRisks: before.highCriticalRisks, overdueAssumptions: before.overdueAssumptions });

    await createRaidItem(r, dependency({ status: "blocked", escalationOwner: "Priya Sharma" }), TODAY);
    expect((await erp()).blockedDependencies).toBe(before.blockedDependencies + 1);
  });
});

describe("store migration v3 -> v4", () => {
  it("converts flat RAID items into typed records", async () => {
    const v3 = {
      version: 3,
      seededOn: "2026-06-01",
      data: {
        projects: [], tasks: [], milestones: [], updates: [],
        raidItems: [
          { id: "x1", projectId: "p", type: "risk", title: "R", description: "", owner: "O", severity: "high", probability: "high", impact: "low", mitigation: "Plan A", status: "monitoring", targetDate: "2026-07-01" },
          { id: "x2", projectId: "p", type: "assumption", title: "A", description: "d", owner: "O", severity: "low", probability: "low", impact: "low", mitigation: "", status: "resolved", targetDate: null },
          { id: "x3", projectId: "p", type: "issue", title: "I", description: "", owner: "O", severity: "medium", probability: "low", impact: "low", mitigation: "", status: "open", targetDate: null },
          { id: "x4", projectId: "p", type: "dependency", title: "D", description: "", owner: "O", severity: "high", probability: "low", impact: "low", mitigation: "", status: "closed", targetDate: null },
        ],
      },
    };
    await writeFile(file, JSON.stringify(v3), "utf8");
    const r = repo();
    expect(await r.getRaidItem("x1")).toMatchObject({ ref: "R-001", status: "mitigating", probability: 4, impact: 2, plan: "Plan A", contingency: "" });
    expect(await r.getRaidItem("x2")).toMatchObject({ ref: "A-001", status: "validated", priority: "low", resolvedDate: "2026-06-01" });
    expect(await r.getRaidItem("x3")).toMatchObject({ ref: "I-001", status: "open", priority: "medium", escalatedDate: null });
    expect(await r.getRaidItem("x4")).toMatchObject({ ref: "D-001", status: "fulfilled", priority: "high", direction: "external" });
    expect(JSON.parse(await readFile(file, "utf8")).version).toBe(4);
  });
});
