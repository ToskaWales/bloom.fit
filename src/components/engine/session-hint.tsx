"use client";

// One-line readiness hint at the top of a running workout (training/session-view.tsx).
// Reads stored suggestions from the local database without recomputing them; details live on the Today screen.
// Neighbours: use-suggestions.ts, suggestions-card.tsx, lib/engine/texts.

import {
  useReadinessParts,
  useSuggestions,
} from "@/components/engine/use-suggestions";
import { useLocal } from "@/components/local-provider";
import { useToday } from "@/components/daily/use-today";
import { renderSuggestion } from "@/lib/engine/texts";

// One calm line at the top of a running workout, from today's readiness hint.
export function SessionHint() {
  const today = useToday();
  const { units } = useLocal();
  const rows = useSuggestions(today, { refresh: false }); // the home card refreshes; not mid-workout
  const parts = useReadinessParts(today);
  // Mirrors SuggestionsCard: an active safety hint changes how the readiness text is phrased.
  const safetyActive = (rows ?? []).some(
    (r) => r.kind === "safety" && r.status !== "dismissed",
  );
  const row = rows?.find(
    (r) => r.kind === "readiness" && r.status !== "dismissed",
  );
  if (!row) return null;
  const r = renderSuggestion(
    { kind: row.kind, subject: row.subject, params: row.params },
    {
      units,
      exerciseName: () => "",
      readinessParts: parts ?? undefined,
      safetyActive,
    },
  );
  if (!r) return null;
  return (
    <p className="rounded-xl bg-rose-50 p-3 text-sm text-neutral-800">
      <span className="font-semibold">{r.title}.</span>{" "}
      {row.params.level === "lower"
        ? "Mehr dazu auf der Startseite unter „Für dich heute“."
        : ""}
    </p>
  );
}
