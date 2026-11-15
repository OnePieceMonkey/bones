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

---

## Bug 2: replay hashed the encoded rawModelOutput instead of keeping the original inputHash

**Discovered by:** the strengthened replay property test, `packages/core/src/__tests__/properties/replay-round-trip.test.ts` (Property 2). Found while writing the expense-auditor spec, by running the test against the unfixed code before the fix.

**Failing counterexample** (verbatim from the unfixed run):
```
Property failed after 1 tests
{ seed: 355815302, path: "0:0:0:0", endOnFailure: true }
Counterexample: [100,"",{}]
Shrunk 3 time(s)
Got AssertionError: expected 'ccccccccccccccccccccccccccccccccccccc…' to be 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa…' // Object.is equality
    at /Users/patrickwerle/Projekte/bones/packages/core/src/__tests__/properties/replay-round-trip.test.ts:113:38

 ❯ src/__tests__/properties/replay-round-trip.test.ts:113:38
    111|           expect(isCoreError(replayed)).toBe(false);
    112|           if (isCoreError(replayed)) return;
    113|           expect(replayed.inputHash).toBe(trace.inputHash);
       |                                      ^
    114|           expect(hashCalls).toBe(0);
    115|           expect(replayed.decisionId).toBe("replay-id");
```
(Long stack frames omitted.) The original trace had `inputHash` "a"×64. The replayed trace got "c"×64, because replay hashed the model output again.

**Root cause:**
`replay()` passed `TextEncoder(trace.rawModelOutput)` to `createTrace`. `createTrace` hashes whatever bytes it receives with the port hasher, so the replayed trace's `inputHash` was a hash of the model output, not of the original input. This violated core requirement 6.2 (extraction fields, including `inputHash`, are copied without modification). The earlier Property 2 compared only `result` and `amountCents`, so it did not catch this.

**Fix applied:**
`createTrace` takes an optional `{ inputHash }` argument. `replay()` passes `trace.inputHash`, never calls the hasher, and returns `invalid_replay_arguments` with `missingField: "inputHash"` when the stored `inputHash` is empty. Property 2 now also asserts that `inputHash` is kept, the hasher is called 0 times, and the extraction fields are unchanged.
