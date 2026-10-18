import { daysBetween } from "@/lib/daily/day";
import type {
  SuggestionKind,
  SuggestionParams,
  SuggestionStatus,
} from "@/lib/local/types";

export interface Candidate {
  kind: SuggestionKind;
  subject: string;
  params: SuggestionParams;
}
export interface PastSuggestion {
  kind: SuggestionKind;
  subject: string;
  day: string;
  status: SuggestionStatus;
}

export const MAX_PER_DAY = 2;
export const COOLDOWN_DAYS = 14;

const PRIORITY: Record<SuggestionKind, number> = {
  safety: 0,
  readiness: 1,
  pattern: 2,
  plateau: 3,
  hunger_note: 4,
};

// Few, calm hints. A dismissed kind stays quiet for two weeks; a plateau is
// raised once per exercise per two weeks whatever the reaction; a safety notice
// is never silenced by an earlier dismissal.
export function selectSuggestions(
  candidates: Candidate[],
  past: PastSuggestion[],
  today: string,
): Candidate[] {
  const allowed = candidates.filter((c) => {
    if (c.kind === "safety") return true;
    const recent = past.filter(
      (p) =>
        p.kind === c.kind &&
        p.subject === c.subject &&
        p.day !== today &&
        daysBetween(p.day, today) < COOLDOWN_DAYS,
    );
    if (c.kind === "plateau") return recent.length === 0;
    return !recent.some((p) => p.status === "dismissed");
  });
  return allowed
    .sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind])
    .slice(0, MAX_PER_DAY);
}
