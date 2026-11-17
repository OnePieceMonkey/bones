import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Fake secret placed in the build environment. It must never appear in any output file. */
export const CANARY_KEY = "sk-canary-q7Zx3Lm9Rt2VbN8cKd5HwY1pAe6UfJ0g";

const CANARY_ENV: Record<string, string> = {
  ANTHROPIC_API_KEY: CANARY_KEY,
  LIVE_EXTRACTION: "on",
  EXTRACTION_MODEL: "canary-model",
};

export interface BuildResult {
  /** Absolute path of the temporary output directory. */
  outDir: string;
  /** Absolute paths of every file below outDir. */
  files: string[];
}

export function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

let cached: Promise<BuildResult> | undefined;

/**
 * Builds the app once per process with canary server variables set, into an os temp dir.
 * The environment is restored afterwards. Nothing is written to disk besides the temp outDir.
 */
export function buildOnce(): Promise<BuildResult> {
  cached ??= (async () => {
    const outDir = mkdtempSync(join(tmpdir(), "bones-expense-dist-"));
    const saved = new Map<string, string | undefined>();
    for (const [key, value] of Object.entries(CANARY_ENV)) {
      saved.set(key, process.env[key]);
      process.env[key] = value;
    }
    try {
      await build({
        root: APP_ROOT,
        logLevel: "silent",
        mode: "production",
        build: { outDir, emptyOutDir: true, sourcemap: false },
      });
    } finally {
      for (const [key, value] of saved) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
    return { outDir, files: listFiles(outDir) };
  })();
  return cached;
}

/** Removes the temp build output. Safe to call when no build ran. */
export async function cleanupBuild(): Promise<void> {
  if (!cached) return;
  const result = await cached.catch(() => undefined);
  cached = undefined;
  if (result) rmSync(result.outDir, { recursive: true, force: true });
}
