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

export interface CheckinRow extends WireRow {
  day: string;
  sleep_quality: number | null;
  sleep_hours: number | null;
  energy: number | null;
  motivation: number | null;
  hunger: number | null;
  symptoms: string[];
  note: string | null;
}

export interface WeightRow extends WireRow {
  day: string;
  weight_kg: number;
}

export interface CycleEventRow extends WireRow {
  kind: "period_start" | "period_end" | "ovulation_test_positive";
  day: string;
}

export type SuggestionKind =
  "readiness" | "plateau" | "pattern" | "safety" | "hunger_note";
export type SuggestionStatus = "shown" | "accepted" | "dismissed";
export type SuggestionParams = Record<
  string,
  number | string | boolean | string[]
>;

export interface SuggestionRow extends WireRow {
  kind: SuggestionKind;
  day: string;
  subject: string;
  params: SuggestionParams;
  status: SuggestionStatus;
  reacted_at: string | null;
}
