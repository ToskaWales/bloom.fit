// The contract between devices and server: which tables sync (in parent-first
// order), exactly which fields a client may write (zod schemas = the server-side
// input validation), the request/response shapes and the size limits. The protocol
// logic lives in client.ts (device) and server.ts (server); these schemas must stay
// in line with the SQL checks in supabase/migrations.
import { z } from "zod";
import { SYMPTOMS } from "@/lib/daily/symptoms";

// Parents first: children reference them with foreign keys. Both pushing and
// pulling iterate in this order.
export const TABLES = [
  "custom_exercises",
  "workouts",
  "workout_exercises",
  "workout_sets",
  "templates",
  "template_exercises",
  "checkins",
  "bodyweight_entries",
  "cycle_events",
  "suggestions",
  "foods",
  "food_logs",
] as const;
export type TableName = (typeof TABLES)[number];

const id = z.uuid();
const ts = z.iso.datetime({ offset: true });
const nullableText = (max: number) => z.string().max(max).nullable();

// What a client may write. Server-owned columns (user_id, created_at,
// updated_at) are not part of the schema, so zod strips them from input.
// The limits mirror the database check constraints: a row that passes here but
// fails in SQL is reported as "db" instead of "invalid" (see server.ts).
// deleted_at is the soft-delete marker; every table has it.
export const pushSchemas = {
  custom_exercises: z.object({
    id,
    name: z.string().min(1).max(80),
    muscle_group: nullableText(40),
    equipment: nullableText(40),
    deleted_at: ts.nullable(),
  }),
  workouts: z
    .object({
      id,
      title: nullableText(80),
      started_at: ts,
      ended_at: ts.nullable(),
      notes: nullableText(2000),
      source: z.enum(["app", "hevy", "strong"]),
      deleted_at: ts.nullable(),
    })
    .refine(
      (w) => !w.ended_at || Date.parse(w.ended_at) >= Date.parse(w.started_at),
      {
        message: "ended_at before started_at",
      },
    ),
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
  templates: z.object({
    id,
    name: z.string().min(1).max(80),
    deleted_at: ts.nullable(),
  }),
  template_exercises: z.object({
    id,
    template_id: id,
    exercise_id: z.string().min(1).max(64),
    position: z.number().int().min(0),
    set_count: z.number().int().min(1).max(20),
    deleted_at: ts.nullable(),
  }),
  checkins: z.object({
    id,
    day: z.iso.date(),
    sleep_quality: z.number().int().min(1).max(5).nullable(),
    sleep_hours: z.number().min(0).max(24).nullable(),
    energy: z.number().int().min(1).max(5).nullable(),
    motivation: z.number().int().min(1).max(5).nullable(),
    hunger: z.number().int().min(1).max(5).nullable(),
    symptoms: z.array(z.enum(SYMPTOMS)).max(12),
    note: nullableText(1000),
    deleted_at: ts.nullable(),
  }),
  bodyweight_entries: z.object({
    id,
    day: z.iso.date(),
    weight_kg: z.number().min(30).max(300),
    deleted_at: ts.nullable(),
  }),
  cycle_events: z.object({
    id,
    kind: z.enum(["period_start", "period_end", "ovulation_test_positive"]),
    day: z.iso.date(),
    deleted_at: ts.nullable(),
  }),
  suggestions: z.object({
    id,
    kind: z.enum(["readiness", "plateau", "pattern", "safety", "hunger_note"]),
    day: z.iso.date(),
    subject: z.string().max(64),
    params: z
      .record(
        z.string().max(40),
        z.union([
          z.number().min(-1e6).max(1e6),
          z.string().max(80),
          z.boolean(),
          z.array(z.string().max(40)).max(10),
        ]),
      )
      .refine(
        (p) => Object.keys(p).length <= 20 && JSON.stringify(p).length <= 1500,
      ),
    status: z.enum(["shown", "accepted", "dismissed"]),
    reacted_at: ts.nullable(),
    deleted_at: ts.nullable(),
  }),
  foods: z
    .object({
      id,
      name: z.string().min(1).max(80),
      brand: nullableText(80),
      barcode: z
        .string()
        .regex(/^[0-9]{6,32}$/)
        .nullable(),
      basis: z.enum(["100g", "portion"]),
      portion_g: z.number().gt(0).max(2000).nullable(),
      kcal: z.number().min(0).max(5000).nullable(),
      protein_g: z.number().min(0).max(500).nullable(),
      carbs_g: z.number().min(0).max(500).nullable(),
      fat_g: z.number().min(0).max(500).nullable(),
      source: z.enum(["own", "off"]),
      favorite: z.boolean(),
      deleted_at: ts.nullable(),
    })
    .refine((f) => f.kcal !== null || f.protein_g !== null, {
      message: "kcal or protein required",
    })
    .refine((f) => f.basis !== "100g" || f.kcal === null || f.kcal <= 900, {
      message: "kcal per 100 g too high",
    }),
  food_logs: z
    .object({
      id,
      day: z.iso.date(),
      meal: z.enum(["morning", "midday", "evening", "snack"]).nullable(),
      food_id: id.nullable(),
      name_snapshot: z.string().max(80),
      amount_g: z.number().gt(0).max(3000).nullable(),
      kcal: z.number().min(0).max(10000).nullable(),
      protein_g: z.number().min(0).max(1000).nullable(),
      carbs_g: z.number().min(0).max(1000).nullable(),
      fat_g: z.number().min(0).max(1000).nullable(),
      deleted_at: ts.nullable(),
    })
    .refine((l) => l.kcal !== null || l.protein_g !== null, {
      message: "kcal or protein required",
    }),
} satisfies Record<TableName, z.ZodType>;

export type PushRow<T extends TableName> = z.infer<(typeof pushSchemas)[T]>;
// A row as stored locally and sent/received over the wire. updated_at is assigned
// by the server and is the pull cursor; deleted_at != null means "deleted".
export type WireRow = {
  id: string;
  updated_at?: string;
  deleted_at: string | null;
  [key: string]: unknown;
};

// Size limits per request, so one sync call stays small; the client sends the rest in further rounds.
export const MAX_ROWS_PER_TABLE = 200;
export const MAX_ROWS_TOTAL = 500;
export const PULL_LIMIT = 500;

// Request body of POST /api/sync. `push` holds rows still to be validated per
// table (hence unknown); `cursors` is the last updated_at seen per table.
export const syncRequestSchema = z.object({
  push: z
    .record(z.string(), z.array(z.unknown()).max(MAX_ROWS_PER_TABLE))
    .default({}),
  cursors: z.record(z.string(), z.string().nullable()).default({}),
});
export type SyncRequest = z.infer<typeof syncRequestSchema>;

// pulled/cursors cover every table; hasMore=true means "ask again". `rejected`
// lists pushed rows the server did not store: reason "invalid" (failed the
// schema, retrying is pointless) or "db" (the database refused it, may work later).
export interface SyncResponse {
  pulled: Record<TableName, WireRow[]>;
  cursors: Record<TableName, string | null>;
  hasMore: boolean;
  rejected: { table: TableName; id: string | null; reason: string }[];
}
