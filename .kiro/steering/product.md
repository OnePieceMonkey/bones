# Product: Bones

Bones is an open-source skeleton for AI apps whose decisions can be audited.

Core principle: the LLM never decides. The LLM only reads messy input (photo, PDF, text) and proposes structured fields. Versioned, declarative rules make every decision. Every decision is stored as a trace that can be replayed.

The skeleton has five parts:

1. Extraction: LLM output must match a typed schema, or it is rejected.

2. Rules: declarative, versioned rule sets (v1, v2, v3). Same input + same rule set version = same result, always.

3. Trace: per decision we store proposed fields, confidence, source locations, validated fields, every rule outcome with evidence, and the result.

4. Human override: a person can overrule a decision; the override is itself traced and never edits the original.

5. X-ray UI: a reusable view that shows any domain as a glowing skeleton. Each bone is one rule. A failed rule is a fractured bone.

Two apps are built on the same skeleton, in separate folders:

- apps/expense-auditor: a receipt photo is read by the LLM, company expense rules decide (approved / partially approved / rejected).

- apps/case-files: a ghost detective game. The LLM writes a case, a solver proves exactly one suspect can be convicted; unfair cases are rejected. Each suspect is a skeleton, each statement is a bone, a lie is a fracture.

"Dr. Bones" explains decisions in a chat panel, typed out like text messages. His text comes from rule message templates and the trace, never from an LLM judgment.

Visual style: 1950s radiology. Dark lightbox with cyan glow, brushed-metal frame around the whole screen, control strip bottom left with a RULE VERSION rotary knob (v1/v2/v3, replays the decision with that rule set version), an AI READ CONFIDENCE needle gauge and an X-RAY toggle switch. The document hangs as an X-ray film with clips. Heartbeat (ECG) line across the skeleton spikes red at a fracture. Fracture: red glow, splinters, pulse ring, the AI answer card cracks like glass, stamp "OVERRULED BY RULE".

Audience: developers and teams who need explainable AI decisions. Product language: English.
