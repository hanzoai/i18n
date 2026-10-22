// A catalog is a flat map from English source to translation. Declared here rather
// than resolved (`resolveJsonModule`), because the catalogs sit beside `src/`, not
// under it, and are shipped as they are rather than compiled.
declare module '*.json' {
  const strings: Record<string, string>
  export default strings
}
