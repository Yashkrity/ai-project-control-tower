import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ISODate, Milestone, PortfolioData, Project, ProjectInput, ProjectUpdate, RaidItem, Task } from "@/lib/types";
import { nextRaidRef } from "@/lib/raid/refs";
import { buildDemoData } from "./demo-data";
import type {
  MilestoneBuilder,
  MilestoneDeletePlan,
  NewProjectUpdate,
  PortfolioRepository,
  RaidBuilder,
  TaskBuilder,
  TaskDeleteGuard,
  TaskLinkGuard,
} from "./repository";

const FILE_VERSION = 4;

type Loose = Record<string, unknown>;
const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);

/**
 * v1 -> v2 (Tasks module):
 *  - task status "todo" renamed to "not_started" ("on_hold" added)
 *  - tasks gain description, createdAt, updatedAt
 * Completion dates are kept as stored (v1 seeds set them to the due date).
 */
function migrateV1toV2(raw: StoreFile): StoreFile {
  const stamp = `${raw.seededOn}T00:00:00.000Z`;
  const tasks = (raw.data.tasks as unknown as Loose[]).map((t) => ({
    ...t,
    status: t.status === "todo" ? "not_started" : t.status,
    description: str(t.description, ""),
    createdAt: str(t.createdAt, stamp),
    updatedAt: str(t.updatedAt, stamp),
  })) as unknown as Task[];
  return { ...raw, version: 2, data: { ...raw.data, tasks } };
}

/**
 * v2 -> v3 (Milestones module):
 *  - stored milestone `status` removed (status is now calculated)
 *  - an actual date is kept only if the old status was "completed"
 *  - milestones gain description, owner (defaults to the project manager),
 *    priority ("medium"), plannedStartDate (earliest linked task start, else
 *    the planned date), notes, createdAt, updatedAt
 */
function migrateV2toV3(raw: StoreFile): StoreFile {
  const stamp = `${raw.seededOn}T00:00:00.000Z`;
  const pm = new Map(raw.data.projects.map((p) => [p.id, p.projectManager]));
  const milestones = (raw.data.milestones as unknown as Loose[]).map((m) => {
    const { status, ...rest } = m;
    const plannedDate = String(m.plannedDate);
    const starts = raw.data.tasks.filter((t) => t.milestoneId === m.id).map((t) => t.startDate).sort();
    return {
      ...rest,
      description: str(m.description, ""),
      owner: str(m.owner, pm.get(String(m.projectId)) ?? "Unassigned"),
      priority: str(m.priority, "medium"),
      plannedStartDate: str(m.plannedStartDate, starts[0] && starts[0] < plannedDate ? starts[0] : plannedDate),
      actualDate: status === "completed" && typeof m.actualDate === "string" ? m.actualDate : null,
      notes: str(m.notes, ""),
      createdAt: str(m.createdAt, stamp),
      updatedAt: str(m.updatedAt, stamp),
    };
  }) as unknown as Milestone[];
  return { ...raw, version: 3, data: { ...raw.data, milestones } };
}

/**
 * v3 -> v4 (RAID module): flat RAID items become typed records.
 *  - 3-level ratings (low/medium/high) map to 1-5 risk ratings 2/3/4 and to priorities
 *  - generic statuses map per type (open/monitoring/resolved/closed)
 *  - new fields get empty defaults; references (R-001 ...) are assigned per type
 *  - closed records get the seed date as resolution date (the old model had none)
 */
function migrateV3toV4(raw: StoreFile): StoreFile {
  const stamp = `${raw.seededOn}T00:00:00.000Z`;
  const rating = (v: unknown) => (v === "high" ? 4 : v === "low" ? 2 : 3) as 2 | 3 | 4;
  const priority = (v: unknown) => (v === "high" || v === "low" ? v : "medium") as "low" | "medium" | "high";
  const counters: Record<string, number> = {};
  const raidItems = (raw.data.raidItems as unknown as Loose[]).map((r) => {
    const type = String(r.type) as RaidItem["type"];
    counters[type] = (counters[type] ?? 0) + 1;
    const status = String(r.status);
    const closed = status === "resolved" || status === "closed";
    const base = {
      id: String(r.id),
      ref: `${{ risk: "R", assumption: "A", issue: "I", dependency: "D" }[type]}-${String(counters[type]).padStart(3, "0")}`,
      projectId: String(r.projectId),
      title: str(r.title, "Untitled"),
      description: str(r.description, ""),
      owner: str(r.owner, "Unassigned"),
      targetDate: typeof r.targetDate === "string" ? r.targetDate : null,
      resolvedDate: closed ? raw.seededOn : null,
      milestoneId: null,
      taskId: null,
      plan: str(r.mitigation, ""),
      latestUpdate: "",
      createdAt: stamp,
      updatedAt: stamp,
    };
    switch (type) {
      case "risk":
        return { ...base, type, status: closed ? "closed" : status === "monitoring" ? "mitigating" : "open", probability: rating(r.probability), impact: rating(r.impact), contingency: "" };
      case "assumption":
        return { ...base, type, status: closed ? "validated" : "pending", priority: priority(r.severity), validationNotes: closed ? "Validated before the RAID register upgrade." : "" };
      case "issue":
        return { ...base, type, status: status === "monitoring" ? "investigating" : status, priority: priority(r.severity), businessImpact: "", escalationReason: "", escalatedDate: null };
      default:
        return { ...base, type: "dependency", status: closed ? "fulfilled" : status === "monitoring" ? "in_progress" : "pending", priority: priority(r.severity), direction: "external", requiredFrom: "Not specified", impactIfUnfulfilled: "", escalationOwner: "" };
    }
  }) as unknown as RaidItem[];
  return { ...raw, version: 4, data: { ...raw.data, raidItems } };
}

/** Upgrades a store of any supported version to the current one, step by step. */
export function migrateStore(raw: StoreFile): StoreFile {
  let store = raw;
  if (store.version === 1) store = migrateV1toV2(store);
  if (store.version === 2) store = migrateV2toV3(store);
  if (store.version === 3) store = migrateV3toV4(store);
  if (store.version !== FILE_VERSION) throw new Error(`Unsupported data file version ${raw.version}`);
  return store;
}

interface StoreFile {
  version: number;
  seededOn: ISODate;
  data: PortfolioData;
}

/** ON DELETE SET NULL for RAID links to a deleted task or milestone. */
function clearRaidReferences(data: PortfolioData, field: "taskId" | "milestoneId", id: string, at: string) {
  data.raidItems.forEach((r, i) => {
    if (r[field] === id) data.raidItems[i] = { ...r, [field]: null, updatedAt: at };
  });
}

/** One queue per file: every read and write runs strictly in order. */
const queues = new Map<string, Promise<unknown>>();

function enqueue<T>(key: string, job: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.then(job, job);
  queues.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === code;
}

/** Windows can briefly lock a file that is being read; retry the rename. */
async function renameWithRetry(from: string, to: string, attempts = 5): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      await fs.rename(from, to);
      return;
    } catch (error) {
      const retryable = isNodeError(error, "EPERM") || isNodeError(error, "EBUSY") || isNodeError(error, "EACCES");
      if (!retryable || i >= attempts - 1) throw error;
      await new Promise((r) => setTimeout(r, 25 * (i + 1)));
    }
  }
}

function assertValidStore(value: unknown, filePath: string): asserts value is StoreFile {
  const v = value as Partial<StoreFile> | null;
  const d = v?.data as Partial<PortfolioData> | undefined;
  const ok =
    !!v &&
    typeof v.version === "number" && v.version >= 1 && v.version <= FILE_VERSION &&
    !!d &&
    ["projects", "tasks", "milestones", "raidItems", "updates"].every((k) =>
      Array.isArray((d as Record<string, unknown>)[k]),
    );
  if (!ok) {
    throw new Error(
      `Data file ${filePath} is not a valid v${FILE_VERSION} store. Run "npm run data:reset" to recreate it from demo data.`,
    );
  }
}

/**
 * Local persistence for development: a single JSON file. Created on first
 * use from the demo portfolio, after which dates are fixed like real data.
 * Not suitable for serverless hosting (read-only filesystem).
 */
export class FileRepository implements PortfolioRepository {
  readonly source = "local" as const;

  constructor(
    private readonly filePath: string,
    private readonly seedDate: ISODate,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async load(): Promise<StoreFile> {
    let raw: string;
    try {
      raw = await fs.readFile(this.filePath, "utf8");
    } catch (error) {
      if (!isNodeError(error, "ENOENT")) throw error;
      const seeded: StoreFile = {
        version: FILE_VERSION,
        seededOn: this.seedDate,
        data: buildDemoData(this.seedDate),
      };
      await this.save(seeded);
      return seeded;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    assertValidStore(parsed, this.filePath);
    if (parsed.version !== FILE_VERSION) {
      const migrated = migrateStore(parsed);
      await this.save(migrated);
      return migrated;
    }
    return parsed;
  }

  private async save(store: StoreFile): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
    await renameWithRetry(tmp, this.filePath);
  }

  private read<T>(select: (data: PortfolioData) => T): Promise<T> {
    return enqueue(this.filePath, async () => select((await this.load()).data));
  }

  private mutate<T>(change: (data: PortfolioData) => T): Promise<T> {
    return enqueue(this.filePath, async () => {
      const store = await this.load();
      const result = change(store.data);
      await this.save(store);
      return result;
    });
  }

  getPortfolio(): Promise<PortfolioData> {
    return this.read((data) => data);
  }

  getProject(id: string): Promise<Project | null> {
    return this.read((data) => data.projects.find((p) => p.id === id) ?? null);
  }

  createProject(input: ProjectInput): Promise<Project> {
    return this.mutate((data) => {
      const at = this.now().toISOString();
      const project: Project = { ...input, id: randomUUID(), archivedAt: null, createdAt: at, updatedAt: at };
      data.projects.push(project);
      return project;
    });
  }

  updateProject(id: string, input: ProjectInput): Promise<Project | null> {
    return this.mutate((data) => {
      const index = data.projects.findIndex((p) => p.id === id);
      if (index === -1) return null;
      const updated: Project = { ...data.projects[index], ...input, updatedAt: this.now().toISOString() };
      data.projects[index] = updated;
      return updated;
    });
  }

  setProjectArchived(id: string, archived: boolean): Promise<Project | null> {
    return this.mutate((data) => {
      const project = data.projects.find((p) => p.id === id);
      if (!project) return null;
      const at = this.now().toISOString();
      project.archivedAt = archived ? (project.archivedAt ?? at) : null;
      project.updatedAt = at;
      return project;
    });
  }

  getTask(id: string): Promise<Task | null> {
    return this.read((data) => data.tasks.find((t) => t.id === id) ?? null);
  }

  createTask(build: TaskBuilder): Promise<Task> {
    return this.mutate((data) => {
      const at = this.now().toISOString();
      const task: Task = { ...build(data, null), id: randomUUID(), createdAt: at, updatedAt: at };
      data.tasks.push(task);
      return task;
    });
  }

  updateTask(id: string, build: TaskBuilder): Promise<Task | null> {
    return this.mutate((data) => {
      const index = data.tasks.findIndex((t) => t.id === id);
      if (index === -1) return null;
      const existing = data.tasks[index];
      const task: Task = { ...build(data, existing), id, createdAt: existing.createdAt, updatedAt: this.now().toISOString() };
      data.tasks[index] = task;
      return task;
    });
  }

  deleteTask(id: string, guard: TaskDeleteGuard): Promise<Task | null> {
    return this.mutate((data) => {
      const index = data.tasks.findIndex((t) => t.id === id);
      if (index === -1) return null;
      const existing = data.tasks[index];
      guard(data, existing);
      data.tasks.splice(index, 1);
      clearRaidReferences(data, "taskId", id, this.now().toISOString());
      return existing;
    });
  }

  getMilestone(id: string): Promise<Milestone | null> {
    return this.read((data) => data.milestones.find((m) => m.id === id) ?? null);
  }

  createMilestone(build: MilestoneBuilder): Promise<Milestone> {
    return this.mutate((data) => {
      const at = this.now().toISOString();
      const milestone: Milestone = { ...build(data, null), id: randomUUID(), createdAt: at, updatedAt: at };
      data.milestones.push(milestone);
      return milestone;
    });
  }

  updateMilestone(id: string, build: MilestoneBuilder): Promise<Milestone | null> {
    return this.mutate((data) => {
      const index = data.milestones.findIndex((m) => m.id === id);
      if (index === -1) return null;
      const existing = data.milestones[index];
      const milestone: Milestone = {
        ...build(data, existing),
        id,
        createdAt: existing.createdAt,
        updatedAt: this.now().toISOString(),
      };
      data.milestones[index] = milestone;
      return milestone;
    });
  }

  deleteMilestone(id: string, plan: MilestoneDeletePlan) {
    return this.mutate((data) => {
      const index = data.milestones.findIndex((m) => m.id === id);
      if (index === -1) return null;
      const milestone = data.milestones[index];
      const { reassignTo } = plan(data, milestone);
      const at = this.now().toISOString();
      const movedTasks: Task[] = [];
      data.tasks.forEach((t, i) => {
        if (t.milestoneId !== id) return;
        data.tasks[i] = { ...t, milestoneId: reassignTo, updatedAt: at };
        movedTasks.push(data.tasks[i]);
      });
      data.milestones.splice(index, 1);
      clearRaidReferences(data, "milestoneId", id, at);
      return { milestone, movedTasks };
    });
  }

  setTasksMilestone(taskIds: string[], milestoneId: string | null, guard: TaskLinkGuard): Promise<Task[]> {
    return this.mutate((data) => {
      const wanted = new Set(taskIds);
      const targets = data.tasks.filter((t) => wanted.has(t.id));
      guard(data, targets);
      const at = this.now().toISOString();
      const updated: Task[] = [];
      data.tasks.forEach((t, i) => {
        if (!wanted.has(t.id)) return;
        data.tasks[i] = { ...t, milestoneId, updatedAt: at };
        updated.push(data.tasks[i]);
      });
      return updated;
    });
  }

  getRaidItem(id: string): Promise<RaidItem | null> {
    return this.read((data) => data.raidItems.find((r) => r.id === id) ?? null);
  }

  createRaidItem(build: RaidBuilder): Promise<RaidItem> {
    return this.mutate((data) => {
      const draft = build(data, null);
      const at = this.now().toISOString();
      const item = { ...draft, id: randomUUID(), ref: nextRaidRef(draft.type, data.raidItems), createdAt: at, updatedAt: at } as RaidItem;
      data.raidItems.push(item);
      return item;
    });
  }

  updateRaidItem(id: string, build: RaidBuilder): Promise<RaidItem | null> {
    return this.mutate((data) => {
      const index = data.raidItems.findIndex((r) => r.id === id);
      if (index === -1) return null;
      const existing = data.raidItems[index];
      const item = { ...build(data, existing), id, ref: existing.ref, createdAt: existing.createdAt, updatedAt: this.now().toISOString() } as RaidItem;
      data.raidItems[index] = item;
      return item;
    });
  }

  deleteRaidItem(id: string): Promise<RaidItem | null> {
    return this.mutate((data) => {
      const index = data.raidItems.findIndex((r) => r.id === id);
      if (index === -1) return null;
      const [removed] = data.raidItems.splice(index, 1);
      return removed;
    });
  }

  addProjectUpdate(update: NewProjectUpdate): Promise<ProjectUpdate> {
    return this.mutate((data) => {
      const entry: ProjectUpdate = { ...update, id: randomUUID(), createdAt: this.now().toISOString() };
      data.updates.push(entry);
      return entry;
    });
  }
}
