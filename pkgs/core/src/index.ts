export {
  locales,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  NAMESPACES,
  type Locale,
  type SupportedLocale,
  type Namespace,
} from './locales.ts'

export type { TranslationMap, NamespacedTranslations, LocaleTranslations, BrandInterpolation } from './types.ts'

export { resolve, direction } from './resolve.ts'

export { slots, parity } from './slots.ts'

export { faults, prose, SOFT, type Terms } from './rules.ts'

export { source, translation, catalog, contents } from './files.ts'

export { translate, pieces, isolate, phrase, preferenceKey, type Piece } from './message.ts'
