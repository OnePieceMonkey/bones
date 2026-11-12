---
name: steering-compliance
description: When a source file is saved in packages/core/src or packages/xray-ui/src, check it against the steering files and report any violations. Do not modify files.
triggers:
  - type: file_save
    pattern: "packages/core/src/**/*.ts"
  - type: file_save
    pattern: "packages/xray-ui/src/**/*.ts"
  - type: file_save
    pattern: "packages/xray-ui/src/**/*.tsx"
---

A source file was just saved. Check it against the three steering files and report any violations. Do NOT modify the file or any other file.

Steering rules to enforce:

**1. Domain isolation (packages/core/src only — from structure.md and product.md)**
Scan the saved file for these forbidden domain-specific identifiers as whole words (case-insensitive, word-boundary match): expense, receipt, alcohol, meal, trip, suspect, case.
Report each match with its line number and the matched term.

**2. Dr. Bones text must come from rule templates, never from LLM judgments (packages/xray-ui/src — from product.md)**
Flag any pattern suggesting the Dr. Bones chat panel generates or rephrases text via an LLM call: calling an AI completion API, using a prompt template to produce explanations, or building natural-language strings outside of messageTemplate interpolation.
Legitimate patterns: rendering ruleOutcome.renderedMessage, reading from trace.ruleOutcomes, interpolating messageTemplate slots.
Violations: any fetch/axios/SDK call to an LLM endpoint, any string concatenation building a user-facing explanation without referencing a rule template field.

**3. No API keys in client code (both packages — from tech.md)**
Scan for hardcoded secrets: strings matching sk-, Bearer, api_key, apiKey, API_KEY, secret, or token assigned directly to a variable or object literal (not a type annotation).
Also flag any process.env or import.meta.env reference whose key name suggests an LLM or third-party API key (e.g. OPENAI_API_KEY, ANTHROPIC_API_KEY).
Do NOT flag environment variable reads that are clearly inside a server-side file (path contains /api/ or /functions/).

For each violation found, report:
- File path
- Line number
- Violated rule (1, 2, or 3)
- The offending line content

If no violations are found, report: ✓ No steering violations found in <filename>.
