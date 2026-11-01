// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanAll } from '../scripts/i18nScan.mjs'
import en from './locales/en.json'

/**
 * The i18n backbone stays whole: no new text written straight into a page, and every key the code
 * asks for is in the English catalog (so a translator's file has the full list to work from).
 */
describe('i18n', () => {
  it('has no user-facing text written straight into JSX', () => {
    const found = scanAll('src').map(f => `${f.file}:${f.line} ${f.text}`)
    expect(found, 'Put these in src/locales/en.json and use t() or <Trans>').toEqual([])
  })

  it('has every key the code uses in the English catalog', () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.(ts|tsx)$/.test(name) && !name.includes('.test.')) files.push(path)
      }
    }
    walk('src')
    const used = new Set<string>()
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) used.add(m[1]!)
      for (const m of src.matchAll(/i18nKey=(?:'([^']+)'|\{([^}]+)\})/g)) {
        if (m[1]) used.add(m[1])
        for (const k of (m[2] ?? '').matchAll(/'([a-zA-Z0-9_]+\.[a-zA-Z0-9_.]+)'/g)) used.add(k[1]!)
      }
    }
    const has = (key: string) => {
      const parts = key.split('.')
      const last = parts.pop()!
      let node: unknown = en
      for (const part of parts) node = (node as Record<string, unknown> | undefined)?.[part]
      const leaf = node as Record<string, unknown> | undefined
      return Boolean(leaf && (last in leaf || `${last}_one` in leaf || `${last}_other` in leaf))
    }
    expect([...used].filter(key => !has(key))).toEqual([])
    expect(used.size).toBeGreaterThan(300)
  })
})
