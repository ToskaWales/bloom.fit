// Pins down the chart helpers: a missing day is a gap (never interpolated), labels never overlap or leave their panel.
import { describe, expect, it } from "vitest";
import { path, segments, spread, tooltipStyle } from "./chart-geometry";

describe("segments", () => {
  it("breaks the line at missing days instead of connecting across them", () => {
    const out = segments([
      { x: 0, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: null },
      { x: 3, y: 4 },
    ]);
    expect(out).toEqual([
      [
        { x: 0, y: 1 },
        { x: 1, y: 2 },
      ],
      [{ x: 3, y: 4 }],
    ]);
  });
  it("returns nothing when there is no data", () => {
    expect(segments([{ x: 0, y: null }])).toEqual([]);
  });
});

describe("path", () => {
  it("writes an SVG path with one decimal", () => {
    expect(
      path([
        { x: 0, y: 1.234 },
        { x: 10, y: 2 },
      ]),
    ).toBe("M0.0,1.2 L10.0,2.0");
  });
});

describe("tooltipStyle", () => {
  it("opens on the side with more room", () => {
    expect(tooltipStyle(0.2)).toEqual({ left: "22%" });
    const right = tooltipStyle(0.8) as { right: string };
    expect(parseFloat(right.right)).toBeCloseTo(22, 6);
  });
});

describe("spread", () => {
  const label = (y: number) => ({ y, text: "t", color: "c" });
  it("pushes labels at least 13 apart and keeps their order", () => {
    const out = spread([label(50), label(52), label(53)], 0, 200);
    expect(out.map((l) => l.y)).toEqual([50, 63, 76]);
  });
  it("keeps the stack inside the panel, moving it back up when it overflows", () => {
    const out = spread([label(95), label(96), label(97)], 0, 100);
    expect(out.at(-1)!.y).toBeLessThanOrEqual(100);
    expect(out[1].y - out[0].y).toBeGreaterThanOrEqual(13);
  });
  it("does not change its input", () => {
    const input = [label(50), label(51)];
    spread(input, 0, 100);
    expect(input.map((l) => l.y)).toEqual([50, 51]);
  });
});
