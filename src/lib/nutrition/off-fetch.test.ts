// Pins down the outgoing Open Food Facts request: fixed host, no extra headers,
// timeout and size limits. Matters for privacy and for not being steerable from the browser.
import { describe, expect, it, vi } from "vitest";
import { fetchOffProduct, OFF_HOST } from "./off-fetch";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
const found = {
  status: 1,
  product: {
    product_name: "Skyr",
    nutriments: { "energy-kcal_100g": 63, proteins_100g: 11 },
  },
};

describe("fetchOffProduct", () => {
  it("asks the fixed host with a digits-only code, our own User-Agent and no extra headers", async () => {
    const fetchImpl = vi.fn(async () => json(found));
    const r = await fetchOffProduct(
      "4006381333931",
      fetchImpl as unknown as typeof fetch,
    );
    expect(r).toMatchObject({
      ok: true,
      food: { name: "Skyr", kcal: 63, proteinG: 11 },
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const u = new URL(url);
    expect(u.protocol).toBe("https:");
    expect(u.host).toBe(OFF_HOST);
    expect(u.pathname).toBe("/api/v2/product/4006381333931.json");
    expect(u.searchParams.get("fields")).toBe(
      "product_name,product_name_de,brands,nutriments",
    );
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.credentials).toBeUndefined();
    expect(Object.keys(init.headers as Record<string, string>).sort()).toEqual([
      "accept",
      "user-agent",
    ]);
    expect((init.headers as Record<string, string>)["user-agent"]).toMatch(
      /^Bloom\/\d/,
    );
    expect(init.method ?? "GET").toBe("GET");
  });

  it("never builds a request from anything but a valid barcode", async () => {
    const fetchImpl = vi.fn();
    for (const bad of [
      "../../etc/passwd",
      "4006381333931/../x",
      "4006381333932",
      "abc",
      "",
    ])
      expect(
        await fetchOffProduct(bad, fetchImpl as unknown as typeof fetch),
      ).toEqual({ ok: false, reason: "invalid" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps upstream trouble to calm reasons", async () => {
    const run = (impl: () => Promise<Response>) =>
      fetchOffProduct("4006381333931", impl as unknown as typeof fetch);
    expect(await run(async () => json({ status: 0 }))).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await run(async () => json({}, { status: 404 }))).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await run(async () => json({}, { status: 503 }))).toEqual({
      ok: false,
      reason: "upstream",
    });
    expect(
      await run(async () => {
        throw new TypeError("redirect");
      }),
    ).toEqual({ ok: false, reason: "upstream" });
    expect(
      await run(async () => {
        throw new DOMException("timeout", "TimeoutError");
      }),
    ).toEqual({ ok: false, reason: "upstream" });
    expect(
      await run(
        async () =>
          new Response("<html>", {
            status: 200,
            headers: { "content-type": "text/html" },
          }),
      ),
    ).toEqual({ ok: false, reason: "upstream" });
    expect(
      await run(
        async () =>
          new Response("not json", {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    ).toEqual({ ok: false, reason: "upstream" });
  });

  it("stops reading oversized responses", async () => {
    const big = "x".repeat(300_000);
    const r = await fetchOffProduct(
      "4006381333931",
      (async () =>
        new Response(JSON.stringify({ status: 1, junk: big }), {
          headers: { "content-type": "application/json" },
        })) as unknown as typeof fetch,
    );
    expect(r).toEqual({ ok: false, reason: "upstream" });
  });

  it("reports an unusable product", async () => {
    const r = await fetchOffProduct("4006381333931", (async () =>
      json({
        status: 1,
        product: { product_name: "x", nutriments: {} },
      })) as unknown as typeof fetch);
    expect(r).toEqual({ ok: false, reason: "unusable" });
  });
});
