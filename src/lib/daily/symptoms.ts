// The fixed list of symptoms she can tag on a check-in, with German labels.
// Stored as the English keys; only SYMPTOM_LABELS is user-facing. Keep neutral:
// no medical claims and no link to a cycle phase.
/** Allowed symptom keys as stored in check-ins. */
export const SYMPTOMS = [
  "cramps",
  "headache",
  "bloating",
  "mood_swings",
  "sore_muscles",
  "back_pain",
  "breast_tenderness",
  "cravings",
] as const;
export type Symptom = (typeof SYMPTOMS)[number];

/** Display text per key; the Record type forces a label for every new symptom. */
export const SYMPTOM_LABELS: Record<Symptom, string> = {
  cramps: "Krämpfe",
  headache: "Kopfschmerzen",
  bloating: "Blähbauch",
  mood_swings: "Stimmungsschwankungen",
  sore_muscles: "Muskelkater",
  back_pain: "Rückenschmerzen",
  breast_tenderness: "Brustspannen",
  cravings: "Heißhunger",
};
