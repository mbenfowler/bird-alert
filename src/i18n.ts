import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'

/**
 * Every word the app shows comes from a catalog (src/locales), so a language is added by adding
 * its file here. Only English exists yet; Mexican Spanish and Canadian French come next.
 *
 * Two settings travel apart. Bird names follow the person's chosen locale for every language
 * eBird has (the server sends them already named), while the rest of the text follows the closest
 * catalog: until a catalog exists, the app stays in English. Dates and numbers are formatted for
 * whichever language the text is in, so a sentence never mixes two.
 */
export const catalogs = { en: { translation: en } }
export type UiLanguage = keyof typeof catalogs

// A catalog is one of the files above, or one added while the app runs (the end-to-end tests).
const added = new Set<string>()
const hasCatalog = (lang: string): lang is UiLanguage => Object.prototype.hasOwnProperty.call(catalogs, lang) || added.has(lang)

/** The catalog for a locale: exact ('fr-CA'), else its language ('fr'), else English. */
export const uiLanguageFor = (locale?: string | null): UiLanguage => {
  if (!locale) return 'en'
  if (hasCatalog(locale)) return locale
  const base = locale.split('-')[0].toLowerCase()
  return hasCatalog(base) ? base : 'en'
}

const browserLocale = () => (typeof navigator !== 'undefined' && navigator.language) || 'en-US'

let chosen: string | null = null

/**
 * The locale dates and numbers are written in: the person's own (or their browser's) when its
 * language has a catalog, so an English page reads "Oct 24" in the US and "24 Oct" in Britain;
 * otherwise US English, to match the English text around it.
 */
export const formatLocale = () => {
  const wanted = chosen || browserLocale()
  const language = i18n.language || 'en'
  if (wanted.split('-')[0].toLowerCase() === language.split('-')[0]) return wanted
  return language === 'en' ? 'en-US' : language
}

/**
 * Languages bird names come in besides English (GET /api/ebird/name-locales lists them). A browser
 * in another variety of one of these languages gets the nearest ("es-ES" names in Mexican Spanish).
 */
const NAME_LOCALES = ['es-MX', 'fr-CA']

const knownLocale = (locale: string) => {
  if (/^en\b/i.test(locale)) return 'en'
  if (NAME_LOCALES.includes(locale)) return locale
  const base = locale.split('-')[0].toLowerCase()
  return NAME_LOCALES.find(l => l.toLowerCase().startsWith(`${base}-`)) ?? null
}

/**
 * The locale bird names are asked for in, or null for English: the person's chosen one, else
 * their browser's nearest. Sent as ?locale= (the server's cache keeps each language apart).
 */
export const nameLocale = (): string | null => {
  const wanted = chosen ? (knownLocale(chosen) ?? chosen) : knownLocale(browserLocale())
  return !wanted || wanted === 'en' ? null : wanted
}

/** What a new account starts with: the browser's language when it's one the app knows, else nothing. */
export const signupLocale = () => knownLocale(browserLocale()) ?? undefined

/**
 * Notes the person's chosen locale (null: their browser's). Pure and cheap, so the app calls it
 * while rendering: everything rendered after it asks for bird names in that language.
 */
export const noteLocale = (locale: string | null | undefined) => { chosen = locale || null }

/** Puts the page's words in the catalog nearest that locale, and says so to the page. */
export const applyLocale = async (locale: string | null | undefined) => {
  noteLocale(locale)
  const lang = uiLanguageFor(chosen || browserLocale())
  if (typeof document !== 'undefined') document.documentElement.lang = chosen || lang
  if (i18n.language !== lang) await i18n.changeLanguage(lang)
  // The tab's title too (index.html carries the English one for link previews, which run no script).
  if (typeof document !== 'undefined') document.title = i18n.t('app.title')
}

void i18n.use(initReactI18next).init({
  resources: catalogs,
  lng: uiLanguageFor(browserLocale()),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
  react: { useSuspense: false }
})

export const t = i18n.t.bind(i18n)

// For the end-to-end tests: a second catalog can be added and switched to while the app runs.
const addCatalog = (lang: string, words: Record<string, unknown>) => { i18n.addResourceBundle(lang, 'translation', words, true, true); added.add(lang) }
if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __addCatalog: addCatalog, __applyLocale: applyLocale })
export default i18n

// Dates and numbers, in the active language's own style.

const parseDay = (day: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : new Date(day)
}

/** "Oct 24" */
export const monthDay = (date: Date | string) =>
  (typeof date === 'string' ? parseDay(date) : date).toLocaleDateString(formatLocale(), { month: 'short', day: 'numeric' })

/** "Oct 24, 2026" */
export const monthDayYear = (date: Date | string) =>
  (typeof date === 'string' ? parseDay(date) : date).toLocaleDateString(formatLocale(), { month: 'short', day: 'numeric', year: 'numeric' })

/** "Oct 2026" */
export const monthYear = (date: Date | string) =>
  (typeof date === 'string' ? parseDay(date) : date).toLocaleDateString(formatLocale(), { month: 'short', year: 'numeric' })

/** "Nov 12 – 15", "Nov 28 – Dec 3": a trip's days, both included. */
export const dateRange = (from: string, to: string) => {
  const format = new Intl.DateTimeFormat(formatLocale(), { month: 'short', day: 'numeric' }) as Intl.DateTimeFormat & { formatRange?: (a: Date, b: Date) => string }
  if (from === to) return format.format(parseDay(from))
  return format.formatRange ? format.formatRange(parseDay(from), parseDay(to)) : `${format.format(parseDay(from))} – ${format.format(parseDay(to))}`
}

/** Whole days from today to a YYYY-MM-DD day (0 today, 1 tomorrow). */
export const daysUntil = (day: string) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)
  return Math.round((parseDay(day).getTime() - today.getTime()) / 86_400_000)
}

/** "8:10 AM" */
export const clockTime = (date: Date) => date.toLocaleTimeString(formatLocale(), { hour: 'numeric', minute: '2-digit' })

/** "10 PM" for 22 */
export const hourLabel = (hour: number) => new Date(2000, 0, 1, hour).toLocaleTimeString(formatLocale(), { hour: 'numeric' })

/** "Jan" for 1 */
export const shortMonth = (month: number) => new Date(2000, month - 1, 15).toLocaleDateString(formatLocale(), { month: 'short' })

/** "1,234" */
export const number = (n: number, options?: Intl.NumberFormatOptions) => n.toLocaleString(formatLocale(), options)
