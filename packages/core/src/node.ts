/**
 * Node-only entry point (`@bones/core/node`).
 * Holds adapters that need Node built-ins such as `node:fs`. Keep them out of
 * `src/index.ts`, because browser bundlers cannot resolve Node built-ins.
 */
export { RecordedAdapter } from "./extraction/recorded.js";
