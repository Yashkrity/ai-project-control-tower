import type { ReactNode } from "react";
import { cn } from "@/lib/utils/format";

export const inputClass = (invalid: boolean) =>
  cn(
    "block w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400",
    "focus:outline-none focus:ring-2 focus:ring-indigo-500/40",
    invalid ? "border-red-400 focus:border-red-500" : "border-slate-300 focus:border-indigo-500",
  );

/** Label + control + hint/error, with the ids wired for screen readers. */
export function FormField({
  id,
  label,
  required,
  hint,
  errors,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  errors?: string[];
  className?: string;
  children: ReactNode;
}) {
  const error = errors?.[0];
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-600" aria-hidden>*</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** aria props for a control rendered inside <FormField>. */
export function fieldAria(id: string, errors?: string[], hint?: string) {
  const invalid = !!errors?.length;
  return {
    id,
    name: id,
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? `${id}-error` : hint ? `${id}-hint` : undefined,
  };
}
