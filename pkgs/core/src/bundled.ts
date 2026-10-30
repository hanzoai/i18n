// The catalogs this package ships, as `loadCatalog` for I18nProvider (`./loaders.ts`).
// Its own entry so that a host which serves catalogs itself bundles none of them.
export { bundled, loaders, type Catalog } from './loaders.ts'
