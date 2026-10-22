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
 * Order is the picker's: by English name. `resolve` does not depend on it; where a
 * request names a region we do not ship, `resolve.ts` says which variant serves it.
 * `dir` follows the script: every locale written in Arabic or Hebrew script is `rtl`
 * (`test/registry.ts` derives the script from the tag and holds the two equal).
 *
 * To add one: insert it here, add its loader in `loaders.ts`, generate its catalog, ship.
 */
const registry = [
  { code: 'am', name: 'አማርኛ', englishName: 'Amharic', dir: 'ltr' },
  { code: 'ar', name: 'العربية', englishName: 'Arabic', dir: 'rtl' },
  { code: 'ar-EG', name: 'العربية (مصر)', englishName: 'Arabic (Egypt)', dir: 'rtl' },
  { code: 'ar-LB', name: 'العربية (لبنان)', englishName: 'Arabic (Lebanon)', dir: 'rtl' },
  { code: 'ar-MA', name: 'العربية (المغرب)', englishName: 'Arabic (Morocco)', dir: 'rtl' },
  { code: 'ar-SA', name: 'العربية (السعودية)', englishName: 'Arabic (Saudi Arabia)', dir: 'rtl' },
  { code: 'hy', name: 'հայերեն', englishName: 'Armenian', dir: 'ltr' },
  { code: 'as', name: 'অসমীয়া', englishName: 'Assamese', dir: 'ltr' },
  { code: 'az', name: 'azərbaycan', englishName: 'Azerbaijani', dir: 'ltr' },
  { code: 'bn', name: 'বাংলা', englishName: 'Bangla', dir: 'ltr' },
  { code: 'bho', name: 'भोजपुरी', englishName: 'Bhojpuri', dir: 'ltr' },
  { code: 'my', name: 'မြန်မာ', englishName: 'Burmese', dir: 'ltr' },
  { code: 'ceb', name: 'Cebuano', englishName: 'Cebuano', dir: 'ltr' },
  { code: 'ckb', name: 'کوردیی ناوەندی', englishName: 'Central Kurdish', dir: 'rtl' },
  { code: 'zh-HK', name: '中文（香港）', englishName: 'Chinese (Hong Kong)', dir: 'ltr' },
  { code: 'zh-Hans', name: '中文（简体）', englishName: 'Chinese (Simplified)', dir: 'ltr' },
  { code: 'zh-Hant', name: '中文（繁體）', englishName: 'Chinese (Traditional)', dir: 'ltr' },
  { code: 'da', name: 'dansk', englishName: 'Danish', dir: 'ltr' },
  { code: 'fa-AF', name: 'دری', englishName: 'Dari', dir: 'rtl' },
  { code: 'nl', name: 'Nederlands', englishName: 'Dutch', dir: 'ltr' },
  { code: 'en-US', name: 'English (United States)', englishName: 'English (United States)', dir: 'ltr' },
  { code: 'fil', name: 'Filipino', englishName: 'Filipino', dir: 'ltr' },
  { code: 'fi', name: 'suomi', englishName: 'Finnish', dir: 'ltr' },
  { code: 'fr-CA', name: 'français (Canada)', englishName: 'French (Canada)', dir: 'ltr' },
  { code: 'fr-FR', name: 'français (France)', englishName: 'French (France)', dir: 'ltr' },
  { code: 'ka', name: 'ქართული', englishName: 'Georgian', dir: 'ltr' },
  { code: 'de-DE', name: 'Deutsch (Deutschland)', englishName: 'German (Germany)', dir: 'ltr' },
  { code: 'gu', name: 'ગુજરાતી', englishName: 'Gujarati', dir: 'ltr' },
  { code: 'ht', name: 'Kreyòl ayisyen', englishName: 'Haitian Creole', dir: 'ltr' },
  { code: 'ha', name: 'Hausa', englishName: 'Hausa', dir: 'ltr' },
  { code: 'he', name: 'עברית', englishName: 'Hebrew', dir: 'rtl' },
  { code: 'hi-IN', name: 'हिन्दी (भारत)', englishName: 'Hindi (India)', dir: 'ltr' },
  { code: 'id-ID', name: 'Indonesia (Indonesia)', englishName: 'Indonesian (Indonesia)', dir: 'ltr' },
  { code: 'it-IT', name: 'italiano (Italia)', englishName: 'Italian (Italy)', dir: 'ltr' },
  { code: 'ja-JP', name: '日本語 (日本)', englishName: 'Japanese (Japan)', dir: 'ltr' },
  { code: 'jv', name: 'Jawa', englishName: 'Javanese', dir: 'ltr' },
  { code: 'kn', name: 'ಕನ್ನಡ', englishName: 'Kannada', dir: 'ltr' },
  { code: 'kk', name: 'қазақ тілі', englishName: 'Kazakh', dir: 'ltr' },
  { code: 'km', name: 'ខ្មែរ', englishName: 'Khmer', dir: 'ltr' },
  { code: 'ko-KR', name: '한국어(대한민국)', englishName: 'Korean (South Korea)', dir: 'ltr' },
  { code: 'ku', name: 'kurdî (kurmancî)', englishName: 'Kurdish (Kurmanji)', dir: 'ltr' },
  { code: 'ky', name: 'кыргызча', englishName: 'Kyrgyz', dir: 'ltr' },
  { code: 'lo', name: 'ລາວ', englishName: 'Lao', dir: 'ltr' },
  { code: 'ms', name: 'Melayu', englishName: 'Malay', dir: 'ltr' },
  { code: 'ml', name: 'മലയാളം', englishName: 'Malayalam', dir: 'ltr' },
  { code: 'mr', name: 'मराठी', englishName: 'Marathi', dir: 'ltr' },
  { code: 'mn', name: 'монгол', englishName: 'Mongolian', dir: 'ltr' },
  { code: 'ne', name: 'नेपाली', englishName: 'Nepali', dir: 'ltr' },
  { code: 'nb', name: 'norsk bokmål', englishName: 'Norwegian Bokmål', dir: 'ltr' },
  { code: 'or', name: 'ଓଡ଼ିଆ', englishName: 'Odia', dir: 'ltr' },
  { code: 'om', name: 'Oromoo', englishName: 'Oromo', dir: 'ltr' },
  { code: 'ps', name: 'پښتو', englishName: 'Pashto', dir: 'rtl' },
  { code: 'fa', name: 'فارسی', englishName: 'Persian', dir: 'rtl' },
  { code: 'pt-BR', name: 'português (Brasil)', englishName: 'Portuguese (Brazil)', dir: 'ltr' },
  { code: 'pt-PT', name: 'português (Portugal)', englishName: 'Portuguese (Portugal)', dir: 'ltr' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', englishName: 'Punjabi', dir: 'ltr' },
  { code: 'pa-PK', name: 'پنجابی', englishName: 'Punjabi (Pakistan)', dir: 'rtl' },
  { code: 'ru', name: 'русский', englishName: 'Russian', dir: 'ltr' },
  { code: 'sd', name: 'سنڌي', englishName: 'Sindhi', dir: 'rtl' },
  { code: 'si', name: 'සිංහල', englishName: 'Sinhala', dir: 'ltr' },
  { code: 'so', name: 'Soomaali', englishName: 'Somali', dir: 'ltr' },
  { code: 'es-AR', name: 'español (Argentina)', englishName: 'Spanish (Argentina)', dir: 'ltr' },
  { code: 'es-419', name: 'español (Latinoamérica)', englishName: 'Spanish (Latin America)', dir: 'ltr' },
  { code: 'es-MX', name: 'español (México)', englishName: 'Spanish (Mexico)', dir: 'ltr' },
  { code: 'es-ES', name: 'español (España)', englishName: 'Spanish (Spain)', dir: 'ltr' },
  { code: 'su', name: 'Basa Sunda', englishName: 'Sundanese', dir: 'ltr' },
  { code: 'sw', name: 'Kiswahili', englishName: 'Swahili', dir: 'ltr' },
  { code: 'sv', name: 'svenska', englishName: 'Swedish', dir: 'ltr' },
  { code: 'tg', name: 'тоҷикӣ', englishName: 'Tajik', dir: 'ltr' },
  { code: 'ta', name: 'தமிழ்', englishName: 'Tamil', dir: 'ltr' },
  { code: 'te', name: 'తెలుగు', englishName: 'Telugu', dir: 'ltr' },
  { code: 'th', name: 'ไทย', englishName: 'Thai', dir: 'ltr' },
  { code: 'tr', name: 'Türkçe', englishName: 'Turkish', dir: 'ltr' },
  { code: 'tk', name: 'türkmen dili', englishName: 'Turkmen', dir: 'ltr' },
  { code: 'uk', name: 'українська', englishName: 'Ukrainian', dir: 'ltr' },
  { code: 'ur', name: 'اردو', englishName: 'Urdu', dir: 'rtl' },
  { code: 'ug', name: 'ئۇيغۇرچە', englishName: 'Uyghur', dir: 'rtl' },
  { code: 'uz', name: 'oʻzbek', englishName: 'Uzbek', dir: 'ltr' },
  { code: 'vi', name: 'Tiếng Việt', englishName: 'Vietnamese', dir: 'ltr' },
] as const satisfies readonly Omit<Locale, 'review'>[]

export type SupportedLocale = (typeof registry)[number]['code']

export const locales: readonly Locale[] = registry.map((l) => ({ ...l, review: REVIEW.includes(l.code) }))

/** The registry's tags, for callers that only negotiate. */
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = registry.map((l) => l.code)

/** What a browser's own language may select: everything not waiting for review. */
export const OFFERED: readonly SupportedLocale[] = registry.filter((l) => !REVIEW.includes(l.code)).map((l) => l.code)

export const DEFAULT_LOCALE: SupportedLocale = 'en-US'

/**
 * Names spaces — keep in sync with the source/ directory layout.
 */
export const NAMESPACES = ['shared', 'exchange', 'wallet', 'chat', 'identity', 'docs'] as const
export type Namespace = (typeof NAMESPACES)[number]
