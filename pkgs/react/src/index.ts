import type { Resource, ResourceLanguage } from 'i18next'
import { useTranslation } from 'react-i18next'

export { useTranslation, Trans } from 'react-i18next'

/**
 * Re-export of useTranslation as `useT` for the canonical Hanzo idiom.
 * `const { t } = useT(); t('swap.title', { brandName: 'Lux' })`
 */
export const useT = useTranslation

/**
 * Build the i18next `resources` shape from a per-namespace JSON map.
 * Static bundle only — translations live in version control as the single
 * source of truth. Hot-fix workflow is `PR → merge → npm publish → ship`.
 */
export function buildResources(
  bundles: Record<string, Record<string, Record<string, string>>>,
): Resource {
  const out: Resource = {}
  for (const [locale, namespaces] of Object.entries(bundles)) {
    const lang: ResourceLanguage = {}
    for (const [ns, kv] of Object.entries(namespaces)) {
      lang[ns] = kv
    }
    out[locale] = lang
  }
  return out
}
