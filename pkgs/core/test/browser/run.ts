/**
 * The provider and picker in a real browser: 36 languages offered minus those
 * waiting for review, Arabic right-to-left, a choice that survives reload and
 * stays with its account, a failed load that keeps the current language, and a
 * review locale that is honoured by code but never offered or auto-selected.
 *
 *   PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome-headless-shell pnpm test:browser
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

import { build } from 'esbuild'
import { chromium } from 'playwright-core'

import { preferenceKey } from '../../src/message.ts'
import { REVIEW } from '../../src/review.ts'
import { SUPPORTED_LOCALES } from '../../src/locales.ts'

let origin = 'http://127.0.0.1'
const bundle = await build({
  entryPoints: [new URL('./app.tsx', import.meta.url).pathname],
  bundle: true,
  write: false,
  format: 'esm',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  // The app hands the provider its own catalogs; the real ones are not bundled here.
  plugins: [{ name: 'no-catalogs', setup: (b) => b.onLoad({ filter: /loaders\.ts$/ }, () => ({ contents: 'export const loaders = {}', loader: 'ts' })) }],
})
const files: Record<string, [string, string | Uint8Array]> = {
  '/app.js': ['text/javascript', bundle.outputFiles[0].contents],
  '/rtl.css': ['text/css', readFileSync(new URL('../../rtl.css', import.meta.url))],
}
const page =
  '<!doctype html><html lang="en-US" dir="ltr"><head><link rel="stylesheet" href="/rtl.css"></head>' +
  '<body><div id="root"></div><script type="module" src="/app.js"></script></body></html>'
const server = createServer((req, res) => {
  const [type, body] = files[new URL(req.url ?? '/', origin).pathname] ?? ['text/html', page]
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
    await tab.locator('code').evaluate((e) => [getComputedStyle(e).direction, getComputedStyle(e).unicodeBidi]),
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

  // A browser set to an offered language is.
  const reader = await browser.newPage({ locale: 'ar-EG' })
  await reader.goto(`${origin}/?user=guest`)
  await reader.getByRole('heading', { name: 'مرحبًا' }).waitFor()
  assert.equal(await reader.locator('html').getAttribute('dir'), 'rtl')

  console.log(
    `PASS: ${offered} offered (${REVIEW.length} under review: ${REVIEW.join(', ') || 'none'}), Arabic RTL, reload, ` +
      'account isolation, failed load keeps the language, review locale kept by code, browser language negotiation',
  )
} finally {
  await browser.close()
  server.close()
}
