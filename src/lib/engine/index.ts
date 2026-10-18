import { computeReadiness, type ReadinessCheckin } from "./readiness";
import { detectPlateau, type ExerciseSession } from "./plateau";
import type { Candidate } from "./select";

export interface EngineInput {
  today: string;
  checkins: ReadinessCheckin[];
  /** Sessions per exercise id, each with that session's best estimated 1RM. */
  exerciseSessions: Map<string, ExerciseSession[]>;
  /** A safety notice is active: never suggest doing more. */
  safetyFlag: boolean;
}

const MAX_PLATEAU_CANDIDATES = 2;
const round1 = (n: number) => Math.round(n * 10) / 10;

// Everything the engine could say today, before cooldowns and the daily cap.
export function buildCandidates({
  today,
  checkins,
  exerciseSessions,
  safetyFlag,
}: EngineInput): Candidate[] {
  const out: Candidate[] = [];

  const r = computeReadiness(today, checkins);
  if (r.status === "ready") {
    const params: Candidate["params"] = {
      level: r.level,
      delta: r.delta,
      canPush: r.level === "higher" && !safetyFlag,
    };
    for (const p of r.parts) {
      params[p.metric] = p.value;
      params[`${p.metric}Base`] = p.baseline;
    }
    out.push({ kind: "readiness", subject: "", params });
  }

  const plateaus = [...exerciseSessions.entries()]
    .map(([id, sessions]) => ({
      id,
      sessions,
      plateau: detectPlateau(sessions, today),
    }))
    .filter((x) => x.plateau !== null)
    .sort((a, b) => b.sessions.length - a.sessions.length)
    .slice(0, MAX_PLATEAU_CANDIDATES);
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
  return out;
}
