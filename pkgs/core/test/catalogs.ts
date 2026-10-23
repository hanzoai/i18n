import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, catalog, locales } from '../src/index.ts'
import { loaders } from '../src/loaders.ts'
import { REVIEW } from '../src/review.ts'

const dir = new URL('../catalogs', import.meta.url).pathname
const read = (code: string) => JSON.parse(readFileSync(catalog(dir, code), 'utf8')) as Record<string, unknown>

test('every locale but English has exactly one lazy loader', () => {
  assert.deepEqual(Object.keys(loaders).sort(), SUPPORTED_LOCALES.filter((c) => c !== DEFAULT_LOCALE).sort())
})

test('every locale ships one catalog, a flat map of strings, and nothing else ships', () => {
  const extra = new Set(['provenance.json', 'review.json'])
  const files = readdirSync(dir).filter((f) => !extra.has(f))
  assert.deepEqual(files.sort(), SUPPORTED_LOCALES.map((c) => `${c}.json`).sort())
  for (const code of SUPPORTED_LOCALES) {
    for (const [key, value] of Object.entries(read(code))) {
      assert.equal(typeof value, 'string', `${code}: ${key}`)
    }
  }
})

test('the English catalog is its own source', () => {
  for (const [key, value] of Object.entries(read(DEFAULT_LOCALE))) {
    assert.equal(value, key)
  }
})

/** review.json: a locale's reason, or `{ why, partial }` for one that ships with keys still to translate. */
const review = JSON.parse(readFileSync(`${dir}/review.json`, 'utf8')) as Record<string, unknown>
const partial = new Set(
  Object.entries(review)
    .filter(([, entry]) => typeof (entry as { partial?: unknown } | null)?.partial === 'string')
    .map(([code]) => code),
)

test('every lazy loader resolves a catalog holding every source message, but what a partial locale has not been given', async () => {
  const english = Object.keys(read(DEFAULT_LOCALE))
  for (const [code, load] of Object.entries(loaders)) {
    const loaded = await load()
    const messages = ('default' in loaded ? loaded.default : loaded) as Record<string, string>
    for (const key of english) {
      if (partial.has(code) && !(key in messages)) continue
      assert.ok(messages[key]?.trim(), `${code}: ${JSON.stringify(key)}`)
    }
  }
})

test('the review list is catalogs/review.json: shipped locales, each with its reason', () => {
  const file = review
  assert.deepEqual([...REVIEW].sort(), Object.keys(file).sort(), 'run scripts/sync-catalogs.sh')
  for (const code of REVIEW) {
    assert.ok(SUPPORTED_LOCALES.includes(code as never), code)
    assert.notEqual(code, DEFAULT_LOCALE)
    const entry = file[code]
    // A bare reason, or { why, partial }: a locale that ships before every key reached it says so, and why.
    const why = typeof entry === 'string' ? entry : (entry as { why?: unknown } | null)?.why
    assert.ok(typeof why === 'string' && why.trim(), `${code} names why it waits`)
    if (typeof entry !== 'string') {
      const said = (entry as { partial?: unknown }).partial
      assert.ok(typeof said === 'string' && said.trim(), `${code}: an entry that is not a bare reason says what it lacks`)
    }
  }
  assert.deepEqual(
    locales.filter((l) => l.review).map((l) => l.code).sort(),
    [...REVIEW].sort(),
  )
})
