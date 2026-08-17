import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SUPPORTED_LOCALES, resolve } from '@hanzo/i18n'
import { detect, locales } from '../src/index.ts'

test('a device preference becomes a locale we ship', () => {
  assert.equal(detect({ locales: () => ['ja-JP'] }), 'ja-JP')
  assert.equal(detect({ locales: () => ['en-GB'] }), 'en-US')
  assert.equal(detect({ locales: () => ['zh-Hant-HK'] }), 'zh-TW')
})

test('the phone answers with a list, and order is preference', () => {
  // iOS hands back AppleLanguages, which is the whole ordered list.
  assert.equal(detect({ locales: () => ['fr-CA', 'en-US'] }), 'fr-FR')
})

test('no device is the default, not a crash', () => {
  // A native screen rendered on a server, or a unit test, has no device. It must
  // still render.
  assert.equal(detect({ locales: () => [] }), 'en-US')
})

test('detect and resolve cannot disagree', () => {
  // native exists to ANSWER a question, not to re-answer the negotiation. If it
  // ever grew its own matching, a phone and a browser set to the same language
  // would render differently, which is the bug this package is shaped to avoid.
  for (const tag of ['zh-Hant-HK', 'en-GB', 'es-MX', 'ko-KR', 'nope']) {
    assert.equal(detect({ locales: () => [tag] }), resolve(tag), tag)
  }
})

test('locales() answers a usable tag on any runtime, and never throws', () => {
  // The previous assertion here could not fail — `Array.isArray(x) || typeof x
  // === 'object'` is true for every array — so it tested nothing while looking
  // like it tested the fallback. What is actually worth pinning is that whatever
  // this returns is something `resolve` can take: a list of tags, possibly empty
  // on a runtime with no Intl, and never an exception on the render path.
  const got = locales()
  assert.ok(Array.isArray(got), 'a list, so resolve can read it as preferences')
  for (const tag of got) {
    assert.equal(typeof tag, 'string')
    assert.ok(tag.length > 0)
  }
  assert.ok(SUPPORTED_LOCALES.includes(resolve(got) as never), 'always lands on a locale we ship')
})
