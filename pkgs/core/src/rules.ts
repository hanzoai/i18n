import { DEFAULT_LOCALE } from './locales.ts'

/**
 * What a translation must get right beyond its slots — asked by the translator
 * before it writes a string and by the gate before it ships one, for the same
 * reason `parity` lives in core: answered twice, the translator writes what the
 * gate refuses.
 */

/** Names a product hands the tools. Brand content belongs to the product, so it arrives as data. */
export interface Terms {
  /**
   * Protected names: kept exactly as written, in Latin script, in every locale. A
   * translation of a source holding one must hold it too (inflection after it is
   * allowed: Finnish `Kain` for `Kai`).
   */
  keep?: readonly string[]
  /** Names that may stay untranslated without counting as English prose (`Traefik`, `GPQA Diamond`). */
  brands?: readonly string[]
}

/** Faults reported for a person to review rather than refused: loanwords like "Open source" can be right. */
export const SOFT: ReadonlySet<string> = new Set(['english'])

/**
 * Everything wrong with `value` as the `locale` copy of `source`, beyond presence
 * and slots (`parity`): `markup`, `names:<A+B>`, `english` (soft), `script`,
 * `simplified`, `traditional`. Empty is shippable.
 */
export function faults(locale: string, source: string, value: string, terms: Terms = {}): string[] {
  const found: string[] = []
  if (MARKUP.test(value)) {
    found.push('markup')
  }
  const lost = required(source, terms.keep ?? []).filter((n) => !new RegExp(`\\b${escape(n)}`).test(value))
  if (lost.length > 0) {
    found.push(`names:${lost.join('+')}`)
  }
  const isProse = prose(source, terms)
  if (locale !== DEFAULT_LOCALE && isProse && value.trim() === source.trim()) {
    found.push('english')
  }
  const script = SCRIPTS[locale]
  if (isProse && script && !script.test(value)) {
    found.push('script')
  }
  if ((locale === 'zh-Hant' || locale === 'zh-HK') && SIMPLIFIED.test(value)) {
    found.push('simplified')
  }
  if (locale === 'zh-Hans' && TRADITIONAL.test(value)) {
    found.push('traditional')
  }
  return found
}

/**
 * Whether a source string is natural language: not code, a path or a URL, and at
 * least two words once the names are taken out. Only prose is held to "written
 * in the locale's script" and "not identical to the English".
 */
export function prose(source: string, terms: Terms = {}): boolean {
  if (PROGRAM.test(source)) {
    return false
  }
  const named = alternation([...(terms.keep ?? []), ...(terms.brands ?? [])])
  const rest = named ? source.replace(named, ' ') : source
  return (rest.match(/\b[A-Za-z][a-z]{2,}\b/g) ?? []).length >= 2
}

/**
 * The protected names a source obliges its translation to carry.
 *
 * A possessive that ENDS a fragment ("agree to Hanzo's " + a link) is exempt: a
 * language that puts the owner after the noun moves it into the link's grammar,
 * which this string never sees. That is a host problem with a host fix — send
 * the sentence as one string with the link as a slot.
 */
function required(source: string, keep: readonly string[]): string[] {
  const names = alternation(keep)
  if (!names) {
    return []
  }
  return [...new Set(source.replace(/\b\w+'s\s+$/, '').match(names) ?? [])]
}

/** Longest first, so `Claude Code` is one name rather than `Claude` and a stray word. */
function alternation(names: readonly string[]): RegExp | undefined {
  if (names.length === 0) {
    return undefined
  }
  const sorted = [...names].sort((a, b) => b.length - a.length).map(escape)
  return new RegExp(`\\b(?:${sorted.join('|')})\\b`, 'g')
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const MARKUP = /<\/?(?:script|iframe)/i
const PROGRAM = /[;(){}=]|^\s*(?:export|const|if|return|import)\b|^#|\w[./]\w/

/** Locales written in a non-Latin script: prose in them must contain it. */
const SCRIPTS: Record<string, RegExp> = {
  am: /\p{Script=Ethiopic}/u,
  ar: /\p{Script=Arabic}/u,
  'ar-EG': /\p{Script=Arabic}/u,
  'ar-LB': /\p{Script=Arabic}/u,
  'ar-MA': /\p{Script=Arabic}/u,
  'ar-SA': /\p{Script=Arabic}/u,
  as: /\p{Script=Bengali}/u,
  bho: /\p{Script=Devanagari}/u,
  bn: /\p{Script=Bengali}/u,
  ckb: /\p{Script=Arabic}/u,
  fa: /\p{Script=Arabic}/u,
  'fa-AF': /\p{Script=Arabic}/u,
  gu: /\p{Script=Gujarati}/u,
  he: /\p{Script=Hebrew}/u,
  'hi-IN': /\p{Script=Devanagari}/u,
  hy: /\p{Script=Armenian}/u,
  'ja-JP': /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
  ka: /\p{Script=Georgian}/u,
  kk: /\p{Script=Cyrillic}/u,
  km: /\p{Script=Khmer}/u,
  kn: /\p{Script=Kannada}/u,
  'ko-KR': /\p{Script=Hangul}/u,
  ky: /\p{Script=Cyrillic}/u,
  lo: /\p{Script=Lao}/u,
  ml: /\p{Script=Malayalam}/u,
  mn: /\p{Script=Cyrillic}/u,
  mr: /\p{Script=Devanagari}/u,
  my: /\p{Script=Myanmar}/u,
  ne: /\p{Script=Devanagari}/u,
  or: /\p{Script=Oriya}/u,
  pa: /\p{Script=Gurmukhi}/u,
  'pa-PK': /\p{Script=Arabic}/u,
  ps: /\p{Script=Arabic}/u,
  ru: /\p{Script=Cyrillic}/u,
  sd: /\p{Script=Arabic}/u,
  si: /\p{Script=Sinhala}/u,
  ta: /\p{Script=Tamil}/u,
  te: /\p{Script=Telugu}/u,
  tg: /\p{Script=Cyrillic}/u,
  th: /\p{Script=Thai}/u,
  ug: /\p{Script=Arabic}/u,
  uk: /\p{Script=Cyrillic}/u,
  ur: /\p{Script=Arabic}/u,
  'zh-HK': /\p{Script=Han}/u,
  'zh-Hans': /\p{Script=Han}/u,
  'zh-Hant': /\p{Script=Han}/u,
}

/** Frequent characters that exist in only one Chinese script. */
const SIMPLIFIED = /[们这个说时为来会对发动与设网络数据务机开关门问题无从进运选择号证费体础执档录页输载认识应该还让图确实际级经历区现钱库]/u
const TRADITIONAL = /[們這個說時為來會對發動與設網絡數據務機開關門問題無從進運選擇號證費體礎執檔錄頁輸載認識應該還讓圖確實際級經歷區現錢庫]/u
