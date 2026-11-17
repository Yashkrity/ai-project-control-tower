import "server-only";

import { connection } from "next/server";
import { todayISO } from "@/lib/utils/dates";
import { DemoRepository } from "./demo-repository";
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

/**
 * Returns the configured data source. Pass the request's `today` (from
 * getToday) so every figure in one render uses the same date. Server-only: data access and any
 * credentials never reach the browser bundle.
 */
export async function getRepository(today: string): Promise<PortfolioRepository> {
  await connection();
  const source = process.env.DATA_SOURCE || "demo";

  switch (source) {
    case "demo":
      return new DemoRepository(today);
    case "supabase":
      throw new Error(
        "DATA_SOURCE=supabase is not implemented yet. Set DATA_SOURCE=demo (or remove it) in .env.local.",
      );
    default:
      throw new Error(`Unknown DATA_SOURCE "${source}". Expected "demo" or "supabase".`);
  }
}
