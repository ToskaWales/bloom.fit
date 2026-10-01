import {
  formatNumber,
  formatTimer,
  hasExactMatch,
  isCompleteSet,
  normalizeText,
  parseDecimal,
  parseReps,
  parseRpe,
  searchExercises,
  suggestSet,
  type Exercise,
  type SetEntry,
} from './training';

const ex = (name: string, aliases: string[] = []): Exercise => ({
  id: name,
  userId: null,
  name,
  aliases,
});
const set = (weightKg: number | null, reps: number | null, isWarmup = false): SetEntry => ({
  id: `${weightKg}-${reps}-${isWarmup}`,
  workoutExerciseId: 'we',
  setIndex: 0,
  weightKg,
  reps,
  rpe: null,
  isWarmup,
});

describe('Eingaben parsen', () => {
  it('parseDecimal akzeptiert Komma und Punkt', () => {
    expect(parseDecimal('82,5')).toBe(82.5);
    expect(parseDecimal(' 60 ')).toBe(60);
    expect(parseDecimal('0')).toBe(0);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('-5')).toBeNull();
    expect(parseDecimal('1,2,3')).toBeNull();
  });
  it('parseReps nur ganze Zahlen 1–100', () => {
    expect(parseReps('8')).toBe(8);
    expect(parseReps('0')).toBeNull();
    expect(parseReps('101')).toBeNull();
    expect(parseReps('5,5')).toBeNull();
  });
  it('parseRpe: leer = keine Angabe, ungültig = undefined', () => {
    expect(parseRpe('')).toBeNull();
    expect(parseRpe('8,5')).toBe(8.5);
    expect(parseRpe('7.3')).toBeUndefined();
    expect(parseRpe('11')).toBeUndefined();
    expect(parseRpe('0')).toBeUndefined();
  });
  it('formatNumber nutzt Komma', () => {
    expect(formatNumber(82.5)).toBe('82,5');
    expect(formatNumber(null)).toBe('');
  });
});

describe('isCompleteSet', () => {
  it('verlangt Gewicht (auch 0 für Körpergewicht) und mindestens 1 Wiederholung', () => {
    expect(isCompleteSet({ weightKg: 0, reps: 10 })).toBe(true);
    expect(isCompleteSet({ weightKg: 80, reps: null })).toBe(false);
    expect(isCompleteSet({ weightKg: null, reps: 5 })).toBe(false);
    expect(isCompleteSet({ weightKg: 80, reps: 0 })).toBe(false);
  });
});

describe('Übungssuche', () => {
  const list = [
    ex('Kniebeuge', ['Back Squat']),
    ex('Frontkniebeuge', ['Front Squat']),
    ex('Rumänisches Kreuzheben', ['RDL']),
    ex('Kreuzheben', ['Deadlift']),
    ex('Bankdrücken', ['Bench Press']),
    ex('Schulterdrücken'),
  ];
  it('normalisiert Akzente und ß', () => {
    expect(normalizeText('Rumänisches  ')).toBe('rumanisches');
    expect(normalizeText('Fußheben')).toBe('fussheben');
  });
  it('findet nach Namen mit Rangfolge', () => {
    expect(searchExercises(list, 'knie').map((e) => e.name)).toEqual([
      'Kniebeuge',
      'Frontkniebeuge',
    ]);
    expect(searchExercises(list, 'kreuz').map((e) => e.name)).toEqual([
      'Kreuzheben',
      'Rumänisches Kreuzheben',
    ]);
  });
  it('findet über Aliase und ignoriert Akzente', () => {
    expect(searchExercises(list, 'squat').map((e) => e.name)).toContain('Kniebeuge');
    expect(searchExercises(list, 'rumanisches')[0].name).toBe('Rumänisches Kreuzheben');
  });
  it('leere Suche liefert alphabetisch', () => {
    expect(searchExercises(list, '')[0].name).toBe('Bankdrücken');
  });
  it('hasExactMatch', () => {
    expect(hasExactMatch(list, ' kniebeuge ')).toBe(true);
    expect(hasExactMatch(list, 'knie')).toBe(false);
  });
});

describe('suggestSet', () => {
  it('nimmt den vorherigen Arbeitssatz im aktuellen Training', () => {
    const current = [set(40, 10, true), set(80, 5)];
    expect(suggestSet(current, [set(75, 6)])).toEqual({ weightKg: 80, reps: 5 });
  });
  it('nutzt sonst den gleichen Satz des letzten Trainings', () => {
    const last = [set(40, 10, true), set(70, 8), set(70, 7), set(70, 6)];
    expect(suggestSet([], last)).toEqual({ weightKg: 70, reps: 8 });
    expect(suggestSet([set(0, 0, true)], last)).toEqual({ weightKg: 70, reps: 8 });
  });
  it('fällt auf den letzten Satz zurück, wenn heute mehr Sätze gemacht werden', () => {
    const last = [set(70, 8), set(70, 7)];
    const current = [set(72, 8), set(72, 7)];
    // aktuelle Sätze haben Vorrang
    expect(suggestSet(current, last)).toEqual({ weightKg: 72, reps: 7 });
  });
  it('liefert null ohne Historie', () => {
    expect(suggestSet([], [])).toBeNull();
    expect(suggestSet([set(null, null)], [])).toBeNull();
  });
});

describe('formatTimer', () => {
  it('formatiert m:ss', () => {
    expect(formatTimer(90)).toBe('1:30');
    expect(formatTimer(5)).toBe('0:05');
    expect(formatTimer(-3)).toBe('0:00');
  });
});
