/**
 * One authored string, rendered: its translation from `messages` or, missing, the
 * English source itself — so an incomplete catalog shows English, never a key.
 *
 * `{name}` arguments are filled from `values`; one with no value stays visible
 * rather than rendering empty. The source's leading and trailing whitespace is
 * kept whatever the catalog holds, because fragments are joined around markup and
 * a translator trimming them would glue words together.
 *
 * Own-key lookups only: a source string of `constructor` is copy, not a prototype.
 */
export function translate(
  messages: Readonly<Record<string, string>>,
  source: string,
  values: Readonly<Record<string, string | number>> = {},
): string {
  const text = Object.hasOwn(messages, source) ? messages[source] : source
  const spaced = (source.match(/^\s*/)?.[0] ?? '') + text.trim() + (source.match(/\s*$/)?.[0] ?? '')
  return spaced.replace(/\{(\w+)\}/g, (whole, key: string) => (Object.hasOwn(values, key) ? String(values[key]) : whole))
}

/** Where this browser keeps one account's language choice; signed-out visitors share `guest`. */
export function preferenceKey(userId?: string | null): string {
  return `hanzo.locale.v1:${encodeURIComponent(userId || 'guest')}`
}

/**
 * The locale this browser's document last showed, written wherever the provider sets
 * `<html lang dir>` and read by `bootScript` (`./boot`) before the next first paint.
 */
export const PAINTED = 'hanzo.locale.v1.painted'
