import type { ComponentProps, ReactNode } from "react";

export const buttonClass =
  "rounded-xl bg-rose-600 px-5 py-3 font-semibold text-white hover:bg-rose-700 disabled:opacity-60";
export const secondaryButtonClass =
  "rounded-xl border border-neutral-300 bg-white px-5 py-3 font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60";
export const inputClass =
  "rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900 focus:outline-2 focus:outline-rose-500";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {children}
      {hint && (
        <span className="text-xs font-normal text-neutral-600">{hint}</span>
      )}
    </label>
  );
}

export function Notice({
  tone = "error",
  children,
}: {
  tone?: "error" | "info";
  children: ReactNode;
}) {
  const cls =
    tone === "error"
      ? "bg-red-50 text-red-900"
      : "bg-emerald-50 text-emerald-900";
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl p-3 text-sm ${cls}`}
    >
      {children}
    </p>
  );
}

export function Page({
  title,
  children,
  narrow = true,
}: {
  title: string;
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <main
      className={`mx-auto flex w-full flex-col gap-6 px-4 py-12 ${narrow ? "max-w-md" : "max-w-3xl"}`}
    >
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </main>
  );
}

export function SubmitButton(
  props: ComponentProps<"button"> & {
    pending?: boolean;
    label: string;
    pendingLabel?: string;
  },
) {
  const { pending, label, pendingLabel, ...rest } = props;
  return (
    <button type="submit" disabled={pending} className={buttonClass} {...rest}>
      {pending ? (pendingLabel ?? "Bitte warten …") : label}
    </button>
  );
}
