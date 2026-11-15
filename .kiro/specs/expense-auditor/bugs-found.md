# Bugs found by property tests: expense-auditor

Bugs found by the expense-auditor property tests. Fix the implementation, not the property.

Format: `Property N | Counterexample | Root cause | Fix`

Property 6 | Counterexample: [100,"",{}] (seed 355815302, shrunk 3 times): replayed.inputHash "c"×64 !== original "a"×64 | replay() rehashed the encoded rawModelOutput instead of keeping trace.inputHash | createTrace accepts { inputHash }; replay passes the original, hashes nothing

Full write-up: `.kiro/specs/core/bugs-found.md`, Bug 2 (includes the verbatim failing output).
