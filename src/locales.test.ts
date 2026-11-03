// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from './locales/en.json'

/**
 * Every translation has every English key, and no others, with the same {{values}} and <tags>.
 * English added after a translation was made shows up here by name, ready to translate.
 *
 * Plurals follow each language's own forms (Intl.PluralRules: Spanish and French have one, many
 * and other where English has one and other). A key that says {{word}} (county, municipality or
 * area) may also have _county, _municipality and _area variants, for languages whose words differ
 * in gender ("ton comté", "ta municipalité"): the code passes the kind as the i18next context.
 */
type Tree = { [key: string]: string | Tree }
const PLURAL = /_(zero|one|two|few|many|other)$/
const CONTEXT = /_(county|municipality|area)$/

const flatten = (tree: Tree, prefix = ''): Record<string, string> =>
  Object.fromEntries(Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${prefix}${key}`, value]] : Object.entries(flatten(value, `${prefix}${key}.`))))

const dir = join(__dirname, 'locales')
const languages = readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'en.json').map(f => f.replace(/\.json$/, ''))
const english = flatten(en as Tree)
const englishBases = new Set(Object.keys(english).map(k => k.replace(PLURAL, '')))
// A plural has its one and other forms side by side; "feedback.kind_other" alone is just a name.
const isPlural = (key: string) => PLURAL.test(key) && `${key.replace(PLURAL, '')}_one` in english && `${key.replace(PLURAL, '')}_other` in english
const pluralBases = new Set(Object.keys(english).filter(isPlural).map(k => k.replace(PLURAL, '')))

/** The keys a language should have: English's, with each plural in the language's own forms. */
const expectedKeys = (lang: string) => {
  const forms = new Intl.PluralRules(lang).resolvedOptions().pluralCategories
  const keys = new Set<string>()
  for (const key of Object.keys(english)) {
    if (isPlural(key)) for (const form of forms) keys.add(key.replace(PLURAL, `_${form}`))
    else keys.add(key)
  }
  return keys
}

const vars = (text: string) => [...new Set([...text.matchAll(/\{\{\s*([\w.]+)[^}]*\}\}/g)].map(m => m[1]!))].sort()
const tags = (text: string) => [...text.matchAll(/<\/?([a-z]+)\b[^>]*>/gi)].map(m => m[0]!.replace(/\s.*>/, '>')).sort()
// English says "a" or "an" before a number; other languages write their own article.
const OPTIONAL_VARS = new Set(['article'])

/** The English text a translated key stands for (a many form stands for English's other). */
const source = (key: string) => {
  const own = key.replace(CONTEXT, '')
  if (own in english) return english[own]
  return PLURAL.test(own) && pluralBases.has(own.replace(PLURAL, '')) ? english[own.replace(PLURAL, '_other')] : undefined
}

describe('translations', () => {
  it('has the languages Settings offers', () => {
    expect(languages.sort()).toEqual(['es-MX', 'fr-CA'])
  })

  describe.each(languages)('%s', (lang) => {
    const words = flatten(JSON.parse(readFileSync(join(dir, `${lang}.json`), 'utf8')) as Tree)
    const expected = expectedKeys(lang)

    it('has every English key (any listed here are new in English and need translating)', () => {
      const missing = [...expected].filter(key => !(key in words))
      expect(missing, `${lang} is missing ${missing.length} key(s)`).toEqual([])
    })

    it('has no keys English lacks', () => {
      const isContextOf = (key: string) => {
        if (!CONTEXT.test(key)) return false
        const base = key.replace(CONTEXT, '')
        return englishBases.has(base) && (english[base] ?? '').includes('{{word}}')
      }
      const extra = Object.keys(words).filter(key => !expected.has(key) && !isContextOf(key))
      expect(extra).toEqual([])
    })

    it('keeps every {{value}} and <tag> of the English', () => {
      const wrong = Object.entries(words).flatMap(([key, text]) => {
        const from = source(key)
        if (from === undefined) return []
        const want = vars(from).filter(v => !OPTIONAL_VARS.has(v))
        const have = vars(text).filter(v => !OPTIONAL_VARS.has(v))
        // A one form may write the number out ("una vez") where English shows {{count}}.
        const loose = key.endsWith('_one') && pluralBases.has(key.replace(PLURAL, ''))
        const varsOk = loose ? have.every(v => want.includes(v)) && want.filter(v => v !== 'count').every(v => have.includes(v)) : JSON.stringify(want) === JSON.stringify(have)
        const tagsOk = JSON.stringify(tags(from)) === JSON.stringify(tags(text))
        return varsOk && tagsOk ? [] : [`${key}: ${JSON.stringify(text)} (English: ${JSON.stringify(from)})`]
      })
      expect(wrong).toEqual([])
    })

    it('translates rather than copies the longer English sentences', () => {
      const copied = Object.entries(words).filter(([key, text]) => text.split(' ').length > 6 && text === source(key)).map(([key]) => key)
      expect(copied).toEqual([])
    })
  })
})
