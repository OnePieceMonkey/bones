import { describe, expect, it } from "vitest";
import type { CoreError } from "@bones/core";
import { describeError } from "../../src/ui/ErrorPanel";

describe("describeError", () => {
  it("lists each validation field error with its plain label and raw path", () => {
    const e: CoreError = {
      kind: "validation_failed",
      message: "x",
      fieldErrors: [
        { path: "lineItems", issue: "must contain at least one line item" },
        { path: "mystery", issue: "is odd" },
      ],
    };
    const d = describeError(e);
    expect(d.details).toEqual([
      "Line items (lineItems): must contain at least one line item",
      "mystery: is odd",
    ]);
  });

  it.each([
    ["disabled", "Live reading is switched off on this server."],
    ["network", "The reading service could not be reached. Check your connection and try again."],
    [
      "bad_response",
      "The reading service returned an answer this app cannot trust, so it was rejected.",
    ],
    ["upstream", "The reading service failed or refused the request. Try again later."],
  ] as const)("maps extraction_failed %s", (reason, text) => {
    expect(describeError({ kind: "extraction_failed", message: "raw", reason }).summary).toBe(text);
  });

  it("maps fixture and input errors and falls back to the message", () => {
    expect(
      describeError({ kind: "fixture_not_found", message: "m", fixturePath: "p" }).summary,
    ).toBe("The recorded receipt could not be loaded.");
    expect(describeError({ kind: "input_empty", message: "m" }).summary).toBe("The file is empty.");
    expect(
      describeError({ kind: "input_too_large", message: "m", byteLength: 2, maxBytes: 1 }).summary,
    ).toBe("The file is too large.");
    expect(describeError({ kind: "ambiguous_override", message: "own text", createdAt: "t" }).summary).toBe(
      "own text",
    );
  });
});
