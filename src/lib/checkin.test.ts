import { SLEEP, stepSleep, validateCheckin } from './checkin';

describe('stepSleep', () => {
  it('verändert in 0,5-Schritten', () => {
    expect(stepSleep(7, 1)).toBe(7.5);
    expect(stepSleep(7, -1)).toBe(6.5);
  });
  it('bleibt im Bereich', () => {
    expect(stepSleep(SLEEP.max, 1)).toBe(SLEEP.max);
    expect(stepSleep(SLEEP.min, -1)).toBe(SLEEP.min);
  });
});

describe('validateCheckin', () => {
  it('akzeptiert gültige Werte', () => {
    expect(validateCheckin({ sleepHours: 7.5, motivation: 4, energy: 3 })).toEqual({});
  });
  it('verlangt Motivation und Energie', () => {
    expect(validateCheckin({ sleepHours: 7, motivation: null, energy: null })).toEqual({
      motivation: 'required',
      energy: 'required',
    });
  });
  it('lehnt Werte außerhalb des Bereichs ab', () => {
    expect(validateCheckin({ sleepHours: 25, motivation: 6, energy: 0 })).toEqual({
      sleepHours: 'range',
      motivation: 'range',
      energy: 'range',
    });
    expect(validateCheckin({ sleepHours: 7, motivation: 2.5, energy: 3 }).motivation).toBe('range');
  });
});
