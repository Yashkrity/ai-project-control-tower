import type { RaidItem, RaidType } from "@/lib/types";

export const RAID_PREFIX: Record<RaidType, string> = { risk: "R", assumption: "A", issue: "I", dependency: "D" };

/** Next human-readable reference for a type, e.g. R-007. Never reuses a number. */
export function nextRaidRef(type: RaidType, items: Pick<RaidItem, "ref">[]): string {
  const prefix = RAID_PREFIX[type];
  const max = items.reduce((n, item) => {
    const match = new RegExp(`^${prefix}-(\\d+)$`).exec(item.ref);
    return match ? Math.max(n, Number(match[1])) : n;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}
