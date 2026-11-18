/**
 * Integration tests: services + rules + the real FileRepository on disk.
 * A new repository instance on the same file stands in for a server restart.
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileRepository } from "@/lib/data/file-repository";
import { buildPortfolioSummary } from "@/lib/metrics/portfolio";
import { TaskRuleError } from "@/lib/tasks/rules";
import { taskInput, TODAY } from "@/test-utils/fixtures";
import { createTask, deleteTask, updateTask } from "./tasks";

let dir: string;
let file: string;
const repo = () => new FileRepository(file, TODAY, () => new Date(`${TODAY}T10:00:00.000Z`));
const ctx = { today: TODAY };

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "ct-tasks-"));
  file = path.join(dir, "portfolio.json");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

// The seeded demo portfolio provides projects; use one with known tasks.
const ERP = "prj-erp";

describe("task CRUD with persistence", () => {
  it("creates, reads back after a restart, updates and deletes", async () => {
    const created = await createTask(repo(), taskInput({ projectId: ERP, title: "Write cutover checklist", dependsOn: ["t-erp-08"] }), ctx);
    expect(created.id).toMatch(/[0-9a-f-]{36}/);

    const reloaded = await repo().getTask(created.id); // "server restart"
    expect(reloaded).toEqual(created);

    const updated = await updateTask(repo(), created.id, taskInput({ projectId: ERP, title: "Write cutover checklist v2", owner: "Ravi Patel" }), ctx);
    expect(updated).toMatchObject({ title: "Write cutover checklist v2", owner: "Ravi Patel", dependsOn: [], createdAt: created.createdAt });

    expect(await deleteTask(repo(), created.id)).toMatchObject({ id: created.id });
    expect(await repo().getTask(created.id)).toBeNull();
    const log = (await repo().getPortfolio()).updates.map((u) => u.summary);
    expect(log).toContain("Task “Write cutover checklist v2” deleted.");
  });

  it("returns null when updating or deleting a task that does not exist", async () => {
    expect(await updateTask(repo(), "ghost", taskInput({ projectId: ERP }), ctx)).toBeNull();
    expect(await deleteTask(repo(), "ghost")).toBeNull();
  });

  it("rejects invalid associations and writes nothing", async () => {
    const before = await readFile(file, "utf8").catch(() => null);
    await repo().getPortfolio(); // seed
    const seeded = await readFile(file, "utf8");
    await expect(createTask(repo(), taskInput({ projectId: "no-such-project" }), ctx)).rejects.toBeInstanceOf(TaskRuleError);
    await expect(createTask(repo(), taskInput({ projectId: ERP, milestoneId: "ms-mob-1" }), ctx)).rejects.toThrow(/different project/);
    await expect(createTask(repo(), taskInput({ projectId: ERP, dependsOn: ["t-mob-01"] }), ctx)).rejects.toThrow(/another project/);
    expect(await readFile(file, "utf8")).toBe(seeded);
    expect(before).toBeNull();
  });

  it("rejects a circular dependency atomically", async () => {
    // Demo chain: t-erp-02 -> t-erp-01 ; t-erp-03 -> t-erp-02
    const t1 = (await repo().getTask("t-erp-01"))!;
    await expect(
      updateTask(repo(), t1.id, { ...t1, dependsOn: ["t-erp-03"] }, ctx),
    ).rejects.toThrow("This would create a circular dependency: “Current-state process mapping” → “Configure GL and cost centres” → “Target architecture design” → “Current-state process mapping”.");
    expect((await repo().getTask("t-erp-01"))!.dependsOn).toEqual([]);
  });
});

describe("completion tracking", () => {
  it("records the actual completion date, keeps it on later edits, and clears it on reopen", async () => {
    const r = repo();
    const t = await createTask(r, taskInput({ projectId: ERP, title: "Sign-off pack", dueDate: "2026-06-20" }), ctx);

    const done = await updateTask(r, t.id, taskInput({ projectId: ERP, title: "Sign-off pack", dueDate: "2026-06-20", status: "done" }), ctx);
    expect(done!.completedDate).toBe(TODAY);
    expect(done!.completedDate).not.toBe(done!.dueDate);

    // Edit later without touching the date: preserved.
    const later = new FileRepository(file, TODAY, () => new Date("2026-06-18T10:00:00.000Z"));
    const edited = await updateTask(later, t.id, taskInput({ projectId: ERP, title: "Sign-off pack (final)", dueDate: "2026-06-20", status: "done" }), { today: "2026-06-18" });
    expect(edited!.completedDate).toBe(TODAY);
    expect((await repo().getTask(t.id))!.completedDate).toBe(TODAY); // persisted

    const reopened = await updateTask(r, t.id, taskInput({ projectId: ERP, title: "Sign-off pack (final)", dueDate: "2026-06-20", status: "in_progress" }), ctx);
    expect(reopened!.completedDate).toBeNull();

    const log = (await r.getPortfolio()).updates.filter((u) => u.projectId === ERP).map((u) => u.summary);
    expect(log).toContain(`Task “Sign-off pack” completed on 15 Jun 2026 (5 days early).`);
    expect(log).toContain(`Task “Sign-off pack (final)” reopened (was completed on 15 Jun 2026).`);
  });

  it("requires an explicit override to complete a task with open predecessors, and logs it", async () => {
    const r = repo();
    const t5 = (await r.getTask("t-erp-05"))!; // waits on t-erp-04 (in progress)
    await expect(updateTask(r, t5.id, { ...t5, status: "done" }, ctx)).rejects.toThrow(/Cannot mark as done: still waiting on “Finance data migration rehearsal”/);
    const done = await updateTask(r, t5.id, { ...t5, status: "done" }, { ...ctx, overrideDependencies: true });
    expect(done!.status).toBe("done");
    const log = (await r.getPortfolio()).updates.map((u) => u.summary);
    expect(log).toContain("Task “Finance SIT defect triage” marked done with incomplete predecessors (override): “Finance data migration rehearsal”.");
  });

  it("refuses to delete a task that others depend on", async () => {
    await expect(deleteTask(repo(), "t-erp-04")).rejects.toThrow("Cannot delete: “Finance SIT defect triage” depends on this task. Remove those dependencies first.");
    expect(await repo().getTask("t-erp-04")).not.toBeNull();
  });
});

describe("dashboard metrics follow task changes", () => {
  it("updates completion, overdue and blocked counts", async () => {
    const r = repo();
    const summary = async () => buildPortfolioSummary(await r.getPortfolio(), TODAY);
    const erp = async () => (await summary()).projects.find((p) => p.project.id === ERP)!;

    const before = await summary();
    const erpBefore = await erp();

    // Complete the overdue rehearsal (t-erp-04): progress up, overdue down,
    // and its successor t-erp-05 is no longer blocked by dependencies.
    const t4 = (await r.getTask("t-erp-04"))!;
    await updateTask(r, t4.id, { ...t4, status: "done" }, ctx);

    const after = await summary();
    const erpAfter = await erp();
    expect(erpAfter.progress.completed).toBe(erpBefore.progress.completed + 1);
    expect(after.taskCompletion.completed).toBe(before.taskCompletion.completed + 1);
    expect(erpAfter.overdueTasks).toBe(erpBefore.overdueTasks - 1);
    expect(after.overdueTaskCount).toBe(before.overdueTaskCount - 1);
    expect(erpAfter.blockedTasks).toBe(erpBefore.blockedTasks - 1);

    // Marking a task Blocked raises the blocked count.
    const t6 = (await r.getTask("t-erp-06"))!;
    await updateTask(r, t6.id, { ...t6, status: "blocked" }, ctx);
    expect((await erp()).blockedTasks).toBe(erpAfter.blockedTasks + 1);
    expect((await summary()).blockedTaskCount).toBe(after.blockedTaskCount + 1);
  });
});

describe("store migration v1 -> v2", () => {
  it("renames todo, adds new task fields, and saves the upgraded file", async () => {
    const v1 = {
      version: 1,
      seededOn: "2026-06-01",
      data: {
        projects: [],
        milestones: [],
        raidItems: [],
        updates: [],
        tasks: [{ id: "x", projectId: "p", milestoneId: null, title: "Old", owner: "O", priority: "low", status: "todo", startDate: "2026-06-01", dueDate: "2026-06-02", completedDate: null, dependsOn: [] }],
      },
    };
    await writeFile(file, JSON.stringify(v1), "utf8");
    const task = await repo().getTask("x");
    expect(task).toMatchObject({ status: "not_started", description: "", createdAt: "2026-06-01T00:00:00.000Z" });
    expect(JSON.parse(await readFile(file, "utf8")).version).toBe(3); // v1 upgrades through v2 to v3
  });
});
