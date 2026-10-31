/**
 * @deprecated NOT FOR PRODUCTION USE.
 * This is a non-production stub. It always returns a CoreError.
 * Use RecordedAdapter for demos and tests.
 */
import type { CoreError } from "../types.js";
import type { ExtractionPort, RawInput } from "./port.js";

/**
 * @deprecated NOT FOR PRODUCTION USE — this adapter is a stub only.
 * It will never call a real LLM. Inject a production adapter instead.
 */
export class LiveAdapter implements ExtractionPort {
  extract(_input: RawInput): Promise<CoreError> {
    console.warn(
      "[LiveAdapter] NOT FOR PRODUCTION USE: LiveAdapter is a stub. " +
      "It does not call any LLM. Use RecordedAdapter for demos."
    );
    return Promise.resolve({
      kind: "live_adapter_not_implemented" as const,
      message:
        "LiveAdapter is not implemented. Use RecordedAdapter for demos and tests.",
    });
  }
}
