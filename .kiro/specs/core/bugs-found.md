# Bugs Found by Property Tests

This file records every bug discovered by a fast-check property-based test during development of `packages/core`.

**Format**: one entry per bug, in the order it was found.

---

<!-- Entries will be added here as property tests run. -->
<!-- Each entry should include:
     - Property number and title
     - The exact failing counterexample from fast-check
     - Root cause analysis
     - Fix applied
-->

---

## Bug 1: `comparison` ordered operators fail on ISO date strings

**Discovered by:** Integration test 12.4 — expense signature scenario, "rejects when receipt date is before trip start"

**Failing counterexample:**
```
receiptDate: "2024-03-05", tripStart: "2024-03-10"
comparison { left: path["receiptDate"], op: "<", right: path["tripStart"] }
Expected: true (2024-03-05 < 2024-03-10)
Actual: false
```

**Root cause:**
`evaluateCondition` in `rules/ast.ts` used `Number(leftVal) < Number(rightVal)` for all ordered comparison operators (`<`, `<=`, `>`, `>=`). ISO 8601 date strings (e.g. `"2024-03-05"`) coerce to `NaN` via `Number()`, and any comparison involving `NaN` returns `false`. The `date-blocking-before` and `date-blocking-after` rules use `comparison` nodes with `<`/`>` on date strings, so they never fired.

**Fix applied:**
Introduced a `compareOrdered(a, b)` helper in `rules/ast.ts`:
- If both values coerce to finite numbers, compare numerically.
- Otherwise compare lexicographically as strings.

ISO date strings in `YYYY-MM-DD` format are lexicographically ordered, so string comparison gives the correct result.
