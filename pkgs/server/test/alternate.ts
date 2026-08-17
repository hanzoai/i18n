import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SUPPORTED_LOCALES } from '@hanzo/i18n'
import { alternates, links, sitemap, type Site } from '../src/alternate.ts'

const site: Site = { origin: 'https://hanzo.ai' }
const few: Site = { origin: 'https://hanzo.ai', locales: ['en-US', 'ja-JP'] }

test('every locale is listed, and so is x-default', () => {
  const all = alternates('/pricing', site)
  assert.equal(all.length, SUPPORTED_LOCALES.length + 1)
  assert.deepEqual(all[0], { hreflang: 'en-US', href: 'https://hanzo.ai/en-US/pricing' })
  assert.deepEqual(all.at(-1), { hreflang: 'x-default', href: 'https://hanzo.ai/en-US/pricing' })
})

test('x-default points at a page that exists', () => {
  // A site shipping a subset that excludes our default would otherwise send
  // every unmatched reader to a URL it does not serve.
  const jp = alternates('/pricing', { origin: 'https://hanzo.ai', locales: ['ja-JP', 'ko-KR'] })
  assert.deepEqual(jp.at(-1), { hreflang: 'x-default', href: 'https://hanzo.ai/ja-JP/pricing' })
  assert.deepEqual(alternates('/pricing', { origin: 'https://hanzo.ai', locales: [] }), [])
})

test('a path is a path however it was written', () => {
  const href = (path: string) => alternates(path, few)[0].href
  assert.equal(href('/about'), 'https://hanzo.ai/en-US/about')
  assert.equal(href('about'), 'https://hanzo.ai/en-US/about')
  assert.equal(href('/about/'), 'https://hanzo.ai/en-US/about')
  // The root contributes nothing, or every home page advertises a trailing
  // slash the site then redirects away from — one crawl wasted per locale.
  assert.equal(href('/'), 'https://hanzo.ai/en-US')
  assert.equal(href(''), 'https://hanzo.ai/en-US')
  assert.equal(alternates('/x', { origin: 'https://hanzo.ai/', locales: ['en-US'] })[0].href, 'https://hanzo.ai/en-US/x')
})

test('a site may keep its locales anywhere', () => {
  // Serving the default unprefixed is the common shape and must not need a
  // second implementation of any of this.
  const bare: Site = {
    origin: 'https://hanzo.ai',
    locales: ['en-US', 'de-DE'],
    url: (locale, path) => (locale === 'en-US' ? `https://hanzo.ai${path}` : `https://de.hanzo.ai${path}`),
  }
  assert.deepEqual(alternates('/about', bare), [
    { hreflang: 'en-US', href: 'https://hanzo.ai/about' },
    { hreflang: 'de-DE', href: 'https://de.hanzo.ai/about' },
    { hreflang: 'x-default', href: 'https://hanzo.ai/about' },
  ])
})

test('head tags are ready to paste', () => {
  assert.equal(
    links('/about', few),
    [
      '<link rel="alternate" hreflang="en-US" href="https://hanzo.ai/en-US/about"/>',
      '<link rel="alternate" hreflang="ja-JP" href="https://hanzo.ai/ja-JP/about"/>',
      '<link rel="alternate" hreflang="x-default" href="https://hanzo.ai/en-US/about"/>',
    ].join('\n'),
  )
})

test('every locale gets its own entry carrying the whole set', () => {
  // The set counts only when it is reciprocal. One entry for the default URL
  // listing the translations reads as a claim nothing confirms, and the
  // translations go unindexed.
  const xml = sitemap(['/about'], few)
  assert.equal(count(xml, '<url>'), 2)
  assert.ok(xml.includes('<loc>https://hanzo.ai/en-US/about</loc>'))
  assert.ok(xml.includes('<loc>https://hanzo.ai/ja-JP/about</loc>'))
  // 2 entries x (2 locales + x-default)
  assert.equal(count(xml, '<xhtml:link'), 6)
  assert.equal(count(xml, 'hreflang="x-default"'), 2)
})

test('a sitemap covers every path', () => {
  const xml = sitemap(['/', '/about', '/pricing'], few)
  assert.equal(count(xml, '<url>'), 6)
  assert.ok(xml.includes('<loc>https://hanzo.ai/ja-JP</loc>'))
})

test('a URL cannot break the document that carries it', () => {
  // A second query parameter is all it takes. Unescaped, the sitemap is not XML
  // and every locale in it is dropped.
  const xml = sitemap(['/s?q=a&sort=<b>'], { origin: 'https://hanzo.ai', locales: ['en-US'] })
  assert.ok(xml.includes('<loc>https://hanzo.ai/en-US/s?q=a&amp;sort=&lt;b&gt;</loc>'))
  assert.ok(!xml.includes('&sort'))
  // Escaping the ampersand anywhere but first escapes the escapes.
  assert.ok(!xml.includes('&amp;lt;'))
  assert.ok(!xml.includes('&amp;amp;'))
})

test('a sitemap is a document, not a fragment', () => {
  const xml = sitemap(['/'], few)
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset '))
  assert.ok(xml.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'))
  assert.ok(xml.endsWith('</urlset>\n'))
  assert.deepEqual(sitemap([], few).match(/<url>/g), null)
})

function count(text: string, needle: string): number {
  return text.split(needle).length - 1
}
