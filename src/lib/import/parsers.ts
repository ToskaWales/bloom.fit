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
  /** Raw title + start text from the file: identifies the workout independent of timezone. */
  sourceKey: string;
  title: string | null;
  startedAt: string;
  endedAt: string;
  notes: string | null;
  exercises: ImportedExercise[];
}
export interface ParseResult {
  format: ImportFormat;
  workouts: ImportedWorkout[];
  skippedRows: number;
  warnings: string[];
  /** Strong exports without a unit column: the user has to say kg or lbs. */
  needsUnit?: boolean;
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
// are read in the local timezone of the browser doing the import. Impossible
// dates (31 Feb, hour 25) are rejected instead of rolling over to another day.
export function parseLocalDate(text: string): string | null {
  const t = text.trim();
  let parts: [number, number, number, number, number, number] | null = null;
  let m = t.match(
    /^(\d{1,2}) ([A-Za-z]{3})[a-z]*,? (\d{4}),? (\d{1,2}):(\d{2})$/,
  ); // 21 Oct 2025, 18:30
  if (m) {
    const month = MONTHS.indexOf(m[2].toLowerCase());
    if (month >= 0)
      parts = [
        Number(m[3]),
        month,
        Number(m[1]),
        Number(m[4]),
        Number(m[5]),
        0,
      ];
  } else if (
    (m = t.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/))
  ) {
    parts = [
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6] ?? 0),
    ];
  } else if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(t)) {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (!parts) return null;
  const [y, mo, d, h, mi, s] = parts;
  const date = new Date(y, mo, d, h, mi, s);
  const same =
    date.getFullYear() === y &&
    date.getMonth() === mo &&
    date.getDate() === d &&
    date.getHours() === h &&
    date.getMinutes() === mi;
  return same ? date.toISOString() : null;
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

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function buildWarnings(skippedSets: number, badDates: number): string[] {
  const out: string[] = [];
  if (skippedSets)
    out.push(
      `${skippedSets} ${plural(skippedSets, "Zeile", "Zeilen")} ohne Gewicht/Wiederholungen oder mit ungültigen Werten ${plural(skippedSets, "wurde", "wurden")} übersprungen (z. B. Cardio).`,
    );
  if (badDates)
    out.push(
      `${badDates} ${plural(badDates, "Zeile", "Zeilen")} mit unbekanntem oder ungültigem Datum ${plural(badDates, "wurde", "wurden")} übersprungen. Unterstützt sind Formate wie „21 Oct 2025, 18:30“ und „2025-10-21 18:30:00“.`,
    );
  return out;
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
  let skippedSets = 0;
  let badDates = 0;
  for (const row of rows) {
    const startedAt = parseLocalDate(row.start_time ?? "");
    if (!startedAt) {
      badDates++;
      continue;
    }
    const name = (row.exercise_title ?? "").trim();
    // Imperial accounts export weight_lbs instead of weight_kg.
    const kg = num(row.weight_kg);
    const lbs = num(row.weight_lbs);
    const weight = kg !== null ? kg : lbs !== null ? lbsToKg(lbs) : null;
    const set = normalizeSet(weight, num(row.reps), num(row.rpe));
    if (!name || !set) {
      skippedSets++;
      continue;
    }
    const sourceKey = `${row.title}|${row.start_time}`.trim();
    const w = builder.workout(sourceKey, () => {
      const end = parseLocalDate(row.end_time ?? "");
      return {
        source: "hevy",
        sourceKey,
        title: row.title?.trim() || null,
        startedAt,
        // Without a usable end the workout would look like one still in progress.
        endedAt: end && end >= startedAt ? end : startedAt,
        notes: row.description?.trim() || null,
        exercises: [],
      };
    });
    builder.addSet(sourceKey, w, name, {
      type: HEVY_TYPES[(row.set_type ?? "").toLowerCase()] ?? "normal",
      ...set,
    });
  }
  return {
    format: "hevy",
    workouts: builder.result(),
    skippedRows: skippedSets + badDates,
    warnings: buildWarnings(skippedSets, badDates),
  };
}

const unitOf = (text: string | undefined): "kg" | "lbs" | null => {
  const t = (text ?? "").trim().toLowerCase();
  return t === "kg" ? "kg" : t === "lbs" || t === "lb" ? "lbs" : null;
};

export function parseStrong(
  rows: Row[],
  units: "kg" | "lbs" | null,
): ParseResult {
  const hasUnitColumn = rows.some((r) => "Weight Unit" in r);
  if (!hasUnitColumn && units === null) {
    return {
      format: "strong",
      workouts: [],
      skippedRows: 0,
      warnings: [],
      needsUnit: true,
    };
  }

  const builder = new WorkoutBuilder();
  let skippedSets = 0;
  let badDates = 0;
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
    if (!startedAt) {
      badDates++;
      continue;
    }
    const name = (row["Exercise Name"] ?? "").trim();
    const rawWeight = num(row.Weight);
    const unit = unitOf(row["Weight Unit"]) ?? units ?? "kg";
    const weightKg =
      rawWeight === null
        ? null
        : unit === "lbs"
          ? lbsToKg(rawWeight)
          : rawWeight;
    const set = normalizeSet(weightKg, num(row.Reps), num(row.RPE));
    if (!name || !set) {
      skippedSets++;
      continue;
    }
    const sourceKey = `${row["Workout Name"]}|${row.Date}`.trim();
    const w = builder.workout(sourceKey, () => {
      const duration = parseDuration(row.Duration ?? "");
      return {
        source: "strong",
        sourceKey,
        title: row["Workout Name"]?.trim() || null,
        startedAt,
        endedAt: duration
          ? new Date(Date.parse(startedAt) + duration).toISOString()
          : startedAt,
        notes: null,
        exercises: [],
      };
    });
    if (!w.notes && row["Workout Notes"]?.trim())
      w.notes = row["Workout Notes"].trim();
    builder.addSet(sourceKey, w, name, { type, ...set });
  }
  return {
    format: "strong",
    workouts: builder.result(),
    skippedRows: skippedSets + badDates,
    warnings: buildWarnings(skippedSets, badDates),
  };
}

export function parseWorkoutFile(
  text: string,
  strongUnits: "kg" | "lbs" | null,
): ParseResult {
  const rows = parseCsv(text);
  const format = detectFormat(rows);
  if (format === "hevy") return parseHevy(rows);
  if (format === "strong") return parseStrong(rows, strongUnits);
  return { format: "unknown", workouts: [], skippedRows: 0, warnings: [] };
}
