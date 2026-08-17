import { resolve, type SupportedLocale } from '@hanzo/i18n'

/**
 * Entries we will read from one header.
 *
 * A browser sends fewer than ten. This header arrives from anyone who can reach
 * the port, and every tag it holds costs a locale parse downstream, so the work
 * one request can ask for is bounded here rather than by the client's restraint.
 */
const LIMIT = 32

interface Rated {
  tag: string
  weight: number
}

/**
 * The languages an `Accept-Language` header asks for, best first.
 *
 * This is the server's half of discovery — the browser has `navigator.languages`
 * and a phone has an OS list, and this is the same question arriving over HTTP.
 * It answers what was ASKED, not what we will serve; `negotiate` does the second
 * half by handing the answer to core.
 *
 * `en-GB,en;q=0.9,fr;q=0.8` is three preferences in descending order. The weight
 * is the ranking and nothing else, so it is spent here and the caller gets the
 * ordered tags.
 */
export function accept(header: string | null | undefined): string[] {
  if (!header) {
    return []
  }

  const rated: Rated[] = []
  for (const entry of header.split(',', LIMIT)) {
    const [name, ...params] = entry.split(';')
    const tag = name.trim()

    // `*` names no language. It asks for anything, which is what an empty list
    // already gets — carrying it forward would only make the negotiation ask
    // whether we ship a language called `*`.
    if (!tag || tag === '*') {
      continue
    }

    const weight = quality(params)
    // q=0 is the one weight that means something other than ranking: RFC 9110
    // reads it as "not acceptable", so it is a preference against.
    if (weight > 0) {
      rated.push({ tag, weight })
    }
  }

  // Sort is stable, so tags of equal weight keep the order the client wrote them
  // in — which is itself the client's ranking. A tie-breaker index here would be
  // restating a guarantee the language already makes.
  return rated.sort((a, b) => b.weight - a.weight).map((r) => r.tag)
}

/** The one locale to render for a request. */
export function negotiate(
  header: string | null | undefined,
  supported?: readonly string[],
): SupportedLocale {
  // Delegated, never re-derived: a server that matched tags itself is a server
  // where the same person reads one language on their laptop and another on
  // their phone.
  return resolve(accept(header), supported)
}

function quality(params: readonly string[]): number {
  const q = params.map((p) => p.trim()).find((p) => p.toLowerCase().startsWith('q='))
  if (!q) {
    return 1
  }
  // An EMPTY value is unreadable, not zero. `Number('')` is 0, which is finite,
  // so `en-US;q=` used to score zero and be dropped as "not acceptable" — the
  // exact opposite of the rule below, and it discarded the tag a person actually
  // asked for over a missing character.
  const raw = q.slice(2).trim()
  const weight = raw === '' ? Number.NaN : Number(raw)
  // A weight we cannot read leaves the tag at full strength rather than
  // discarding it. The tag is the stated preference; the number is decoration on
  // it, and a typo in the decoration is no reason to stop offering someone their
  // language.
  return Number.isFinite(weight) ? weight : 1
}
