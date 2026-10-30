# Tech

- TypeScript everywhere, strict mode. pnpm workspace.

- Web apps: React + Vite. Serverless functions only for the LLM call.

- Rules engine: our own small pure TypeScript evaluator over a restricted JSON AST. No eval, no arbitrary code, no I/O, no randomness, no current time inside the kernel.

- Validation: zod. Money: integer cents only.

- Tests: Vitest + fast-check property-based tests.

- LLM only in the extraction layer, behind one interface. A "recorded" mode replays stored LLM outputs so the demo works without an API key.

- Animations: CSS + small canvas layer. Respect prefers-reduced-motion. Sound off by default.

- Never put API keys in the client.
