import { z } from "zod";
import { cleanBarcode, normaliseBarcode } from "./barcode";
import type { FetchOffResult } from "./off-fetch";
import type { OffFood } from "./off";

export interface LookupDeps {
  getUser: () => Promise<{ id: string } | null>;
  /** Permission and rate limit, decided in the database. */
  consume: () => Promise<"ok" | "limited" | "not_allowed">;
  fetchProduct: (code: string) => Promise<FetchOffResult>;
}

type Body = { success: boolean; data?: { food: OffFood }; error?: string };
const reply = (body: Body, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const bodySchema = z.object({ barcode: z.string().max(40) });
const MAX_BODY_BYTES = 1000;

// A real request is tiny: refuse a declared or actual larger body before it is buffered.
async function readBody(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? Number.NaN);
  if (!Number.isFinite(declared) || declared > MAX_BODY_BYTES) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

// The request flow without any framework: easy to test with fakes. Nothing
// here ever logs or echoes the barcode.
export async function handleLookup(
  request: Request,
  deps: LookupDeps,
): Promise<Response> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reply({ success: false, error: "unsupported" }, 415);
  const user = await deps.getUser();
  if (!user) return reply({ success: false, error: "unauthorized" }, 401);

  const text = await readBody(request);
  if (text === null)
    return reply({ success: false, error: "bad request" }, 400);
  let barcode: string;
  try {
    const parsed = bodySchema.safeParse(JSON.parse(text));
    if (!parsed.success)
      return reply({ success: false, error: "bad request" }, 400);
    barcode = cleanBarcode(parsed.data.barcode);
  } catch {
    return reply({ success: false, error: "bad request" }, 400);
  }
  const normalised = normaliseBarcode(barcode);
  if (!normalised) return reply({ success: false, error: "bad request" }, 400);
  barcode = normalised;

  let allowed: "ok" | "limited" | "not_allowed";
  try {
    allowed = await deps.consume();
  } catch {
    return reply({ success: false, error: "lookup failed" }, 500);
  }
  if (allowed === "not_allowed")
    return reply({ success: false, error: "not allowed" }, 403);
  if (allowed === "limited")
    return reply({ success: false, error: "too many lookups" }, 429);

  const result = await deps.fetchProduct(barcode);
  if (result.ok)
    return reply({ success: true, data: { food: result.food } }, 200);
  if (result.reason === "not_found")
    return reply({ success: false, error: "not found" }, 404);
  if (result.reason === "unusable")
    return reply({ success: false, error: "unusable" }, 422);
  if (result.reason === "invalid")
    return reply({ success: false, error: "bad request" }, 400);
  return reply({ success: false, error: "upstream" }, 502);
}
