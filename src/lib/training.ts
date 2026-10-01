// Reine Helfer und Typen für das Training-Log (keine UI, kein I/O).

export type Exercise = { id: string; userId: string | null; name: string; aliases: string[] };

export type SetEntry = {
  id: string;
  workoutExerciseId: string;
  setIndex: number;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  isWarmup: boolean;
};

export type WorkoutExerciseEntry = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  position: number;
  sets: SetEntry[];
};

export type WorkoutEntry = {
  id: string;
  performedOn: string;
  startedAt: string | null;
  endedAt: string | null;
  exercises: WorkoutExerciseEntry[];
};

export type WorkoutSummary = {
  id: string;
  performedOn: string;
  exerciseCount: number;
  setCount: number;
};

export function isCompleteSet(set: Pick<SetEntry, 'weightKg' | 'reps'>): boolean {
  return set.weightKg !== null && set.weightKg >= 0 && set.reps !== null && set.reps >= 1;
}

/** '82,5' → 82.5; leer oder ungültig → null. Akzeptiert Komma und Punkt. */
export function parseDecimal(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (normalized === '' || !/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

export function parseReps(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n >= 1 && n <= 100 ? n : null;
}

/** RPE 1–10 in 0,5-Schritten; leer = keine Angabe (null). `undefined` = ungültig. */
export function parseRpe(input: string): number | null | undefined {
  if (input.trim() === '') return null;
  const n = parseDecimal(input);
  if (n === null || n < 1 || n > 10 || n * 2 !== Math.trunc(n * 2)) return undefined;
  return n;
}

export function formatNumber(value: number | null): string {
  return value === null ? '' : String(value).replace('.', ',');
}

/** Kleinbuchstaben ohne Akzente, ß → ss: für die Übungssuche. */
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/** Suche über Name und Aliase; Treffer am Wortanfang vor Treffern mittendrin, danach alphabetisch. */
export function searchExercises(exercises: Exercise[], query: string, limit = 30): Exercise[] {
  const q = normalizeText(query);
  if (q === '') return [...exercises].sort(byName).slice(0, limit);

  const scored: { exercise: Exercise; score: number }[] = [];
  for (const exercise of exercises) {
    const name = normalizeText(exercise.name);
    const aliases = exercise.aliases.map(normalizeText);
    let score = 0;
    if (name === q) score = 5;
    else if (name.startsWith(q)) score = 4;
    else if (name.split(/\s+/).some((word) => word.startsWith(q))) score = 3;
    else if (name.includes(q)) score = 2;
    else if (aliases.some((a) => a.startsWith(q) || a.includes(q))) score = 1;
    if (score > 0) scored.push({ exercise, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || byName(a.exercise, b.exercise))
    .slice(0, limit)
    .map((s) => s.exercise);
}

const byName = (a: Exercise, b: Exercise) => a.name.localeCompare(b.name, 'de');

export function hasExactMatch(exercises: Exercise[], query: string): boolean {
  const q = normalizeText(query);
  return exercises.some((e) => normalizeText(e.name) === q);
}

/**
 * Vorschlag für einen neuen Satz als reiner Hinweis (wird nicht automatisch geloggt):
 * der vorherige Satz derselben Übung im aktuellen Training, sonst der gleiche Satz des letzten Trainings.
 */
export function suggestSet(
  currentSets: SetEntry[],
  lastSessionSets: SetEntry[],
): { weightKg: number; reps: number } | null {
  const pick = (sets: SetEntry[]) =>
    [...sets].reverse().find((s) => !s.isWarmup && isCompleteSet(s));
  const previous = pick(currentSets);
  if (previous) return { weightKg: previous.weightKg as number, reps: previous.reps as number };
  const workingLast = lastSessionSets.filter((s) => !s.isWarmup && isCompleteSet(s));
  const sameIndex =
    workingLast[currentSets.filter((s) => !s.isWarmup).length] ?? workingLast.at(-1);
  return sameIndex
    ? { weightKg: sameIndex.weightKg as number, reps: sameIndex.reps as number }
    : null;
}

/** 90 → '1:30' */
export function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
