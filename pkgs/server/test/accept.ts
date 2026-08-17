import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolve } from '@hanzo/i18n'
import { accept, negotiate } from '../src/accept.ts'

test('a header is its tags, best first', () => {
  assert.deepEqual(accept('en-GB,en;q=0.9,fr;q=0.8'), ['en-GB', 'en', 'fr'])
})

test('weight ranks, it does not filter', () => {
  // The header is written in whatever order the client felt like; the q values
  // are the ranking. Reading it as written serves Dutch to someone who asked
  // for Japanese.
  assert.deepEqual(accept('nl;q=0.2,ja;q=0.9,de;q=0.5'), ['ja', 'de', 'nl'])
  assert.equal(negotiate('nl;q=0.2,ja;q=0.9,de;q=0.5'), 'ja-JP')
})

test('an unweighted tag outranks a weighted one', () => {
  // Omitted q is 1, which is the top. Chrome and Firefox both write their first
  // choice this way, so reading a missing q as 0 inverts every real request.
  assert.deepEqual(accept('fr,en;q=0.9'), ['fr', 'en'])
  assert.deepEqual(accept('en;q=0.9,fr'), ['fr', 'en'])
})

test('equal weights keep the order the client wrote', () => {
  assert.deepEqual(accept('de;q=0.9,fr;q=0.9,es;q=0.9'), ['de', 'fr', 'es'])
  assert.deepEqual(accept('es;q=0.9,fr;q=0.9,de;q=0.9'), ['es', 'fr', 'de'])
})

test('q=0 is a preference against', () => {
  assert.deepEqual(accept('de;q=0,fr;q=0.5'), ['fr'])
  assert.deepEqual(accept('de;q=0'), [])
})

test('whitespace and case in the header are not meaning', () => {
  assert.deepEqual(accept(' fr-CA ; q=0.8 , en-US ; Q=0.9 '), ['en-US', 'fr-CA'])
})

test('a header we cannot read still renders a page', () => {
  // This runs on every request. It has no failure mode.
  assert.deepEqual(accept(''), [])
  assert.deepEqual(accept(null), [])
  assert.deepEqual(accept(undefined), [])
  assert.deepEqual(accept(',,,'), [])
  assert.deepEqual(accept('fr;q=nonsense'), ['fr'])
  assert.equal(negotiate(null), 'en-US')
  assert.equal(negotiate('☃'), 'en-US')
})

test('a wildcard asks for anything, which is the default', () => {
  assert.deepEqual(accept('*'), [])
  assert.equal(negotiate('*'), 'en-US')
  assert.deepEqual(accept('*;q=0.5,ja;q=0.9'), ['ja'])
})

test('one header cannot ask for unbounded work', () => {
  // Anyone who can reach the port writes this string.
  const flood = Array.from({ length: 5000 }, (_, i) => `x${i};q=0.5`).join(',')
  assert.ok(accept(flood).length <= 32)
  assert.equal(negotiate(`${flood},de-DE`), 'en-US')
})

test('negotiate and resolve cannot disagree', () => {
  // The server exists to ANSWER what was asked, never to re-decide what we
  // serve. If it ever grew its own matching, a laptop and a phone set to the
  // same language would read different pages.
  for (const header of ['zh-Hant-HK', 'en-GB', 'es-MX,en;q=0.4', 'ko-KR', 'cy-GB']) {
    assert.equal(negotiate(header), resolve(accept(header)), header)
  }
})

test('a caller may state its own supported set', () => {
  assert.equal(negotiate('de-DE', ['en-US', 'ja-JP']), 'en-US')
  assert.equal(negotiate('ja,de', ['en-US', 'ja-JP']), 'ja-JP')
})

test('real browsers', () => {
  assert.equal(negotiate('en-US,en;q=0.9'), 'en-US')
  assert.equal(negotiate('zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7'), 'zh-TW')
  assert.equal(negotiate('zh-HK,zh;q=0.9,en;q=0.8'), 'zh-TW')
  assert.equal(negotiate('pt-BR,pt;q=0.9,en-US;q=0.8'), 'pt-PT')
})

test('a q with no number is a typo, not a refusal', () => {
  // `Number('')` is 0 — finite — so an empty q scored zero and the tag was
  // dropped as "not acceptable", discarding the language someone asked for over
  // a missing character. Unreadable means full strength, which is what the rule
  // beside it has always said.
  assert.deepEqual(accept('en-US;q='), ['en-US'])
  assert.deepEqual(accept('fr-FR;q=,de-DE;q=,ja-JP'), ['fr-FR', 'de-DE', 'ja-JP'])
  assert.deepEqual(accept('en-US;q=   '), ['en-US'])
  // A real zero still means what RFC 9110 says it means.
  assert.deepEqual(accept('en-US;q=0,fr-FR'), ['fr-FR'])
})
