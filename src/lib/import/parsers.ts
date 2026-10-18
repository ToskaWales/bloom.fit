import { lbsToKg } from "@/lib/onboarding/schema";
import { parseCsv } from "./csv";

export type ImportFormat = "hevy" | "strong" | "unknown";
export type ImportedSetType = "normal" | "warmup" | "drop" | "failure";

export interface ImportedSet {
  type: ImportedSetType;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
}
export interface ImportedExercise {
  name: string;
  sets: ImportedSet[];
}
export interface ImportedWorkout {
  source: "hevy" | "strong";
  title: string | null;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  exercises: ImportedExercise[];
}
export interface ParseResult {
  format: ImportFormat;
  workouts: ImportedWorkout[];
  skippedRows: number;
  warnings: string[];
}

type Row = Record<string, string>;

export function detectFormat(rows: Row[]): ImportFormat {
  const keys = new Set(Object.keys(rows[0] ?? {}));
  if (keys.has("exercise_title") && keys.has("start_time")) return "hevy";
  if (keys.has("Exercise Name") && keys.has("Set Order")) return "strong";
  return "unknown";
}

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

// Exports carry no timezone; the times are the user's wall-clock times, so they
// are read in the local timezone of the browser doing the import.
export function parseLocalDate(text: string): string | null {
  const t = text.trim();
  let m = t.match(
    /^(\d{1,2}) ([A-Za-z]{3})[a-z]*,? (\d{4}),? (\d{1,2}):(\d{2})$/,
  ); // 21 Oct 2025, 18:30
  let date: Date | null = null;
  if (m) {
    const month = MONTHS.indexOf(m[2].toLowerCase());
    if (month >= 0)
      date = new Date(
        Number(m[3]),
        month,
        Number(m[1]),
        Number(m[4]),
        Number(m[5]),
      );
  } else if (
    (m = t.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/))
  ) {
    date = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6] ?? 0),
    );
  } else if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(t)) {
    date = new Date(t);
  }
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

// "1h 10m", "55m", "1h", "45s" -> milliseconds
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  let ms = 0;
  let matched = false;
  for (const [, n, unit] of t.matchAll(/(\d+)\s*(h|m|s)/g)) {
    matched = true;
    ms += Number(n) * (unit === "h" ? 3_600_000 : unit === "m" ? 60_000 : 1000);
  }
  return matched ? ms : null;
}

const num = (s: string | undefined): number | null => {
  const t = (s ?? "").trim().replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
};

// Normalizes one set row. `null` = unusable (cardio/time rows, impossible numbers).
function normalizeSet(
  weightKg: number | null,
  reps: number | null,
  rpe: number | null,
): Omit<ImportedSet, "type"> | null {
  if (weightKg !== null && (weightKg < 0 || weightKg > 1000)) return null;
  if (reps !== null && (!Number.isInteger(reps) || reps < 0 || reps > 1000))
    return null;
  const weight = weightKg === 0 ? null : weightKg; // 0 with reps = bodyweight
  if (weight === null && (reps === null || reps === 0)) return null;
  return {
    weightKg: weight,
    reps,
    rpe: rpe !== null && rpe >= 1 && rpe <= 10 ? rpe : null,
  };
}

const HEVY_TYPES: Record<string, ImportedSetType> = {
  normal: "normal",
  warmup: "warmup",
  dropset: "drop",
  failure: "failure",
};

function summarizeWarnings(skipped: number): string[] {
  return skipped
    ? [
        `${skipped} Zeile${skipped === 1 ? "" : "n"} ohne Gewicht/Wiederholungen oder mit ungültigen Werten wurde${skipped === 1 ? "" : "n"} übersprungen (z. B. Cardio).`,
      ]
    : [];
}

// Groups consecutive rows into workouts (by `key`) and consecutive same-name rows into exercises.
class WorkoutBuilder {
  private byKey = new Map<string, ImportedWorkout>();
  private lastExercise = new Map<string, ImportedExercise>();

  workout(key: string, make: () => ImportedWorkout): ImportedWorkout {
    let w = this.byKey.get(key);
    if (!w) {
      w = make();
      this.byKey.set(key, w);
    }
    return w;
  }

  addSet(
    key: string,
    w: ImportedWorkout,
    exerciseName: string,
    set: ImportedSet,
  ) {
    let ex = this.lastExercise.get(key);
    if (!ex || ex.name !== exerciseName) {
      ex = { name: exerciseName, sets: [] };
      w.exercises.push(ex);
      this.lastExercise.set(key, ex);
    }
    ex.sets.push(set);
  }

  result(): ImportedWorkout[] {
    return [...this.byKey.values()]
      .filter((w) => w.exercises.length > 0)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }
}

export function parseHevy(rows: Row[]): ParseResult {
  const builder = new WorkoutBuilder();
  let skipped = 0;
  for (const row of rows) {
    const startedAt = parseLocalDate(row.start_time ?? "");
    const name = (row.exercise_title ?? "").trim();
    const set = normalizeSet(num(row.weight_kg), num(row.reps), num(row.rpe));
    if (!startedAt || !name || !set) {
      skipped++;
      continue;
    }
    const key = `${row.title}|${row.start_time}`;
    const w = builder.workout(key, () => {
      const end = parseLocalDate(row.end_time ?? "");
      return {
        source: "hevy",
        title: row.title?.trim() || null,
        startedAt,
        endedAt: end && end >= startedAt ? end : null,
        notes: row.description?.trim() || null,
        exercises: [],
      };
    });
    builder.addSet(key, w, name, {
      type: HEVY_TYPES[(row.set_type ?? "").toLowerCase()] ?? "normal",
      ...set,
    });
  }
  return {
    format: "hevy",
    workouts: builder.result(),
    skippedRows: skipped,
    warnings: summarizeWarnings(skipped),
  };
}

export function parseStrong(rows: Row[], units: "kg" | "lbs"): ParseResult {
  const builder = new WorkoutBuilder();
  let skipped = 0;
  for (const row of rows) {
    const order = (row["Set Order"] ?? "").trim().toUpperCase();
    // "Rest Timer" and similar helper rows are not sets: ignore them silently.
    const type: ImportedSetType | null = /^\d+$/.test(order)
      ? "normal"
      : order === "W"
        ? "warmup"
        : order === "F"
          ? "failure"
          : order === "D"
            ? "drop"
            : null;
    if (!type) continue;

    const startedAt = parseLocalDate(row.Date ?? "");
    const name = (row["Exercise Name"] ?? "").trim();
    const rawWeight = num(row.Weight);
    const weightKg =
      rawWeight === null
        ? null
        : units === "lbs"
          ? lbsToKg(rawWeight)
          : rawWeight;
    const set = normalizeSet(weightKg, num(row.Reps), num(row.RPE));
    if (!startedAt || !name || !set) {
      skipped++;
      continue;
    }
    const key = `${row["Workout Name"]}|${row.Date}`;
    const w = builder.workout(key, () => {
      const duration = parseDuration(row.Duration ?? "");
      return {
        source: "strong",
        title: row["Workout Name"]?.trim() || null,
        startedAt,
        endedAt: duration
          ? new Date(Date.parse(startedAt) + duration).toISOString()
          : null,
        notes: null,
        exercises: [],
      };
    });
    if (!w.notes && row["Workout Notes"]?.trim())
      w.notes = row["Workout Notes"].trim();
    builder.addSet(key, w, name, { type, ...set });
  }
  return {
    format: "strong",
    workouts: builder.result(),
    skippedRows: skipped,
    warnings: summarizeWarnings(skipped),
  };
}

export function parseWorkoutFile(
  text: string,
  strongUnits: "kg" | "lbs",
): ParseResult {
  const rows = parseCsv(text);
  const format = detectFormat(rows);
  if (format === "hevy") return parseHevy(rows);
  if (format === "strong") return parseStrong(rows, strongUnits);
  return { format: "unknown", workouts: [], skippedRows: 0, warnings: [] };
}
