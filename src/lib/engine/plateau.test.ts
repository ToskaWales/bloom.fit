// Pins down plateau detection: four recent sessions without a real gain, compared
// with the weeks right before them. Matters so old records or breaks never create advice.
import { describe, expect, it } from "vitest";
import { detectPlateau, type ExerciseSession } from "./plateau";

const today = "2026-10-30";
const s = (day: string, e1rm: number): ExerciseSession => ({ day, e1rm });

describe("detectPlateau", () => {
  const earlier = [
    s("2026-08-20", 80),
    s("2026-09-03", 84),
    s("2026-09-10", 85),
  ];

  it("flags four recent sessions without a new best", () => {
    const sessions = [
      ...earlier,
      s("2026-10-01", 84),
      s("2026-10-08", 85),
      s("2026-10-15", 84.5),
      s("2026-10-22", 85),
    ];
    expect(detectPlateau(sessions, today)).toMatchObject({
      sessions: 4,
      recentBest: 85,
      earlierBest: 85,
    });
  });

  it("does not flag while there is progress", () => {
    const sessions = [
      ...earlier,
      s("2026-10-01", 84),
      s("2026-10-08", 86),
      s("2026-10-15", 87),
      s("2026-10-22", 88),
    ];
    expect(detectPlateau(sessions, today)).toBeNull();
  });

  it("needs at least four sessions in the last eight weeks and some history before them", () => {
    expect(
      detectPlateau(
        [...earlier, s("2026-10-15", 84), s("2026-10-22", 85)],
        today,
      ),
    ).toBeNull();
    const tooOld = [
      s("2026-07-01", 85),
      s("2026-07-08", 85),
      s("2026-07-15", 85),
      s("2026-07-22", 85),
    ];
    expect(detectPlateau(tooOld, today)).toBeNull();
    const noHistory = [
      s("2026-10-01", 80),
      s("2026-10-08", 80),
      s("2026-10-15", 80),
      s("2026-10-22", 80),
    ];
    expect(detectPlateau(noHistory, today)).toBeNull();
  });

  it("treats a tiny gain (under 1 %) as no progress, a real one as progress", () => {
    const flat = [
      ...earlier,
      s("2026-10-01", 84),
      s("2026-10-08", 85.5),
      s("2026-10-15", 85),
      s("2026-10-22", 85.5),
    ];
    expect(detectPlateau(flat, today)).not.toBeNull(); // 85.5 vs 85 = +0.6 %
    const gain = [
      ...earlier,
      s("2026-10-01", 84),
      s("2026-10-08", 85),
      s("2026-10-15", 85),
      s("2026-10-22", 86.5),
    ];
    expect(detectPlateau(gain, today)).toBeNull(); // +1.8 %
  });

  it("also reports a decline (same card, the numbers tell the story)", () => {
    const sessions = [
      ...earlier,
      s("2026-10-01", 80),
      s("2026-10-08", 79),
      s("2026-10-15", 78),
      s("2026-10-22", 79),
    ];
    expect(detectPlateau(sessions, today)).toMatchObject({
      recentBest: 80,
      earlierBest: 85,
    });
  });

  it("handles unordered input", () => {
    const sessions = [
      s("2026-10-22", 85),
      s("2026-09-10", 85),
      s("2026-10-01", 84),
      s("2026-08-20", 80),
      s("2026-10-15", 84.5),
      s("2026-09-03", 84),
      s("2026-10-08", 85),
    ];
    expect(detectPlateau(sessions, today)).not.toBeNull();
  });

  it("compares with the weeks before the recent sessions, not with an old record", () => {
    const afterBreak = [
      s("2026-03-05", 100), // old heavy single, long before the recent block
      s("2026-08-20", 70),
      s("2026-09-03", 72),
      s("2026-09-10", 74),
      s("2026-10-01", 76),
      s("2026-10-08", 78),
      s("2026-10-15", 80),
      s("2026-10-22", 82),
    ];
    expect(detectPlateau(afterBreak, today)).toBeNull(); // clearly progressing again
  });

  it("never flags exercises without a usable load (bodyweight logged as 0)", () => {
    const zeros = [
      s("2026-08-20", 0),
      s("2026-09-03", 0),
      s("2026-09-10", 0),
      s("2026-10-01", 0),
      s("2026-10-08", 0),
      s("2026-10-15", 0),
      s("2026-10-22", 0),
    ];
    expect(detectPlateau(zeros, today)).toBeNull();
  });
});
