import assert from 'node:assert/strict'
import { test } from 'node:test'

import { merge, scan } from '../src/scan.ts'

const keys = (code: string) => scan(code, 'shared').map((k) => `${k.namespace}:${k.key}`)

test('a key is whatever t() was asked for', () => {
  assert.deepEqual(keys(`t('swap.title')`), ['shared:swap.title'])
  assert.deepEqual(keys(`t("swap.title")`), ['shared:swap.title'])
  assert.deepEqual(keys(`const { t } = useT(); return t('a') + t('b')`), ['shared:a', 'shared:b'])
})

test('a key names its own namespace when it wants one', () => {
  assert.deepEqual(keys(`t('exchange:swap.title')`), ['exchange:swap.title'])
  // A key with two colons keeps the rest of itself.
  assert.deepEqual(scan(`t('exchange:a:b')`, 'shared')[0].key, 'a:b')
})

test('English written beside the key is the English we keep', () => {
  assert.equal(scan(`t('swap.title', 'Swap tokens')`, 'shared')[0].english, 'Swap tokens')
  assert.equal(scan(`t('exchange:swap.go', 'Go')`, 'shared')[0].english, 'Go')
})

test('a key with no English stands in for itself', () => {
  // Not blank: an empty value renders an empty screen, and a key at least says
  // which string is missing. `cli` reports these so somebody writes them.
  assert.equal(scan(`t('swap.title')`, 'shared')[0].english, 'swap.title')
})

test('Trans is a call by another name', () => {
  assert.deepEqual(keys(`<Trans i18nKey="legal.terms">read the <a>terms</a></Trans>`), ['shared:legal.terms'])
  assert.deepEqual(keys(`<Trans i18nKey='wallet:send.hint' />`), ['wallet:send.hint'])
})

test('functions that merely end in t are not translation', () => {
  // The narrowness is the point. `split(` and `format(` end in `t(` and appear
  // in every file; matching them files hundreds of keys named `,` and `%s`.
  assert.deepEqual(keys(`s.split('x'); format('%s'); at('0'); print('hi')`), [])
  // The ones that genuinely are, via a boundary: bare, member, method.
  assert.deepEqual(keys(`i18n.t('a'); this.t('b'); t('c')`), ['shared:a', 'shared:b', 'shared:c'])
})

test('a key built at runtime is not extracted', () => {
  // Nothing static can know what `section` holds. Silently emitting the literal
  // part would file a key no screen ever asks for.
  assert.deepEqual(keys('t(`nav.${section}`)'), [])
  assert.deepEqual(keys(`t(key)`), [])
})

test('merge adds what is missing and edits nothing', () => {
  const before = { 'swap.title': 'Trade tokens' }
  const after = merge(before, scan(`t('swap.title', 'Swap')  t('swap.go', 'Go')`, 'shared'), 'shared')
  // The reviewed English wins over whatever a developer typed to see it render.
  assert.deepEqual(after, { 'swap.go': 'Go', 'swap.title': 'Trade tokens' })
})

test('merge is per namespace', () => {
  const found = scan(`t('exchange:a', 'A')  t('wallet:b', 'B')`, 'shared')
  assert.deepEqual(merge({}, found, 'exchange'), { a: 'A' })
  assert.deepEqual(merge({}, found, 'wallet'), { b: 'B' })
})

test('merge run twice is merge run once', () => {
  const found = scan(`t('a', 'A')  t('b', 'B')`, 'shared')
  const once = merge({}, found, 'shared')
  assert.deepEqual(merge(once, found, 'shared'), once)
  assert.equal(JSON.stringify(merge(once, found, 'shared')), JSON.stringify(once))
})
