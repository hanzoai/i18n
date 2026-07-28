import type { SupportedLocale, Namespace } from './locales'

export type TranslationMap = Record<string, string>
export type NamespacedTranslations = Record<Namespace, TranslationMap>
export type LocaleTranslations = Record<SupportedLocale, NamespacedTranslations>

/**
 * Standard interpolation slots — every Hanzo white-label app supplies these.
 * Match the field names on `@l.x/config` brand singleton.
 */
export interface BrandInterpolation {
  brandName: string
  brandTitle: string
  walletName: string
  protocolName: string
  coinSymbol: string
  appDomain: string
  legalEntity: string
  copyrightHolder: string
  [key: string]: string
}
