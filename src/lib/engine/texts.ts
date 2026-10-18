import { formatWeight, weightLabel, type Units } from "@/lib/workout/units";
import type { Candidate } from "./select";

export interface RenderContext {
  units: Units;
  exerciseName: (exerciseId: string) => string;
}

export interface RenderedSuggestion {
  title: string;
  body: string;
  /** The data behind the hint ("weil …"). Never empty. */
  because: string[];
  acceptLabel?: string;
}

const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

function readinessBecause(p: Candidate["params"]): string[] {
  const lines: string[] = [];
  const rows: [string, string, string][] = [
    ["Energie", "energy", "energyBase"],
    ["Motivation", "motivation", "motivationBase"],
    ["Schlaf", "sleep", "sleepBase"],
  ];
  for (const [label, value, base] of rows) {
    const v = num(p[value]);
    const b = num(p[base]);
    if (v !== null && b !== null)
      lines.push(`${label} heute ${fmt(v)}, bei dir meist ${fmt(b)}`);
  }
  lines.push("Verglichen mit deinen Check-ins der letzten vier Wochen");
  return lines;
}

// All wording lives here, so one test can hold every possible sentence to the
// rules in CLAUDE.md. Hints are suggestions, never commands or universal rules.
export function renderSuggestion(
  c: Candidate,
  ctx: RenderContext,
): RenderedSuggestion {
  if (c.kind === "readiness") {
    const level = c.params.level;
    const because = readinessBecause(c.params);
    if (level === "lower") {
      return {
        title: "Heute vielleicht etwas leichter",
        body: "Dein Check-in liegt heute unter deinem üblichen Niveau. Wenn du dich auch beim Aufwärmen schwer fühlst, kannst du ein bis zwei Sätze weglassen oder eine Stufe unter deiner üblichen Anstrengung bleiben (RPE). Das ist ein Vorschlag, du entscheidest.",
        because,
        acceptLabel: "Mache ich so",
      };
    }
    if (level === "higher") {
      return {
        title: "Heute fühlst du dich besser als sonst",
        body:
          "Dein Check-in liegt heute über deinem üblichen Niveau. Trainiere wie geplant." +
          (c.params.canPush === true
            ? " Wenn du magst, probiere bei einer Übung eine Wiederholung mehr."
            : ""),
        because,
        acceptLabel: "Verstanden",
      };
    }
    return {
      title: "Heute wie gewohnt",
      body: "Dein Check-in liegt im Rahmen deiner letzten Wochen. Trainiere wie geplant.",
      because,
      acceptLabel: "Verstanden",
    };
  }

  if (c.kind === "plateau") {
    const name = ctx.exerciseName(c.subject);
    const unit = weightLabel(ctx.units);
    const recent = num(c.params.recentBest) ?? 0;
    const earlier = num(c.params.earlierBest) ?? 0;
    const sessions = num(c.params.sessions) ?? 4;
    const weeks = num(c.params.weeks) ?? 4;
    return {
      title: `${name}: seit ${sessions} Einheiten kein neuer Bestwert`,
      body: "Stagnation gehört beim Krafttraining dazu. Wenn du etwas ändern möchtest, schau zuerst auf Schlaf und Erholung. Manche probieren außerdem eine andere Wiederholungszahl oder eine etwas leichtere Woche. Das ist ein Vorschlag, keine Regel.",
      because: [
        `Geschätztes 1RM der letzten ${sessions} Einheiten (in etwa ${weeks} ${weeks === 1 ? "Woche" : "Wochen"}): höchstens ${formatWeight(recent, ctx.units)} ${unit}`,
        `Davor: bis zu ${formatWeight(earlier, ctx.units)} ${unit}`,
      ],
      acceptLabel: "Verstanden",
    };
  }

  // kinds added in later steps (pattern, safety, hunger_note) render in their own modules
  return {
    title: "Hinweis",
    body: "",
    because: ["Aus deinen eigenen Einträgen berechnet"],
  };
}
