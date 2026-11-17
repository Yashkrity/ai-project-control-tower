import { z } from "zod";

/** Empty strings and missing fields both count as "not provided". */
export const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : (v ?? undefined);

export const requiredText = (label: string, min: number, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, { error: `${label} is required`, abort: true })
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be ${max} characters or fewer`);

export const optionalText = (label: string, max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v : ""),
    z.string().trim().max(max, `${label} must be ${max.toLocaleString("en-US")} characters or fewer`),
  );

export const isoDate = (label: string) =>
  z.preprocess(
    blankToUndefined,
    z.iso.date({
      error: (issue) => (issue.input === undefined ? `${label} is required` : `${label} must be a valid date`),
    }),
  );

/** Optional date: blank becomes null. */
export const optionalIsoDate = (label: string) =>
  z.preprocess(
    (v) => blankToUndefined(v) ?? null,
    z.iso.date({ error: `${label} must be a valid date` }).nullable(),
  );

/**
 * Zod skips object-level refinements while any field is invalid. Call this on
 * the failure path so a date-order error is reported together with the rest.
 */
export function dateOrderError(start: unknown, end: unknown): boolean {
  const s = z.iso.date().safeParse(start);
  const e = z.iso.date().safeParse(end);
  return s.success && e.success && e.data < s.data;
}
