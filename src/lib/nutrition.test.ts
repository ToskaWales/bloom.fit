import {
  dedupeRecent,
  kcalFromMacros,
  parseFoodDraft,
  per100FromTotals,
  scaleMacros,
  sumMacros,
  type FoodDraft,
} from './nutrition';

const draft = (patch: Partial<FoodDraft> = {}): FoodDraft => ({
  name: 'Haferflocken',
  quantityG: '50',
  kcal: '370',
  proteinG: '13',
  carbsG: '60',
  fatG: '7',
  ...patch,
});

describe('Skalierung', () => {
  it('rechnet pro 100 g auf die Menge hoch und zurück', () => {
    const per100 = { kcal: 370, proteinG: 13, carbsG: 60, fatG: 7 };
    const scaled = scaleMacros(per100, 50);
    expect(scaled).toEqual({ kcal: 185, proteinG: 6.5, carbsG: 30, fatG: 3.5 });
    expect(per100FromTotals(scaled, 50)).toEqual(per100);
  });
  it('nimmt ohne Menge 100 g an', () => {
    expect(per100FromTotals({ kcal: 100, proteinG: 5, carbsG: 10, fatG: 2 }, null).kcal).toBe(100);
  });
  it('summiert und rundet', () => {
    expect(
      sumMacros([
        { kcal: 100.04, proteinG: 17, carbsG: 4, fatG: 0.2 },
        { kcal: 370, proteinG: 13, carbsG: 60, fatG: 7 },
      ]),
    ).toEqual({ kcal: 470, proteinG: 30, carbsG: 64, fatG: 7.2 });
  });
  it('kcalFromMacros nutzt 4/4/9', () => {
    expect(kcalFromMacros(10, 20, 5)).toBe(165);
  });
});

describe('parseFoodDraft', () => {
  it('akzeptiert gültige Eingaben (Komma erlaubt)', () => {
    const r = parseFoodDraft(draft({ proteinG: '13,5' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.per100.proteinG).toBe(13.5);
  });
  it('berechnet kcal aus Makros, wenn leer', () => {
    const r = parseFoodDraft(draft({ kcal: '', proteinG: '10', carbsG: '20', fatG: '5' }));
    expect(r.ok && r.value.per100.kcal).toBe(165);
  });
  it('verlangt Name, Menge und (kcal oder Makros)', () => {
    const r = parseFoodDraft(
      draft({ name: ' ', quantityG: '', kcal: '', proteinG: '', carbsG: '', fatG: '' }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors).toEqual({ name: 'required', quantityG: 'required', kcal: 'required' });
  });
  it('lehnt unplausible Werte ab', () => {
    const r = parseFoodDraft(draft({ quantityG: '0', kcal: '2000', proteinG: 'x' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toEqual({ quantityG: 'range', kcal: 'range', proteinG: 'invalid' });
  });
  it('lehnt mehr als 100 g Makros pro 100 g ab', () => {
    const r = parseFoodDraft(draft({ proteinG: '50', carbsG: '40', fatG: '30' }));
    expect(r.ok).toBe(false);
  });
});

describe('dedupeRecent', () => {
  it('behält den jeweils neuesten Eintrag je Name', () => {
    const items = [
      { name: 'Skyr', id: 1 },
      { name: 'Haferflocken', id: 2 },
      { name: 'skyr ', id: 3 },
    ];
    expect(dedupeRecent(items).map((i) => i.id)).toEqual([1, 2]);
  });
  it('begrenzt die Anzahl', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ name: `Food ${i}` }));
    expect(dedupeRecent(items, 5)).toHaveLength(5);
  });
});
