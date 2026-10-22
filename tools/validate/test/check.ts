import assert from 'node:assert/strict'
import { test } from 'node:test'

import { check, line, type Namespace } from '../src/check.ts'

const ns = (source: Namespace['source'], locales: Namespace['locales']): Namespace => ({
  name: 'exchange',
  source,
  locales,
})

const what = (problems: ReturnType<typeof check>) => problems.map((p) => `${p.locale}/${p.key ?? ''}`)

test('a complete locale is silent', () => {
  assert.deepEqual(check(ns({ a: 'A', b: 'B {{x}}' }, { 'ja-JP': { a: 'あ', b: 'ビー {{x}}' } }), []), [])
})

test('a key nobody translated is named', () => {
  const problems = check(ns({ a: 'A', b: 'B' }, { 'ja-JP': { a: 'あ' } }), [])
  assert.equal(problems.length, 1)
  assert.equal(line(problems[0]), 'ja-JP/exchange b: is missing')
})

test('an untouched locale is one line, not four hundred', () => {
  // Reporting every key of a locale nobody has started buries the three real
  // breakages under a locale's worth of noise.
  const problems = check(ns({ a: 'A', b: 'B', c: 'C' }, { 'ja-JP': undefined }), [])
  assert.equal(problems.length, 1)
  assert.equal(line(problems[0]), 'ja-JP/exchange: has no translations at all')
})

test('a slot that did not survive translation is named with both sides', () => {
  const problems = check(ns({ a: 'Swap {{amount}}' }, { 'de-DE': { a: 'Tauschen' } }), [])
  assert.equal(line(problems[0]), 'de-DE/exchange a: slots none, source has {{amount}}')

  const renamed = check(ns({ a: '{{amount}}' }, { 'de-DE': { a: '{{betrag}}' } }), [])
  assert.equal(line(renamed[0]), 'de-DE/exchange a: slots {{betrag}}, source has {{amount}}')
})

test('reordering slots is translating, not breaking', () => {
  assert.deepEqual(
    check(ns({ a: '{{amount}} of {{token}}' }, { 'de-DE': { a: '{{token}} im Wert von {{amount}}' } }), []),
    [],
  )
})

test('every locale asked for is checked, and the source is not a translation', () => {
  const problems = check(ns({ a: 'A' }, { 'en-US': {}, 'ja-JP': {}, 'ko-KR': {}, 'fr-FR': { a: 'Ah' } }), [])
  // en-US is the source; asking it to translate itself reports the whole file.
  assert.deepEqual(what(problems), ['ja-JP/a', 'ko-KR/a'])
})

test('a brand name in the copy fails the gate', () => {
  // The forbid list belongs to the product. The toolkit only enforces it.
  const problems = check(ns({ a: 'Open Lux Wallet' }, {}), ['Lux Wallet', 'zoo.exchange'])
  assert.equal(line(problems[0]), 'en-US/exchange a: holds "Lux Wallet", which belongs to the product')
  assert.deepEqual(check(ns({ a: 'Open your wallet' }, {}), ['Lux Wallet']), [])
})

test('a brand name is one in any case, and in any locale', () => {
  // A translation moves words to the front of sentences, where the case changes;
  // and the leak is just as hardcoded in Japanese as in English.
  assert.equal(check(ns({ a: 'open lux wallet' }, {}), ['Lux Wallet']).length, 1)
  const inTranslation = check(ns({ a: 'Open it' }, { 'ja-JP': { a: 'Lux Walletを開く' } }), ['Lux Wallet'])
  assert.equal(line(inTranslation[0]), 'ja-JP/exchange a: holds "Lux Wallet", which belongs to the product')
})

test('an empty forbid list forbids nothing', () => {
  assert.deepEqual(check(ns({ a: 'Open Lux Wallet' }, { 'ja-JP': { a: 'Lux Walletを開く' } }), []), [])
})

test('everything wrong is reported at once', () => {
  const problems = check(
    ns({ a: 'A {{x}}', b: 'B', c: 'Lux Wallet' }, { 'ja-JP': { a: 'あ', b: 'ビー' }, 'ko-KR': undefined }),
    ['Lux Wallet'],
  )
  assert.deepEqual(what(problems), ['en-US/c', 'ja-JP/a', 'ja-JP/c', 'ko-KR/'])
})

test('a key a translation has and the source does not is nobody’s problem', () => {
  // Stale, not broken: i18next never asks for it, so failing a release over it
  // would be the gate inventing work.
  assert.deepEqual(check(ns({ a: 'A' }, { 'ja-JP': { a: 'あ', old: '古い' } }), []), [])
})

test('a protected name a translation dropped fails the gate', () => {
  const terms = { keep: ['Hanzo', 'Claude Code'] }
  const problems = check(ns({ a: 'Accelerate Claude Code with Hanzo' }, { 'ar': { a: 'سرّع كلود كود مع هانزو' } }), [], terms)
  assert.equal(line(problems[0]), 'ar/exchange a: drops Claude Code, Hanzo, which stays as written in every locale')
  assert.equal(problems[0].review, undefined)
  assert.deepEqual(check(ns({ a: 'Accelerate Claude Code with Hanzo' }, { 'ar': { a: 'سرّع Claude Code مع Hanzo' } }), [], terms), [])
})

test('the wrong script and the wrong Chinese fail; English-identical prose is only for review', () => {
  const problems = check(
    ns(
      { a: 'Pending Invitations', b: 'Account and organization', c: 'Open source' },
      { 'ja-JP': { a: 'Pending invites', b: 'アカウントと組織', c: 'オープンソース' }, 'zh-Hant': { a: '待處理邀請', b: '账户和组织机构', c: '開源' }, nl: { a: 'Openstaande uitnodigingen', b: 'Account en organisatie', c: 'Open source' } },
    ),
    [],
  )
  assert.deepEqual(
    problems.map((p) => [line(p), p.review ?? false]),
    [
      ["ja-JP/exchange a: is not written in ja-JP's script", false],
      ['zh-Hant/exchange b: uses Simplified characters in Traditional Chinese', false],
      ['nl/exchange c: is identical to the English', true],
    ],
  )
})

test('a {name} argument is held to parity like a {{slot}}', () => {
  const problems = check(ns({ a: 'Hello {name}' }, { 'fr-FR': { a: 'Bonjour' } }), [])
  assert.equal(line(problems[0]), 'fr-FR/exchange a: slots none, source has {name}')
})
