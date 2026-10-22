/** A catalog, as a dynamic import hands it back. */
export type Catalog = Record<string, string> | { default: Record<string, string> }

/**
 * One lazy import per shipped locale, so a bundler splits each catalog into its own
 * chunk and a reader downloads only the language they chose. Literal specifiers on
 * purpose: a template string would leave the bundler guessing which files exist.
 * English is the source and needs no catalog.
 */
export const loaders: Readonly<Record<string, () => Promise<Catalog>>> = {
  'am': () => import('../catalogs/am.json', { with: { type: 'json' } }),
  'ar': () => import('../catalogs/ar.json', { with: { type: 'json' } }),
  'bn': () => import('../catalogs/bn.json', { with: { type: 'json' } }),
  'bho': () => import('../catalogs/bho.json', { with: { type: 'json' } }),
  'zh-Hans': () => import('../catalogs/zh-Hans.json', { with: { type: 'json' } }),
  'zh-Hant': () => import('../catalogs/zh-Hant.json', { with: { type: 'json' } }),
  'da': () => import('../catalogs/da.json', { with: { type: 'json' } }),
  'nl': () => import('../catalogs/nl.json', { with: { type: 'json' } }),
  'fil': () => import('../catalogs/fil.json', { with: { type: 'json' } }),
  'fi': () => import('../catalogs/fi.json', { with: { type: 'json' } }),
  'fr-FR': () => import('../catalogs/fr-FR.json', { with: { type: 'json' } }),
  'de-DE': () => import('../catalogs/de-DE.json', { with: { type: 'json' } }),
  'gu': () => import('../catalogs/gu.json', { with: { type: 'json' } }),
  'ha': () => import('../catalogs/ha.json', { with: { type: 'json' } }),
  'hi-IN': () => import('../catalogs/hi-IN.json', { with: { type: 'json' } }),
  'id-ID': () => import('../catalogs/id-ID.json', { with: { type: 'json' } }),
  'it-IT': () => import('../catalogs/it-IT.json', { with: { type: 'json' } }),
  'ja-JP': () => import('../catalogs/ja-JP.json', { with: { type: 'json' } }),
  'kn': () => import('../catalogs/kn.json', { with: { type: 'json' } }),
  'ko-KR': () => import('../catalogs/ko-KR.json', { with: { type: 'json' } }),
  'ml': () => import('../catalogs/ml.json', { with: { type: 'json' } }),
  'mr': () => import('../catalogs/mr.json', { with: { type: 'json' } }),
  'nb': () => import('../catalogs/nb.json', { with: { type: 'json' } }),
  'pt-BR': () => import('../catalogs/pt-BR.json', { with: { type: 'json' } }),
  'ru': () => import('../catalogs/ru.json', { with: { type: 'json' } }),
  'es-419': () => import('../catalogs/es-419.json', { with: { type: 'json' } }),
  'es-ES': () => import('../catalogs/es-ES.json', { with: { type: 'json' } }),
  'sw': () => import('../catalogs/sw.json', { with: { type: 'json' } }),
  'sv': () => import('../catalogs/sv.json', { with: { type: 'json' } }),
  'ta': () => import('../catalogs/ta.json', { with: { type: 'json' } }),
  'te': () => import('../catalogs/te.json', { with: { type: 'json' } }),
  'th': () => import('../catalogs/th.json', { with: { type: 'json' } }),
  'tr': () => import('../catalogs/tr.json', { with: { type: 'json' } }),
  'uk': () => import('../catalogs/uk.json', { with: { type: 'json' } }),
  'vi': () => import('../catalogs/vi.json', { with: { type: 'json' } }),
}
