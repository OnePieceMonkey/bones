import { readFile } from "node:fs/promises";
import type { ExtractionResult, CoreError } from "../types.js";
import type { ExtractionPort, RawInput } from "./port.js";
import { guardInput } from "./port.js";

/**
 * An ExtractionPort adapter that replays stored JSON fixture files.
 * Use this for demos and tests — it never calls a real LLM.
 */
export class RecordedAdapter implements ExtractionPort {
  constructor(private readonly fixturePath: string) {}

  async extract(input: RawInput): Promise<ExtractionResult | CoreError> {
    const guard = guardInput(input);
    if (guard !== null) return guard;

    let raw: string;
    try {
      raw = await readFile(this.fixturePath, "utf-8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        return {
          kind: "fixture_not_found",
          message: `Fixture file not found: ${this.fixturePath}`,
          fixturePath: this.fixturePath,
        };
      }
      return {
        kind: "fixture_invalid",
        message: `Failed to read fixture file: ${this.fixturePath}`,
        fixturePath: this.fixturePath,
        parseError: String(e),
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return {
        kind: "fixture_invalid",
        message: `Fixture file contains invalid JSON: ${this.fixturePath}`,
        fixturePath: this.fixturePath,
        parseError: String(e),
      };
    }

    // Return the stored ExtractionResult exactly as-is, without transformation.
    return parsed as ExtractionResult;
  }
}
