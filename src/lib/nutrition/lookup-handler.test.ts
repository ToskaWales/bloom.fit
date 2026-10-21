import { describe, expect, it, vi } from "vitest";
import { handleLookup, type LookupDeps } from "./lookup-handler";

const request = (body: unknown, type = "application/json") => {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("http://localhost/api/food/lookup", {
    method: "POST",
    headers: {
      "content-type": type,
      "content-length": String(new TextEncoder().encode(text).length),
    },
    body: text,
  });
};

const food = {
  name: "Skyr",
  brand: null,
  kcal: 63,
  proteinG: 11,
  carbsG: 4,
  fatG: 0.2,
};
const deps = (over: Partial<LookupDeps> = {}): LookupDeps => ({
  getUser: async () => ({ id: "u1" }),
  consume: vi.fn(async () => "ok" as const),
  fetchProduct: vi.fn(async () => ({ ok: true as const, food })),
  ...over,
});
const json = async (res: Response) => res.json();

describe("handleLookup", () => {
  it("returns the normalised food, uncached, in the API response shape", async () => {
    const res = await handleLookup(
      request({ barcode: "4006381333931" }),
      deps(),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await json(res)).toEqual({ success: true, data: { food } });
  });

  it("accepts spaces and dashes in the barcode", async () => {
    const d = deps();
    await handleLookup(request({ barcode: "4006 3813-33931" }), d);
    expect(d.fetchProduct).toHaveBeenCalledWith("4006381333931");
  });

  it("looks up the 13-digit form of a UPC-A code", async () => {
    const d = deps();
    await handleLookup(request({ barcode: "036000291452" }), d);
    expect(d.fetchProduct).toHaveBeenCalledWith("0036000291452");
  });

  it("refuses a body without or with a too large content-length before reading it", async () => {
    const big = new Request("http://localhost/api/food/lookup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "5000000",
      },
      body: "{}",
    });
    const d = deps();
    expect((await handleLookup(big, d)).status).toBe(400);
    expect(big.bodyUsed).toBe(false); // refused without reading the body
    expect(d.consume).not.toHaveBeenCalled();
    const streamed = new Request("http://localhost/api/food/lookup", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "10" },
      body: JSON.stringify({ barcode: "4006381333931", pad: "x".repeat(2000) }),
    });
    expect((await handleLookup(streamed, d)).status).toBe(400);
    const none = new Request("http://localhost/api/food/lookup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ barcode: "4006381333931" }),
    });
    none.headers.delete("content-length");
    expect((await handleLookup(none, deps())).status).toBe(400);
  });

  it("answers 401 without a session and does nothing else", async () => {
    const d = deps({ getUser: async () => null });
    const res = await handleLookup(request({ barcode: "4006381333931" }), d);
    expect(res.status).toBe(401);
    expect(d.consume).not.toHaveBeenCalled();
    expect(d.fetchProduct).not.toHaveBeenCalled();
  });

  it("answers 403 while nutrition is off or not consented, without calling OFF", async () => {
    const d = deps({ consume: vi.fn(async () => "not_allowed" as const) });
    const res = await handleLookup(request({ barcode: "4006381333931" }), d);
    expect(res.status).toBe(403);
    expect(d.fetchProduct).not.toHaveBeenCalled();
  });

  it("answers 429 at the limit, without calling OFF", async () => {
    const d = deps({ consume: vi.fn(async () => "limited" as const) });
    const res = await handleLookup(request({ barcode: "4006381333931" }), d);
    expect(res.status).toBe(429);
    expect(d.fetchProduct).not.toHaveBeenCalled();
  });

  it("answers 400 for a bad body or barcode before spending a lookup", async () => {
    for (const body of [
      { barcode: "123" },
      { barcode: 4006381333931 },
      {},
      "not json",
      { barcode: "4006381333932" },
    ]) {
      const d = deps();
      const res = await handleLookup(request(body), d);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(d.consume).not.toHaveBeenCalled();
      expect(d.fetchProduct).not.toHaveBeenCalled();
    }
    expect(
      (await handleLookup(request("{}", "text/plain"), deps())).status,
    ).toBe(415);
  });

  it("maps product results to status codes", async () => {
    const status = async (reason: "not_found" | "unusable" | "upstream") =>
      (
        await handleLookup(
          request({ barcode: "4006381333931" }),
          deps({ fetchProduct: async () => ({ ok: false as const, reason }) }),
        )
      ).status;
    expect(await status("not_found")).toBe(404);
    expect(await status("unusable")).toBe(422);
    expect(await status("upstream")).toBe(502);
  });

  it("never puts the barcode into an error message or log", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handleLookup(
      request({ barcode: "4006381333931" }),
      deps({
        fetchProduct: async () => ({ ok: false as const, reason: "upstream" }),
      }),
    );
    expect(JSON.stringify(await json(res))).not.toContain("4006381333931");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("4006381333931");
    spy.mockRestore();
  });

  it("treats a failing permission check as an error, not as permission", async () => {
    const d = deps({
      consume: vi.fn(async () => {
        throw new Error("db down");
      }),
    });
    const res = await handleLookup(request({ barcode: "4006381333931" }), d);
    expect(res.status).toBe(500);
    expect(d.fetchProduct).not.toHaveBeenCalled();
  });
});
