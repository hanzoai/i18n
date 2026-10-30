/**
 * The face a catalog's words are set in, loaded before they are shown.
 *
 * A script the page's own family does not draw (Arabic under Zen) comes from a
 * companion declared with a `unicode-range`, and a browser fetches it only once a
 * letter of it is laid out. Showing the words first lays them out invisibly, in
 * the platform's metrics, for the face's block period, then moves every box after
 * them when the face lands: the page changes twice, once for the words and once
 * for the face. Asking for the face first means the words arrive once, in the face
 * they keep.
 *
 * The body's families are asked in order, and the walk stops at the first that has
 * a face for these letters: that is the face the browser will draw them in. Asking
 * the whole stack at once would also fetch any later declaration of the same
 * letters (a second copy of a companion under the family it stands in for).
 *
 * Bounded by `wait`, the block period browsers give a face, so a face that never
 * comes holds the words no longer than it would have hidden them. A catalog the
 * stack's first face already draws, or a browser without the Font Loading API,
 * costs nothing.
 */
export async function faces(messages: Readonly<Record<string, string>>, wait = 3000): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load || !document.body) return
  const text = letters(messages)
  if (!text) return
  const style = getComputedStyle(document.body)
  const walk = async (): Promise<void> => {
    for (const family of style.fontFamily.split(',')) {
      // A family the set does not hold (a platform face, a generic) answers an
      // empty list at once; one the shorthand cannot parse is passed over.
      const found = await document.fonts.load(`${style.fontWeight} 16px ${family.trim()}`, text).catch(() => [])
      if (found.length) return
    }
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  await Promise.race([walk(), new Promise<void>((done) => (timer = setTimeout(done, wait)))])
  clearTimeout(timer)
}

/** Every character the catalog's words use, once each: what a face is matched against. */
export function letters(messages: Readonly<Record<string, string>>): string {
  const seen = new Set<string>()
  for (const words of Object.values(messages)) for (const ch of words) seen.add(ch)
  return [...seen].join('')
}
