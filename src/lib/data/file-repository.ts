import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ISODate, PortfolioData, Project, ProjectInput, ProjectUpdate } from "@/lib/types";
import { buildDemoData } from "./demo-data";
import type { NewProjectUpdate, PortfolioRepository } from "./repository";

const FILE_VERSION = 1;

interface StoreFile {
  version: number;
  seededOn: ISODate;
  data: PortfolioData;
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
    v.version === FILE_VERSION &&
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

  addProjectUpdate(update: NewProjectUpdate): Promise<ProjectUpdate> {
    return this.mutate((data) => {
      const entry: ProjectUpdate = { ...update, id: randomUUID(), createdAt: this.now().toISOString() };
      data.updates.push(entry);
      return entry;
    });
  }
}
