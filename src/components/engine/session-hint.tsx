"use client";

import { useSuggestions } from "@/components/engine/use-suggestions";
import { useToday } from "@/components/daily/use-today";
import { renderSuggestion } from "@/lib/engine/texts";

// One calm line at the top of a running workout, from today's readiness hint.
export function SessionHint() {
  const today = useToday();
  const rows = useSuggestions(today);
  const row = rows?.find(
    (r) => r.kind === "readiness" && r.status !== "dismissed",
  );
  if (!row) return null;
  const r = renderSuggestion(
    { kind: row.kind, subject: row.subject, params: row.params },
    { units: "metric", exerciseName: () => "" },
  );
  return (
    <p className="rounded-xl bg-rose-50 p-3 text-sm text-neutral-800">
      <span className="font-semibold">{r.title}.</span>{" "}
      {row.params.level === "lower"
        ? "Mehr dazu auf der Startseite unter „Für dich heute“."
        : ""}
    </p>
  );
}
