import { parseOffProduct, type OffResult } from '@/lib/openFoodFacts';

const BASE = 'https://world.openfoodfacts.org/api/v2/product';
// Open Food Facts bittet um einen identifizierbaren User-Agent.
const USER_AGENT = 'Bloom-App/1.0 (https://github.com/ToskaWales/bloom.fit)';

export class LookupError extends Error {}

/** Barcode-Lookup; wirft LookupError bei Netzwerk-/Serverproblemen (nicht bei „nicht gefunden"). */
export async function lookupBarcode(barcode: string): Promise<OffResult> {
  const fields = 'product_name,brands,nutriments,serving_quantity';
  let response: Response;
  try {
    response = await fetch(`${BASE}/${encodeURIComponent(barcode)}.json?fields=${fields}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
  } catch {
    throw new LookupError('network');
  }
  // 404 bedeutet bei Open Food Facts: Produkt unbekannt
  if (response.status === 404) return { kind: 'notFound' };
  if (!response.ok) throw new LookupError(`http ${response.status}`);
  try {
    return parseOffProduct(await response.json());
  } catch {
    throw new LookupError('parse');
  }
}
