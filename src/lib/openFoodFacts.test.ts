import { parseOffProduct } from './openFoodFacts';

describe('parseOffProduct', () => {
  it('liest ein vollständiges Produkt', () => {
    const r = parseOffProduct({
      status: 1,
      product: {
        product_name: 'Skyr Natur',
        brands: 'Arla, Foods',
        serving_quantity: '150',
        nutriments: {
          'energy-kcal_100g': 63,
          proteins_100g: 11,
          carbohydrates_100g: '4,0',
          fat_100g: 0.2,
        },
      },
    });
    expect(r).toEqual({
      kind: 'found',
      name: 'Skyr Natur (Arla)',
      quantityG: 150,
      per100: { kcal: 63, proteinG: 11, carbsG: 4, fatG: 0.2 },
    });
  });

  it('rechnet kJ in kcal um, wenn kcal fehlt', () => {
    const r = parseOffProduct({
      status: 1,
      product: {
        product_name: 'Müsli',
        nutriments: { energy_100g: 1590, proteins_100g: 10, carbohydrates_100g: 60, fat_100g: 8 },
      },
    });
    expect(r.kind === 'found' && r.per100.kcal).toBe(380);
  });

  it('berechnet kcal aus Makros, wenn Energie ganz fehlt', () => {
    const r = parseOffProduct({
      status: 1,
      product: {
        product_name: 'X',
        nutriments: { proteins_100g: 10, carbohydrates_100g: 20, fat_100g: 5 },
      },
    });
    expect(r.kind === 'found' && r.per100.kcal).toBe(165);
  });

  it('nutzt 100 g ohne Portionsangabe und ignoriert unplausible Portionen', () => {
    const base = {
      status: 1,
      product: { product_name: 'X', nutriments: { 'energy-kcal_100g': 100 } },
    };
    expect(parseOffProduct(base)).toMatchObject({ kind: 'found', quantityG: 100 });
    const huge = { ...base, product: { ...base.product, serving_quantity: 99999 } };
    expect(parseOffProduct(huge)).toMatchObject({ quantityG: 100 });
  });

  it('meldet Produkte ohne Nährwerte', () => {
    expect(
      parseOffProduct({ status: 1, product: { product_name: 'Mystery', nutriments: {} } }),
    ).toEqual({
      kind: 'noNutrition',
      name: 'Mystery',
    });
  });

  it('meldet unbekannte Produkte und kaputte Antworten', () => {
    expect(parseOffProduct({ status: 0, status_verbose: 'product not found' })).toEqual({
      kind: 'notFound',
    });
    expect(parseOffProduct(null)).toEqual({ kind: 'notFound' });
    expect(parseOffProduct({ status: 1 })).toEqual({ kind: 'notFound' });
  });

  it('ignoriert negative und nicht numerische Werte', () => {
    const r = parseOffProduct({
      status: 1,
      product: {
        product_name: 'X',
        nutriments: { 'energy-kcal_100g': 'abc', proteins_100g: -3, fat_100g: 5 },
      },
    });
    expect(r).toMatchObject({ kind: 'found', per100: { proteinG: 0, fatG: 5, kcal: 45 } });
  });
});
