import { DEFAULT_LOCALE } from './locales.ts'

/**
 * Where a product keeps its strings.
 *
 * Three CLIs read and write these paths — extract writes the source, translate
 * writes the translations, validate reads both — and they have to mean the same
 * thing by them. Written out at each call site instead, one of them eventually
 * looks in a directory the others never fill and reports the whole product
 * untranslated.
 *
 * Strings, not `node:path`, so core stays runnable in a browser.
 */

/** The canonical copy of a namespace, under a `--source` directory. */
export function source(dir: string, namespace: string): string {
  return `${dir}/${namespace}/${DEFAULT_LOCALE}.json`
}

/** One locale's copy of a namespace, under a `--translations` directory. */
export function translation(dir: string, locale: string, namespace: string): string {
  return `${dir}/${locale}/${namespace}.json`
}

/**
 * One of those files as text.
 *
 * Sorted by key, because two tools write these files and a person reviews the
 * diff: unsorted, a run that adds one string reorders forty and the review that
 * would have caught a bad translation does not happen.
 */
export function contents(strings: Record<string, string>): string {
  const sorted = Object.entries(strings).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `${JSON.stringify(Object.fromEntries(sorted), null, 2)}\n`
}
