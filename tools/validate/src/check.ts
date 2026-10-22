import { DEFAULT_LOCALE, SOFT, faults, parity, slots, type Terms } from '@hanzo/i18n'

export type Strings = Record<string, string>

export interface Namespace {
  name: string
  source: Strings
  /** One entry per locale asked for. `undefined` is a file that is not there. */
  locales: Record<string, Strings | undefined>
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

    for (const [key, english] of Object.entries(namespace.source)) {
      const translated = strings[key]
      if (translated === undefined) {
        at(locale, 'is missing', key)
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
