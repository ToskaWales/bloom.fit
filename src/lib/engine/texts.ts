import { formatWeight, weightLabel, type Units } from "@/lib/workout/units";
import type { ReadinessPart } from "./readiness";
import type { Candidate } from "./select";

export interface RenderContext {
  units: Units;
  exerciseName: (exerciseId: string) => string;
  /** Today's numbers, recomputed on this device from the check-ins (not stored with the hint). */
  readinessParts?: ReadinessPart[];
  /** A safety notice is active: never offer to do more, whatever an older stored hint says. */
  safetyActive?: boolean;
}

export interface RenderedSuggestion {
  title: string;
  body: string;
  /** The data behind the hint ("weil …"). Never empty. */
  because: string[];
  acceptLabel?: string;
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

const READINESS_LABEL = {
  energy: "Energie",
  motivation: "Motivation",
  sleep: "Schlaf",
} as const;

function readinessBecause(parts: ReadinessPart[] | undefined): string[] {
  const lines = (parts ?? []).map(
    (p) =>
      `${READINESS_LABEL[p.metric]} heute ${fmt(p.value)}, bei dir meist ${fmt(p.baseline)}`,
  );
  lines.push("Verglichen mit deinen Check-ins der letzten vier Wochen");
  return lines;
}

const METRIC = {
  energy: { label: "Energie", possessive: "deine Energie", points: true },
  motivation: {
    label: "Motivation",
    possessive: "deine Motivation",
    points: true,
  },
  sleep: {
    label: "Schlafqualität",
    possessive: "deine Schlafqualität",
    points: true,
  },
  hunger: { label: "Hunger", possessive: "dein Hunger", points: true },
  performance: {
    label: "Trainingsleistung",
    possessive: "deine Trainingsleistung",
    points: false,
  },
} as const;
const WINDOW = {
  before: "den vier Tagen vor deiner Periode",
  start: "den ersten drei Tagen deiner Periode",
} as const;

// All wording lives here, so one test can hold every possible sentence to the
// rules in CLAUDE.md. Hints are suggestions or observations about her own data,
// never commands, diagnoses or universal rules. Returns null when a stored hint
// can't be rendered (unknown kind or unusable params): better nothing than a blank card.
export function renderSuggestion(
  c: Candidate,
  ctx: RenderContext,
): RenderedSuggestion | null {
  const p = c.params;

  if (c.kind === "readiness") {
    const because = readinessBecause(ctx.readinessParts);
    if (p.level === "lower") {
      return {
        title: "Heute vielleicht etwas leichter",
        body: "Dein Check-in liegt heute unter deinem üblichen Niveau. Wenn du dich auch beim Aufwärmen schwer fühlst, kannst du ein bis zwei Sätze weglassen oder eine Stufe unter deiner üblichen Anstrengung bleiben (RPE). Das ist ein Vorschlag, du entscheidest.",
        because,
        acceptLabel: "Mache ich so",
      };
    }
    if (p.level === "higher") {
      const extra = p.canPush === true && !ctx.safetyActive;
      return {
        title: "Heute fühlst du dich besser als sonst",
        body:
          "Dein Check-in liegt heute über deinem üblichen Niveau. Du kannst wie geplant trainieren." +
          (extra
            ? " Wenn du magst, kannst du bei einer Übung eine Wiederholung mehr probieren."
            : ""),
        because,
        acceptLabel: "Verstanden",
      };
    }
    if (p.level === "usual") {
      return {
        title: "Heute wie gewohnt",
        body: "Dein Check-in liegt im Rahmen deiner letzten Wochen. Du kannst wie geplant trainieren.",
        because,
        acceptLabel: "Verstanden",
      };
    }
    return null;
  }

  if (c.kind === "plateau") {
    const recent = num(p.recentBest);
    const earlier = num(p.earlierBest);
    const sessions = num(p.sessions);
    const weeks = num(p.weeks);
    if (
      recent === null ||
      earlier === null ||
      sessions === null ||
      weeks === null
    )
      return null;
    const unit = weightLabel(ctx.units);
    return {
      title: `${ctx.exerciseName(c.subject)}: seit ${sessions} Einheiten kaum Fortschritt`,
      body: "Stagnation gehört beim Krafttraining dazu. Wenn du etwas ändern möchtest, kannst du zuerst auf Schlaf und Erholung schauen. Manche probieren außerdem eine andere Wiederholungszahl oder eine etwas leichtere Woche. Das ist ein Vorschlag, keine Regel.",
      because: [
        `Geschätztes 1RM der letzten ${sessions} Einheiten (in etwa ${weeks} ${weeks === 1 ? "Woche" : "Wochen"}): höchstens ${formatWeight(recent, ctx.units)} ${unit}`,
        `In den Wochen davor: bis zu ${formatWeight(earlier, ctx.units)} ${unit}`,
      ],
      acceptLabel: "Verstanden",
    };
  }

  if (c.kind === "pattern") {
    const metric =
      typeof p.metric === "string" && p.metric in METRIC
        ? METRIC[p.metric as keyof typeof METRIC]
        : null;
    const window =
      typeof p.window === "string" && p.window in WINDOW
        ? WINDOW[p.window as keyof typeof WINDOW]
        : null;
    const effect = num(p.effect);
    const cycles = num(p.cycles);
    if (!metric || !window || effect === null || cycles === null) return null;
    const direction = effect < 0 ? "niedriger" : "höher";
    const size = metric.points
      ? `${fmt(Math.abs(effect))} Punkte`
      : `etwa ${Math.round(Math.abs(effect) * 100)} %`;
    const because = [`${cycles} Zyklen mit genug Einträgen`];
    const windowAvg = num(p.windowAvg);
    const restAvg = num(p.restAvg);
    if (metric.points && windowAvg !== null && restAvg !== null) {
      because.push(
        `Durchschnitt in diesen Tagen ${fmt(windowAvg)}, an den übrigen Tagen ${fmt(restAvg)}`,
      );
    }
    because.push(
      "Der Unterschied ging in jedem dieser Zyklen in dieselbe Richtung und ist kaum durch Zufall zu erklären",
    );
    return {
      title: `${metric.label}: meist ${direction} in ${window}`,
      body: `In deinen letzten ${cycles} Zyklen war ${metric.possessive} in ${window} im Schnitt ${size} ${direction} als an den übrigen Tagen. Das ist ein Muster in deinen Daten, kein allgemeines Gesetz: Bei anderen Frauen kann es ganz anders aussehen.${
        p.metric === "hunger" && effect > 0
          ? " Wenn du magst, kannst du deinem Hunger an diesen Tagen Raum geben, zum Beispiel mit regelmäßigen Mahlzeiten. Bloom gibt dir dabei keine Zahl vor."
          : ""
      }`,
      because,
      acceptLabel: "Verstanden",
    };
  }

  if (c.kind === "safety") {
    const overdue = num(p.overdueDays);
    const late = overdue !== null && overdue > 0;
    const lowEnergy = p.lowEnergy === true;
    const weightFall = p.weightFall === true;
    const lowIntake = p.lowIntake === true;
    const signals = [
      ...(late || c.subject !== "energy"
        ? ["deine Periode ist später als sonst"]
        : []),
      ...(lowEnergy ? ["deine Energie war zuletzt meist niedrig"] : []),
      ...(weightFall
        ? ["dein Gewicht hat sich zuletzt deutlich verändert"]
        : []),
      ...(lowIntake
        ? [
            "an vielen Tagen stehen eher kleine Mengen in deinem Ernährungs-Protokoll",
          ]
        : []),
    ];
    const because = [
      ...(late
        ? [
            `Periode seit etwa ${overdue} ${overdue === 1 ? "Tag" : "Tagen"} über dem üblichen Zeitraum`,
          ]
        : c.subject !== "energy"
          ? ["Periode später als in deinen bisherigen Zyklen"]
          : []),
      ...(lowEnergy
        ? ["Energie in den letzten zwei Wochen meist bei 1 oder 2"]
        : []),
      ...(weightFall
        ? ["Gewichtstrend in den letzten zwei Wochen gefallen"]
        : []),
      ...(lowIntake
        ? [
            "Deine Einträge der letzten zwei Wochen sprechen dafür, dass die Energie knapp sein könnte",
          ]
        : []),
      ...(c.subject === "energy" ? ["Dazu trainierst du regelmäßig"] : []),
    ];
    if (because.length === 0 || signals.length === 0) return null;
    return {
      title: "Mehrere Hinweise, die dir wichtig sein könnten",
      body: `Bei dir passt gerade zusammen: ${signals.join(", ")}. Das kann viele Gründe haben, zum Beispiel Stress, wenig Schlaf, zu wenig Energie bei viel Training${lowIntake ? " oder dass nicht alles im Protokoll steht" : ""}. Wenn es anhält, sprich bitte mit einer Ärztin, einem Arzt oder einer Ernährungsfachkraft. Bloom schlägt dir in dieser Zeit keine Steigerung vor.`,
      because,
      acceptLabel: "Habe ich gelesen",
    };
  }

  if (c.kind === "hunger_note") {
    const recent = num(p.recent);
    const before = num(p.before);
    const training = num(p.trainingDays);
    if (recent === null || before === null || training === null) return null;
    const perfDrop = num(p.perfDrop);
    return {
      title: "Hunger: zuletzt höher als sonst",
      body: "Dein Hunger lag in den letzten sieben Tagen über deinem üblichen Niveau. Hunger ist ein normales Signal. Wenn du magst, kannst du ihm in diesen Tagen Raum geben, zum Beispiel mit regelmäßigen Mahlzeiten. Bloom gibt dir dabei keine Zahl vor, du entscheidest.",
      because: [
        `Hunger in den letzten 7 Tagen meist ${fmt(recent)}, bei dir sonst meist ${fmt(before)}`,
        "Verglichen mit deinen Check-ins der vier Wochen davor",
        `Dazu hast du in den letzten zwei Wochen an ${training} ${training === 1 ? "Tag" : "Tagen"} trainiert`,
        ...(perfDrop !== null
          ? [
              `Deine Trainingsleistung lag zuletzt etwa ${perfDrop} % unter deinem üblichen Niveau`,
            ]
          : []),
      ],
      acceptLabel: "Verstanden",
    };
  }

  return null; // anything newer
}

export interface FindingText {
  title: string;
  summary: string;
  /** How the metric's numbers are written ("2,5" for scale points, "−6 %" for performance). */
  value: (n: number) => string;
  unit: string;
}

// Wording for a pattern on the Muster page; same rules as the hints.
export function describeFinding(f: {
  metric: keyof typeof METRIC;
  window: keyof typeof WINDOW;
  effect: number;
  cycles: number;
}): FindingText {
  const m = METRIC[f.metric];
  const window = WINDOW[f.window];
  const direction = f.effect < 0 ? "niedriger" : "höher";
  const size = m.points
    ? `${fmt(Math.abs(f.effect))} Punkte`
    : `etwa ${Math.round(Math.abs(f.effect) * 100)} %`;
  return {
    title: `${m.label}: meist ${direction} in ${window}`,
    summary: `In deinen letzten ${f.cycles} Zyklen war ${m.possessive} in ${window} im Schnitt ${size} ${direction} als an den übrigen Tagen. Das ist ein Muster in deinen Daten, kein allgemeines Gesetz.`,
    value: m.points
      ? (n) => fmt(n)
      : (n) =>
          `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.round(Math.abs(n) * 100)} %`,
    unit: m.points ? "Skala 1 bis 5" : "im Vergleich zu deinem üblichen Niveau",
  };
}
