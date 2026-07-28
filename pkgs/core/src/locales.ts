/**
 * Canonical 14 locales the Hanzo ecosystem supports.
 * To add a locale: append here, run zen-translator, ship.
 */
export const SUPPORTED_LOCALES = [
  'en-US',
  'zh-CN',
  'zh-TW',
  'nl-NL',
  'fr-FR',
  'de-DE',
  'id-ID',
  'ja-JP',
  'ko-KR',
  'pt-PT',
  'ru-RU',
  'es-ES',
  'tr-TR',
  'vi-VN',
] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: SupportedLocale = 'en-US'

/**
 * Names spaces — keep in sync with the source/ directory layout.
 */
export const NAMESPACES = ['shared', 'exchange', 'wallet', 'chat', 'identity', 'docs'] as const
export type Namespace = (typeof NAMESPACES)[number]
