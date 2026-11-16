import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Why this guard exists: the new look needs bundled images, so the old blanket
// ban on url() is gone. This guard replaces it. Every CSS url() and every image
// import must resolve to a file inside src/assets/. Remote and data targets fail.
// Exactly one font file may live outside src/assets/ (see ALLOWED_FONT).

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, "../..");
const assetsDir = join(srcDir, "assets");

const ALLOWED_FONT = {
  file: "styles/fonts.css",
  target: "@fontsource/cormorant-sc/files/cormorant-sc-latin-700-normal.woff2",
};

const IMAGE_EXT = /\.(webp|png|jpe?g|gif|svg|avif)$/i;

export interface SourceFile {
  /** Path relative to src/, with forward slashes. */
  path: string;
  content: string;
}

export interface Violation {
  path: string;
  line: number;
  target: string;
  reason: string;
}

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function checkTarget(file: SourceFile, target: string, line: number, isImport: boolean): Violation | null {
  const t = target.trim();
  const fail = (reason: string): Violation => ({ path: file.path, line, target: t, reason });
  if (!isImport && t.startsWith("#")) return null; // in-document fragment, e.g. url(#id)
  if (/^(https?:)?\/\//i.test(t) || /^data:/i.test(t)) return fail("remote or data URL");
  if (
    !isImport &&
    file.path === ALLOWED_FONT.file &&
    t === ALLOWED_FONT.target
  ) {
    return null;
  }
  const fromDir = dirname(join(srcDir, file.path));
  const resolved = resolve(fromDir, t);
  const rel = relative(assetsDir, resolved);
  if (rel === "" || rel.startsWith("..") || resolve(assetsDir, rel) !== resolved) {
    return fail("outside src/assets/");
  }
  return null;
}

/** Scans CSS url(...) and image imports. Pure: works on the given contents. */
export function scanAssetRefs(files: SourceFile[]): Violation[] {
  const out: Violation[] = [];
  for (const file of files) {
    const isCss = file.path.endsWith(".css");
    if (isCss) {
      const text = file.content.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
      const re = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]*))\s*\)/gi;
      for (const m of text.matchAll(re)) {
        const target = m[1] ?? m[2] ?? m[3] ?? "";
        const v = checkTarget(file, target, lineOf(text, m.index ?? 0), false);
        if (v) out.push(v);
      }
    } else {
      const re = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;
      for (const m of file.content.matchAll(re)) {
        const target = m[1] ?? "";
        if (!IMAGE_EXT.test(target.split(/[?#]/)[0] ?? "")) continue;
        const v = checkTarget(file, target, lineOf(file.content, m.index ?? 0), true);
        if (v) out.push(v);
      }
    }
  }
  return out;
}

export function formatViolation(v: Violation): string {
  return `${v.path}:${v.line}: ${v.reason}: ${v.target}`;
}

function listSource(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "__tests__") continue;
      out.push(...listSource(full));
    } else if (/\.(css|ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe("assets guard", () => {
  it("every CSS url() and image import under src/ resolves inside src/assets/", () => {
    const files = listSource(srcDir).map((full) => ({
      path: relative(srcDir, full).split(sep).join("/"),
      content: readFileSync(full, "utf8"),
    }));
    expect(files.length).toBeGreaterThan(0);
    expect(scanAssetRefs(files).map(formatViolation)).toEqual([]);
  });

  describe("scanAssetRefs", () => {
    it("accepts targets inside src/assets/", () => {
      const css = { path: "styles/stage.css", content: '.a { background: url("../assets/film.webp"); }' };
      const ts = { path: "assets/index.ts", content: 'export { default as x } from "./film.webp";' };
      expect(scanAssetRefs([css, ts])).toEqual([]);
    });

    it("rejects a CSS url() that points outside src/assets/ and names file and line", () => {
      const css = { path: "styles/stage.css", content: ".a {}\n.b { background: url(../other/x.webp); }" };
      const [v] = scanAssetRefs([css]);
      expect(v && formatViolation(v)).toBe("styles/stage.css:2: outside src/assets/: ../other/x.webp");
    });

    it("rejects an image import outside src/assets/", () => {
      const ts = { path: "components/A.tsx", content: 'import x from "../pics/a.png";' };
      expect(scanAssetRefs([ts])).toHaveLength(1);
    });

    it("rejects http, https and // URLs", () => {
      const css = {
        path: "styles/a.css",
        content: 'a{background:url(http://x.test/a.webp)}b{background:url("https://x.test/b.webp")}c{background:url(//x.test/c.webp)}',
      };
      const vs = scanAssetRefs([css]);
      expect(vs).toHaveLength(3);
      expect(vs.every((v) => v.reason === "remote or data URL")).toBe(true);
    });

    it("rejects data: URLs", () => {
      const css = { path: "styles/a.css", content: "a{background:url(data:image/png;base64,AAAA)}" };
      expect(scanAssetRefs([css])).toHaveLength(1);
    });

    it("allows only the one named font file, only in styles/fonts.css", () => {
      const ok = {
        path: "styles/fonts.css",
        content: `@font-face{src:url("${ALLOWED_FONT.target}") format("woff2")}`,
      };
      const otherFont = {
        path: "styles/fonts.css",
        content: '@font-face{src:url("@fontsource/cormorant-sc/files/cormorant-sc-latin-700-normal.woff")}',
      };
      const wrongFile = { path: "styles/other.css", content: `a{src:url("${ALLOWED_FONT.target}")}` };
      expect(scanAssetRefs([ok])).toEqual([]);
      expect(scanAssetRefs([otherFont])).toHaveLength(1);
      expect(scanAssetRefs([wrongFile])).toHaveLength(1);
    });

    it("ignores url() inside CSS comments and in-document fragments", () => {
      const css = { path: "styles/a.css", content: "/* url(http://x.test/a.png) */ a{filter:url(#f)}" };
      expect(scanAssetRefs([css])).toEqual([]);
    });
  });
});
