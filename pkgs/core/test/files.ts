import assert from 'node:assert/strict'
import { test } from 'node:test'

import { contents, source, translation } from '../src/files.ts'

test('the layout is the same one three tools use', () => {
  assert.equal(source('/p/strings', 'exchange'), '/p/strings/exchange/en-US.json')
  assert.equal(translation('/p/out', 'ja-JP', 'exchange'), '/p/out/ja-JP/exchange.json')
})

test('a strings file is sorted', () => {
  // Two tools write these and a person reviews the diff. Unsorted, adding one
  // string reorders forty and the review that catches a bad translation does
  // not happen.
  assert.equal(contents({ z: 'Z', a: 'A' }), '{\n  "a": "A",\n  "z": "Z"\n}\n')
  assert.equal(contents({ a: 'A', z: 'Z' }), contents({ z: 'Z', a: 'A' }))
})

test('a strings file ends in a newline', () => {
  // Or every one of them is a "\ No newline at end of file" line in the diff.
  assert.ok(contents({ a: 'A' }).endsWith('}\n'))
  assert.equal(contents({}), '{}\n')
})

test('keys that look like numbers still sort as keys', () => {
  // JavaScript hoists integer-like keys to the front of an object regardless of
  // insertion order, so `10` sorting before `2` is the engine, not the compare.
  assert.deepEqual(Object.keys(JSON.parse(contents({ b: 'B', '10': 'T', '2': 'W', a: 'A' }))), [
    '2',
    '10',
    'a',
    'b',
  ])
})
