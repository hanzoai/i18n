/**
 * One authored message, translated and cut at its `{name}` arguments: runs of text,
 * and each argument where the translation puts it. A message a catalog lacks is its
 * English source, so an incomplete catalog shows English, never a key.
 *
 * The source's leading and trailing whitespace is kept whatever the catalog holds,
 * because a translator trimming it would glue a message to what is drawn beside it.
 *
 * Own-key lookups only: a source string of `constructor` is copy, not a prototype.
 */
export type Piece = string | { name: string }

export function pieces(messages: Readonly<Record<string, string>>, source: string): Piece[] {
  const text = Object.hasOwn(messages, source) ? messages[source] : source
  const spaced = (source.match(/^\s*/)?.[0] ?? '') + text.trim() + (source.match(/\s*$/)?.[0] ?? '')
  const out: Piece[] = []
  let at = 0
  for (const slot of spaced.matchAll(/\{(\w+)\}/g)) {
    if (slot.index > at) {
      out.push(spaced.slice(at, slot.index))
    }
    out.push({ name: slot[1] })
    at = slot.index + slot[0].length
  }
  if (at < spaced.length) {
    out.push(spaced.slice(at))
  }
  return out
}

/**
 * One authored string, rendered: `{name}` arguments are filled from `values`, and one
 * with no value stays visible rather than rendering empty.
 */
export function translate(
  messages: Readonly<Record<string, string>>,
  source: string,
  values: Readonly<Record<string, string | number>> = {},
): string {
  return pieces(messages, source)
    .map((piece) =>
      typeof piece === 'string' ? piece : Object.hasOwn(values, piece.name) ? String(values[piece.name]) : `{${piece.name}}`,
    )
    .join('')
}

/**
 * Text set apart from the direction around it: Unicode's first-strong isolate.
 *
 * A figure dropped into right-to-left prose is reordered with it — `1,150–1,400`
 * reads `1,400–1,150` and `~43 tok/s` reads `tok/s 43~`. Inside an isolate the
 * value takes its own direction (its first strong letter, or left-to-right when it
 * has none, as a number does) and the prose around it is unaffected. Invisible, and
 * what `<bdi>` is in plain text, so it holds in an attribute, a title or a label.
 */
export function isolate(text: string): string {
  return `⁨${text}⁩`
}

/**
 * Authored English written as data, translated where it is drawn:
 * `{ label: phrase('Pricing') }`, then `t(item.label)`. It returns its argument; it
 * exists so `i18n-extract` finds the string where no `t` call names it.
 */
export function phrase(source: string): string {
  return source
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
