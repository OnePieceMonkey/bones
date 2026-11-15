import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { RecordedAdapter } from "@bones/core/node";
import { RecordedSampleAdapter } from "../../src/extraction/RecordedSampleAdapter";
import { SAMPLES, SAMPLE_IDS } from "../../src/extraction/samples";

const dir = mkdtempSync(join(tmpdir(), "bones-parity-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("RecordedSampleAdapter parity with Core RecordedAdapter", () => {
  for (const id of SAMPLE_IDS) {
    it(`returns the same extraction for ${id}`, async () => {
      const sample = SAMPLES.find((s) => (s as { id?: string }).id === id) as { extraction: unknown };
      const path = join(dir, `${id}.json`);
      writeFileSync(path, JSON.stringify(sample.extraction), "utf8");

      const fromCore = await new RecordedAdapter(path).extract("x");
      const fromApp = await new RecordedSampleAdapter(id).extract("x");
      expect(fromApp).toEqual(fromCore);
    });
  }
});
