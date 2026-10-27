// Chooses which candidate hints are actually shown today: daily cap, priority,
// cooldowns after dismissal. It keeps the engine calm; it does not decide what is
// true (./index.ts builds candidates) or how it is worded (./texts.ts). Past
// suggestions come from local storage (@/lib/local/types).
import { daysBetween } from "@/lib/daily/day";
import type {
  SuggestionKind,
  SuggestionParams,
  SuggestionStatus,
} from "@/lib/local/types";

/** A hint the engine could show: kind + subject (e.g. exercise id) identify it for cooldowns; params feed texts.ts. */
export interface Candidate {
  kind: SuggestionKind;
  subject: string;
  params: SuggestionParams;
}
/** A hint shown earlier, with how she reacted (status). */
export interface PastSuggestion {
  kind: SuggestionKind;
  subject: string;
  day: string;
  status: SuggestionStatus;
}

/** At most two hints per day, in total. */
export const MAX_PER_DAY = 2;
/** Days a dismissed hint of the same kind/subject stays quiet. */
export const COOLDOWN_DAYS = 14;
const SAFETY_QUIET_DAYS = 7;
// Minimum days between two hints of the same kind and subject, whatever she answered.
const ONCE_PER_DAYS: Partial<Record<SuggestionKind, number>> = {
  plateau: 14,
  pattern: 28,
  hunger_note: 28,
};
// One of a kind per day keeps the card calm (a second plateau waits for another day).
const PER_KIND_CAP: Partial<Record<SuggestionKind, number>> = {
  plateau: 1,
  pattern: 1,
  hunger_note: 1,
};

// Lower number wins when the daily cap forces a choice; safety always first.
const PRIORITY: Record<SuggestionKind, number> = {
  safety: 0,
  readiness: 1,
  pattern: 2,
  plateau: 3,
  hunger_note: 4,
};

// Returns at most MAX_PER_DAY candidates. Few, calm hints. A dismissed kind stays quiet for two weeks; a plateau is
// raised once per exercise per two weeks whatever the reaction; a safety notice
// is never silenced by an earlier dismissal.
export function selectSuggestions(
  candidates: Candidate[],
  past: PastSuggestion[],
  today: string,
): Candidate[] {
  const allowed = candidates.filter((c) => {
    // The two safety variants (late period / low energy) count as one notice.
    const earlier = past.filter(
      (p) =>
        p.kind === c.kind &&
        (c.kind === "safety" || p.subject === c.subject) &&
        p.day !== today,
    );
    // A safety notice is never silenced by a dismissal; once she has marked it as read it waits a week.
    if (c.kind === "safety")
      return !earlier.some(
        (p) =>
          p.status === "accepted" &&
          daysBetween(p.day, today) < SAFETY_QUIET_DAYS,
      );
    // Findings and plateaus are raised once per cooldown, whatever the reaction.
    const once = ONCE_PER_DAYS[c.kind];
    if (once) return !earlier.some((p) => daysBetween(p.day, today) < once);
    return !earlier.some(
      (p) =>
        p.status === "dismissed" && daysBetween(p.day, today) < COOLDOWN_DAYS,
    );
  });
  const taken = new Map<SuggestionKind, number>();
  return allowed
    .sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind])
    .filter((c) => {
      const n = taken.get(c.kind) ?? 0;
      taken.set(c.kind, n + 1);
      return n < (PER_KIND_CAP[c.kind] ?? MAX_PER_DAY);
    })
    .slice(0, MAX_PER_DAY);
}
