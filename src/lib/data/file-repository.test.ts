import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ProjectInput } from "@/lib/types";
import { createProject, setProjectArchived, updateProject } from "@/lib/services/projects";
import { FileRepository } from "./file-repository";

const SEED_DATE = "2026-06-15";
const input: ProjectInput = {
  name: "New Project",
  client: "Client Co",
  description: "",
  projectManager: "Pat Doe",
  startDate: "2026-06-01",
  targetEndDate: "2026-09-30",
  budget: 100000,
  actualSpend: 0,
  status: "planning",
  health: "green",
};

let dir: string;
let file: string;
const repo = () => new FileRepository(file, SEED_DATE, () => new Date("2026-06-15T10:00:00.000Z"));

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "ct-repo-"));
  file = path.join(dir, "nested", "portfolio.json");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("FileRepository", () => {
  it("seeds from demo data on first read and writes the file", async () => {
    const data = await repo().getPortfolio();
    expect(data.projects.length).toBe(8);
    const stored = JSON.parse(await readFile(file, "utf8"));
    expect(stored.version).toBe(3);
    expect(stored.seededOn).toBe(SEED_DATE);
  });

  it("persists a created project across repository instances", async () => {
    const created = await repo().createProject(input);
    expect(created.id).toMatch(/[0-9a-f-]{36}/);
    expect(created.archivedAt).toBeNull();
    const reloaded = await repo().getProject(created.id);
    expect(reloaded).toEqual(created);
  });

  it("updates and archives / restores without losing status", async () => {
    const { id } = await repo().createProject(input);
    await repo().updateProject(id, { ...input, status: "completed", health: "amber" });
    await repo().setProjectArchived(id, true);
    let p = await repo().getProject(id);
    expect(p?.status).toBe("completed");
    expect(p?.archivedAt).not.toBeNull();
    await repo().setProjectArchived(id, false);
    p = await repo().getProject(id);
    expect(p?.archivedAt).toBeNull();
    expect(p?.status).toBe("completed");
  });

  it("returns null for unknown projects", async () => {
    expect(await repo().getProject("nope")).toBeNull();
    expect(await repo().updateProject("nope", input)).toBeNull();
    expect(await repo().setProjectArchived("nope", true)).toBeNull();
  });

  it("serialises concurrent writes without losing any", async () => {
    const r = repo();
    await Promise.all(Array.from({ length: 20 }, (_, i) => r.createProject({ ...input, name: `P${i}` })));
    const data = await repo().getPortfolio();
    expect(data.projects.filter((p) => /^P\d+$/.test(p.name))).toHaveLength(20);
  });

  it("refuses a corrupt data file with an actionable message", async () => {
    await repo().getPortfolio();
    await writeFile(file, "{not json", "utf8");
    await expect(repo().getPortfolio()).rejects.toThrow(/npm run data:reset/);
  });
});

describe("project services (activity log)", () => {
  it("logs creation, material changes and archive, but not cosmetic edits", async () => {
    const r = repo();
    const p = await createProject(r, input);
    await updateProject(r, p.id, { ...input, description: "typo fix" });
    await updateProject(r, p.id, { ...input, description: "typo fix", status: "active", health: "red" });
    await setProjectArchived(r, p.id, true);
    await setProjectArchived(r, p.id, true); // no-op: already archived

    const updates = (await r.getPortfolio()).updates.filter((u) => u.projectId === p.id);
    expect(updates.map((u) => [u.kind, u.summary])).toEqual([
      ["general", "Project created (Planning, Green)."],
      ["status", "Status changed from Planning to Active. Health changed from Green to Red."],
      ["general", "Project archived."],
    ]);
  });
});
