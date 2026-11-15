import fc from "fast-check";

/** Real ISO calendar dates from 2000-01-01 to 2035-12-31 (UTC). */
export const arbIsoDate: fc.Arbitrary<string> = fc
  .date({
    min: new Date("2000-01-01T00:00:00Z"),
    max: new Date("2035-12-31T00:00:00Z"),
    noInvalidDate: true,
  })
  .map((d) => d.toISOString().slice(0, 10));
