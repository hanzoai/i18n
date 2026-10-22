import { DEFAULT_LOCALE, SUPPORTED_LOCALES, locales, type SupportedLocale } from './locales.ts'

/**
 * Turn what a person's device asked for into a locale we actually ship.
 *
 * Every surface needs this and none of them should answer it differently: a web
 * browser sends `navigator.languages`, a phone reports the OS preference list, a
 * server reads Accept-Language, and all three arrive as BCP-47 tags that are
 * usually NOT one of ours — `en-GB`, `es-MX`, `zh-Hant-HK`. Left to each
 * surface, the same person sees a different language depending on which one they
 * opened, which is the failure this exists to make impossible.
 *
 * The rule is RFC 4647 lookup with two additions, applied in order:
 *
 *   1. the exact tag, case-insensitively — `zh-hant` is `zh-Hant`
 *   2. same language AND same script — `zh-TW` finds `zh-Hant`, never `zh-Hans`;
 *      among those, the same region first — `es` (Spain, maximized) finds `es-ES`,
 *      `es-MX` finds `es-419` by registry order
 *   3. same language — `en-GB` finds `en-US`
 *   4. the default
 *
 * Script is what step 2 buys, and it is the step a naive implementation skips.
 * Chinese is the case that punishes skipping it: `zh-CN` and `zh-TW` differ by
 * WRITING SYSTEM, so matching on language alone hands a Hong Kong reader
 * simplified characters because `zh-Hans` happens to be listed first. Neither tag
 * says its script out loud, so both sides are maximized (`zh-TW` → `zh-Hant-TW`)
 * before comparing — the platform knows this mapping and we do not restate it.
 */
export function resolve(
  requested: string | readonly string[] | null | undefined,
  supported: readonly string[] = SUPPORTED_LOCALES,
): SupportedLocale {
  const wanted = (typeof requested === 'string' ? [requested] : requested ?? []).filter(
    (tag): tag is string => typeof tag === 'string' && tag.trim() !== '',
  )

  // In order: the caller's FIRST preference that we can serve at all beats a
  // later preference we could serve exactly. Someone whose list is [fr, en] is
  // telling us they would rather read approximate French than perfect English.
  for (const tag of wanted) {
    const hit = match(tag.trim().replaceAll('_', '-'), supported)
    if (hit) {
      return hit as SupportedLocale
    }
  }
  return DEFAULT_LOCALE
}

/** Which way a locale's text runs, after negotiating it. Arabic is `rtl`; so is any later RTL entry. */
export function direction(requested: string | null | undefined): 'ltr' | 'rtl' {
  const code = resolve(requested)
  return locales.find((l) => l.code === code)?.dir ?? 'ltr'
}

function match(tag: string, supported: readonly string[]): string | undefined {
  const exact = supported.find((s) => s.toLowerCase() === tag.toLowerCase())
  if (exact) {
    return exact
  }

  const want = parse(tag)
  if (!want.language) {
    return undefined
  }

  const sameLanguage = supported.filter((s) => parse(s).language === want.language)
  if (sameLanguage.length === 0) {
    return undefined
  }
  const sameScript = want.script ? sameLanguage.filter((s) => parse(s).script === want.script) : []
  const near = sameScript.length > 0 ? sameScript : sameLanguage
  return near.find((s) => want.region && parse(s).region === want.region) ?? near[0]
}

/**
 * `no` names the Norwegian macrolanguage, which every OS that sends it means as
 * Bokmål; CLDR leaves it as is, so `Intl` cannot say so for us. (`tl` → `fil` and
 * `in` → `id` it does canonicalize.)
 */
const MACRO: Record<string, string> = { no: 'nb' }

/**
 * The language, script and region of a tag, with script and region filled in
 * where the tag left them implied. `Intl.Locale` holds the likely-subtags data
 * that does the filling, so a runtime that has it answers `zh-TW → Hant` without
 * this file carrying a table that would go stale.
 *
 * A runtime without it still resolves by language, which is step 3 — worse for
 * Chinese, correct for everything else, and never an exception thrown at a person
 * trying to read a page.
 */
function parse(tag: string): { language: string; script?: string; region?: string } {
  try {
    const loc = new Intl.Locale(tag).maximize()
    return { language: MACRO[loc.language] ?? loc.language, script: loc.script, region: loc.region }
  } catch {
    const language = tag.toLowerCase().split('-')[0]
    return { language: MACRO[language] ?? language }
  }
}
