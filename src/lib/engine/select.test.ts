import { describe, expect, it } from "vitest";
import {
  selectSuggestions,
  type Candidate,
  type PastSuggestion,
} from "./select";

const readiness: Candidate = {
  kind: "readiness",
  subject: "",
  params: { level: "lower" },
};
const plateauBench: Candidate = {
  kind: "plateau",
  subject: "barbell-bench-press",
  params: {},
};
const plateauSquat: Candidate = {
  kind: "plateau",
  subject: "barbell-back-squat",
  params: {},
};
const safety: Candidate = { kind: "safety", subject: "", params: {} };
const today = "2026-10-30";

describe("selectSuggestions", () => {
  it("shows at most two, in priority order safety > readiness > plateau", () => {
    const out = selectSuggestions(
      [plateauBench, readiness, safety, plateauSquat],
      [],
      today,
    );
    expect(out.map((c) => c.kind)).toEqual(["safety", "readiness"]);
  });

  it("does not repeat a dismissed kind within 14 days, but allows it afterwards", () => {
    const dismissed: PastSuggestion = {
      kind: "readiness",
      subject: "",
      day: "2026-10-20",
      status: "dismissed",
    };
    expect(selectSuggestions([readiness], [dismissed], today)).toEqual([]);
    expect(
      selectSuggestions(
        [readiness],
        [{ ...dismissed, day: "2026-10-10" }],
        today,
      ),
    ).toEqual([readiness]);
  });

  it("shows a plateau for the same exercise at most once every 14 days, whatever the reaction", () => {
    const shown: PastSuggestion = {
      kind: "plateau",
      subject: "barbell-bench-press",
      day: "2026-10-25",
      status: "shown",
    };
    expect(
      selectSuggestions([plateauBench, plateauSquat], [shown], today),
    ).toEqual([plateauSquat]);
  });

  it("never lets a dismissal hide a safety notice", () => {
    const dismissed: PastSuggestion = {
      kind: "safety",
      subject: "",
      day: "2026-10-29",
      status: "dismissed",
    };
    expect(selectSuggestions([safety], [dismissed], today)).toEqual([safety]);
  });

  it("keeps today's own earlier suggestions (same day is not a repeat)", () => {
    const sameDay: PastSuggestion = {
      kind: "readiness",
      subject: "",
      day: today,
      status: "shown",
    };
    expect(selectSuggestions([readiness], [sameDay], today)).toEqual([
      readiness,
    ]);
  });

  it("lets a third plateau through once the first two are in cooldown", () => {
    const third: Candidate = {
      kind: "plateau",
      subject: "pull-up",
      params: {},
    };
    const past: PastSuggestion[] = [
      {
        kind: "plateau",
        subject: "barbell-bench-press",
        day: "2026-10-25",
        status: "shown",
      },
      {
        kind: "plateau",
        subject: "barbell-back-squat",
        day: "2026-10-25",
        status: "shown",
      },
    ];
    expect(
      selectSuggestions([plateauBench, plateauSquat, third], past, today),
    ).toEqual([third]);
  });

  it("shows at most one plateau per day", () => {
    expect(selectSuggestions([plateauBench, plateauSquat], [], today)).toEqual([
      plateauBench,
    ]);
  });

  it("keeps the cooldown per readiness level: dismissing 'higher' does not silence 'lower'", () => {
    const lower: Candidate = {
      kind: "readiness",
      subject: "lower",
      params: {},
    };
    const dismissedHigher: PastSuggestion = {
      kind: "readiness",
      subject: "higher",
      day: "2026-10-28",
      status: "dismissed",
    };
    expect(selectSuggestions([lower], [dismissedHigher], today)).toEqual([
      lower,
    ]);
  });

  it("is allowed again exactly 14 days after a dismissal, not on day 13", () => {
    const d = (day: string): PastSuggestion => ({
      kind: "readiness",
      subject: "lower",
      day,
      status: "dismissed",
    });
    const lower: Candidate = {
      kind: "readiness",
      subject: "lower",
      params: {},
    };
    expect(selectSuggestions([lower], [d("2026-10-17")], today)).toEqual([]); // 13 days ago
    expect(selectSuggestions([lower], [d("2026-10-16")], today)).toEqual([
      lower,
    ]); // 14 days ago
  });

  it("keeps a safety notice quiet for a week after she marked it as read, but not after a dismissal", () => {
    const read: PastSuggestion = {
      kind: "safety",
      subject: "",
      day: "2026-10-27",
      status: "accepted",
    };
    expect(selectSuggestions([safety], [read], today)).toEqual([]);
    expect(
      selectSuggestions([safety], [{ ...read, day: "2026-10-22" }], today),
    ).toEqual([safety]); // 8 days ago
  });

  it("raises a pattern for the same finding at most once every four weeks", () => {
    const pattern: Candidate = {
      kind: "pattern",
      subject: "energy:before",
      params: {},
    };
    const shown = (day: string): PastSuggestion => ({
      kind: "pattern",
      subject: "energy:before",
      day,
      status: "accepted",
    });
    expect(selectSuggestions([pattern], [shown("2026-10-10")], today)).toEqual(
      [],
    ); // 20 days
    expect(selectSuggestions([pattern], [shown("2026-10-01")], today)).toEqual([
      pattern,
    ]); // 29 days
  });
});
