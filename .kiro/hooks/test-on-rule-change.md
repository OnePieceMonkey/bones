---
name: test-on-rule-change
description: When a JSON file is saved under rules/ or packages/core/test-fixtures/, run the core test suite and report which rule outcomes changed.
triggers:
  - type: file_save
    pattern: "rules/**/*.json"
  - type: file_save
    pattern: "packages/core/test-fixtures/**/*.json"
---

A JSON file that affects rule evaluation was just saved. Run the full @bones/core test suite and report any changes to rule outcomes.

Steps:
1. Run `pnpm --filter @bones/core test --reporter=verbose 2>&1` from the workspace root.
2. Report the overall result (pass / fail).
3. If any test changed status (newly failing or newly passing), list those tests by name.
4. If the integration test "expense signature scenario" ran, extract the decision.result and decision.amountCents values from the test output and report them.
5. Do NOT modify any files. Report only.
