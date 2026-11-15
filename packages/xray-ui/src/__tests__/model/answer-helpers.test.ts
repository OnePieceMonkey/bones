import { describe, expect, it } from "vitest";
import { summariseValue } from "../../model/format";
import { hasFieldLabel } from "../../model/selectors";
import type { Anatomy } from "../../types";

function anatomyWith(fieldLabels: Record<string, string>): Anatomy {
  return { bones: [], fieldLabels };
}

describe("hasFieldLabel", () => {
  const anatomy = anatomyWith({ merchant: "Merchant", empty: "" });

  it("is true for a present, non-empty label", () => {
    expect(hasFieldLabel(anatomy, "merchant")).toBe(true);
  });

  it("is false for an empty-string label", () => {
    expect(hasFieldLabel(anatomy, "empty")).toBe(false);
  });

  it("is false for an absent key", () => {
    expect(hasFieldLabel(anatomy, "missing")).toBe(false);
  });

  it.each(["constructor", "toString", "__proto__", "hasOwnProperty"])(
    "is false for the prototype key %s",
    (key) => {
      expect(hasFieldLabel(anatomy, key)).toBe(false);
    },
  );

  it("is true for an own __proto__ label", () => {
    const own = JSON.parse('{"__proto__":"Proto label"}') as Record<string, string>;
    expect(hasFieldLabel(anatomyWith(own), "__proto__")).toBe(true);
  });
});

describe("summariseValue", () => {
  it("summarises arrays whose text is JSON, singular and plural", () => {
    expect(summariseValue([], "[]")).toBe("0 items");
    expect(summariseValue([1], "[1]")).toBe("1 item");
    expect(summariseValue([1, 2, 3], "[1,2,3]")).toBe("3 items");
  });

  it("returns a custom array summary without brackets unchanged", () => {
    expect(summariseValue([1, 2, 3], "3 line items")).toBe("3 line items");
  });

  it("summarises plain objects whose text is JSON, singular and plural", () => {
    expect(summariseValue({}, "{}")).toBe("0 fields");
    expect(summariseValue({ a: 1 }, '{"a":1}')).toBe("1 field");
    expect(summariseValue({ a: 1, b: 2 }, '{"a":1,"b":2}')).toBe("2 fields");
  });

  it("summarises null-prototype objects", () => {
    const o = Object.create(null) as Record<string, number>;
    o.a = 1;
    expect(summariseValue(o, '{"a":1}')).toBe("1 field");
  });

  it("returns primitives unchanged", () => {
    expect(summariseValue("hello", "hello")).toBe("hello");
    expect(summariseValue(42, "42")).toBe("42");
    expect(summariseValue("[x]", "[x]")).toBe("[x]");
    expect(summariseValue(null, "null")).toBe("null");
    expect(summariseValue(undefined, "undefined")).toBe("undefined");
  });

  it("returns Date and class instances unchanged", () => {
    const d = new Date(0);
    const dText = JSON.stringify(d);
    expect(summariseValue(d, dText)).toBe(dText);
    class Box {
      a = 1;
    }
    expect(summariseValue(new Box(), '{"a":1}')).toBe('{"a":1}');
  });

  it("returns formatted and never throws when inspecting the value throws", () => {
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("boom");
        },
        ownKeys() {
          throw new Error("boom");
        },
      },
    );
    expect(() => summariseValue(hostile, '{"a":1}')).not.toThrow();
    expect(summariseValue(hostile, '{"a":1}')).toBe('{"a":1}');

    const throwingGetter = {
      get a(): number {
        throw new Error("boom");
      },
    };
    expect(() => summariseValue(throwingGetter, "{...}")).not.toThrow();
  });
});
