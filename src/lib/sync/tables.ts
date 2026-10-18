import { z } from "zod";

// Parents first: children reference them with foreign keys.
export const TABLES = [
  "custom_exercises",
  "workouts",
  "workout_exercises",
  "workout_sets",
] as const;
export type TableName = (typeof TABLES)[number];

const id = z.uuid();
const ts = z.iso.datetime({ offset: true });
const nullableText = (max: number) => z.string().max(max).nullable();

// What a client may write. Server-owned columns (user_id, created_at,
// updated_at) are not part of the schema, so zod strips them from input.
export const pushSchemas = {
  custom_exercises: z.object({
    id,
    name: z.string().min(1).max(80),
    muscle_group: nullableText(40),
    equipment: nullableText(40),
    deleted_at: ts.nullable(),
  }),
  workouts: z.object({
    id,
    title: nullableText(80),
    started_at: ts,
    ended_at: ts.nullable(),
    notes: nullableText(2000),
    source: z.enum(["app", "hevy", "strong"]),
    deleted_at: ts.nullable(),
  }),
  workout_exercises: z.object({
    id,
    workout_id: id,
    exercise_id: z.string().min(1).max(64),
    position: z.number().int().min(0),
    notes: nullableText(1000),
    deleted_at: ts.nullable(),
  }),
  workout_sets: z.object({
    id,
    workout_exercise_id: id,
    position: z.number().int().min(0),
    set_type: z.enum(["normal", "warmup", "drop", "failure"]),
    weight_kg: z.number().min(0).max(1000).nullable(),
    reps: z.number().int().min(0).max(1000).nullable(),
    rpe: z.number().min(1).max(10).nullable(),
    completed: z.boolean(),
    deleted_at: ts.nullable(),
  }),
} satisfies Record<TableName, z.ZodType>;

export type PushRow<T extends TableName> = z.infer<(typeof pushSchemas)[T]>;
export type WireRow = {
  id: string;
  updated_at?: string;
  deleted_at: string | null;
  [key: string]: unknown;
};

export const MAX_ROWS_PER_TABLE = 200;
export const MAX_ROWS_TOTAL = 500;
export const PULL_LIMIT = 500;

export const syncRequestSchema = z.object({
  push: z
    .record(z.string(), z.array(z.unknown()).max(MAX_ROWS_PER_TABLE))
    .default({}),
  cursors: z.record(z.string(), z.string().nullable()).default({}),
});
export type SyncRequest = z.infer<typeof syncRequestSchema>;

export interface SyncResponse {
  pulled: Record<TableName, WireRow[]>;
  cursors: Record<TableName, string | null>;
  hasMore: boolean;
  rejected: { table: TableName; id: string | null; reason: string }[];
}
