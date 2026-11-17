import "server-only";

import path from "node:path";
import { connection } from "next/server";
import { todayISO } from "@/lib/utils/dates";
import { FileRepository } from "./file-repository";
import type { PortfolioRepository } from "./repository";

export type { PortfolioRepository } from "./repository";

export function getAppTimeZone(): string {
  return process.env.APP_TIMEZONE || "UTC";
}

/**
 * Resolves "today" for the current request. Calls `connection()` so that
 * anything depending on the current date renders at request time, never
 * frozen into a build-time prerender.
 */
export async function getToday(): Promise<string> {
  await connection();
  return todayISO(getAppTimeZone());
}

let warnedLegacySource = false;

/** Fixed location; a static subfolder keeps server output tracing scoped. */
function dataFilePath(): string {
  return path.join(process.cwd(), ".data", "portfolio.json");
}

/**
 * Returns the configured data source. Server-only: data access and any
 * credentials never reach the browser bundle. Calls `connection()` so data
 * is always read at request time.
 */
export async function getRepository(): Promise<PortfolioRepository> {
  await connection();
  const source = process.env.DATA_SOURCE || "local";

  switch (source) {
    case "demo": // legacy value from the Phase 1 .env.example
      if (!warnedLegacySource) {
        warnedLegacySource = true;
        console.warn('DATA_SOURCE=demo is deprecated; use DATA_SOURCE=local. Treating it as "local".');
      }
    // falls through
    case "local":
      return new FileRepository(dataFilePath(), todayISO(getAppTimeZone()));
    case "supabase":
      throw new Error(
        "DATA_SOURCE=supabase is not implemented yet. Set DATA_SOURCE=local (or remove it) in .env.local.",
      );
    default:
      throw new Error(`Unknown DATA_SOURCE "${source}". Expected "local" or "supabase".`);
  }
}
