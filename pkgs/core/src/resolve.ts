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
 *      `pa-Arab` finds `pa-PK`, never Gurmukhi `pa`. Among those, in order:
 *      a. the same region — `es` (Spain, maximized) finds `es-ES`
 *      b. the variant that serves that region (`SERVES`) — `es-CO` finds `es-419`,
 *         `pt-AO` `pt-PT`, `zh-MO` `zh-HK`, `ar-AE` `ar-SA`
 *      c. the variant with no region — `ar-IQ` finds `ar`, `fa-IR` `fa`
 *      d. the language's own region — `fr-BE` finds `fr-FR`, as bare `fr` would
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

/** Which way a locale's text runs, after negotiating it: `rtl` for every locale in Arabic or Hebrew script. */
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
  const own = parse(want.language).region
  return (
    near.find((s) => want.region && region(s) === want.region) ??
    near.find((s) => want.region && SERVES[s]?.includes(want.region)) ??
    near.find((s) => !region(s)) ??
    near.find((s) => own && region(s) === own) ??
    near[0]
  )
}

/**
 * Regions read in a variant other than the one their language falls to. Spanish and
 * Portuguese follow CLDR's parent locales (`es-419` is the parent of every American
 * Spanish, `pt-PT` of every Portuguese outside Brazil); Macau reads Hong Kong's
 * Traditional Chinese; Arabic follows its dialect areas, Gulf, Maghreb and Levant.
 * A region whose own variant ships is matched before this is asked.
 */
const SERVES: Readonly<Record<string, readonly string[]>> = {
  'es-419': ['AR', 'BO', 'BR', 'BZ', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'GT', 'HN', 'MX', 'NI', 'PA', 'PE', 'PR', 'PY', 'SV', 'US', 'UY', 'VE'],
  'pt-PT': ['AO', 'CH', 'CV', 'FR', 'GQ', 'GW', 'LU', 'MO', 'MZ', 'ST', 'TL'],
  'zh-HK': ['MO'],
  'ar-SA': ['AE', 'BH', 'KW', 'OM', 'QA', 'YE'],
  'ar-MA': ['DZ', 'EH', 'LY', 'MR', 'TN'],
  'ar-LB': ['JO', 'PS', 'SY'],
}

/** The region a tag states, not one `maximize` infers: `ar` names no region, though it maximizes to Egypt. */
function region(tag: string): string | undefined {
  try {
    return new Intl.Locale(tag).region
  } catch {
    return undefined
  }
}

/**
 * Languages `Intl` leaves under a name we do not ship. `no` is the Norwegian
 * macrolanguage, which every OS that sends it means as Bokmål. `lah` (Lahnda, what
 * `pnb` canonicalizes to) is the Punjabi of Pakistan, written in Shahmukhi, so it
 * maximizes to Arabic script and finds `pa-PK`. (`tl` → `fil`, `in` → `id`, `iw` →
 * `he` and `prs` → `fa-AF` `Intl` canonicalizes itself.)
 */
const MACRO: Record<string, string> = { no: 'nb', lah: 'pa' }

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
