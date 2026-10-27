// Pure drawing helpers for the Verlauf chart (components/daily/overview-chart.tsx):
// line segments that break at missing days, SVG path text, tooltip placement and
// non-overlapping direct labels. No React and no data access, so they are unit-tested.

// Line segments that break at missing days (a gap is shown as a gap, never interpolated).
export function segments(
  points: { x: number; y: number | null }[],
): { x: number; y: number }[][] {
  const out: { x: number; y: number }[][] = [];
  let cur: { x: number; y: number }[] = [];
  for (const p of points) {
    if (p.y === null) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push({ x: p.x, y: p.y });
  }
  if (cur.length) out.push(cur);
  return out;
}
export const path = (seg: { x: number; y: number }[]) =>
  seg
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

// Open the tooltip on the side with more room, so it never covers the crosshair.
export function tooltipStyle(fraction: number) {
  return fraction < 0.55
    ? { left: `${fraction * 100 + 2}%` }
    : { right: `${(1 - fraction) * 100 + 2}%` };
}

// Push direct labels apart so they never overlap.
export function spread(
  labels: { y: number; text: string; color: string }[],
  top: number,
  bottom: number,
  min = 13,
) {
  const sorted = labels.map((l) => ({ ...l })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++)
    if (sorted[i].y - sorted[i - 1].y < min)
      sorted[i].y = sorted[i - 1].y + min;
  // never leave the panel: if the stack was pushed past the bottom, move it back up
  const overflow = (sorted.at(-1)?.y ?? 0) - bottom;
  if (overflow > 0) for (const l of sorted) l.y -= overflow;
  for (const l of sorted) l.y = Math.max(top, l.y);
  return sorted;
}
