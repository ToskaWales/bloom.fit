import { describe, expect, it } from "vitest";
import type { SuggestionKind } from "@/lib/local/types";
import type { Candidate } from "./select";
import { describeFinding, renderSuggestion, type RenderContext } from "./texts";

// Wording rules from CLAUDE.md, checked against every sentence the engine can
// produce: no phase talk, no calorie or protein numbers, no "optimal", no
// "cycle syncing", no science claims, no commands, no diagnoses, no weight loss.
const FORBIDDEN: RegExp[] = [
  /follikel/i,
  /luteal/i,
  /phase/i,
  /optimal/i,
  /kcal|kalorien|protein|kohlenhydrat/i,
  /\d+\s*(kcal|g\b)/i,
  /brauchst|benötigst/i,
  /cycle[ -]?sync|zyklus-?sync|zyklusbasiert/i,
  /science|wissenschaft|studie|forschung zeigt|belegt|bewiesen|garantiert|beweist|nachweislich/i,
  /\bmusst\b|\bsolltest\b|\bsollst\b|\bunbedingt\b/i,
  /\b(trainiere|mach|nimm|iss|hör|verzichte|schau|probiere|reduziere|steigere)\b/i, // imperatives
  /\bweniger\b|weniger\s+ess|eiweiß|eiweiss/i,
  /diagnos|krankheit|störung|essstörung/i,
  /abnehm|diät|defizit|zunehm/i,
];

const metric: RenderContext = {
  units: "metric",
  exerciseName: (id) =>
    id === "barbell-bench-press" ? "Bankdrücken (Langhantel)" : "Eigene Übung",
};
const imperial: RenderContext = { ...metric, units: "imperial" };
const safetyOn: RenderContext = { ...metric, safetyActive: true };
const withParts: RenderContext = {
  ...metric,
  readinessParts: [
    { metric: "energy", value: 2, baseline: 3 },
    { metric: "motivation", value: 2, baseline: 3 },
    { metric: "sleep", value: 2, baseline: 3 },
  ],
};

const KINDS: SuggestionKind[] = [
  "readiness",
  "plateau",
  "pattern",
  "safety",
  "hunger_note",
];

function grid(): Candidate[] {
  const out: Candidate[] = [];
  for (const kind of KINDS) out.push({ kind, subject: "", params: {} }); // garbage / empty params
  for (const level of ["lower", "usual", "higher"])
    for (const canPush of [true, false])
      out.push({
        kind: "readiness",
        subject: level,
        params: { level, delta: level === "lower" ? -1.3 : 1.1, canPush },
      });
  for (const weeks of [1, 4])
    out.push({
      kind: "plateau",
      subject: "barbell-bench-press",
      params: { sessions: 4, weeks, recentBest: 85, earlierBest: 85 },
    });
  out.push({
    kind: "plateau",
    subject: "custom-x",
    params: { sessions: 5, weeks: 6, recentBest: 100.5, earlierBest: 100 },
  });
  for (const m of [
    "energy",
    "motivation",
    "sleep",
    "hunger",
    "performance",
  ] as const)
    for (const window of ["before", "start"] as const)
      for (const effect of m === "performance" ? [-0.07, 0.06] : [-1.1, 0.9])
        out.push({
          kind: "pattern",
          subject: `${m}:${window}`,
          params: {
            metric: m,
            window,
            effect,
            cycles: 3,
            windowAvg: 2.1,
            restAvg: 3.2,
          },
        });
  for (const lowEnergy of [true, false])
    for (const weightFall of [true, false])
      for (const lowIntake of [true, false])
        out.push({
          kind: "safety",
          subject: "",
          params: { overdueDays: 10, lowEnergy, weightFall, lowIntake },
        });
  for (const perfDrop of [undefined, 5])
    out.push({
      kind: "hunger_note",
      subject: "",
      params: {
        recent: 4,
        before: 2.5,
        trainingDays: 6,
        ...(perfDrop ? { perfDrop } : {}),
      },
    });
  for (const lowEnergy of [true, false])
    for (const lowIntake of [true, false])
      out.push({
        kind: "safety",
        subject: "energy",
        params: { overdueDays: 0, lowEnergy, lowIntake },
      });
  return out;
}

describe("renderSuggestion: wording rules", () => {
  const candidates = grid();
  for (const [name, ctx] of [
    ["metric", metric],
    ["imperial", imperial],
    ["safety active", safetyOn],
    ["with data", withParts],
  ] as const) {
    it(`every possible text passes the rules (${name})`, () => {
      let rendered = 0;
      for (const c of candidates) {
        const r = renderSuggestion(c, ctx);
        if (!r) continue;
        rendered++;
        const all = [r.title, r.body, ...r.because, r.acceptLabel ?? ""].join(
          "\n",
        );
        for (const rule of FORBIDDEN)
          expect(
            all,
            `${c.kind}/${c.subject} ${JSON.stringify(c.params)} vs ${rule}`,
          ).not.toMatch(rule);
        expect(r.because.length, `${c.kind} needs a 'because'`).toBeGreaterThan(
          0,
        );
        expect(all, "no invented numbers for missing params").not.toMatch(
          /NaN|undefined|null/,
        );
      }
      expect(rendered).toBeGreaterThan(20);
    });
  }

  it("catches what it is meant to catch (the checks themselves work)", () => {
    for (const bad of [
      "Zyklusphase",
      "du brauchst mehr kcal",
      "optimal für dich",
      "Studien zeigen",
      "Trainiere heute",
      "Lutealphase",
      "Zyklusbasiertes Training",
    ]) {
      expect(
        FORBIDDEN.some((r) => r.test(bad)),
        bad,
      ).toBe(true);
    }
  });

  it("does not render kinds it has no text for", () => {
    expect(
      renderSuggestion(
        { kind: "hunger_note", subject: "", params: {} },
        metric,
      ),
    ).toBeNull();
    expect(
      renderSuggestion(
        { kind: "horoscope" as SuggestionKind, subject: "", params: {} },
        metric,
      ),
    ).toBeNull();
  });
});

describe("renderSuggestion: content", () => {
  const r = (c: Candidate, ctx: RenderContext = metric) =>
    renderSuggestion(c, ctx)!;
  const lower: Candidate = {
    kind: "readiness",
    subject: "lower",
    params: { level: "lower", delta: -1.3, canPush: false },
  };

  it("shows the data behind a readiness hint when it is available, otherwise a generic line", () => {
    expect(r(lower, withParts).because.join(" ")).toMatch(
      /Energie heute 2, bei dir meist 3/,
    );
    expect(r(lower).because.join(" ")).toMatch(/letzten vier Wochen/);
    expect(r(lower).title).toMatch(/leichter/);
  });

  it("offers the optional extra rep only on a good day, with permission, and never while a safety notice is active", () => {
    const higher = (canPush: boolean): Candidate => ({
      kind: "readiness",
      subject: "higher",
      params: { level: "higher", canPush },
    });
    expect(r(higher(true)).body).toMatch(/Wiederholung/);
    expect(r(higher(false)).body).not.toMatch(/Wiederholung/);
    expect(r(higher(true), safetyOn).body).not.toMatch(/Wiederholung/);
  });

  it("plateau: names the exercise, formats weights in her unit and does not contradict its numbers", () => {
    const c: Candidate = {
      kind: "plateau",
      subject: "barbell-bench-press",
      params: { sessions: 4, weeks: 4, recentBest: 85, earlierBest: 85 },
    };
    expect(r(c).title).toMatch(/Bankdrücken/);
    expect(r(c).title).not.toMatch(/Bestwert/);
    expect(r(c).because.join(" ")).toMatch(/85 kg/);
    expect(r(c, imperial).because.join(" ")).toMatch(/lbs/);
  });

  it("pattern: states direction, size and number of cycles as an observation about her data only", () => {
    const c: Candidate = {
      kind: "pattern",
      subject: "energy:before",
      params: {
        metric: "energy",
        window: "before",
        effect: -1.1,
        cycles: 3,
        windowAvg: 2.1,
        restAvg: 3.2,
      },
    };
    const text = `${r(c).title} ${r(c).body} ${r(c).because.join(" ")}`;
    expect(text).toMatch(/Energie/);
    expect(text).toMatch(/vor deiner Periode/);
    expect(text).toMatch(/niedriger/);
    expect(text).toMatch(/3 Zyklen/);
    expect(r(c).body).toMatch(/in deinen Daten/);
  });

  it("safety: lists only the signals that apply and points to a doctor without diagnosing", () => {
    const only = r({
      kind: "safety",
      subject: "",
      params: { overdueDays: 10, lowEnergy: true, weightFall: false },
    });
    expect(only.because.join(" ")).toMatch(/Periode/);
    expect(only.because.join(" ")).toMatch(/Energie/);
    expect(only.because.join(" ")).not.toMatch(/Gewicht/);
    expect(only.body).toMatch(/Ärztin, einem Arzt/);
    expect(only.body).toMatch(/keine Steigerung/);
  });
});

describe("describeFinding: wording rules", () => {
  it("every metric, window and direction passes the rules", () => {
    for (const metric of [
      "energy",
      "motivation",
      "sleep",
      "hunger",
      "performance",
    ] as const)
      for (const window of ["before", "start"] as const)
        for (const effect of [-0.9, 0.9]) {
          const t = describeFinding({ metric, window, effect, cycles: 3 });
          const all = [t.title, t.summary, t.unit, t.value(effect)].join("\n");
          for (const rule of FORBIDDEN) expect(all).not.toMatch(rule);
          expect(all).not.toMatch(/NaN|undefined/);
        }
  });
  it("writes performance as a percentage with a sign", () => {
    expect(
      describeFinding({
        metric: "performance",
        window: "start",
        effect: -0.06,
        cycles: 2,
      }).value(-0.06),
    ).toBe("−6 %");
  });
});

describe("renderSuggestion: hunger", () => {
  const note = (params: Candidate["params"]): Candidate => ({
    kind: "hunger_note",
    subject: "",
    params,
  });
  it("states her numbers, offers eating more only softly and never gives a number", () => {
    const r = renderSuggestion(
      note({ recent: 4, before: 2.5, trainingDays: 6 }),
      metric,
    );
    expect(r?.title).toBe("Hunger: zuletzt höher als sonst");
    expect(r?.body).toMatch(/Hunger ist ein Signal, kein Fehler/);
    expect(r?.body).toMatch(/Wenn du magst/);
    expect(r?.because).toEqual([
      "Hunger in den letzten 7 Tagen meist 4, bei dir sonst meist 2,5",
      "Verglichen mit deinen Check-ins der vier Wochen davor",
      "Dazu hast du in den letzten zwei Wochen an 6 Tagen trainiert",
    ]);
  });
  it("adds the performance line only when it is in the data", () => {
    const r = renderSuggestion(
      note({ recent: 4, before: 2.5, trainingDays: 6, perfDrop: 5 }),
      metric,
    );
    expect(r?.because.at(-1)).toBe(
      "Deine Trainingsleistung lag zuletzt etwa 5 % unter deinem üblichen Niveau",
    );
  });
  it("renders nothing for unusable params (no invented numbers)", () => {
    expect(renderSuggestion(note({}), metric)).toBeNull();
    expect(
      renderSuggestion(note({ recent: 4, before: 2.5 }), metric),
    ).toBeNull();
    expect(
      renderSuggestion(
        note({ recent: "x", before: 2, trainingDays: 5 }),
        metric,
      ),
    ).toBeNull();
  });
  it("a pattern about higher hunger adds the soft sentence, other patterns do not", () => {
    const pattern = (metricName: string, effect: number): Candidate => ({
      kind: "pattern",
      subject: `${metricName}:before`,
      params: {
        metric: metricName,
        window: "before",
        effect,
        cycles: 3,
        windowAvg: 4,
        restAvg: 3,
      },
    });
    expect(renderSuggestion(pattern("hunger", 1), metric)?.body).toMatch(
      /Wenn du magst, kannst du an diesen Tagen etwas mehr oder öfter essen/,
    );
    expect(renderSuggestion(pattern("hunger", -1), metric)?.body).not.toMatch(
      /essen/,
    );
    expect(renderSuggestion(pattern("energy", 1), metric)?.body).not.toMatch(
      /essen/,
    );
  });
});
