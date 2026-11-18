/**
 * RAID use-cases: validated writes (rules run in the repository's write lock)
 * plus the per-record activity history (project updates tagged with raidItemId).
 */
import type { PortfolioRepository } from "@/lib/data/repository";
import type { ISODate, RaidInput, RaidItem } from "@/lib/types";
import { RAID_TYPE_LABEL, resolveRaidWrite, type RaidWriteResult } from "@/lib/raid/rules";
import { CURRENT_ACTOR } from "./projects";

async function record(repo: PortfolioRepository, item: RaidItem, summary: string) {
  await repo.addProjectUpdate({
    projectId: item.projectId,
    author: CURRENT_ACTOR,
    kind: "raid",
    summary: `${item.ref} ${RAID_TYPE_LABEL[item.type]} “${item.title}”: ${summary}`,
    raidItemId: item.id,
  });
}

export async function createRaidItem(repo: PortfolioRepository, input: RaidInput, today: ISODate): Promise<RaidItem> {
  let result!: RaidWriteResult;
  const item = await repo.createRaidItem((data) => {
    result = resolveRaidWrite(data, null, input, today);
    return result.draft;
  });
  for (const change of result.changes) await record(repo, item, change);
  return item;
}

/** Returns null when the record does not exist. Throws RaidRuleError on rule violations. */
export async function updateRaidItem(repo: PortfolioRepository, id: string, input: RaidInput, today: ISODate): Promise<RaidItem | null> {
  let result!: RaidWriteResult;
  const item = await repo.updateRaidItem(id, (data, existing) => {
    result = resolveRaidWrite(data, existing, input, today);
    return result.draft;
  });
  if (item) for (const change of result.changes) await record(repo, item, change);
  return item;
}

export async function deleteRaidItem(repo: PortfolioRepository, id: string): Promise<RaidItem | null> {
  const item = await repo.deleteRaidItem(id);
  if (item) await record(repo, item, "Deleted.");
  return item;
}
