import {
  emptyOnboarding,
  errorsForStep,
  hasErrors,
  validateOnboarding,
  type OnboardingInput,
} from './onboarding';

const TODAY = '2026-10-01';
const valid = (): OnboardingInput => ({
  trainingGoal: 'muscle_gain',
  trainingExperience: 'intermediate',
  cycleContext: 'regular',
  cycleLength: '28',
  lastPeriodStart: '2026-09-20',
  consentHealthData: true,
  consentPrivacy: true,
});

describe('validateOnboarding', () => {
  it('akzeptiert vollständige gültige Eingaben', () => {
    expect(hasErrors(validateOnboarding(valid(), TODAY))).toBe(false);
  });

  it('verlangt Ziel, Erfahrung, Kontext und beide Einwilligungen', () => {
    const errors = validateOnboarding(emptyOnboarding(), TODAY);
    expect(Object.keys(errors).sort()).toEqual(
      [
        'consentHealthData',
        'consentPrivacy',
        'cycleContext',
        'trainingExperience',
        'trainingGoal',
      ].sort(),
    );
  });

  it('prüft die Zykluslänge (21–45, ganze Zahl)', () => {
    for (const bad of ['', 'abc', '20', '46', '28.5', '-30']) {
      expect(validateOnboarding({ ...valid(), cycleLength: bad }, TODAY).cycleLength).toBe(
        'cycleLengthRange',
      );
    }
    for (const good of ['21', '28', '45', ' 30 ']) {
      expect(
        validateOnboarding({ ...valid(), cycleLength: good }, TODAY).cycleLength,
      ).toBeUndefined();
    }
  });

  it('letzte Periode ist optional, aber wenn gesetzt gültig', () => {
    expect(
      validateOnboarding({ ...valid(), lastPeriodStart: null }, TODAY).lastPeriodStart,
    ).toBeUndefined();
    expect(
      validateOnboarding({ ...valid(), lastPeriodStart: '2026-13-01' }, TODAY).lastPeriodStart,
    ).toBe('invalidDate');
    expect(
      validateOnboarding({ ...valid(), lastPeriodStart: '2026-10-02' }, TODAY).lastPeriodStart,
    ).toBe('futureDate');
    expect(
      validateOnboarding({ ...valid(), lastPeriodStart: '2025-01-01' }, TODAY).lastPeriodStart,
    ).toBe('tooOld');
    expect(
      validateOnboarding({ ...valid(), lastPeriodStart: TODAY }, TODAY).lastPeriodStart,
    ).toBeUndefined();
  });
});

describe('errorsForStep', () => {
  it('meldet nur Fehler des aktuellen Schritts', () => {
    const input = emptyOnboarding();
    expect(Object.keys(errorsForStep('training', input, TODAY)).sort()).toEqual([
      'trainingExperience',
      'trainingGoal',
    ]);
    expect(Object.keys(errorsForStep('intro', input, TODAY))).toEqual([]);
    expect(Object.keys(errorsForStep('consent', input, TODAY)).sort()).toEqual([
      'consentHealthData',
      'consentPrivacy',
    ]);
  });
});
