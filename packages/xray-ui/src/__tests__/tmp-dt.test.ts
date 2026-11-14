import { it, expect } from "vitest";
import { buildTrace, VERSIONS } from "/Users/patrickwerle/Projekte/bones/packages/xray-ui/demo/demoTrace";
it("x", () => { for (const v of VERSIONS) { const t = buildTrace(v); expect(t.result).toBe("partially_approved"); expect(t.amountCents).toBe(4150); } });
