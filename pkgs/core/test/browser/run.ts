/**
 * The provider and picker in a real browser: every language offered minus those
 * waiting for review, every right-to-left locale turning the page, a choice that survives reload and
 * stays with its account, a failed load that keeps the current language, and a
 * review locale that is honoured by code but never offered or auto-selected. Then
 * `bootScript` in a server-rendered page React hydrates: `<html lang dir>` set before
 * the first paint, never turned back, and no hydration mismatch.
 *
 *   PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome-headless-shell pnpm test:browser
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

import { build, type Plugin } from 'esbuild'
import { chromium, type Page } from 'playwright-core'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

import { Document, props } from './document.ts'
import { PAINTED, preferenceKey } from '../../src/message.ts'
import { REVIEW } from '../../src/review.ts'
import { SUPPORTED_LOCALES, locales } from '../../src/locales.ts'

interface Mark {
  name: string
  value: string | null
  state: DocumentReadyState
  at: number
}
interface Ready {
  lang: string
  dir: string
  text: string | null
}

let origin = 'http://127.0.0.1'
// The pages hand the provider their own catalogs; the real ones are not bundled here.
const catalogs: Plugin = {
  name: 'no-catalogs',
  setup: (b) => b.onLoad({ filter: /loaders\.ts$/ }, () => ({ contents: 'export const loaders = {}', loader: 'ts' })),
}
const bundle = await build({
  entryPoints: [new URL('./app.tsx', import.meta.url).pathname],
  bundle: true,
  write: false,
  format: 'esm',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [catalogs],
})
// Development React, which reports every hydration mismatch it finds.
const hydrate = await build({
  entryPoints: [new URL('./hydrate.ts', import.meta.url).pathname],
  bundle: true,
  write: false,
  format: 'esm',
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [catalogs],
})
const files: Record<string, [string, string | Uint8Array]> = {
  '/app.js': ['text/javascript', bundle.outputFiles[0].contents],
  '/hydrate.js': ['text/javascript', hydrate.outputFiles[0].contents],
  '/rtl.css': ['text/css', readFileSync(new URL('../../rtl.css', import.meta.url))],
}
const page =
  '<!doctype html><html lang="en-US" dir="ltr"><head><link rel="stylesheet" href="/rtl.css"></head>' +
  '<body><div id="root"></div><script type="module" src="/app.js"></script></body></html>'
const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', origin)
  if (url.pathname === '/v1/iam/preferences') {
    // IAM, where this account's language is Arabic: an empty patch reads it, a patch merges.
    let patch = ''
    req.on('data', (chunk) => (patch += chunk))
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ status: 'ok', data: { locale: JSON.parse(patch || '{}').locale ?? 'ar' } }))
    })
    return
  }
  const [type, body] =
    url.pathname === '/boot'
      ? ['text/html', `<!doctype html>${renderToString(createElement(Document, props(url.href)))}`]
      : (files[url.pathname] ?? ['text/html', page])
  res.setHeader('Content-Type', type)
  res.end(body)
}).listen(0, '127.0.0.1')
await new Promise((r) => server.once('listening', r))
origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
const offered = SUPPORTED_LOCALES.length - REVIEW.length
try {
  const tab = await browser.newPage()
  const html = tab.locator('html')
  const select = tab.locator('select')
  const options = async () => select.locator('option').evaluateAll((all) => all.map((o) => (o as HTMLOptionElement).value))

  await tab.goto(origin)
  assert.equal((await options()).length, offered)
  // rtl.css answers to :dir(rtl), so a right-to-left region of a left-to-right page is held too.
  const style = (selector: string) =>
    tab.locator(selector).evaluate((e) => [getComputedStyle(e).direction, getComputedStyle(e).unicodeBidi, getComputedStyle(e).transform])
  assert.equal(await html.getAttribute('dir'), 'ltr')
  assert.deepEqual((await style('#inner')).slice(0, 2), ['ltr', 'isolate'])
  assert.equal((await style('#mirrored'))[2], 'matrix(-1, 0, 0, 1, 0, 0)')
  assert.equal((await style('#plain'))[2], 'none')
  for (const code of REVIEW) {
    assert.ok(!(await options()).includes(code), `${code} is under review and not offered`)
  }

  await select.selectOption('ar')
  await tab.getByRole('heading', { name: 'مرحبًا' }).waitFor()
  assert.equal(await html.getAttribute('dir'), 'rtl')
  assert.equal(await html.getAttribute('lang'), 'ar')
  assert.equal(await tab.locator('aside').getAttribute('data-side'), 'right')
  // rtl.css: machine-readable text keeps its own order inside a right-to-left page.
  assert.deepEqual(
    await tab.locator('main > code').evaluate((e) => [getComputedStyle(e).direction, getComputedStyle(e).unicodeBidi]),
    ['ltr', 'isolate'],
  )

  await tab.reload()
  await tab.getByRole('heading', { name: 'مرحبًا' }).waitFor()

  await tab.goto(`${origin}/?user=bob`)
  await tab.getByRole('heading', { name: 'Welcome' }).waitFor()
  assert.equal(await html.getAttribute('dir'), 'ltr')

  await select.selectOption('fr-FR')
  await tab.getByRole('alert').waitFor()
  assert.equal(await select.inputValue(), 'en-US')

  await select.selectOption('ar')
  await tab.getByRole('heading', { name: 'مرحبًا' }).waitFor()
  await select.selectOption('en-US')
  await tab.getByRole('heading', { name: 'Welcome' }).waitFor()
  assert.equal(await html.getAttribute('dir'), 'ltr')

  if (REVIEW.length > 0) {
    const held = REVIEW[0]
    // A person who chose a review locale keeps it, and sees it selected.
    await tab.evaluate(([key, code]) => localStorage.setItem(key, code), [preferenceKey('carol'), held])
    await tab.goto(`${origin}/?user=carol`)
    await tab.getByRole('heading', { name: `Welcome:${held}` }).waitFor()
    assert.equal(await select.inputValue(), held)
    assert.equal((await options()).length, offered + 1)

    // A host that opts in offers all of them.
    await tab.goto(`${origin}/?user=dave&review`)
    await tab.getByRole('heading', { name: 'Welcome' }).waitFor()
    assert.equal((await options()).length, SUPPORTED_LOCALES.length)

    // A browser set to a review language is not switched into it.
    const visitor = await browser.newPage({ locale: held })
    await visitor.goto(`${origin}/?user=guest`)
    await visitor.getByRole('heading', { name: 'Welcome' }).waitFor()
    assert.equal(await visitor.locator('select').inputValue(), 'en-US')
    await visitor.close()
  }

  // Every right-to-left locale, offered or under review, turns the page around and keeps code left-to-right.
  const rtl = locales.filter((l) => l.dir === 'rtl').map((l) => l.code)
  await tab.goto(`${origin}/?user=erin&review`)
  await tab.getByRole('heading', { name: 'Welcome' }).waitFor()
  for (const code of rtl) {
    await select.selectOption(code)
    await tab.waitForFunction((c) => document.documentElement.lang === c, code)
    assert.equal(await html.getAttribute('dir'), 'rtl', code)
    assert.deepEqual((await style('main > code')).slice(0, 2), ['ltr', 'isolate'], code)
    assert.equal((await style('#plain'))[2], 'matrix(-1, 0, 0, 1, 0, 0)', code)
  }
  await select.selectOption('en-US')
  await tab.waitForFunction(() => document.documentElement.dir === 'ltr')

  // A browser set to an offered language is.
  const reader = await browser.newPage({ locale: 'ar-EG' })
  await reader.goto(`${origin}/?user=guest`)
  await reader.getByRole('heading', { name: 'مرحبًا' }).waitFor()
  assert.equal(await reader.locator('html').getAttribute('dir'), 'rtl')

  // bootScript, in a page React hydrates. Every write to <html lang dir> is recorded by
  // an observer installed before any page script, with the parser's state and the time.
  const watch = () => {
    const w = window as unknown as { marks: Mark[]; ready: Ready }
    w.marks = []
    new MutationObserver((records) => {
      const root = records.filter((r) => r.target === document.documentElement)
      root.forEach((r, i) => {
        const name = r.attributeName as string
        const later = root.slice(i + 1).find((n) => n.attributeName === name)
        w.marks.push({ name, value: later ? later.oldValue : document.documentElement.getAttribute(name), state: document.readyState, at: performance.now() })
      })
    }).observe(document, { attributes: true, attributeOldValue: true, attributeFilter: ['lang', 'dir'], subtree: true })
    document.addEventListener('DOMContentLoaded', () => {
      const html = document.documentElement
      w.ready = { lang: html.lang, dir: html.dir, text: document.querySelector('h1')?.textContent ?? null }
    })
  }
  const reported = (tab: Page) => {
    const errors: string[] = []
    tab.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text()))
    tab.on('pageerror', (e) => errors.push(String(e)))
    return async () => [...errors, ...(await tab.evaluate(() => (window as unknown as { recoverable?: string[] }).recoverable ?? []))]
  }
  const seen = (tab: Page) =>
    tab.evaluate(() => {
      const w = window as unknown as { marks: Mark[]; ready: Ready }
      const paint = performance.getEntriesByType('paint').find((p) => p.name === 'first-paint')?.startTime ?? null
      return { marks: w.marks, ready: w.ready, paint }
    })
  // The page turned right to left by the script, before the parser reached the body and
  // before the first paint, and the provider never turned it back.
  const early = async (tab: Page, lang: string) => {
    const { marks, ready, paint } = await seen(tab)
    assert.deepEqual(marks.slice(0, 2).map((m) => [m.name, m.value, m.state]), [['lang', lang, 'loading'], ['dir', 'rtl', 'loading']])
    assert.deepEqual(ready, { lang, dir: 'rtl', text: 'Welcome' })
    assert.ok(paint === null || marks[1].at <= paint, `dir at ${marks[1].at}ms, first paint at ${paint}ms`)
    assert.deepEqual([...new Set(marks.filter((m) => m.name === 'dir').map((m) => m.value))], ['rtl'])
    return paint
  }

  const visitor = await browser.newContext({ locale: 'en-US' })
  await visitor.addInitScript(watch)
  const first = await visitor.newPage()
  const firstErrors = reported(first)
  await first.goto(`${origin}/boot`)
  await first.getByRole('heading', { name: 'Welcome' }).waitFor()
  await first.waitForFunction(() => document.documentElement.dir === 'ltr')
  // English by default: the script wrote nothing, and only the provider set ltr.
  const english = await seen(first)
  assert.deepEqual(english.marks.filter((m) => m.state === 'loading'), [])
  assert.deepEqual([...new Set(english.marks.filter((m) => m.name === 'dir').map((m) => m.value))], ['ltr'])
  assert.deepEqual(english.ready, { lang: 'en-US', dir: '', text: 'Welcome' })
  await first.locator('select').selectOption('ar')
  await first.getByRole('heading', { name: 'مرحبًا' }).waitFor()
  assert.deepEqual(
    await first.evaluate(([painted, guest]) => [localStorage.getItem(painted), localStorage.getItem(guest)], [PAINTED, preferenceKey(null)]),
    ['ar', 'ar'],
  )
  await first.reload()
  await first.getByRole('heading', { name: 'مرحبًا' }).waitFor()
  const paint = await early(first, 'ar')
  assert.deepEqual(await firstErrors(), [])

  // With no JavaScript after the script, the page is still right to left.
  const bare = await visitor.newPage()
  await bare.route('**/hydrate.js', (route) => route.abort())
  await bare.goto(`${origin}/boot`)
  assert.deepEqual(await bare.evaluate(() => [document.documentElement.lang, document.documentElement.dir, document.querySelector('h1')?.textContent]), ['ar', 'rtl', 'Welcome'])

  // Without suppressHydrationWarning on <html>, React reports the attributes it finds changed:
  // the check above can see a mismatch.
  const strict = await visitor.newPage()
  const strictErrors = reported(strict)
  await strict.goto(`${origin}/boot?strict`)
  await strict.getByRole('heading', { name: 'مرحبًا' }).waitFor()
  assert.ok((await strictErrors()).some((e) => /hydrat/i.test(e)), 'React reports a changed <html> without suppressHydrationWarning')
  await visitor.close()

  // Signed in, the language held only by IAM: the provider mirrors it on this device, so
  // the next load opens right to left with no left-to-right frame in between.
  const member = await browser.newContext({ locale: 'en-US' })
  await member.addInitScript(watch)
  const alice = await member.newPage()
  const aliceErrors = reported(alice)
  await alice.goto(`${origin}/boot?user=alice&iam`)
  await alice.getByRole('heading', { name: 'مرحبًا' }).waitFor()
  assert.deepEqual(
    await alice.evaluate(([painted, own]) => [localStorage.getItem(painted), localStorage.getItem(own)], [PAINTED, preferenceKey('alice')]),
    ['ar', 'ar'],
  )
  await alice.reload()
  await alice.getByRole('heading', { name: 'مرحبًا' }).waitFor()
  await early(alice, 'ar')
  assert.deepEqual(await aliceErrors(), [])
  await member.close()

  console.log(
    `PASS: ${offered} offered (${REVIEW.length} under review: ${REVIEW.join(', ') || 'none'}), Arabic RTL, reload, ` +
      'account isolation, failed load keeps the language, review locale kept by code, browser language negotiation, ' +
      `${rtl.length} right-to-left locales (${rtl.join(', ')}), :dir(rtl) inside a left-to-right page; ` +
      `bootScript: rtl before the parser reached the body (first paint at ${paint === null ? 'unreported' : `${Math.round(paint)}ms`}), ` +
      'never turned back, no JS needed, IAM choice mirrored, hydration without a mismatch',
  )
} finally {
  await browser.close()
  server.close()
}
