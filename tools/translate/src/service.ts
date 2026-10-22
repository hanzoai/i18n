import type { Terms } from '@hanzo/i18n'

import type { Engine } from './fill.ts'

export type Tier = 'quality' | 'bulk'

/**
 * Hanzo's translation endpoint, `POST /v1/translate` (HIP-0516), as an `Engine`.
 *
 * One request per group: the strings go as `batch` in key order and come back as
 * `translations[i].text` in the same order. The endpoint keeps a translation
 * memory per org, so an unchanged string costs nothing the second time. The
 * protected names go as its `glossary`, each fixed to itself. A string the
 * endpoint could not translate carries `error` and no text; it is answered as
 * absent, so `fill` reports it and the next run asks again.
 */
export function service(origin: string, key: string, tier: Tier, terms: Terms = {}, model?: string): Engine {
  const endpoint = `${origin.replace(/\/+$/, '')}/v1/translate`
  const glossary = Object.fromEntries((terms.keep ?? []).map((name) => [name, name]))
  return async (want, locale) => {
    const keys = Object.keys(want)
    const answer = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        batch: keys.map((k) => want[k]),
        target: locale,
        source: 'en',
        tier,
        ...(Object.keys(glossary).length > 0 && { glossary }),
        ...(model && { model }),
      }),
    })
    if (!answer.ok) {
      throw new Error(`${endpoint} answered ${answer.status}: ${(await answer.text()).slice(0, 200)}`)
    }
    const body = (await answer.json()) as { translations?: { text?: unknown; error?: string }[] }
    const translations = body.translations
    if (!Array.isArray(translations) || translations.length !== keys.length) {
      throw new Error(`${endpoint} answered ${Array.isArray(translations) ? translations.length : 'no'} translations for ${keys.length} strings`)
    }
    return Object.fromEntries(keys.map((k, i) => [k, translations[i]?.error ? undefined : translations[i]?.text]))
  }
}
