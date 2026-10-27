import { computeReadiness, type ReadinessCheckin } from "./readiness";
import { detectPlateau, type ExerciseSession } from "./plateau";
import type { HungerRise } from "./hunger";
import type { PatternAnalysis } from "./patterns";
import type { SafetyResult } from "./safety";
import type { Candidate } from "./select";
import { round1, round2 } from "@/lib/math";

export interface EngineInput {
  today: string;
  checkins: ReadinessCheckin[];
  /** Sessions per exercise id, each with that session's best estimated 1RM. */
  exerciseSessions: Map<string, ExerciseSession[]>;
  patterns: PatternAnalysis | null;
  /** null when cycle tracking is off. */
  safety: SafetyResult | null;
  /** A rise in her hunger ratings (hunger.ts). */
  hunger?: HungerRise | null;
  /** Safety notice for people without a period signal (nutrition logging on). */
  energyNote?: {
    active: boolean;
    lowIntake: boolean;
    lowEnergy: boolean;
  } | null;
}

// Everything the engine could say today, before cooldowns and the daily cap.
// While a safety notice is active it never suggests doing more: no extra rep,
// no plateau advice, no pattern card.
export function buildCandidates({
  today,
  checkins,
  exerciseSessions,
  patterns,
  safety,
  energyNote,
  hunger,
}: EngineInput): Candidate[] {
  const out: Candidate[] = [];
  const safetyActive = safety?.active === true || energyNote?.active === true;

  if (safety?.active) {
    out.push({
      kind: "safety",
      subject: "",
      params: {
        overdueDays: safety.overdueDays,
        lowEnergy: safety.lowEnergy,
        weightFall: safety.weightFall,
        lowIntake: safety.lowIntake,
      },
    });
  } else if (energyNote?.active) {
    out.push({
      kind: "safety",
      subject: "energy",
      params: {
        lowIntake: energyNote.lowIntake,
        lowEnergy: energyNote.lowEnergy,
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
  // A hunger pattern around the period already says it; no second card for the same thing.
  // The pattern card shows the strongest finding only; it carries the hunger
  // sentence when that finding is a rise in hunger.
  const top = patterns?.status === "found" ? patterns.findings[0] : undefined;
  const hungerPattern = top?.metric === "hunger" && top.effect > 0;
  if (hunger && !hungerPattern) {
    out.push({
      kind: "hunger_note",
      subject: "",
      params: {
        recent: hunger.recent,
        before: hunger.before,
        trainingDays: hunger.trainingDays,
        ...(hunger.perfDrop !== null ? { perfDrop: hunger.perfDrop } : {}),
      },
    });
  }
  return out;
}
