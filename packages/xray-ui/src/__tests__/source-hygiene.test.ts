import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const srcDir = join(here, '..')
const pkgPath = join(srcDir, '..', 'package.json')

function listFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      // src/assets/ holds binary images (webp). They must not be read as UTF-8 text.
      // Every text file elsewhere under src/ is still scanned with all patterns.
      if (name === '__tests__' || (name === 'assets' && dir === srcDir)) continue
      out.push(...listFiles(full))
    } else {
      out.push(full)
    }
  }
  return out
}

const forbidden: Array<[string, RegExp]> = [
  ['Math.random', /Math\.random/],
  ['Date.now', /Date\.now/],
  ['new Date(', /new Date\(/],
  ['fetch(', /\bfetch\(/],
  ['XMLHttpRequest', /XMLHttpRequest/],
  ['WebSocket', /WebSocket/],
  ['<canvas', /<canvas/],
  ['getContext(', /getContext\(/],
  ['new Audio', /new Audio/],
  ['AudioContext', /AudioContext/],
  ['api key', /api[_-]?key/i],
  ['openai import', /(?:from\s+|import\s*\(?\s*|require\(\s*)['"]openai(?:\/[^'"]*)?['"]/],
  ['anthropic import', /(?:from\s+|import\s*\(?\s*|require\(\s*)['"][^'"]*anthropic[^'"]*['"]/],
]

describe('source hygiene', () => {
  const files = listFiles(srcDir)

  it('scans at least one source file', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(forbidden)('src contains no %s', (_label, re) => {
    const hits = files
      .filter((f) => re.test(readFileSync(f, 'utf8')))
      .map((f) => relative(srcDir, f))
    expect(hits).toEqual([])
  })

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
    peerDependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }

  it('declares react and react-dom as peerDependencies', () => {
    expect(pkg.peerDependencies).toHaveProperty('react')
    expect(pkg.peerDependencies).toHaveProperty('react-dom')
  })

  it('pins devDependencies to exact versions', () => {
    const bad = Object.entries(pkg.devDependencies ?? {}).filter(([, v]) => /[\^~]/.test(v))
    expect(bad).toEqual([])
  })
})
