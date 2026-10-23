import { DEFAULT_LOCALE, SOFT, faults, parity, slots, type Terms } from '@hanzo/i18n'

export type Strings = Record<string, string>

export interface Namespace {
  name: string
  source: Strings
  /** One entry per locale asked for. `undefined` is a file that is not there. */
  locales: Record<string, Strings | undefined>
  /**
   * Locales review.json marks `partial`: waiting for a native reader AND for the
   * keys the last run did not reach. A key such a locale lacks renders English and
   * is counted, not failed; every key it has is checked like any other.
   */
  partial?: ReadonlySet<string>
}

export interface Problem {
  namespace: string
  locale: string
  key?: string
  what: string
  /** For a person to look at, not a reason to fail: a loanword can be the right translation. */
  review?: boolean
}

/**
 * The locales `review.json` lets ship with keys missing: an entry written as
 * `{ "why": "<why it waits>", "partial": "<what it lacks, and why>" }` rather
 * than the bare reason. Only a locale under review can be one, so an offered
 * locale is always complete.
 */
export function partials(review: Readonly<Record<string, unknown>>): Set<string> {
  return new Set(
    Object.entries(review)
      .filter(([, entry]) => typeof (entry as { partial?: unknown } | null)?.partial === 'string' && ((entry as { partial: string }).partial.trim() !== ''))
      .map(([locale]) => locale),
  )
}

/**
 * Everything wrong with one namespace.
 *
 * Returned rather than printed, and returned in full rather than at the first
 * find: someone fixing translations wants the whole list once, not one line per
 * push.
 */
export function check(namespace: Namespace, forbid: readonly string[], terms: Terms = {}): Problem[] {
  const problems: Problem[] = []
  const at = (locale: string, what: string, key?: string, review?: boolean) =>
    problems.push({ namespace: namespace.name, locale, key, what, ...(review && { review }) })

  for (const [key, english] of Object.entries(namespace.source)) {
    for (const term of found(english, forbid)) {
      at(DEFAULT_LOCALE, `holds "${term}", which belongs to the product`, key)
    }
  }

  for (const [locale, strings] of Object.entries(namespace.locales)) {
    if (locale === DEFAULT_LOCALE) {
      continue
    }
    if (!strings) {
      // One line, not one per key. A locale nobody has started is a single fact,
      // and reporting it four hundred times buries the three real breakages.
      at(locale, 'has no translations at all')
      continue
    }

    const partial = namespace.partial?.has(locale) ?? false
    let owed = 0
    for (const [key, english] of Object.entries(namespace.source)) {
      const translated = strings[key]
      if (translated === undefined) {
        if (partial) {
          owed++
        } else {
          at(locale, 'is missing', key)
        }
        continue
      }
      if (!parity(english, translated)) {
        at(locale, `slots ${show(slots(translated))}, source has ${show(slots(english))}`, key)
      }
      for (const fault of faults(locale, english, translated, terms)) {
        at(locale, describe(fault, locale), key, SOFT.has(fault))
      }
      for (const term of found(translated, forbid)) {
        at(locale, `holds "${term}", which belongs to the product`, key)
      }
    }
    if (owed > 0) {
      // One line, for a person: what this locale still reads in English.
      at(locale, `partial: ${owed} of ${Object.keys(namespace.source).length} not translated yet, read in English`, undefined, true)
    }
  }

  return problems
}

export function line(problem: Problem): string {
  const where = `${problem.locale}/${problem.namespace}`
  return problem.key ? `${where} ${problem.key}: ${problem.what}` : `${where}: ${problem.what}`
}

/**
 * Which forbidden terms a string carries.
 *
 * Case-insensitive: a brand name does not stop being one in lower case, and
 * translations move words to the front of sentences where the case changes.
 */
function found(text: string, forbid: readonly string[]): string[] {
  const haystack = text.toLowerCase()
  return forbid.filter((term) => haystack.includes(term.toLowerCase()))
}

function show(list: readonly string[]): string {
  // A `{name}` argument is reported with its braces already on; an i18next slot by its bare name.
  return list.length === 0 ? 'none' : list.map((s) => (s.startsWith('{') ? s : `{{${s}}}`)).join(' ')
}

function describe(fault: string, locale: string): string {
  if (fault.startsWith('names:')) {
    return `drops ${fault.slice('names:'.length).split('+').join(', ')}, which stays as written in every locale`
  }
  return (
    {
      markup: 'holds script markup',
      english: 'is identical to the English',
      script: `is not written in ${locale}'s script`,
      simplified: 'uses Simplified characters in Traditional Chinese',
      traditional: 'uses Traditional characters in Simplified Chinese',
    }[fault] ?? fault
  )
}
