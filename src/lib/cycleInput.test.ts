import { periodLengthDays, validateCycleInput } from './cycleInput';

const TODAY = '2026-10-01';

describe('validateCycleInput', () => {
  it('verlangt einen Beginn', () => {
    expect(validateCycleInput({ periodStart: null, periodEnd: null }, TODAY)).toBe('required');
  });
  it('akzeptiert laufende und abgeschlossene Perioden', () => {
    expect(validateCycleInput({ periodStart: '2026-09-28', periodEnd: null }, TODAY)).toBeNull();
    expect(
      validateCycleInput({ periodStart: '2026-09-28', periodEnd: '2026-10-01' }, TODAY),
    ).toBeNull();
    expect(validateCycleInput({ periodStart: TODAY, periodEnd: TODAY }, TODAY)).toBeNull();
  });
  it('lehnt ungültige, zukünftige und widersprüchliche Daten ab', () => {
    expect(validateCycleInput({ periodStart: '2026-02-30', periodEnd: null }, TODAY)).toBe(
      'invalidDate',
    );
    expect(validateCycleInput({ periodStart: '2026-10-02', periodEnd: null }, TODAY)).toBe(
      'futureDate',
    );
    expect(validateCycleInput({ periodStart: '2026-09-28', periodEnd: '2026-10-02' }, TODAY)).toBe(
      'futureDate',
    );
    expect(validateCycleInput({ periodStart: '2026-09-28', periodEnd: '2026-09-27' }, TODAY)).toBe(
      'endBeforeStart',
    );
  });
});

describe('periodLengthDays', () => {
  it('zählt Start- und Endtag mit', () => {
    expect(periodLengthDays('2026-09-28', '2026-09-28')).toBe(1);
    expect(periodLengthDays('2026-09-28', '2026-10-02')).toBe(5);
  });
});
