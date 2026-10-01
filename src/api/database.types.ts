// Von Hand gepflegt, spiegelt supabase/migrations. Kann später durch `supabase gen types typescript` ersetzt werden.
// Datumsfelder (`date`) sind ISO-Strings 'YYYY-MM-DD', Zeitstempel ISO-8601.

export type TrainingGoal = 'muscle_gain' | 'recomposition' | 'other';
export type TrainingExperience = 'intermediate' | 'advanced' | 'other';
export type CycleContext =
  | 'regular'
  | 'irregular'
  | 'hormonal_contraception'
  | 'pregnant_or_postpartum'
  | 'perimenopause_menopause';
export type EngineMode = 'adaptive' | 'descriptive_only' | 'paused';
export type ConsentType = 'health_data' | 'privacy_policy';
export type CycleSource = 'manual' | 'healthkit' | 'health_connect';
export type CyclePhase = 'menstruation' | 'follicular' | 'ovulation' | 'luteal';
export type AdjustmentMetric = 'volume';
export type AdjustmentStatus = 'active' | 'lifted_auto' | 'lifted_manual';

type Timestamps = { created_at: string; updated_at: string };

type Def<Row, Optional extends keyof Row = never> = {
  Row: Row;
  Insert: Omit<Row, Optional> & Partial<Pick<Row, Optional>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type ProfileRow = Timestamps & {
  id: string;
  default_cycle_length: number;
  training_goal: TrainingGoal | null;
  training_experience: TrainingExperience | null;
  cycle_context: CycleContext;
  engine_mode: EngineMode;
  onboarded_at: string | null;
};

export type UserConsentRow = Timestamps & {
  id: string;
  user_id: string;
  consent_type: ConsentType;
  version: string;
  granted_at: string;
  revoked_at: string | null;
};

export type CycleRow = Timestamps & {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string | null;
  source: CycleSource;
  external_id: string | null;
};

export type ExerciseRow = Timestamps & {
  id: string;
  user_id: string | null;
  name: string;
  aliases: string[];
};

export type WorkoutRow = Timestamps & {
  id: string;
  user_id: string;
  performed_on: string;
  started_at: string | null;
  ended_at: string | null;
  notes: string | null;
  deleted_at: string | null;
};

export type WorkoutExerciseRow = Timestamps & {
  id: string;
  user_id: string;
  workout_id: string;
  exercise_id: string;
  position: number;
  deleted_at: string | null;
};

export type SetRow = Timestamps & {
  id: string;
  user_id: string;
  workout_exercise_id: string;
  set_index: number;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  deleted_at: string | null;
};

export type NutritionEntryRow = Timestamps & {
  id: string;
  user_id: string;
  logged_on: string;
  name: string;
  barcode: string | null;
  quantity_g: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type DailyCheckinRow = Timestamps & {
  id: string;
  user_id: string;
  checkin_on: string;
  sleep_hours: number;
  motivation: number;
  energy: number;
};

export type PhaseAdjustmentRow = Timestamps & {
  id: string;
  user_id: string;
  phase: CyclePhase;
  target_metric: AdjustmentMetric;
  factor: number;
  basis_cycles: number;
  confirming_cycles: number;
  contradicting_cycles: number;
  status: AdjustmentStatus;
  lifted_at: string | null;
  lifted_reason: string | null;
};

export type NutritionDailyRow = {
  user_id: string;
  logged_on: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type WorkoutCycleContextRow = {
  workout_id: string;
  user_id: string;
  performed_on: string;
  cycle_id: string | null;
  period_start: string | null;
  cycle_day: number | null;
  next_period_start: string | null;
  days_to_next_period: number | null;
};

type Auto = 'created_at' | 'updated_at';
type View<Row> = { Row: Row; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      profiles: Def<ProfileRow, Auto | Exclude<keyof ProfileRow, 'id'>>;
      user_consents: Def<UserConsentRow, Auto | 'id' | 'granted_at' | 'revoked_at'>;
      cycles: Def<CycleRow, Auto | 'period_end' | 'source' | 'external_id'>;
      exercises: Def<ExerciseRow, Auto | 'id' | 'user_id' | 'aliases'>;
      workouts: Def<WorkoutRow, Auto | 'started_at' | 'ended_at' | 'notes' | 'deleted_at'>;
      workout_exercises: Def<WorkoutExerciseRow, Auto | 'deleted_at'>;
      sets: Def<SetRow, Auto | 'rpe' | 'is_warmup' | 'deleted_at'>;
      nutrition_entries: Def<
        NutritionEntryRow,
        Auto | 'barcode' | 'quantity_g' | 'protein_g' | 'carbs_g' | 'fat_g'
      >;
      daily_checkins: Def<DailyCheckinRow, Auto>;
      phase_adjustments: Def<
        PhaseAdjustmentRow,
        | Auto
        | 'target_metric'
        | 'confirming_cycles'
        | 'contradicting_cycles'
        | 'status'
        | 'lifted_at'
        | 'lifted_reason'
      >;
    };
    Views: {
      nutrition_daily: View<NutritionDailyRow>;
      workout_cycle_context: View<WorkoutCycleContextRow>;
    };
    Functions: {
      export_my_data: { Args: Record<string, never>; Returns: unknown };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
