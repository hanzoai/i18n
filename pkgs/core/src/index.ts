export {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  NAMESPACES,
  type SupportedLocale,
  type Namespace,
} from './locales.ts'

export type { TranslationMap, NamespacedTranslations, LocaleTranslations, BrandInterpolation } from './types.ts'

export { resolve } from './resolve.ts'

export { slots, parity } from './slots.ts'

export { source, translation, contents } from './files.ts'
