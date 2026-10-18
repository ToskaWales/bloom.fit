import { describe, expect, it } from "vitest";
import { renderSuggestion } from "./texts";
import type { Candidate } from "./select";

// Wording rules from CLAUDE.md: no phase prescriptions, no calorie numbers, no
// "optimal", no "cycle syncing", no unsupported science claims, no commands.
const FORBIDDEN = [
  /follikel/i,
  /luteal/i,
  /\bphase\b/i,
  /optimal/i,
  /kcal|kalorien/i,
  /cycle[ -]?sync/i,
  /science|wissenschaftlich/i,
  /bewiesen|garantiert|beweist/i,
  /\bmusst\b|\bsolltest\b|\bsollst\b/i,
  /diagnos|krankheit|störung/i,
  /abnehm|diät/i,
];

const ctx = {
  units: "metric" as const,
  exerciseName: (id: string) =>
    id === "barbell-bench-press" ? "Bankdrücken (Langhantel)" : "Eigene Übung",
};

const grid: Candidate[] = [
  ...(["lower", "usual", "higher"] as const).flatMap((level) =>
    [true, false].map((canPush) => ({
      kind: "readiness" as const,
      subject: "",
      params: {
        level,
        delta: level === "lower" ? -1.3 : level === "higher" ? 1.1 : 0,
        canPush,
        energy: 2,
        energyBase: 3,
        motivation: 2,
        motivationBase: 3,
        sleep: 2,
        sleepBase: 3,
      },
    })),
  ),
  {
    kind: "plateau",
    subject: "barbell-bench-press",
    params: { sessions: 4, weeks: 4, recentBest: 85, earlierBest: 85 },
  },
  {
    kind: "plateau",
    subject: "x-custom",
    params: { sessions: 5, weeks: 6, recentBest: 60.5, earlierBest: 64 },
  },
];

describe("renderSuggestion", () => {
  it.each(grid.map((g, i) => [i, g] as const))(
    "text %i passes the wording rules and explains itself",
    (_i, candidate) => {
      const r = renderSuggestion(candidate, ctx);
      const all = [r.title, r.body, ...r.because, r.acceptLabel ?? ""].join(
        "\n",
      );
      for (const rule of FORBIDDEN) expect(all, String(rule)).not.toMatch(rule);
      expect(r.because.length).toBeGreaterThan(0);
      expect(r.title.length).toBeGreaterThan(5);
    },
  );

  it("shows the data behind a lower-readiness hint", () => {
    const r = renderSuggestion(grid[0], ctx);
    expect(r.title).toMatch(/leichter/);
    expect(r.because.join(" ")).toMatch(/Energie.*2.*3/);
  });

  it("offers the optional extra rep only when pushing is allowed", () => {
    const withPush = renderSuggestion(
      grid.find((g) => g.params.level === "higher" && g.params.canPush)!,
      ctx,
    );
    const withoutPush = renderSuggestion(
      grid.find((g) => g.params.level === "higher" && !g.params.canPush)!,
      ctx,
    );
    expect(withPush.body).toMatch(/Wiederholung/);
    expect(withoutPush.body).not.toMatch(/Wiederholung/);
  });

  it("names the exercise and formats weights in the user's unit", () => {
    const kg = renderSuggestion(
      grid.find(
        (g) => g.kind === "plateau" && g.subject === "barbell-bench-press",
      )!,
      ctx,
    );
    expect(kg.title).toMatch(/Bankdrücken/);
    expect(kg.body + kg.because.join(" ")).toMatch(/85 kg/);
    const lbs = renderSuggestion(
      grid.find(
        (g) => g.kind === "plateau" && g.subject === "barbell-bench-press",
      )!,
      { ...ctx, units: "imperial" },
    );
    expect(lbs.body + lbs.because.join(" ")).toMatch(/lbs/);
  });
});
