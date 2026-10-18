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
});
