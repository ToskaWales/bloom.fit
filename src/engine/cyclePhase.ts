// Zyklus-Tag und Phasenfenster aus den geloggten Perioden einer Nutzerin (E6).
// Reine Funktionen, keine UI-Texte. Die Phasen sind Fenster relativ zum Periodenstart bzw. zur
// vorhergesagten nächsten Periode – keine Aussage über Hormone und kein starrer 28-Tage-Kalender.

export type Phase = 'menstruation' | 'follicular' | 'ovulation' | 'luteal';

/** Perioden-Eintrag; Daten als ISO-Datum 'YYYY-MM-DD' (lokales Kalenderdatum). */
export type CycleEntry = { periodStart: string; periodEnd: string | null };

export type CycleConfig = {
  /** Standard-Zykluslänge aus dem Onboarding */
  defaultCycleLength: number;
  /** Annahme für die Dauer der Periode, solange keine eigene beobachtet wurde */
  defaultPeriodLength?: number;
};

export type PhaseResult = {
  phase: Phase;
  /** Tag 1 = Periodenstart */
  cycleDay: number;
  periodStart: string;
  /** Länge dieses Zyklus: beobachtet (nächste Periode bekannt) oder vorhergesagt */
  cycleLength: number;
  nextPeriodStart: string;
  daysToNextPeriod: number;
  /** observed = nächste Periode ist geloggt; history = Median aus früheren Zyklen; default = Onboarding-Wert */
  basis: 'observed' | 'history' | 'default';
  /** Die vorhergesagte Periode ist schon überfällig */
  overdue: boolean;
};

export const CYCLE_RULES = {
  /** plausible Zykluslängen für die Vorhersage (Ausreißer durch Lücken im Logging ausschließen) */
  minPlausibleLength: 18,
  maxPlausibleLength: 60,
  /** wie viele der letzten Zyklen in die Vorhersage einfließen */
  historyWindow: 6,
  defaultPeriodLength: 5,
  /** Lutealfenster: letzte 14 Tage vor der (vorhergesagten) nächsten Periode */
  lutealDays: 14,
  /** Ovulationsfenster: die 3 Tage vor dem Lutealfenster */
  ovulationDays: 3,
} as const;

const MS_PER_DAY = 86_400_000;

export function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

function isoFromDayNumber(n: number): string {
  return new Date(n * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return isoFromDayNumber(dayNumber(iso) + days);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function sortedByStart(cycles: CycleEntry[]): CycleEntry[] {
  return [...cycles].sort((a, b) => dayNumber(a.periodStart) - dayNumber(b.periodStart));
}

function isPlausibleLength(length: number): boolean {
  return length >= CYCLE_RULES.minPlausibleLength && length <= CYCLE_RULES.maxPlausibleLength;
}

/** Beobachtete Zykluslängen (Abstand zweier Periodenstarts), nur plausible Werte. */
export function observedCycleLengths(cycles: CycleEntry[]): number[] {
  const sorted = sortedByStart(cycles);
  const lengths: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const length = dayNumber(sorted[i].periodStart) - dayNumber(sorted[i - 1].periodStart);
    if (isPlausibleLength(length)) lengths.push(length);
  }
  return lengths;
}

/** Vorhergesagte Zykluslänge: Median der letzten plausiblen Zyklen, sonst der Onboarding-Wert. */
export function predictCycleLength(
  cycles: CycleEntry[],
  config: CycleConfig,
): { length: number; basis: 'history' | 'default' } {
  const recent = observedCycleLengths(cycles).slice(-CYCLE_RULES.historyWindow);
  if (recent.length === 0) return { length: config.defaultCycleLength, basis: 'default' };
  return { length: median(recent), basis: 'history' };
}

/** Typische Periodendauer in Tagen (Median der beobachteten, sonst Annahme). */
export function typicalPeriodLength(cycles: CycleEntry[], config: CycleConfig): number {
  const observed = cycles
    .filter((c) => c.periodEnd)
    .map((c) => dayNumber(c.periodEnd as string) - dayNumber(c.periodStart) + 1)
    .filter((n) => n >= 1 && n <= 10);
  if (observed.length === 0) return config.defaultPeriodLength ?? CYCLE_RULES.defaultPeriodLength;
  return median(observed);
}

/**
 * Phase für ein Datum. `null`, wenn keine Aussage möglich ist: vor dem ersten geloggten Periodenstart
 * oder wenn der Zyklus unplausibel lang ist (längere Pause beim Logging).
 *
 * Für vergangene Zyklen mit bekannter Folgeperiode zählt die tatsächliche Länge, für den laufenden
 * Zyklus die Vorhersage aus den bisherigen Zyklen.
 */
export function phaseForDate(
  date: string,
  cycles: CycleEntry[],
  config: CycleConfig,
): PhaseResult | null {
  const sorted = sortedByStart(cycles);
  const target = dayNumber(date);

  let index = -1;
  for (let i = 0; i < sorted.length; i++) {
    if (dayNumber(sorted[i].periodStart) <= target) index = i;
  }
  if (index === -1) return null;

  const current = sorted[index];
  const start = dayNumber(current.periodStart);
  const next = sorted[index + 1];

  let cycleLength: number;
  let basis: PhaseResult['basis'];
  if (next) {
    cycleLength = dayNumber(next.periodStart) - start;
    basis = 'observed';
  } else {
    // Vorhersage nur aus Zyklen bis einschließlich dem aktuellen (keine „Zukunft" für Rückblicke)
    ({ length: cycleLength, basis } = predictCycleLength(sorted.slice(0, index + 1), config));
  }
  if (cycleLength > CYCLE_RULES.maxPlausibleLength) return null;
  // Mehr als das 60-Tage-Limit seit Periodenstart ohne neue Periode: Logging-Lücke, keine Aussage
  if (!next && target - start + 1 > CYCLE_RULES.maxPlausibleLength) return null;

  const cycleDay = target - start + 1;
  const nextStart = start + cycleLength;
  const daysToNextPeriod = nextStart - target;
  const overdue = daysToNextPeriod <= 0;

  // Dauer der eigenen Periode in diesem Zyklus, falls geloggt; sonst typischer Wert
  const ownPeriodLength = current.periodEnd
    ? dayNumber(current.periodEnd) - start + 1
    : typicalPeriodLength(sorted.slice(0, index + 1), config);

  let phase: Phase;
  if (cycleDay <= ownPeriodLength) phase = 'menstruation';
  else if (overdue || daysToNextPeriod <= CYCLE_RULES.lutealDays) phase = 'luteal';
  else if (daysToNextPeriod <= CYCLE_RULES.lutealDays + CYCLE_RULES.ovulationDays)
    phase = 'ovulation';
  else phase = 'follicular';

  return {
    phase,
    cycleDay,
    periodStart: current.periodStart,
    cycleLength,
    nextPeriodStart: isoFromDayNumber(nextStart),
    daysToNextPeriod,
    basis,
    overdue,
  };
}
