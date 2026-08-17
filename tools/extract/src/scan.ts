/**
 * A key a person will read, and the English they will read if nobody writes any.
 */
export interface Key {
  namespace: string
  key: string
  english: string
}

export type Strings = Record<string, string>

/**
 * `t('swap.title')` and `t('swap.title', 'Swap')`, plus `<Trans i18nKey="…">`.
 *
 * `\bt\(` is the whole trick and it is deliberately narrow: it catches `t(`,
 * `i18n.t(` and `this.t(` because a word boundary sits before each, and it
 * declines `split(`, `at(` and `format(` because none of them do.
 *
 * A key built at runtime — `t(\`nav.${section}\`)` — is not here and cannot be.
 * Nothing static can know what `section` holds, so those keys belong in the
 * source file by hand.
 */
const CALL = /\bt\(\s*['"]([^'"\n]+)['"](?:\s*,\s*['"]([^'"\n]*)['"])?/g
const TRANS = /i18nKey\s*=\s*['"]([^'"\n]+)['"]/g

export function scan(code: string, fallback: string): Key[] {
  const found: Key[] = []
  for (const [, key, english] of code.matchAll(CALL)) {
    found.push(split(key, fallback, english))
  }
  for (const [, key] of code.matchAll(TRANS)) {
    found.push(split(key, fallback))
  }
  return found
}

/**
 * Add what is missing and touch nothing else.
 *
 * The English in a source file is the copy someone wrote and reviewed; the
 * English in the code is whatever the developer typed to see the screen render.
 * Extraction that overwrote would quietly undo every edit, so this run and the
 * next produce the same file.
 */
export function merge(existing: Strings, found: readonly Key[], namespace: string): Strings {
  const out: Strings = { ...existing }
  for (const key of found) {
    if (key.namespace === namespace && out[key.key] === undefined) {
      out[key.key] = key.english
    }
  }
  return out
}

/** `exchange:swap.title` names its own namespace; a bare key takes the caller's. */
function split(key: string, fallback: string, english?: string): Key {
  const at = key.indexOf(':')
  return at === -1
    ? { namespace: fallback, key, english: english || key }
    : { namespace: key.slice(0, at), key: key.slice(at + 1), english: english || key.slice(at + 1) }
}
