import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parity, slots } from '../src/slots.ts'

test('a slot is its name, not its punctuation', () => {
  assert.deepEqual(slots('Swap {{amount}} {{token}}'), ['amount', 'token'])
  assert.deepEqual(slots('no slots here'), [])
  assert.deepEqual(slots(''), [])
})

test('spacing inside a slot is not meaning', () => {
  // i18next trims, so both of these render the same value. Rejecting the spaced
  // one would fail a translation that works.
  assert.deepEqual(slots('{{ count }}'), slots('{{count}}'))
  assert.ok(parity('{{count}} left', 'noch {{ count }}'))
})

test('a format spec is part of the slot', () => {
  // `{{count, number}}` and `{{count}}` format differently, so a translation
  // that drops the spec is not the same message.
  assert.deepEqual(slots('{{count, number}}'), ['count, number'])
  assert.ok(!parity('{{count, number}}', '{{count}}'))
})

test('word order may change, the slots may not', () => {
  // German moves the verb; the translation is correct and must pass.
  assert.ok(parity('{{amount}} of {{token}}', '{{token}} im Wert von {{amount}}'))
})

test('a repeated slot is counted, not deduplicated', () => {
  // The multiset case: same names, wrong number of them. A set comparison calls
  // this fine and ships a number where a ticker belongs.
  assert.ok(!parity('{{amount}} of {{token}}', '{{amount}} of {{amount}}'))
  assert.ok(!parity('{{a}} {{a}}', '{{a}}'))
  assert.ok(parity('{{a}} {{a}} {{b}}', '{{b}} {{a}} {{a}}'))
})

test('a missing or invented slot fails', () => {
  assert.ok(!parity('Swap {{amount}}', 'Tauschen'))
  assert.ok(!parity('Swap', 'Tauschen {{amount}}'))
  assert.ok(!parity('{{amount}}', '{{montant}}'))
})

test('a stray brace does not swallow the rest of the string', () => {
  // Left greedy, `{{a}} }} {{b}}` reads as one enormous slot and two real ones
  // silently become none.
  assert.deepEqual(slots('{{a}} }} {{b}}'), ['a', 'b'])
  assert.deepEqual(slots('{{}}'), [''])
})
