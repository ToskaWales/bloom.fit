import { estimateOneRepMax, type SetLike } from "./stats";

export type PrKind = "weight" | "e1rm";
export type PrSet = SetLike & { id: string };

const usable = (s: SetLike) =>
  s.completed &&
  !s.deleted_at &&
  s.set_type !== "warmup" &&
  s.weight_kg != null &&
  s.weight_kg > 0 &&
  s.reps != null &&
  s.reps >= 1;

// Personal records of the current sets against everything done earlier.
// `current` must be in the order the sets were performed. Without any earlier
// history there is no baseline, so nothing is flagged (a first time isn't a "record").
export function findPRs(
  history: SetLike[],
  current: PrSet[],
): Map<string, PrKind[]> {
  const result = new Map<string, PrKind[]>();
  const earlier = history.filter(usable);
  if (earlier.length === 0) return result;

  let bestWeight = Math.max(...earlier.map((s) => s.weight_kg!));
  let bestE1rm = Math.max(
    ...earlier.map((s) => estimateOneRepMax(s.weight_kg, s.reps) ?? 0),
  );

  for (const s of current) {
    if (!usable(s)) continue;
    const kinds: PrKind[] = [];
    const e1rm = estimateOneRepMax(s.weight_kg, s.reps);
    if (s.weight_kg! > bestWeight) {
      kinds.push("weight");
      bestWeight = s.weight_kg!;
    }
    if (e1rm !== null && e1rm > bestE1rm) {
      kinds.push("e1rm");
      bestE1rm = e1rm;
    }
    if (kinds.length) result.set(s.id, kinds);
  }
  return result;
}
