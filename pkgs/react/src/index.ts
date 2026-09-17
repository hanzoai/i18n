import type { Resource, ResourceLanguage } from 'i18next'

/**
 * `useT` is the canonical Hanzo idiom for useTranslation.
 * `const { t } = useT(); t('swap.title', { brandName: 'Lux' })`
 *
 * A re-export, not `const useT = useTranslation`: an aliased value has to have
 * its type NAMED in the declaration output, and react-i18next's overload type
 * is not exported, so the alias form cannot be declared at all.
 */
export { useTranslation, useTranslation as useT, Trans } from 'react-i18next'

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
