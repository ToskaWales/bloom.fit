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
});
