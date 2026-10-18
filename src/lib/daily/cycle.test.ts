import { describe, expect, it } from "vitest";
import {
  periodDaySet,
  plausibleCycles,
  summarizeCycle,
  type CycleEvent,
} from "./cycle";

const start = (day: string): CycleEvent => ({ kind: "period_start", day });
const end = (day: string): CycleEvent => ({ kind: "period_end", day });

// starts every 28 days from 2026-06-01
const regular = [
  "2026-06-01",
  "2026-06-29",
  "2026-07-27",
  "2026-08-24",
  "2026-09-21",
].map(start);

describe("summarizeCycle", () => {
  it("has nothing to say without data", () => {
    const s = summarizeCycle([], "2026-10-01");
    expect(s).toMatchObject({
      status: "no_data",
      cycleDay: null,
      prediction: null,
      lengths: [],
    });
  });

  it("gives the cycle day from the latest period start", () => {
    const s = summarizeCycle([start("2026-10-01")], "2026-10-12");
    expect(s.cycleDay).toBe(12);
    expect(s.status).toBe("not_enough_data");
    expect(s.prediction).toBeNull();
  });

  it("needs three completed cycles before predicting", () => {
    expect(
      summarizeCycle(regular.slice(0, 3), "2026-08-01").prediction,
    ).toBeNull(); // 2 cycles
    expect(
      summarizeCycle(regular.slice(0, 4), "2026-09-01").prediction,
    ).not.toBeNull(); // 3 cycles
  });

  it("predicts the next period as a range around the typical length", () => {
    const s = summarizeCycle(regular, "2026-10-01");
    expect(s.lengths).toEqual([28, 28, 28, 28]);
    expect(s.medianLength).toBe(28);
    expect(s.status).toBe("regular");
    expect(s.prediction).toMatchObject({ expected: "2026-10-19" });
    expect(s.prediction!.earliest <= s.prediction!.expected).toBe(true);
    expect(s.prediction!.latest >= s.prediction!.expected).toBe(true);
  });

  it("widens the range when cycles vary and refuses to predict very irregular ones", () => {
    const varied = [
      "2026-05-01",
      "2026-05-30",
      "2026-06-24",
      "2026-07-26",
      "2026-08-22",
    ].map(start); // 29, 25, 32, 27
    const s = summarizeCycle(varied, "2026-09-10");
    expect(s.status).toBe("regular");
    const width = (p: { earliest: string; latest: string }) =>
      Date.parse(p.latest) - Date.parse(p.earliest);
    expect(width(s.prediction!)).toBeGreaterThan(
      width(summarizeCycle(regular, "2026-10-01").prediction!),
    );

    const wild = [
      "2026-03-01",
      "2026-03-24",
      "2026-05-02",
      "2026-05-25",
      "2026-07-05",
    ].map(start); // 23, 39, 23, 41
    const w = summarizeCycle(wild, "2026-07-20");
    expect(w.status).toBe("irregular");
    expect(w.prediction).toBeNull();
  });

  it("ignores implausible gaps (a missed log) instead of distorting the average", () => {
    const withGap = [
      "2026-06-01",
      "2026-06-29",
      "2026-09-21",
      "2026-10-19",
      "2026-11-16",
    ].map(start); // 28, 84, 28, 28
    const s = summarizeCycle(withGap, "2026-11-20");
    expect(s.lengths).toEqual([28, 28, 28]);
    expect(s.medianLength).toBe(28);
  });

  it("gives no cycle day when the last start is too old to be trusted", () => {
    expect(
      summarizeCycle([start("2026-06-01")], "2026-10-01").cycleDay,
    ).toBeNull();
  });

  it("derives period lengths from matching end events and ignores orphans", () => {
    const s = summarizeCycle(
      [...regular, end("2026-09-25"), end("2026-06-05"), end("2026-01-01")],
      "2026-10-01",
    );
    expect(s.periodLengths).toEqual([5, 5]);
  });

  it("ignores deleted or duplicate starts and unordered input", () => {
    const shuffled = [
      regular[3],
      regular[0],
      regular[2],
      regular[1],
      regular[4],
      regular[4],
    ];
    expect(summarizeCycle(shuffled, "2026-10-01").lengths).toEqual([
      28, 28, 28, 28,
    ]);
  });
});

describe("summarizeCycle: review fixes", () => {
  const starts = (...days: string[]) => days.map(start);

  it("flags an overdue period instead of showing a prediction window in the past", () => {
    const s = summarizeCycle(regular, "2026-10-30"); // expected ~Oct 19, window ends Oct 23
    expect(s.status).toBe("overdue");
    expect(s.prediction).toBeNull();
    expect(s.cycleDay).toBe(40);
  });

  it("calls an old last start stale (no cycle day, no prediction)", () => {
    const s = summarizeCycle(regular, "2026-12-20");
    expect(s.status).toBe("stale");
    expect(s.cycleDay).toBeNull();
    expect(s.prediction).toBeNull();
  });

  it("merges a second start within two weeks into the first (re-tapped button)", () => {
    const s = summarizeCycle(
      starts(
        "2026-06-01",
        "2026-06-04",
        "2026-06-29",
        "2026-07-27",
        "2026-08-24",
      ),
      "2026-09-01",
    );
    expect(s.lengths).toEqual([28, 28, 28]);
    expect(s.lastStart).toBe("2026-08-24");
  });

  it("does not treat one missed log (about twice the usual length) as a very long cycle", () => {
    const s = summarizeCycle(
      starts(
        "2026-01-01",
        "2026-01-29",
        "2026-02-26",
        "2026-04-23",
        "2026-05-21",
      ),
      "2026-06-01",
    ); // 28, 28, 56, 28
    expect(s.lengths).toEqual([28, 28, 28]);
    expect(s.status).toBe("regular");
  });

  it("keeps genuinely long cycles when no gap is an outlier", () => {
    const s = summarizeCycle(
      starts(
        "2026-01-01",
        "2026-02-10",
        "2026-03-22",
        "2026-05-01",
        "2026-06-10",
      ),
      "2026-06-20",
    ); // 40 x4
    expect(s.lengths).toEqual([40, 40, 40, 40]);
  });

  it("includes cycle lengths of exactly 18 and 60 days and excludes 17 and 61", () => {
    const add = (n: number) =>
      new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10);
    const lengths = (n: number) =>
      summarizeCycle(starts("2026-01-01", add(n)), "2026-12-31").lengths;
    expect([lengths(17), lengths(18), lengths(60), lengths(61)]).toEqual([
      [],
      [18],
      [60],
      [],
    ]);
  });

  it("does not let one end event count for two starts", () => {
    const s = summarizeCycle(
      [...starts("2026-06-01", "2026-06-20"), end("2026-06-24")],
      "2026-07-01",
    );
    expect(s.periodLengths).toEqual([5]); // only the second period (Jun 20-24) has an end
  });
});

describe("periodDaySet", () => {
  it("shades start..end, only the start day without an end, and ignores orphans and far ends", () => {
    const days = periodDaySet([
      start("2026-10-01"),
      end("2026-10-04"),
      start("2026-11-01"),
      end("2026-11-30"),
      end("2026-01-01"),
    ]);
    expect([...days].sort()).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-11-01",
    ]);
  });
  it("handles duplicate starts", () => {
    expect(periodDaySet([start("2026-10-01"), start("2026-10-01")]).size).toBe(
      1,
    );
  });
});

describe("overdueDays and plausibleCycles", () => {
  it("reports how many days the period is beyond the usual window", () => {
    // expected 2026-10-19, window ends 2026-10-21 (half width 2 days)
    expect(summarizeCycle(regular, "2026-10-30")).toMatchObject({
      status: "overdue",
      overdueDays: 9,
    });
    expect(summarizeCycle(regular, "2026-10-01").overdueDays).toBeNull();
  });

  it("lists complete cycles with their start, next start and length, without implausible gaps", () => {
    const withGap = [
      start("2026-06-01"),
      start("2026-06-29"),
      start("2026-09-21"),
      start("2026-10-19"),
      start("2026-11-16"),
    ]; // 28, 84, 28, 28
    expect(plausibleCycles(withGap)).toEqual([
      { start: "2026-06-01", next: "2026-06-29", length: 28 },
      { start: "2026-09-21", next: "2026-10-19", length: 28 },
      { start: "2026-10-19", next: "2026-11-16", length: 28 },
    ]);
  });

  it("drops a cycle that is about twice the usual length (a missed log)", () => {
    const missed = [
      "2026-01-01",
      "2026-01-29",
      "2026-02-26",
      "2026-04-23",
      "2026-05-21",
    ].map(start);
    expect(plausibleCycles(missed).map((c) => c.length)).toEqual([28, 28, 28]);
  });
});
