import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const STYLES_DIR = join(here, "..", "..", "styles");

export interface StyleFile {
  readonly file: string;
  readonly source: string;
}
export interface Declaration {
  readonly file: string;
  readonly selector: string;
  readonly property: string;
  readonly value: string;
}

/** All `styles/*.css` files, sorted by name. */
export function readStyles(): StyleFile[] {
  return readdirSync(STYLES_DIR)
    .filter((f) => f.endsWith(".css"))
    .sort()
    .map((file) => ({ file, source: readFileSync(join(STYLES_DIR, file), "utf8") }));
}

/** Declaration block of the first rule in `source` whose selector is exactly `selector`. */
export function block(source: string, selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`, "m").exec(source);
  return m?.[1] ?? "";
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

interface Rule {
  readonly selectors: string[];
  readonly body: string;
}

/** Flat list of style rules (at-rule wrappers such as @media are entered, not kept). */
export function parseRules(source: string): Rule[] {
  const text = stripComments(source);
  const rules: Rule[] = [];
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "{") {
      const prelude = text.slice(start, i).trim();
      const end = findClose(text, i);
      const inner = text.slice(i + 1, end);
      if (prelude.startsWith("@")) {
        if (inner.includes("{")) rules.push(...parseRules(inner));
        else rules.push({ selectors: [prelude], body: inner });
      } else {
        rules.push({ selectors: prelude.split(",").map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean), body: inner });
      }
      i = end + 1;
      start = i;
    } else {
      i += 1;
    }
  }
  return rules;
}

function findClose(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return text.length;
}

function parseDeclarations(body: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const part of body.split(/;(?![^(]*\))/)) {
    const idx = part.indexOf(":");
    if (idx < 0) continue;
    const property = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (property && value) out.push([property, value]);
  }
  return out;
}

/** Every property and value of every rule, with file and selector, in file order. */
export function declarations(files: StyleFile[] = readStyles()): Declaration[] {
  const out: Declaration[] = [];
  for (const { file, source } of files) {
    for (const rule of parseRules(source)) {
      const decls = parseDeclarations(rule.body);
      for (const selector of rule.selectors) {
        for (const [property, value] of decls) out.push({ file, selector, property, value });
      }
    }
  }
  return out;
}

/** Merge every block whose selector list contains `selector`, in file order (later wins). */
export function mergedDeclarations(selector: string, files: StyleFile[] = readStyles()): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const d of declarations(files)) {
    if (d.selector === selector) merged[d.property] = d.value;
  }
  return merged;
}
