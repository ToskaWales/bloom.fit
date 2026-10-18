import { computeReadiness, type ReadinessCheckin } from "./readiness";
import { detectPlateau, type ExerciseSession } from "./plateau";
import type { PatternAnalysis } from "./patterns";
import type { SafetyResult } from "./safety";
import type { Candidate } from "./select";

export interface EngineInput {
  today: string;
  checkins: ReadinessCheckin[];
  /** Sessions per exercise id, each with that session's best estimated 1RM. */
  exerciseSessions: Map<string, ExerciseSession[]>;
  patterns: PatternAnalysis | null;
  /** null when cycle tracking is off. */
  safety: SafetyResult | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

// Everything the engine could say today, before cooldowns and the daily cap.
// While a safety notice is active it never suggests doing more: no extra rep,
// no plateau advice, no pattern card.
export function buildCandidates({
  today,
  checkins,
  exerciseSessions,
  patterns,
  safety,
}: EngineInput): Candidate[] {
  const out: Candidate[] = [];
  const safetyActive = safety?.active === true;

  if (safety && safetyActive) {
    out.push({
      kind: "safety",
      subject: "",
      params: {
        overdueDays: safety.overdueDays,
        lowEnergy: safety.lowEnergy,
        weightFall: safety.weightFall,
      },
    });
  }

  const r = computeReadiness(today, checkins);
  if (r.status === "ready" && r.level !== "usual") {
    const sleep = r.parts.find((p) => p.metric === "sleep");
    out.push({
      kind: "readiness",
      subject: r.level,
      params: {
        level: r.level,
        delta: r.delta,
        canPush:
          r.level === "higher" &&
          !safetyActive &&
          sleep !== undefined &&
          sleep.value >= sleep.baseline,
      },
    });
  }

  if (safetyActive) return out;

  const plateaus = [...exerciseSessions.entries()]
    .map(([id, sessions]) => ({
      id,
      sessions,
      plateau: detectPlateau(sessions, today),
    }))
    .filter((x) => x.plateau !== null)
    .sort((a, b) => b.sessions.length - a.sessions.length);
  for (const { id, plateau } of plateaus) {
    out.push({
      kind: "plateau",
      subject: id,
      params: {
        ...plateau!,
        recentBest: round1(plateau!.recentBest),
        earlierBest: round1(plateau!.earlierBest),
      },
    });
  }

  if (patterns?.status === "found" && patterns.findings.length > 0) {
    const f = patterns.findings[0];
    out.push({
      kind: "pattern",
      subject: `${f.metric}:${f.window}`,
      params: {
        metric: f.metric,
        window: f.window,
        effect: round2(f.effect),
        cycles: f.cycles,
        windowAvg: round2(f.windowAvg),
        restAvg: round2(f.restAvg),
      },
    });
  }
  return out;
}
