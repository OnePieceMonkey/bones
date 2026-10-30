# Structure

- packages/core: extraction port, validation, rules engine, trace, replay, override. No UI, no domain-specific logic.

- packages/xray-ui: reusable React components (lightbox, skeleton, bone, fracture, ECG line, Dr. Bones chat, control strip).

- apps/expense-auditor and apps/case-files: the two apps. They never import from each other.

- rules/: versioned rule files per app.

- design/: concept mockups (reference only).

- .kiro/: specs, steering, hooks. Always tracked in git.

```
