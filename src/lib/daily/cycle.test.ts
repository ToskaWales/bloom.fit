import { describe, expect, it } from "vitest";
import { summarizeCycle, type CycleEvent } from "./cycle";

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
