// Server-side call to Open Food Facts for one barcode, with hard limits
// (fixed host, timeout, size cap, no redirects). Parsing the JSON is ./off;
// the endpoint around it is ./lookup-handler. The browser never calls OFF.
import { isValidBarcode } from "./barcode";
import { normaliseOffProduct, type OffFood } from "./off";

/** The only host this module will ever call. */
export const OFF_HOST = "world.openfoodfacts.org";
const TIMEOUT_MS = 4000; // milliseconds before the lookup is given up
const MAX_BYTES = 200_000; // largest accepted response body (bytes)
// Ask only for the fields we use: less data in, less to trust.
const FIELDS = "product_name,product_name_de,brands,nutriments";

/** ok with a food, or a reason the handler maps to an HTTP status. */
export type FetchOffResult =
  | { ok: true; food: OffFood }
  | { ok: false; reason: "invalid" | "not_found" | "unusable" | "upstream" };

// Reads the body but gives up (null) once it exceeds MAX_BYTES.
async function readLimited(res: Response): Promise<string | null> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

// Server side only. A fixed host, a digits-only path, no cookies or client
// headers, a short timeout and a size cap: nothing the browser sent can steer
// this request, and the barcode is never logged.
export async function fetchOffProduct(
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchOffResult> {
  if (!isValidBarcode(code)) return { ok: false, reason: "invalid" };
  const contact = process.env.NEXT_PUBLIC_SITE_URL ?? "bloom.fit";
  const url = `https://${OFF_HOST}/api/v2/product/${code}.json?fields=${FIELDS}`;
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      redirect: "error",
      cache: "no-store", // a barcode must never end up in a fetch cache
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        accept: "application/json",
        "user-agent": `Bloom/1.0 (${contact})`,
      },
    });
    if (res.status === 404) return { ok: false, reason: "not_found" };
    if (!res.ok) return { ok: false, reason: "upstream" };
    if (!res.headers.get("content-type")?.includes("json"))
      return { ok: false, reason: "upstream" };
    const text = await readLimited(res);
    if (text === null) return { ok: false, reason: "upstream" };
    const result = normaliseOffProduct(JSON.parse(text));
    return result.ok ? result : { ok: false, reason: result.reason };
  } catch {
    return { ok: false, reason: "upstream" };
  }
}
