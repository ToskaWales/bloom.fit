import type { WireRow } from "@/lib/sync/tables";

export interface WorkoutRow extends WireRow {
  title: string | null;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  source: "app" | "hevy" | "strong";
}

export interface WorkoutExerciseRow extends WireRow {
  workout_id: string;
  exercise_id: string;
  position: number;
  notes: string | null;
}

export interface SetRow extends WireRow {
  workout_exercise_id: string;
  position: number;
  set_type: "normal" | "warmup" | "drop" | "failure";
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  completed: boolean;
}

export interface CustomExerciseRow extends WireRow {
  name: string;
  muscle_group: string | null;
  equipment: string | null;
}

export interface TemplateRow extends WireRow {
  name: string;
}

export interface TemplateExerciseRow extends WireRow {
  template_id: string;
  exercise_id: string;
  position: number;
  set_count: number;
}
