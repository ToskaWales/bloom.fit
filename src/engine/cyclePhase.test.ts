import {
  addDays,
  observedCycleLengths,
  phaseForDate,
  predictCycleLength,
  typicalPeriodLength,
  type CycleEntry,
} from './cyclePhase';

const config = { defaultCycleLength: 28 };
const c = (periodStart: string, periodEnd: string | null = null): CycleEntry => ({
  periodStart,
  periodEnd,
});

describe('addDays', () => {
  it('rechnet über Monats- und Jahresgrenzen', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('predictCycleLength', () => {
  it('nutzt den Onboarding-Wert ohne Historie', () => {
    expect(predictCycleLength([], { defaultCycleLength: 30 })).toEqual({
      length: 30,
      basis: 'default',
    });
    expect(predictCycleLength([c('2026-01-01')], config)).toEqual({ length: 28, basis: 'default' });
  });

  it('nimmt den Median der letzten Zyklen', () => {
    const cycles = [c('2026-01-01'), c('2026-01-29'), c('2026-02-28'), c('2026-03-28')]; // 28, 30, 28
    expect(observedCycleLengths(cycles)).toEqual([28, 30, 28]);
    expect(predictCycleLength(cycles, config)).toEqual({ length: 28, basis: 'history' });
  });

  it('ignoriert unplausible Lücken (z. B. Logging-Pause)', () => {
    const cycles = [c('2026-01-01'), c('2026-01-29'), c('2026-05-01')]; // 28, 92
    expect(observedCycleLengths(cycles)).toEqual([28]);
  });

  it('sortiert unsortierte Eingaben', () => {
    const cycles = [c('2026-02-26'), c('2026-01-01'), c('2026-01-29')];
    expect(observedCycleLengths(cycles)).toEqual([28, 28]);
  });
});

describe('typicalPeriodLength', () => {
  it('nutzt die Annahme ohne geloggtes Ende', () => {
    expect(typicalPeriodLength([c('2026-01-01')], config)).toBe(5);
  });
  it('nutzt den Median geloggter Perioden', () => {
    const cycles = [
      c('2026-01-01', '2026-01-04'),
      c('2026-01-29', '2026-02-02'),
      c('2026-02-26', '2026-03-02'),
    ];
    expect(typicalPeriodLength(cycles, config)).toBe(5); // 4, 5, 5
  });
});

describe('phaseForDate', () => {
  const cycles = [c('2026-01-01', '2026-01-05'), c('2026-01-29', '2026-02-02')]; // Zyklus 1: 28 Tage

  it('liefert null ohne Zyklen oder vor dem ersten Periodenstart', () => {
    expect(phaseForDate('2026-01-10', [], config)).toBeNull();
    expect(phaseForDate('2025-12-31', cycles, config)).toBeNull();
  });

  it('Periodenstart ist Zyklustag 1 und Menstruation', () => {
    const r = phaseForDate('2026-01-01', cycles, config)!;
    expect(r.cycleDay).toBe(1);
    expect(r.phase).toBe('menstruation');
    expect(r.basis).toBe('observed');
    expect(r.cycleLength).toBe(28);
  });

  it('Menstruation endet mit dem geloggten Periodenende', () => {
    expect(phaseForDate('2026-01-05', cycles, config)!.phase).toBe('menstruation');
    expect(phaseForDate('2026-01-06', cycles, config)!.phase).toBe('follicular');
  });

  it('Phasenfenster relativ zur nächsten Periode (28-Tage-Zyklus)', () => {
    // Zyklustag 10 → 19 Tage bis zur nächsten Periode → Follikel
    expect(phaseForDate('2026-01-10', cycles, config)!.phase).toBe('follicular');
    // 17 bis 15 Tage davor → Ovulationsfenster (Zyklustag 12–14)
    expect(phaseForDate('2026-01-12', cycles, config)!.phase).toBe('ovulation');
    expect(phaseForDate('2026-01-14', cycles, config)!.phase).toBe('ovulation');
    // ab 14 Tage davor → Luteal (Zyklustag 15)
    expect(phaseForDate('2026-01-15', cycles, config)!.phase).toBe('luteal');
    expect(phaseForDate('2026-01-28', cycles, config)!.phase).toBe('luteal');
  });

  it('nutzt für den laufenden Zyklus die Vorhersage aus der Historie', () => {
    const r = phaseForDate('2026-02-10', cycles, config)!;
    expect(r.basis).toBe('history');
    expect(r.nextPeriodStart).toBe('2026-02-26');
    expect(r.daysToNextPeriod).toBe(16);
    expect(r.phase).toBe('ovulation');
  });

  it('fällt ohne Historie auf den Onboarding-Wert zurück', () => {
    const r = phaseForDate('2026-01-20', [c('2026-01-01')], { defaultCycleLength: 32 })!;
    expect(r.basis).toBe('default');
    expect(r.cycleLength).toBe(32);
    expect(r.nextPeriodStart).toBe('2026-02-02');
  });

  it('passt die Fenster an kürzere und längere Zyklen an', () => {
    const short = [c('2026-01-01'), c('2026-01-23')]; // 22 Tage
    expect(phaseForDate('2026-01-09', short, config)!.phase).toBe('luteal'); // 14 Tage vor Ende
    const long = [c('2026-01-01'), c('2026-02-11')]; // 41 Tage
    expect(phaseForDate('2026-01-20', long, config)!.phase).toBe('follicular');
  });

  it('markiert überfällige Perioden und bleibt im Lutealfenster', () => {
    const r = phaseForDate('2026-02-28', cycles, config)!;
    expect(r.overdue).toBe(true);
    expect(r.phase).toBe('luteal');
  });

  it('gibt nach langer Logging-Pause keine Phase mehr aus', () => {
    expect(phaseForDate('2026-06-01', cycles, config)).toBeNull();
  });

  it('gibt für unplausibel lange vergangene Zyklen null zurück', () => {
    const gap = [c('2026-01-01'), c('2026-05-01')];
    expect(phaseForDate('2026-02-15', gap, config)).toBeNull();
  });

  it('wirkt nachträglich korrigierten Perioden: neuer Start verschiebt die Fenster', () => {
    const corrected = [c('2026-01-01', '2026-01-05'), c('2026-01-27', '2026-01-31')]; // 26 statt 28
    const r = phaseForDate('2026-01-15', corrected, config)!;
    expect(r.cycleLength).toBe(26);
    expect(r.daysToNextPeriod).toBe(12);
    expect(r.phase).toBe('luteal');
  });

  it('Menstruation hat Vorrang in sehr kurzen Zyklen', () => {
    const veryShort = [c('2026-01-01', '2026-01-07'), c('2026-01-19')]; // 18 Tage, Periode 7 Tage
    expect(phaseForDate('2026-01-07', veryShort, config)!.phase).toBe('menstruation');
  });
});
