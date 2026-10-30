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
  'ar-EG': () => import('../catalogs/ar-EG.json', { with: { type: 'json' } }),
  'ar-LB': () => import('../catalogs/ar-LB.json', { with: { type: 'json' } }),
  'ar-MA': () => import('../catalogs/ar-MA.json', { with: { type: 'json' } }),
  'ar-SA': () => import('../catalogs/ar-SA.json', { with: { type: 'json' } }),
  'hy': () => import('../catalogs/hy.json', { with: { type: 'json' } }),
  'as': () => import('../catalogs/as.json', { with: { type: 'json' } }),
  'az': () => import('../catalogs/az.json', { with: { type: 'json' } }),
  'bn': () => import('../catalogs/bn.json', { with: { type: 'json' } }),
  'bho': () => import('../catalogs/bho.json', { with: { type: 'json' } }),
  'my': () => import('../catalogs/my.json', { with: { type: 'json' } }),
  'ceb': () => import('../catalogs/ceb.json', { with: { type: 'json' } }),
  'ckb': () => import('../catalogs/ckb.json', { with: { type: 'json' } }),
  'zh-HK': () => import('../catalogs/zh-HK.json', { with: { type: 'json' } }),
  'zh-Hans': () => import('../catalogs/zh-Hans.json', { with: { type: 'json' } }),
  'zh-Hant': () => import('../catalogs/zh-Hant.json', { with: { type: 'json' } }),
  'da': () => import('../catalogs/da.json', { with: { type: 'json' } }),
  'fa-AF': () => import('../catalogs/fa-AF.json', { with: { type: 'json' } }),
  'nl': () => import('../catalogs/nl.json', { with: { type: 'json' } }),
  'fil': () => import('../catalogs/fil.json', { with: { type: 'json' } }),
  'fi': () => import('../catalogs/fi.json', { with: { type: 'json' } }),
  'fr-CA': () => import('../catalogs/fr-CA.json', { with: { type: 'json' } }),
  'fr-FR': () => import('../catalogs/fr-FR.json', { with: { type: 'json' } }),
  'ka': () => import('../catalogs/ka.json', { with: { type: 'json' } }),
  'de-DE': () => import('../catalogs/de-DE.json', { with: { type: 'json' } }),
  'gu': () => import('../catalogs/gu.json', { with: { type: 'json' } }),
  'ht': () => import('../catalogs/ht.json', { with: { type: 'json' } }),
  'ha': () => import('../catalogs/ha.json', { with: { type: 'json' } }),
  'he': () => import('../catalogs/he.json', { with: { type: 'json' } }),
  'hi-IN': () => import('../catalogs/hi-IN.json', { with: { type: 'json' } }),
  'id-ID': () => import('../catalogs/id-ID.json', { with: { type: 'json' } }),
  'it-IT': () => import('../catalogs/it-IT.json', { with: { type: 'json' } }),
  'ja-JP': () => import('../catalogs/ja-JP.json', { with: { type: 'json' } }),
  'jv': () => import('../catalogs/jv.json', { with: { type: 'json' } }),
  'kn': () => import('../catalogs/kn.json', { with: { type: 'json' } }),
  'kk': () => import('../catalogs/kk.json', { with: { type: 'json' } }),
  'km': () => import('../catalogs/km.json', { with: { type: 'json' } }),
  'ko-KR': () => import('../catalogs/ko-KR.json', { with: { type: 'json' } }),
  'ku': () => import('../catalogs/ku.json', { with: { type: 'json' } }),
  'ky': () => import('../catalogs/ky.json', { with: { type: 'json' } }),
  'lo': () => import('../catalogs/lo.json', { with: { type: 'json' } }),
  'ms': () => import('../catalogs/ms.json', { with: { type: 'json' } }),
  'ml': () => import('../catalogs/ml.json', { with: { type: 'json' } }),
  'mr': () => import('../catalogs/mr.json', { with: { type: 'json' } }),
  'mn': () => import('../catalogs/mn.json', { with: { type: 'json' } }),
  'ne': () => import('../catalogs/ne.json', { with: { type: 'json' } }),
  'nb': () => import('../catalogs/nb.json', { with: { type: 'json' } }),
  'or': () => import('../catalogs/or.json', { with: { type: 'json' } }),
  'om': () => import('../catalogs/om.json', { with: { type: 'json' } }),
  'ps': () => import('../catalogs/ps.json', { with: { type: 'json' } }),
  'fa': () => import('../catalogs/fa.json', { with: { type: 'json' } }),
  'pt-BR': () => import('../catalogs/pt-BR.json', { with: { type: 'json' } }),
  'pt-PT': () => import('../catalogs/pt-PT.json', { with: { type: 'json' } }),
  'pa': () => import('../catalogs/pa.json', { with: { type: 'json' } }),
  'pa-PK': () => import('../catalogs/pa-PK.json', { with: { type: 'json' } }),
  'ru': () => import('../catalogs/ru.json', { with: { type: 'json' } }),
  'sd': () => import('../catalogs/sd.json', { with: { type: 'json' } }),
  'si': () => import('../catalogs/si.json', { with: { type: 'json' } }),
  'so': () => import('../catalogs/so.json', { with: { type: 'json' } }),
  'es-AR': () => import('../catalogs/es-AR.json', { with: { type: 'json' } }),
  'es-419': () => import('../catalogs/es-419.json', { with: { type: 'json' } }),
  'es-MX': () => import('../catalogs/es-MX.json', { with: { type: 'json' } }),
  'es-ES': () => import('../catalogs/es-ES.json', { with: { type: 'json' } }),
  'su': () => import('../catalogs/su.json', { with: { type: 'json' } }),
  'sw': () => import('../catalogs/sw.json', { with: { type: 'json' } }),
  'sv': () => import('../catalogs/sv.json', { with: { type: 'json' } }),
  'tg': () => import('../catalogs/tg.json', { with: { type: 'json' } }),
  'ta': () => import('../catalogs/ta.json', { with: { type: 'json' } }),
  'te': () => import('../catalogs/te.json', { with: { type: 'json' } }),
  'th': () => import('../catalogs/th.json', { with: { type: 'json' } }),
  'tr': () => import('../catalogs/tr.json', { with: { type: 'json' } }),
  'tk': () => import('../catalogs/tk.json', { with: { type: 'json' } }),
  'uk': () => import('../catalogs/uk.json', { with: { type: 'json' } }),
  'ur': () => import('../catalogs/ur.json', { with: { type: 'json' } }),
  'ug': () => import('../catalogs/ug.json', { with: { type: 'json' } }),
  'uz': () => import('../catalogs/uz.json', { with: { type: 'json' } }),
  'vi': () => import('../catalogs/vi.json', { with: { type: 'json' } }),
}

/**
 * `loadCatalog` for I18nProvider from the catalogs bundled with this package: one lazy
 * chunk per locale, the whole catalog. A host that serves catalogs itself (in parts,
 * from a CDN) passes its own and never imports this, so its build carries none of them.
 */
export const bundled = (code: string): Promise<Catalog> => {
  const load = loaders[code]
  return load ? load() : Promise.reject(new Error(`no catalog for ${code}`))
}
