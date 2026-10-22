/**
 * The interpolation slots in a message, sorted.
 *
 * This is the ONE definition of what a slot is. The translator that fills a
 * locale and the gate that blocks the PR both ask here, because a toolkit where
 * those two answer separately is a toolkit that writes a translation it will
 * later refuse to ship.
 *
 * Two syntaxes fill a slot, one per renderer: i18next's `{{name}}`, reported as
 * the bare name, and the `{name}` argument this package's own `translate`
 * substitutes, reported WITH its braces. Keeping the braces on the second is what
 * stops `{{amount}}` → `{amount}` passing parity: same name, and under i18next a
 * literal `{amount}` on the screen.
 *
 * Names are trimmed: i18next trims them too, so `{{ count }}` renders exactly as
 * `{{count}}` does and a translator who added a space has broken nothing.
 */
const SLOT = /\{\{([^{}]*)\}\}|\{(\w+)\}/g

export function slots(text: string): string[] {
  return [...text.matchAll(SLOT)].map((m) => (m[1] !== undefined ? m[1].trim() : `{${m[2]}}`)).sort()
}

/**
 * Whether a translation carries exactly the slots its source does.
 *
 * Sorted, because word order is the first thing a translation changes — German
 * moves the verb, and `{{amount}} of {{token}}` legitimately comes back as
 * `{{token}} im Wert von {{amount}}`.
 *
 * Compared as a multiset, because a translation that renders `{{amount}}` twice
 * and drops `{{token}}` has the same slot NAMES as its source and is still
 * broken: it prints a number where a ticker belongs. Length plus positionwise
 * equality over the sorted lists is that comparison; asking whether each source
 * slot merely appears is the version that lets it through.
 */
export function parity(source: string, target: string): boolean {
  const a = slots(source)
  const b = slots(target)
  return a.length === b.length && a.every((s, i) => s === b[i])
}
