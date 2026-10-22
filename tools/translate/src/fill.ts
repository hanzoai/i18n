import { SOFT, faults, locales, parity, prose, slots, type Terms } from '@hanzo/i18n'

export type Strings = Record<string, string>

export interface Message {
  role: 'system' | 'user'
  content: string
}

/** A chat model you can ask. `chat` binds one to an endpoint; a test binds a fake. */
export type Model = (messages: Message[]) => Promise<string>

/**
 * Whatever translates one group of strings into one locale, answering by key.
 * `asking` makes one of a chat model; `service` is `/v1/translate`. The answer is
 * data: `fill` checks every value and files only what it asked for.
 */
export type Engine = (want: Strings, locale: string) => Promise<Record<string, unknown>>

export interface Filled {
  /** Sound translations for keys that had none. */
  added: Strings
  /** Keys the answer got wrong. They stay missing, so the next run asks again. */
  refused: string[]
  /** Keys of `added` written as the source itself: labels the answer got wrong (see `label`). */
  kept: string[]
}

/** The keys a locale still owes. */
export function missing(source: Strings, existing: Strings): Strings {
  return Object.fromEntries(Object.entries(source).filter(([key]) => existing[key] === undefined))
}

/**
 * Translate what a locale is missing, and only that.
 *
 * Existing translations are never sent and never replaced. A translator's
 * correction has to survive the next run or nobody makes a second one, and a
 * tool that retranslated everything would spend a thousand keys to add three.
 */
export async function fill(
  source: Strings,
  existing: Strings,
  locale: string,
  engine: Engine,
  terms: Terms = {},
): Promise<Filled> {
  const want = missing(source, existing)
  const added: Strings = {}
  const refused: string[] = []
  const kept: string[] = []
  if (Object.keys(want).length === 0) {
    return { added, refused, kept }
  }

  // Every batch is asked at once; the engine decides how many are in flight (the
  // CLI's `gate`), so a server with several slots answers one locale's batches together.
  let failure: Error | undefined
  const answers = await Promise.all(
    batches(want).map(async (group) => {
      try {
        return { group, answer: await engine(group, locale) }
      } catch (error) {
        // One batch failing costs its own keys and nothing else. They stay missing,
        // which is the same state every other refusal leaves them in, so the next
        // run asks for exactly them — and the batches that DID answer are still
        // returned and written. Asking for everything at once had no such property:
        // one truncated reply lost the whole locale, and since the next run asked
        // the identical question it truncated identically. No progress was possible.
        failure = error as Error
        return { group, answer: undefined }
      }
    }),
  )
  for (const { group, answer } of answers) {
    if (!answer) {
      refused.push(...Object.keys(group))
      continue
    }
    // Walked over what was ASKED, never over what came back. The answer is data:
    // a model that returns a key nobody asked for cannot file it, and one that
    // silently drops a key gets that key reported rather than lost.
    for (const [key, english] of Object.entries(group)) {
      const value = answer[key]
      if (typeof value === 'string' && value.trim() !== '' && sound(locale, english, value, terms)) {
        added[key] = value
      } else if (label(english, terms) && sound(locale, english, english, terms)) {
        added[key] = english
        kept.push(key)
      } else {
        refused.push(key)
      }
    }
  }

  // Every batch failed, so this is the endpoint being down rather than a model
  // getting some strings wrong, and the caller should hear it as an error.
  if (failure && Object.keys(added).length === 0) {
    throw failure
  }
  return { added, refused, kept }
}

/**
 * Whether a source is a label: a protected name with at most one other word and no
 * slot (`Hanzo OS`, `Hanzo.Stack`, `Gen 1`). Its translation is itself, so when an
 * answer transliterates the name the label is written as the source rather than left
 * missing for a model that will transliterate it again.
 */
function label(english: string, terms: Terms): boolean {
  const named = (terms.keep ?? []).some((name) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(english))
  return named && slots(english).length === 0 && !prose(english, terms)
}

/**
 * How many strings one request may carry.
 *
 * A reply has to hold a translation of everything the request asked for, so an
 * unbatched run asks for an answer larger than any model will return: this
 * toolkit's own documented workload is 1377 keys, which is ~97 KB of prompt
 * needing ~21k tokens back, and it came home truncated and unparseable.
 *
 * The bound is BYTES rather than keys because a key costs whatever its string
 * costs — a hundred error messages are not a hundred button labels. The count
 * cap is the second half of the same guard, for a namespace of very short
 * strings where bytes alone would allow thousands of keys and the model would
 * start dropping them silently.
 */
const MAX_BYTES = 8_000
const MAX_KEYS = 100

function batches(want: Strings): Strings[] {
  const out: Strings[] = []
  let group: Strings = {}
  let bytes = 0
  for (const [key, english] of Object.entries(want)) {
    const cost = key.length + english.length + 8
    if (Object.keys(group).length > 0 && (bytes + cost > MAX_BYTES || Object.keys(group).length >= MAX_KEYS)) {
      out.push(group)
      group = {}
      bytes = 0
    }
    group[key] = english
    bytes += cost
  }
  if (Object.keys(group).length > 0) {
    out.push(group)
  }
  return out
}

/**
 * Whether a translation may be written: its slots survive (`parity`) and it has
 * no fault the gate would fail it for (`faults`) — protected names kept, the
 * locale's own script, the right Chinese. English-identical prose is written and
 * left for the gate to list for review, since a loanword can be the translation.
 */
function sound(locale: string, english: string, value: string, terms: Terms): boolean {
  return parity(english, value) && faults(locale, english, value, terms).every((f) => SOFT.has(f))
}

/** A regional Arabic: the register an interface uses, with the region's words only where they differ. */
const ARABIC = (region: string, area: string) =>
  `Write Arabic for readers in ${region}: formal, neutral Modern Standard Arabic grammar; use ${area} vocabulary only where the usual interface term differs there; never slang or dialect grammar.`

/** What a model needs told about a locale beyond its tag: the variant, where a tag alone is ambiguous. */
const NOTES: Record<string, string> = {
  ar: 'Use Modern Standard Arabic.',
  'ar-EG': ARABIC('Egypt', 'Egyptian'),
  'ar-LB': ARABIC('Lebanon and the Levant', 'Levantine'),
  'ar-MA': ARABIC('Morocco and the Maghreb', 'Maghrebi'),
  'ar-SA': ARABIC('Saudi Arabia and the Gulf', 'Gulf'),
  as: 'Write Assamese (with ৰ and ৱ), not Bengali.',
  az: 'Write North Azerbaijani in the Latin alphabet, not Turkish.',
  bho: 'Write Bhojpuri in Devanagari, not Hindi.',
  ceb: 'Write Cebuano (Bisaya), not Tagalog.',
  ckb: 'Write Central Kurdish (Sorani) in its Arabic script, not Persian or Arabic.',
  'es-419': 'Use neutral Latin American Spanish (computadora, celular, ustedes), not the Spanish of Spain.',
  'es-AR': 'Use Rioplatense Spanish as in Argentine software: voseo (vos tenés, elegí), computadora, celular.',
  'es-ES': 'Use the Spanish of Spain (ordenador, móvil, vale), not Latin American Spanish.',
  'es-MX': 'Use Mexican Spanish (tú, computadora, celular), not the Spanish of Spain.',
  fa: 'Use standard Iranian Persian; write the zero-width non-joiner (U+200C) where Persian spelling needs it.',
  'fa-AF': 'Write Dari as used in Afghanistan (کمپیوتر, not رایانه), not Iranian Persian.',
  'fr-CA': 'Use Canadian French as in Quebec software (courriel, clavarder, magasiner), not the French of France.',
  he: 'Use modern Hebrew without vowel points.',
  ht: 'Write Haitian Creole (Kreyòl), not French.',
  hy: 'Write Eastern Armenian.',
  jv: 'Write Javanese in the Latin alphabet, in a neutral polite register, not Indonesian.',
  kk: 'Write Kazakh in Cyrillic, not Russian.',
  ku: 'Write Northern Kurdish (Kurmanji) in the Latin alphabet, not Sorani or Turkish.',
  ky: 'Write Kyrgyz in Cyrillic, not Kazakh or Russian.',
  lo: 'Write Lao, not Thai.',
  mn: 'Write Mongolian in Cyrillic.',
  ms: 'Use Standard Malay (Malaysia), not Indonesian.',
  my: 'Write Burmese in Unicode, never the Zawgyi encoding.',
  nb: 'Use Norwegian Bokmål, not Nynorsk or Danish.',
  ne: 'Write Nepali, not Hindi.',
  pa: 'Write Punjabi in Gurmukhi, not Hindi.',
  'pa-PK': 'Write Punjabi in Shahmukhi, the Arabic script of Pakistan, not Urdu.',
  ps: 'Write Pashto, not Persian or Urdu.',
  'pt-BR': 'Use Brazilian Portuguese.',
  'pt-PT': 'Use European Portuguese (ecrã, utilizador, ficheiro, telemóvel), not Brazilian Portuguese.',
  sd: 'Write Sindhi in its Arabic script, not Urdu.',
  su: 'Write Sundanese in the Latin alphabet, not Indonesian.',
  tg: 'Write Tajik in Cyrillic, not the Persian script.',
  tk: 'Write Turkmen in the Latin alphabet, not Turkish.',
  ug: 'Write Uyghur in its Arabic script, with every vowel written.',
  ur: 'Write Urdu in Urdu script, not Hindi.',
  uz: 'Write Uzbek in the Latin alphabet (oʻ and gʻ with U+02BB), not Cyrillic.',
  'zh-HK': 'Use Traditional Chinese characters with Hong Kong written-Chinese terms (軟件, 數據, 網絡, 用戶); never Simplified characters, never colloquial Cantonese.',
  'zh-Hans': 'Use Simplified Chinese characters and mainland China terminology.',
  'zh-Hant': 'Use Traditional Chinese characters and Taiwan terminology (軟體, 資料, 網路, 程式); never Simplified characters.',
}

/**
 * At most `n` calls in flight, the rest served in the order they were asked. The CLI
 * asks every locale's batches in registry order, so the first locale's batches go
 * first and it is written first, while the server's every slot stays busy.
 */
export function gate(n: number): <T>(task: () => Promise<T>) => Promise<T> {
  let busy = 0
  const waiting: (() => void)[] = []
  return async (task) => {
    if (busy < n) {
      busy++
    } else {
      // A finished call hands its slot straight to the next in line, so a caller
      // arriving between the two cannot take it and run n + 1 at once.
      await new Promise<void>((go) => waiting.push(go))
    }
    try {
      return await task()
    } finally {
      const next = waiting.shift()
      if (next) {
        next()
      } else {
        busy--
      }
    }
  }
}

/**
 * A chat model as an `Engine`: one prompt per group, a JSON object back.
 *
 * The strings go NUMBERED, not keyed. A catalog keyed by its English hands a model
 * `"Log in": "Log in"`, and told to keep the keys, Jais 3 translated both sides of
 * every pair, so no answer matched a key and a whole locale came back refused. A
 * number has nothing to translate; the answer is read back by it.
 */
export function asking(model: Model, terms: Terms = {}): Engine {
  return async (want, locale) => {
    const keys = Object.keys(want)
    const numbered = Object.fromEntries(keys.map((key, i) => [String(i + 1), want[key]]))
    const answer = read(await model(prompt(numbered, locale, terms)))
    return Object.fromEntries(keys.map((key, i) => [key, answer[String(i + 1)]]))
  }
}

function prompt(want: Strings, locale: string, terms: Terms): Message[] {
  const named = locales.find((l) => l.code === locale)?.englishName
  const keep = terms.keep ?? []
  const lines = [
    `Translate software interface strings from English into ${named ? `${named} (${locale})` : locale}.`,
    NOTES[locale],
    '',
    'Answer with a JSON object: the same keys, translated values, nothing else.',
    'Leave every {{slot}} and {placeholder} exactly as written. They are substituted at runtime, so a',
    'renamed or dropped one prints an empty space where a number or a name belongs.',
    keep.length > 0
      ? `Keep these names exactly as written, in Latin script, never translated or transliterated: ${keep.join(', ')}.`
      : undefined,
    'Keep product names, ticker symbols, URLs and code identifiers in English.',
    'Match the register of the source: short, plain, and addressed to one person.',
  ]
  return [
    { role: 'system', content: lines.filter((line) => line !== undefined).join('\n') },
    { role: 'user', content: JSON.stringify(want, null, 2) },
  ]
}

function read(raw: string): Record<string, unknown> {
  // Asked for an object, a model still sometimes returns one inside a fenced
  // block, and the fence is not JSON; a reasoning model may lead with its trace.
  const body = raw
    .replace(/^\s*<think>[\s\S]*?<\/think>/, '')
    .trim()
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/```$/, '')
    .trim()

  let value: unknown
  try {
    value = JSON.parse(body)
  } catch {
    throw new Error(`answer was not JSON: ${body.slice(0, 120)}`)
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`answer was not an object: ${body.slice(0, 120)}`)
  }
  return value as Record<string, unknown>
}
