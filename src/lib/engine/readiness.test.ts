import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/daily/day";
import { computeReadiness, type ReadinessCheckin } from "./readiness";

const today = "2026-10-30";
const c = (
  offset: number,
  v: Partial<ReadinessCheckin> = {},
): ReadinessCheckin => ({
  day: addDays(today, offset),
  energy: 3,
  motivation: 3,
  sleep_quality: 3,
  ...v,
});
// ten usual days (all 3s) before today
const usual = Array.from({ length: 10 }, (_, i) => c(-(i + 1)));

describe("computeReadiness", () => {
  it("needs today's check-in", () => {
    expect(computeReadiness(today, usual)).toEqual({ status: "no_checkin" });
  });

  it("says so when there is too little history to compare with", () => {
    const r = computeReadiness(today, [c(0), ...usual.slice(0, 4)]);
    expect(r).toMatchObject({ status: "not_enough_data", have: 4, need: 7 });
  });

  it("is usual when today matches the personal baseline", () => {
    const r = computeReadiness(today, [c(0), ...usual]);
    expect(r).toMatchObject({ status: "ready", level: "usual", delta: 0 });
  });

  it("is lower when energy, motivation and sleep are clearly under the personal baseline", () => {
    const r = computeReadiness(today, [
      c(0, { energy: 2, motivation: 1, sleep_quality: 2 }),
      ...usual,
    ]);
    expect(r).toMatchObject({ status: "ready", level: "lower" });
    if (r.status === "ready") {
      expect(r.delta).toBeLessThanOrEqual(-0.8);
      expect(r.parts.map((p) => [p.metric, p.value, p.baseline])).toEqual([
        ["energy", 2, 3],
        ["motivation", 1, 3],
        ["sleep", 2, 3],
      ]);
    }
  });

  it("is higher when everything is above the baseline", () => {
    const r = computeReadiness(today, [
      c(0, { energy: 5, motivation: 4, sleep_quality: 4 }),
      ...usual,
    ]);
    expect(r).toMatchObject({ status: "ready", level: "higher" });
  });

  it("compares with the person's own normal, not an absolute scale", () => {
    const lowNormal = Array.from({ length: 10 }, (_, i) =>
      c(-(i + 1), { energy: 2, motivation: 2, sleep_quality: 2 }),
    );
    const r = computeReadiness(today, [
      c(0, { energy: 2, motivation: 2, sleep_quality: 2 }),
      ...lowNormal,
    ]);
    expect(r).toMatchObject({ level: "usual" }); // a 2 is normal for her
  });

  it("one low value among normal ones is not enough", () => {
    const r = computeReadiness(today, [c(0, { energy: 2 }), ...usual]);
    expect(r).toMatchObject({ level: "usual" });
  });

  it("uses only the last 28 days before today and ignores today for the baseline", () => {
    const old = Array.from({ length: 10 }, (_, i) =>
      c(-(40 + i), { energy: 5, motivation: 5, sleep_quality: 5 }),
    );
    const r = computeReadiness(today, [c(0), ...usual, ...old]);
    expect(r).toMatchObject({ level: "usual", delta: 0 });
    const todayOnlyHistory = computeReadiness(today, [
      c(0, { energy: 1 }),
      c(0, { energy: 1 }),
    ]);
    expect(todayOnlyHistory).toMatchObject({ status: "not_enough_data" });
  });

  it("skips metrics without enough history and needs at least two usable metrics", () => {
    const noSleep = usual.map((u) => ({ ...u, sleep_quality: null }));
    const r = computeReadiness(today, [
      c(0, { energy: 2, motivation: 2, sleep_quality: 1 }),
      ...noSleep,
    ]);
    expect(r.status === "ready" && r.parts.map((p) => p.metric)).toEqual([
      "energy",
      "motivation",
    ]);
    const onlyEnergy = usual.map((u) => ({
      ...u,
      motivation: null,
      sleep_quality: null,
    }));
    expect(computeReadiness(today, [c(0), ...onlyEnergy]).status).toBe(
      "not_enough_data",
    );
  });

  it("decides the level on the exact average, so +0.75 and -0.75 are treated the same", () => {
    // energy alternates 2/3 (median 2.5), motivation is always 3: today's distances average exactly ±0.75
    const mk = (offset: number, e: number, m: number) => ({
      day: addDays(today, offset),
      energy: e,
      motivation: m,
      sleep_quality: null,
    });
    const hist = Array.from({ length: 8 }, (_, i) =>
      mk(-(i + 1), i % 2 ? 2 : 3, 3),
    );
    const up = computeReadiness(today, [mk(0, 3, 4), ...hist]); // +0.5 and +1
    const down = computeReadiness(today, [mk(0, 2, 2), ...hist]); // -0.5 and -1
    expect(up.status === "ready" && up.level).toBe("usual");
    expect(down.status === "ready" && down.level).toBe("usual");
  });

  it("needs two metrics pointing the same way, whichever number of metrics was logged", () => {
    const two = usual.map((u) => ({ ...u, sleep_quality: null }));
    // one metric far below, the other normal: only one deviates -> not a lower day
    const r = computeReadiness(today, [
      c(0, { energy: 1, motivation: 3, sleep_quality: null }),
      ...two,
    ]);
    expect(r.status === "ready" && r.level).toBe("usual");
    // both below -> lower
    const both = computeReadiness(today, [
      c(0, { energy: 2, motivation: 2, sleep_quality: null }),
      ...two,
    ]);
    expect(both.status === "ready" && both.level).toBe("lower");
  });

  it("counts history only for metrics that have a value today", () => {
    const hist = usual.map((u) => ({ ...u, sleep_quality: 3 }));
    // today has no energy/motivation, only sleep -> only one usable metric
    const r = computeReadiness(today, [
      { day: today, energy: null, motivation: null, sleep_quality: 2 },
      ...hist,
    ]);
    expect(r).toMatchObject({ status: "not_enough_data" });
    if (r.status === "not_enough_data") expect(r.have).toBe(10);
  });
});
