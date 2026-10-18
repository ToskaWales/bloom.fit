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
