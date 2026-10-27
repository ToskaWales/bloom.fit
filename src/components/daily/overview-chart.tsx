"use client";

// Hand-drawn SVG behind the Verlauf screen: mood lines, optional weight trend, training volume and period shading.
// Pure presentation of the rows it is given (props only, no database); the table in overview-view.tsx is the text alternative.
// Neighbours: overview-view.tsx, lib/daily/overview (OverviewRow), CSS variables --series-* and --viz-*.

import { useId, useState } from "react";
import { SYMPTOM_LABELS, type Symptom } from "@/lib/daily/symptoms";
import type { OverviewRow } from "@/lib/daily/overview";
import { formatWeight, weightLabel, type Units } from "@/lib/workout/units";

// Drawn at phone width so text keeps its size (the SVG scales to its container).
const W = 360;
const PAD = { left: 30, right: 66, top: 8 };
const PLOT_W = W - PAD.left - PAD.right;
const GAP = 22; // space between panels (holds the panel title)
const PANELS = { mood: 120, weight: 72, volume: 56 } as const;
const AXIS_H = 22;

interface Props {
  rows: OverviewRow[];
  showWeight: boolean;
  units: Units;
}

type MoodKey = "energy" | "motivation" | "sleepQuality";
const MOOD: { key: MoodKey; label: string; color: string }[] = [
  { key: "energy", label: "Energie", color: "var(--series-1)" },
  { key: "motivation", label: "Motivation", color: "var(--series-2)" },
  { key: "sleepQuality", label: "Schlaf", color: "var(--series-3)" },
];

// Line segments that break at missing days (a gap is shown as a gap, never interpolated).
function segments(
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
const path = (seg: { x: number; y: number }[]) =>
  seg
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

// Open the tooltip on the side with more room, so it never covers the crosshair.
function tooltipStyle(fraction: number) {
  return fraction < 0.55
    ? { left: `${fraction * 100 + 2}%` }
    : { right: `${(1 - fraction) * 100 + 2}%` };
}

// Push direct labels apart so they never overlap.
function spread(
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

// Panels are stacked vertically with a shared x axis (one column per day); each panel has its own scale on purpose.
export function OverviewChart({ rows, showWeight, units }: Props) {
  const uid = useId();
  const [active, setActive] = useState<number | null>(null);
  const n = rows.length;
  const x = (i: number) =>
    PAD.left + (n <= 1 ? PLOT_W / 2 : (i / (n - 1)) * PLOT_W);
  const step = n <= 1 ? PLOT_W : PLOT_W / (n - 1);

  const moodTop = PAD.top + GAP;
  const weightTop = moodTop + PANELS.mood + GAP;
  const volumeTop =
    (showWeight ? weightTop + PANELS.weight : moodTop + PANELS.mood) + GAP;
  const height = volumeTop + PANELS.volume + AXIS_H;

  const moodY = (v: number) =>
    moodTop + PANELS.mood - ((v - 1) / 4) * PANELS.mood;

  // Weight scale is padded by 0.5 kg and only used when at least one weight exists (min/max of nothing would be infinite).
  const weights = rows
    .map((r) => r.weightTrend)
    .filter((v): v is number => v !== null);
  const raw = rows
    .map((r) => r.weightKg)
    .filter((v): v is number => v !== null);
  const wMin = Math.min(...weights, ...raw) - 0.5;
  const wMax = Math.max(...weights, ...raw) + 0.5;
  const weightY = (v: number) =>
    weightTop +
    PANELS.weight -
    ((v - wMin) / (wMax - wMin || 1)) * PANELS.weight;

  const maxVol = Math.max(1, ...rows.map((r) => r.volumeKg));
  const volY = (v: number) =>
    volumeTop + PANELS.volume - (v / maxVol) * PANELS.volume;

  const lastIdx = n - 1;
  const labels = spread(
    MOOD.flatMap((m) => {
      // label at the last day that has a value, so it sits next to the line's end
      for (let i = lastIdx; i >= 0; i--)
        if (rows[i][m.key] !== null)
          return [{ y: moodY(rows[i][m.key]!), text: m.label, color: m.color }];
      return [];
    }),
    moodTop + 4,
    moodTop + PANELS.mood,
  );

  // Maps the pointer to the nearest day column; pointer events cover both mouse and touch.
  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * PLOT_W;
    setActive(Math.max(0, Math.min(n - 1, Math.round(px / (step || 1)))));
  }

  // weekly ticks, but not right next to the last day's label
  const tick = (i: number) =>
    i === lastIdx || (i % 7 === 0 && lastIdx - i >= 4);
  const a = active !== null ? rows[active] : null;

  return (
    <div className="viz-root relative">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        role="img"
        aria-label={`Verlauf von Energie, Motivation, Schlaf${showWeight ? ", Gewichtstrend" : ""} und Trainingsvolumen. Eine Tabelle mit allen Werten steht darunter zur Verfügung.`}
        className="w-full"
      >
        <defs>
          <pattern
            id={`${uid}-hatch`}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect
              width="6"
              height="6"
              fill="var(--viz-period)"
              fillOpacity="0.1"
            />
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="6"
              stroke="var(--viz-period)"
              strokeWidth="2"
              strokeOpacity="0.35"
            />
          </pattern>
        </defs>

        {/* period days, shaded behind every panel (texture + tint, not colour alone) */}
        {rows.map((r, i) =>
          r.period ? (
            <rect
              key={r.day}
              x={Math.max(PAD.left, x(i) - step / 2)}
              y={moodTop}
              width={
                Math.min(W - PAD.right, x(i) + step / 2) -
                Math.max(PAD.left, x(i) - step / 2)
              }
              height={height - moodTop - AXIS_H}
              fill={`url(#${uid}-hatch)`}
            />
          ) : null,
        )}

        {/* Befinden */}
        <text
          x={PAD.left}
          y={moodTop - 8}
          fontSize="11"
          fontWeight="600"
          fill="var(--viz-text)"
        >
          Befinden (1 niedrig – 5 hoch)
        </text>
        {[1, 3, 5].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={moodY(v)}
              y2={moodY(v)}
              stroke="var(--viz-grid)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 6}
              y={moodY(v) + 4}
              fontSize="10"
              textAnchor="end"
              fill="var(--viz-muted)"
            >
              {v}
            </text>
          </g>
        ))}
        {MOOD.map((m) => {
          const pts = rows.map((r, i) => ({
            x: x(i),
            y: r[m.key] === null ? null : moodY(r[m.key]!),
          }));
          return (
            <g key={m.key}>
              {segments(pts).map((seg, i) => (
                <path
                  key={i}
                  d={path(seg)}
                  fill="none"
                  stroke={m.color}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {pts.map((p, i) =>
                p.y === null ? null : (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r="3"
                    fill={m.color}
                    stroke="var(--viz-surface)"
                    strokeWidth="2"
                  />
                ),
              )}
            </g>
          );
        })}
        {labels.map((l) => (
          <text
            key={l.text}
            x={W - PAD.right + 8}
            y={l.y + 4}
            fontSize="11"
            fill="var(--viz-text)"
          >
            <tspan fill={l.color}>●</tspan> {l.text}
          </text>
        ))}

        {/* Gewichtstrend: its own panel and scale, never a second axis on another chart */}
        {showWeight && (
          <g>
            <text
              x={PAD.left}
              y={weightTop - 8}
              fontSize="11"
              fontWeight="600"
              fill="var(--viz-text)"
            >
              Gewichtstrend ({weightLabel(units)})
            </text>
            {weights.length === 0 ? (
              <text
                x={PAD.left}
                y={weightTop + 30}
                fontSize="11"
                fill="var(--viz-muted)"
              >
                Noch kein Gewicht eingetragen.
              </text>
            ) : (
              <>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={weightTop + PANELS.weight}
                  y2={weightTop + PANELS.weight}
                  stroke="var(--viz-grid)"
                />
                <text
                  x={PAD.left - 6}
                  y={weightTop + 8}
                  fontSize="10"
                  textAnchor="end"
                  fill="var(--viz-muted)"
                >
                  {formatWeight(wMax, units)}
                </text>
                <text
                  x={PAD.left - 6}
                  y={weightTop + PANELS.weight}
                  fontSize="10"
                  textAnchor="end"
                  fill="var(--viz-muted)"
                >
                  {formatWeight(wMin, units)}
                </text>
                {rows.map((r, i) =>
                  r.weightKg === null ? null : (
                    <circle
                      key={r.day}
                      cx={x(i)}
                      cy={weightY(r.weightKg)}
                      r="2.5"
                      fill="var(--viz-axis)"
                    />
                  ),
                )}
                {segments(
                  rows.map((r, i) => ({
                    x: x(i),
                    y: r.weightTrend === null ? null : weightY(r.weightTrend),
                  })),
                ).map((seg, i) => (
                  <path
                    key={i}
                    d={path(seg)}
                    fill="none"
                    stroke="var(--viz-text)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                ))}
              </>
            )}
          </g>
        )}

        {/* Trainingsvolumen */}
        <text
          x={PAD.left}
          y={volumeTop - 8}
          fontSize="11"
          fontWeight="600"
          fill="var(--viz-text)"
        >
          Trainingsvolumen
        </text>
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={volumeTop + PANELS.volume}
          y2={volumeTop + PANELS.volume}
          stroke="var(--viz-grid)"
        />
        {rows.map((r, i) =>
          r.volumeKg > 0 ? (
            <rect
              key={r.day}
              x={x(i) - Math.min(step * 0.35, 5)}
              y={volY(r.volumeKg)}
              width={Math.min(step * 0.7, 10)}
              height={volumeTop + PANELS.volume - volY(r.volumeKg)}
              rx="3"
              fill="var(--viz-bar)"
            />
          ) : null,
        )}

        {/* x axis */}
        {rows.map((r, i) =>
          tick(i) ? (
            <text
              key={r.day}
              x={x(i)}
              y={height - 6}
              fontSize="10"
              textAnchor="middle"
              fill="var(--viz-muted)"
            >
              {new Date(`${r.day}T12:00:00`).toLocaleDateString("de-DE", {
                day: "numeric",
                month: "numeric",
              })}
            </text>
          ) : null,
        )}

        {/* crosshair + hit area (much wider than any mark) */}
        {active !== null && (
          <line
            x1={x(active)}
            x2={x(active)}
            y1={moodTop}
            y2={height - AXIS_H}
            stroke="var(--viz-axis)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}
        <rect
          x={PAD.left}
          y={moodTop}
          width={PLOT_W}
          height={height - moodTop - AXIS_H}
          fill="transparent"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
          style={{ touchAction: "pan-y" }}
        />
      </svg>

      {a && (
        <div
          className="pointer-events-none absolute top-2 whitespace-nowrap rounded-xl border border-neutral-200 bg-white p-2 text-xs shadow"
          style={tooltipStyle(x(active!) / W)}
        >
          <p className="font-semibold">
            {new Date(`${a.day}T12:00:00`).toLocaleDateString("de-DE", {
              weekday: "short",
              day: "numeric",
              month: "numeric",
            })}
          </p>
          {MOOD.map((m) => (
            <p key={m.key}>
              <span style={{ color: m.color }}>●</span> {m.label}:{" "}
              {a[m.key] ?? "–"}
            </p>
          ))}
          {showWeight && (
            <p>
              Gewicht:{" "}
              {a.weightKg !== null
                ? `${formatWeight(a.weightKg, units)} ${weightLabel(units)}`
                : "–"}
            </p>
          )}
          <p>
            Volumen:{" "}
            {a.volumeKg
              ? `${formatWeight(a.volumeKg, units)} ${weightLabel(units)}`
              : "–"}
          </p>
          {a.period && <p>Periode</p>}
          {a.symptoms.length > 0 && (
            <p>
              {a.symptoms
                .map((s) => SYMPTOM_LABELS[s as Symptom] ?? s)
                .join(", ")}
            </p>
          )}
        </div>
      )}

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-700">
        {MOOD.map((m) => (
          <li key={m.key}>
            <span style={{ color: m.color }}>●</span> {m.label}
          </li>
        ))}
        {showWeight && <li>━ Gewichtstrend (Punkte: einzelne Tage)</li>}
        <li>▒ Volumen</li>
        <li>
          <span style={{ color: "var(--viz-period)" }}>▨</span> Periode
        </li>
      </ul>
    </div>
  );
}
