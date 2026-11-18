/**
 * Integration tests: milestone services + rules + the real FileRepository.
 * A new repository instance on the same file stands in for a server restart.
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileRepository } from "@/lib/data/file-repository";
import { buildPortfolioSummary } from "@/lib/metrics/portfolio";
import { milestoneState } from "@/lib/milestones/rules";
import type { MilestoneInput } from "@/lib/types";
import { TaskRuleError } from "@/lib/tasks/rules";
import { TODAY } from "@/test-utils/fixtures";
import { createMilestone, deleteMilestone, setTasksMilestone, updateMilestone } from "./milestones";
import { updateTask } from "./tasks";

let dir: string;
let file: string;
const repo = () => new FileRepository(file, TODAY, () => new Date(`${TODAY}T10:00:00.000Z`));

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "ct-ms-"));
  file = path.join(dir, "portfolio.json");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const ERP = "prj-erp";
const input = (over: Partial<MilestoneInput> = {}): MilestoneInput => ({
  projectId: ERP,
  name: "Data reconciliation sign-off",
  description: "Finance signs off reconciled balances.",
  owner: "Priya Sharma",
  priority: "high",
  plannedStartDate: "2026-06-01",
  plannedDate: "2026-07-31",
  actualDate: null,
  notes: "",
  ...over,
});
const log = async () => (await repo().getPortfolio()).updates.map((u) => u.summary);
const stateOf = async (id: string) => {
  const data = await repo().getPortfolio();
  const m = data.milestones.find((x) => x.id === id)!;
  return milestoneState(m, data.tasks.filter((t) => t.projectId === m.projectId), TODAY);
};

describe("milestone CRUD with persistence", () => {
  it("creates, survives a restart, updates dates and deletes", async () => {
    const created = await createMilestone(repo(), input(), TODAY);
    expect(await repo().getMilestone(created.id)).toEqual(created); // restart
    expect((await stateOf(created.id)).progress.percent).toBeNull(); // no tasks linked

    const moved = await updateMilestone(repo(), created.id, input({ plannedDate: "2026-08-15" }), TODAY);
    expect(moved!.plannedDate).toBe("2026-08-15");
    expect(moved!.createdAt).toBe(created.createdAt);

    expect(await deleteMilestone(repo(), created.id, { mode: "none" })).toMatchObject({ movedTasks: [] });
    expect(await repo().getMilestone(created.id)).toBeNull();

    const entries = await log();
    expect(entries).toContain("Milestone “Data reconciliation sign-off” created, planned for 31 Jul 2026.");
    expect(entries).toContain("Milestone “Data reconciliation sign-off”: planned completion moved from 31 Jul 2026 to 15 Aug 2026.");
    expect(entries).toContain("Milestone “Data reconciliation sign-off” deleted.");
  });

  it("rejects an invalid project and writes nothing", async () => {
    await repo().getPortfolio();
    const before = await readFile(file, "utf8");
    await expect(createMilestone(repo(), input({ projectId: "nope" }), TODAY)).rejects.toThrow("Choose a project that exists.");
    expect(await readFile(file, "utf8")).toBe(before);
  });
});

describe("task association, progress and completion", () => {
  it("links tasks, derives progress, completes only when all are done, and logs each step", async () => {
    const r = repo();
    const ms = await createMilestone(r, input(), TODAY);
    // t-erp-03 is done, t-erp-04 is in progress
    await setTasksMilestone(r, ["t-erp-03", "t-erp-04"], ms.id);
    let s = await stateOf(ms.id);
    expect(s.progress).toEqual({ completed: 1, total: 2, percent: 50 });

    await expect(updateMilestone(r, ms.id, input({ actualDate: TODAY }), TODAY)).rejects.toThrow(
      "Cannot record completion: 1 linked task is not done (“Finance data migration rehearsal”).",
    );

    const t4 = (await r.getTask("t-erp-04"))!;
    await updateTask(r, t4.id, { ...t4, status: "done" }, { today: TODAY });
    expect((await stateOf(ms.id)).readyToComplete).toBe(true);

    await updateMilestone(r, ms.id, input({ actualDate: TODAY }), TODAY);
    s = await stateOf(ms.id);
    expect(s.status).toBe("completed");
    expect(s.progress.percent).toBe(100);

    const entries = await log();
    expect(entries).toContain("“Configure GL and cost centres”, “Finance data migration rehearsal” removed from milestone “Finance module SIT complete”.");
    expect(entries).toContain("“Configure GL and cost centres”, “Finance data migration rehearsal” added to milestone “Data reconciliation sign-off”.");
    expect(entries).toContain("Milestone “Data reconciliation sign-off” completed on 15 Jun 2026.");
  });

  it("reopening a linked task reopens a completed milestone, and logs both", async () => {
    const r = repo();
    // ms-erp-1 is completed; its tasks t-erp-01 and t-erp-02 are done
    expect((await stateOf("ms-erp-1")).status).toBe("completed");
    const t1 = (await r.getTask("t-erp-01"))!;
    await updateTask(r, t1.id, { ...t1, status: "in_progress" }, { today: TODAY });

    expect((await r.getMilestone("ms-erp-1"))!.actualDate).toBeNull();
    expect((await stateOf("ms-erp-1")).status).toBe("delayed"); // planned date is in the past
    const entries = await log();
    expect(entries.some((e) => /^Milestone “Solution blueprint signed off” reopened \(was completed on .+\): task “Current-state process mapping” is no longer done\.$/.test(e))).toBe(true);
  });

  it("refuses to add unfinished work to a completed milestone, from either side", async () => {
    const r = repo();
    await expect(setTasksMilestone(r, ["t-erp-05"], "ms-erp-1")).rejects.toThrow(/is completed\. Reopen it/);
    const t5 = (await r.getTask("t-erp-05"))!;
    await expect(updateTask(r, t5.id, { ...t5, milestoneId: "ms-erp-1" }, { today: TODAY })).rejects.toBeInstanceOf(TaskRuleError);
  });

  it("unlinks a task and logs the removal", async () => {
    await setTasksMilestone(repo(), ["t-erp-09"], null);
    expect((await repo().getTask("t-erp-09"))!.milestoneId).toBeNull();
    expect(await log()).toContain("“Hypercare rota” removed from milestone “Production cutover”.");
  });
});

describe("deleting a milestone with linked tasks", () => {
  it("refuses without a decision, then moves or unlinks the tasks", async () => {
    const r = repo();
    await expect(deleteMilestone(r, "ms-erp-3", { mode: "none" })).rejects.toThrow(/2 tasks are linked/);
    expect(await r.getMilestone("ms-erp-3")).not.toBeNull();

    const moved = await deleteMilestone(r, "ms-erp-3", { mode: "reassign", target: "ms-erp-4" });
    expect(moved!.movedTasks.map((t) => t.id).sort()).toEqual(["t-erp-06", "t-erp-07"]);
    expect((await r.getTask("t-erp-06"))!.milestoneId).toBe("ms-erp-4");

    const unlinked = await deleteMilestone(r, "ms-erp-4", { mode: "unlink" });
    expect(unlinked!.movedTasks).toHaveLength(4);
    expect((await r.getTask("t-erp-06"))!.milestoneId).toBeNull();
    expect((await log()).some((e) => e.startsWith("Milestone “Warehouse module UAT” deleted; 2 task(s) moved to “Production cutover”"))).toBe(true);
  });
});

describe("dashboard metrics follow milestone changes", () => {
  it("updates past-due, at-risk, upcoming and per-project completion", async () => {
    const r = repo();
    const summary = async () => buildPortfolioSummary(await r.getPortfolio(), TODAY);
    const erp = async () => (await summary()).projects.find((p) => p.project.id === ERP)!.milestones;
    const before = await summary();
    const erpBefore = await erp();

    // A new milestone due in 5 days with an open task: upcoming + at risk.
    const ms = await createMilestone(r, input({ plannedStartDate: "2026-06-01", plannedDate: "2026-06-20" }), TODAY);
    await setTasksMilestone(r, ["t-erp-08"], ms.id);
    let after = await summary();
    expect(after.upcomingMilestones.map((u) => u.milestone.id)).toContain(ms.id);
    expect(after.atRiskMilestoneCount).toBe(before.atRiskMilestoneCount + 1);

    // Move its date into the past: now delayed (past due), no longer at risk or upcoming.
    await updateMilestone(r, ms.id, input({ plannedStartDate: "2026-06-01", plannedDate: "2026-06-12" }), TODAY);
    after = await summary();
    expect(after.pastDueMilestoneCount).toBe(before.pastDueMilestoneCount + 1);
    expect(after.atRiskMilestoneCount).toBe(before.atRiskMilestoneCount);
    expect(after.upcomingMilestones.map((u) => u.milestone.id)).not.toContain(ms.id);

    // Complete it: project-wise completion goes up, past due goes back down.
    const t8 = (await r.getTask("t-erp-08"))!;
    await updateTask(r, t8.id, { ...t8, status: "done" }, { today: TODAY });
    await updateMilestone(r, ms.id, input({ plannedStartDate: "2026-06-01", plannedDate: "2026-06-12", actualDate: TODAY }), TODAY);
    after = await summary();
    expect(after.pastDueMilestoneCount).toBe(before.pastDueMilestoneCount);
    expect(await erp()).toMatchObject({ total: erpBefore.total + 1, completed: erpBefore.completed + 1 });
  });
});

describe("store migration to v3", () => {
  it("upgrades a v2 file: drops stored status, keeps completed dates only, fills new fields", async () => {
    const v2 = {
      version: 2,
      seededOn: "2026-06-01",
      data: {
        projects: [{ id: "p", name: "P", projectManager: "Pat PM" }],
        raidItems: [],
        updates: [],
        tasks: [{ id: "t", projectId: "p", milestoneId: "a", startDate: "2026-05-20", status: "done" }],
        milestones: [
          { id: "a", projectId: "p", name: "Done one", plannedDate: "2026-06-01", actualDate: "2026-06-02", status: "completed" },
          { id: "b", projectId: "p", name: "Open one", plannedDate: "2026-07-01", actualDate: "2026-06-03", status: "in_progress" },
        ],
      },
    };
    await writeFile(file, JSON.stringify(v2), "utf8");
    const a = await repo().getMilestone("a");
    const b = await repo().getMilestone("b");
    expect(a).toMatchObject({ actualDate: "2026-06-02", owner: "Pat PM", priority: "medium", plannedStartDate: "2026-05-20", description: "", notes: "" });
    expect(a).not.toHaveProperty("status");
    expect(b).toMatchObject({ actualDate: null, plannedStartDate: "2026-07-01" });
    expect(JSON.parse(await readFile(file, "utf8")).version).toBe(3);
  });
});
