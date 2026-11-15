import { describe, it, expect } from "vitest";
import { formatMoney, renderTemplate, evaluate, isCoreError } from "../index.js";
import type { Rule, RuleSet, Decision } from "../index.js";

describe("formatMoney", () => {
  const cases: Array<[number, string]> = [
    [48000, "$480.00"],
    [4150, "$41.50"],
    [123456789, "$1,234,567.89"],
    [-5, "-$0.05"],
    [0, "$0.00"],
  ];
  for (const [cents, expected] of cases) {
    it(`${cents} -> ${expected}`, () => {
      expect(formatMoney(cents, "$")).toBe(expected);
    });
  }
  it("uses a custom symbol", () => {
    expect(formatMoney(48000, "kr")).toBe("kr480.00");
  });
});

describe("renderTemplate", () => {
  const fields = { claimedTotalCents: 48000, s: "text", f: 1.5, b: true, o: { x: 1 }, a: [1, 2] };

  it("money filter renders dollars, spaced and compact forms equal", () => {
    const spaced = renderTemplate("{{ claimedTotalCents | money }}", fields);
    expect(spaced).toBe("$480.00");
    expect(renderTemplate("{{claimedTotalCents|money}}", fields)).toBe(spaced);
  });

  it("renders string, float, boolean, object and array values plainly", () => {
    expect(renderTemplate("{{s}}", fields)).toBe("text");
    expect(renderTemplate("{{f}}", fields)).toBe("1.5");
    expect(renderTemplate("{{b}}", fields)).toBe("true");
    expect(renderTemplate("{{o}}", fields)).toBe(String(fields.o));
    expect(renderTemplate("{{a}}", fields)).toBe("1,2");
  });

  it("renders money filter on non-integer values plainly", () => {
    expect(renderTemplate("{{f | money}}", fields)).toBe("1.5");
    expect(renderTemplate("{{s | money}}", fields)).toBe("text");
  });

  it("renders a missing path as empty string", () => {
    expect(renderTemplate("a{{nope}}b{{o.y.z | money}}c", fields)).toBe("abc");
  });

  it("renders unknown filter and chained filters plainly", () => {
    expect(renderTemplate("{{claimedTotalCents | upper}}", fields)).toBe("48000");
    expect(renderTemplate("{{claimedTotalCents|money|x}}", fields)).toBe("48000");
  });

  it("uses a custom symbol", () => {
    expect(renderTemplate("{{claimedTotalCents | money}}", fields, "kr")).toBe("kr480.00");
  });

  it("does not interpret $& in a value", () => {
    expect(renderTemplate("<{{s}}>", { s: "a$&b$1$$" })).toBe("<a$&b$1$$>");
  });
});

describe("formatMoney via evaluate", () => {
  const rule: Rule = {
    id: "limit",
    version: "1.0.0",
    effect: "blocking",
    condition: {
      kind: "comparison",
      left: { kind: "path", segments: ["claimedTotalCents"] },
      op: ">",
      right: { kind: "literal", value: 10000 },
    },
    effectConfig: {},
    messageTemplate: "Claimed {{ claimedTotalCents | money }} is over the limit.",
  };
  const catalog = new Map([["limit@1.0.0", rule]]);
  const run = (ruleSet: RuleSet): Decision => {
    const d = evaluate({ claimedTotalCents: 48000 }, ruleSet, catalog, [
      { name: "total", claimedCents: 48000 },
    ]);
    if (isCoreError(d)) throw new Error(d.message);
    return d;
  };
  const base: RuleSet = {
    id: "s",
    version: "1.0.0",
    rules: [{ ruleId: "limit", ruleVersion: "1.0.0" }],
  };

  it("renders the default dollar symbol in renderedMessage", () => {
    expect(run(base).ruleOutcomes[0]?.renderedMessage).toBe("Claimed $480.00 is over the limit.");
  });

  it("uses the rule set currencySymbol", () => {
    expect(run({ ...base, currencySymbol: "kr" }).ruleOutcomes[0]?.renderedMessage).toBe(
      "Claimed kr480.00 is over the limit.",
    );
  });
});
