import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@hanzo/i18n'

/**
 * Where a site keeps its localized copies.
 *
 * Values, not a framework: Next, Express and Hono all end up holding an origin
 * and a path, so that is all this asks for.
 */
export interface Site {
  /** Scheme and host, e.g. `https://hanzo.ai`. */
  origin: string
  /** Defaults to every locale the toolkit ships. */
  locales?: readonly string[]
  /** Where one locale's copy of a path lives. Defaults to `/<locale><path>`. */
  url?: (locale: string, path: string) => string
}

export interface Alternate {
  hreflang: string
  href: string
}

/**
 * Every locale's copy of a path, plus `x-default`.
 *
 * A translated page nobody can find is a translation nobody reads, and a crawler
 * finds one only by being told the whole set from every member of it. `x-default`
 * is the extra entry: it names the copy to serve a reader whose language is none
 * of ours, and without it a crawler picks one for them.
 */
export function alternates(path: string, site: Site): Alternate[] {
  const locales = site.locales ?? SUPPORTED_LOCALES
  if (locales.length === 0) {
    return []
  }

  const href = builder(site)
  const at = trim(path)
  const list = locales.map((locale) => ({ hreflang: locale, href: href(locale, at) }))

  // x-default has to point at a page that exists, so a site shipping a subset
  // that excludes our default gets its own first locale rather than a 404.
  const fallback = locales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : locales[0]
  return [...list, { hreflang: 'x-default', href: href(fallback, at) }]
}

/** The `<link rel="alternate">` tags for a page's head. */
export function links(path: string, site: Site): string {
  return alternates(path, site)
    .map((a) => link(a))
    .join('\n')
}

/**
 * A sitemap covering every locale of every path.
 *
 * Each localized URL gets its own `<url>` entry carrying the WHOLE alternate
 * set, including its own. The set is only believed when it is reciprocal, so the
 * shorter sitemap — one entry for the default URL, listing the translations —
 * is quietly ignored and the translations go unindexed.
 */
export function sitemap(paths: readonly string[], site: Site): string {
  const entries = paths.flatMap((path) => {
    const all = alternates(path, site)
    const set = all.map((a) => `    ${link(a, 'xhtml:')}`).join('\n')
    return all
      .filter((a) => a.hreflang !== 'x-default')
      .map((a) => `  <url>\n    <loc>${escape(a.href)}</loc>\n${set}\n  </url>`)
  })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n')
}

/** The same element a head and a sitemap each want, under their own namespace. */
function link(a: Alternate, namespace = ''): string {
  return `<${namespace}link rel="alternate" hreflang="${escape(a.hreflang)}" href="${escape(a.href)}"/>`
}

function builder(site: Site): (locale: string, path: string) => string {
  if (site.url) {
    return site.url
  }
  const origin = site.origin.replace(/\/+$/, '')
  return (locale, path) => `${origin}/${locale}${path}`
}

/** A path with one leading slash and no trailing one, so the root contributes nothing. */
function trim(path: string): string {
  const at = path.startsWith('/') ? path : `/${path}`
  return at.replace(/\/+$/, '')
}

function escape(text: string): string {
  return text
    // Ampersand first. Any other order re-escapes the escapes, and a real URL
    // carries one the moment it has a second query parameter.
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
