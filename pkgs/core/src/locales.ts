import { REVIEW } from './review.ts'

/** One language we ship: its tag, its name in its own script, and its writing direction. */
export interface Locale {
  /** BCP-47, canonical (`Intl.getCanonicalLocales` returns it unchanged). */
  code: string
  /** The name a reader of this language recognises — never a flag. */
  name: string
  englishName: string
  dir: 'ltr' | 'rtl'
  /**
   * Machine-translated and waiting for a native reader (`catalogs/review.json`).
   * Still served by code — a person who chose it keeps it — but `LanguagePicker`
   * does not offer it and a browser's language does not select it.
   */
  review: boolean
}

/**
 * Every locale the Hanzo ecosystem ships. THE registry: the picker offers it (less what
 * waits for review, `review.ts`), `resolve`
 * negotiates against it, the tools fill and gate it, and `catalogs/` holds one file per
 * entry.
 *
 * Order is the picker's (by English name) and it is also a tiebreak: where a request
 * names a language and script but no region we ship, `resolve` takes the first match,
 * so `es-419` precedes `es-ES` (`es-MX` reads Latin-American Spanish) and `zh-Hans`
 * precedes `zh-Hant`.
 *
 * To add one: append here, add its loader in `loaders.ts`, generate its catalog, ship.
 */
const registry = [
  { code: 'am', name: 'አማርኛ', englishName: 'Amharic', dir: 'ltr' },
  { code: 'ar', name: 'العربية', englishName: 'Arabic', dir: 'rtl' },
  { code: 'bn', name: 'বাংলা', englishName: 'Bangla', dir: 'ltr' },
  { code: 'bho', name: 'भोजपुरी', englishName: 'Bhojpuri', dir: 'ltr' },
  { code: 'zh-Hans', name: '中文（简体）', englishName: 'Chinese (Simplified)', dir: 'ltr' },
  { code: 'zh-Hant', name: '中文（繁體）', englishName: 'Chinese (Traditional)', dir: 'ltr' },
  { code: 'da', name: 'dansk', englishName: 'Danish', dir: 'ltr' },
  { code: 'nl', name: 'Nederlands', englishName: 'Dutch', dir: 'ltr' },
  { code: 'en-US', name: 'English (United States)', englishName: 'English (United States)', dir: 'ltr' },
  { code: 'fil', name: 'Filipino', englishName: 'Filipino', dir: 'ltr' },
  { code: 'fi', name: 'suomi', englishName: 'Finnish', dir: 'ltr' },
  { code: 'fr-FR', name: 'français (France)', englishName: 'French (France)', dir: 'ltr' },
  { code: 'de-DE', name: 'Deutsch (Deutschland)', englishName: 'German (Germany)', dir: 'ltr' },
  { code: 'gu', name: 'ગુજરાતી', englishName: 'Gujarati', dir: 'ltr' },
  { code: 'ha', name: 'Hausa', englishName: 'Hausa', dir: 'ltr' },
  { code: 'hi-IN', name: 'हिन्दी (भारत)', englishName: 'Hindi (India)', dir: 'ltr' },
  { code: 'id-ID', name: 'Indonesia (Indonesia)', englishName: 'Indonesian (Indonesia)', dir: 'ltr' },
  { code: 'it-IT', name: 'italiano (Italia)', englishName: 'Italian (Italy)', dir: 'ltr' },
  { code: 'ja-JP', name: '日本語 (日本)', englishName: 'Japanese (Japan)', dir: 'ltr' },
  { code: 'kn', name: 'ಕನ್ನಡ', englishName: 'Kannada', dir: 'ltr' },
  { code: 'ko-KR', name: '한국어(대한민국)', englishName: 'Korean (South Korea)', dir: 'ltr' },
  { code: 'ml', name: 'മലയാളം', englishName: 'Malayalam', dir: 'ltr' },
  { code: 'mr', name: 'मराठी', englishName: 'Marathi', dir: 'ltr' },
  { code: 'nb', name: 'norsk bokmål', englishName: 'Norwegian Bokmål', dir: 'ltr' },
  { code: 'pt-BR', name: 'português (Brasil)', englishName: 'Portuguese (Brazil)', dir: 'ltr' },
  { code: 'ru', name: 'русский', englishName: 'Russian', dir: 'ltr' },
  { code: 'es-419', name: 'español (Latinoamérica)', englishName: 'Spanish (Latin America)', dir: 'ltr' },
  { code: 'es-ES', name: 'español (España)', englishName: 'Spanish (Spain)', dir: 'ltr' },
  { code: 'sw', name: 'Kiswahili', englishName: 'Swahili', dir: 'ltr' },
  { code: 'sv', name: 'svenska', englishName: 'Swedish', dir: 'ltr' },
  { code: 'ta', name: 'தமிழ்', englishName: 'Tamil', dir: 'ltr' },
  { code: 'te', name: 'తెలుగు', englishName: 'Telugu', dir: 'ltr' },
  { code: 'th', name: 'ไทย', englishName: 'Thai', dir: 'ltr' },
  { code: 'tr', name: 'Türkçe', englishName: 'Turkish', dir: 'ltr' },
  { code: 'uk', name: 'українська', englishName: 'Ukrainian', dir: 'ltr' },
  { code: 'vi', name: 'Tiếng Việt', englishName: 'Vietnamese', dir: 'ltr' },
] as const satisfies readonly Omit<Locale, 'review'>[]

export type SupportedLocale = (typeof registry)[number]['code']

export const locales: readonly Locale[] = registry.map((l) => ({ ...l, review: REVIEW.includes(l.code) }))

/** The registry's tags, for callers that only negotiate. */
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = registry.map((l) => l.code)

export const DEFAULT_LOCALE: SupportedLocale = 'en-US'

/**
 * Names spaces — keep in sync with the source/ directory layout.
 */
export const NAMESPACES = ['shared', 'exchange', 'wallet', 'chat', 'identity', 'docs'] as const
export type Namespace = (typeof NAMESPACES)[number]
