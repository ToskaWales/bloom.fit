// Detects personal records (heaviest weight, best estimated 1RM) among the sets
// of the current workout. Pure function; the formula and the notion of a
// "working set" come from ./stats. No wording or celebration lives here.
import { estimateOneRepMax, type SetLike } from "./stats";

/** "weight": heaviest load so far; "e1rm": best estimated 1RM so far. */
export type PrKind = "weight" | "e1rm";
/** A set of the current workout, with an id to attach the record to. */
export type PrSet = SetLike & { id: string };

// Counts for records: completed, not deleted, no warm-up, weight and reps present.
const usable = (s: SetLike) =>
  s.completed &&
  !s.deleted_at &&
  s.set_type !== "warmup" &&
  s.weight_kg != null &&
  s.weight_kg > 0 &&
  s.reps != null &&
  s.reps >= 1;

// Returns the record kinds per set id. Compares the current sets against everything done earlier
// (and against each other, in order: a later set must beat an earlier one).
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
  const baselines = earlier
    .map((s) => estimateOneRepMax(s.weight_kg, s.reps))
    .filter((x): x is number => x !== null);
  // No baseline (all earlier sets high-rep): don't flag a 1RM "record" out of thin air.
  let bestE1rm = baselines.length ? Math.max(...baselines) : Infinity;

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
