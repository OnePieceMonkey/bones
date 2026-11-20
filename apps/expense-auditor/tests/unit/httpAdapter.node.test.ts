import { describe, expect, it, vi } from "vitest";
import type { CoreError } from "@bones/core";
import { HttpExtractionAdapter } from "../../src/extraction/HttpExtractionAdapter";
import { describeError } from "../../src/ui/ErrorPanel";

const validExtraction = {
  proposedFields: {
    merchant: "Corner Bistro",
    receiptDate: "2024-03-12",
    claimedTotalCents: 3240,
    lineItems: [{ description: "Chicken bowl", amount: 3240, isAlcohol: false }],
  },
  confidence: { merchant: 0.99, receiptDate: 0.98, claimedTotalCents: 0.97, lineItems: 0.95 },
  sources: {},
  rawModelOutput: "{}",
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function make(fetchImpl: typeof fetch) {
  return new HttpExtractionAdapter({ mediaType: "image/jpeg", endpoint: "/api/extract", fetchImpl });
}

describe("HttpExtractionAdapter (mocked fetch)", () => {
  it("posts a body with exactly imageBase64 and mediaType", async () => {
    const fake = vi.fn(async () => json(validExtraction));
    await make(fake as unknown as typeof fetch).extract(bytes);
    expect(fake).toHaveBeenCalledTimes(1);
    const [url, init] = fake.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/extract");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["imageBase64", "mediaType"]);
    expect(body.mediaType).toBe("image/jpeg");
    expect(body.imageBase64).toBe(btoa(String.fromCharCode(...bytes)));
  });

  it("returns the extraction for a valid 200", async () => {
    const result = await make((async () => json(validExtraction)) as typeof fetch).extract(bytes);
    expect(result).toEqual(validExtraction);
  });

  it("gives forbidden_origin its own message and keeps the kill-switch text for disabled", async () => {
    const origin = { error: { reason: "disabled", code: "forbidden_origin", message: "x" } };
    const off = { error: { reason: "disabled", code: "disabled", message: "x" } };
    const a = await make((async () => json(origin, 403)) as typeof fetch).extract(bytes);
    const b = await make((async () => json(off, 403)) as typeof fetch).extract(bytes);
    expect(a).toMatchObject({
      reason: "disabled",
      message: "This request was blocked because it came from another site.",
    });
    expect(b).toMatchObject({ reason: "disabled", message: "Live reading is switched off." });
    expect(describeError(a as CoreError).summary).toBe(
      "This request was blocked because it came from another site.",
    );
    expect(describeError(b as CoreError).summary).toBe("Live reading is switched off on this server.");
  });

  it("maps a 403 disabled body to extraction_failed disabled", async () => {
    const body = { error: { reason: "disabled", code: "disabled", message: "off" } };
    const result = await make((async () => json(body, 403)) as typeof fetch).extract(bytes);
    expect(result).toMatchObject({ kind: "extraction_failed", reason: "disabled" });
  });

  it("maps a rejected fetch to extraction_failed network", async () => {
    const result = await make((async () => {
      throw new TypeError("offline");
    }) as typeof fetch).extract(bytes);
    expect(result).toMatchObject({ kind: "extraction_failed", reason: "network" });
  });

  it("maps a 200 with a wrong shape to bad_response", async () => {
    const wrong = { ...validExtraction, proposedFields: { merchant: "x" } };
    const result = await make((async () => json(wrong)) as typeof fetch).extract(bytes);
    expect(result).toMatchObject({ kind: "extraction_failed", reason: "bad_response" });
  });

  it("maps a 502 with an unparseable body to upstream", async () => {
    const result = await make((async () => new Response("<html>bad gateway</html>", { status: 502 })) as typeof fetch).extract(bytes);
    expect(result).toMatchObject({ kind: "extraction_failed", reason: "upstream" });
  });

  it("does not call fetch again after a 4xx", async () => {
    const fake = vi.fn(async () => new Response("nope", { status: 400 }));
    const result = await make(fake as unknown as typeof fetch).extract(bytes);
    expect(result).toMatchObject({ kind: "extraction_failed", reason: "bad_response" });
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it("returns validation_failed for string input without calling fetch", async () => {
    const fake = vi.fn();
    const result = await make(fake as unknown as typeof fetch).extract("receipt text");
    expect(result).toMatchObject({
      kind: "validation_failed",
      fieldErrors: [{ path: "input", issue: "expected image bytes" }],
    });
    expect(fake).not.toHaveBeenCalled();
  });
});
