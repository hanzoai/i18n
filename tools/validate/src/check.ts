import { DEFAULT_LOCALE, parity, slots } from '@hanzo/i18n'

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
}

/**
 * Everything wrong with one namespace.
 *
 * Returned rather than printed, and returned in full rather than at the first
 * find: someone fixing translations wants the whole list once, not one line per
 * push.
 */
export function check(namespace: Namespace, forbid: readonly string[]): Problem[] {
  const problems: Problem[] = []
  const at = (locale: string, what: string, key?: string) =>
    problems.push({ namespace: namespace.name, locale, key, what })

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
  return list.length === 0 ? 'none' : list.map((s) => `{{${s}}}`).join(' ')
}
