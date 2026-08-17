import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fill, missing, type Message, type Model } from '../src/fill.ts'

/** A model that answers with whatever it is handed. */
const says = (answer: unknown): Model => async () => (typeof answer === 'string' ? answer : JSON.stringify(answer))

/** A model that must not be called. */
const silent: Model = async () => {
  throw new Error('asked when there was nothing to ask')
}

test('only the missing keys are asked for', async () => {
  let asked: Message[] = []
  const model: Model = async (messages) => {
    asked = messages
    return JSON.stringify({ b: 'Bee' })
  }

  const { added } = await fill({ a: 'A', b: 'B' }, { a: 'Ah' }, 'fr-FR', model)
  assert.deepEqual(added, { b: 'Bee' })
  // Sending the whole file every run would spend a thousand keys to add three,
  // and would hand back new wording for strings a person already approved.
  assert.ok(!asked.at(-1)?.content.includes('"a"'))
  assert.ok(asked.at(-1)?.content.includes('"b"'))
  assert.ok(asked[0].content.includes('fr-FR'))
})

test('a complete locale is not a request', async () => {
  // Idempotence, and it is also the bill: a second CI run costs nothing.
  const done = await fill({ a: 'A' }, { a: 'Ah' }, 'fr-FR', silent)
  assert.deepEqual(done, { added: {}, refused: [] })
  assert.deepEqual(await fill({}, {}, 'fr-FR', silent), { added: {}, refused: [] })
})

test('a slot that did not survive is refused, not written', async () => {
  const source = { swap: 'Swap {{amount}} {{token}}' }

  const dropped = await fill(source, {}, 'de-DE', says({ swap: 'Tausche {{amount}}' }))
  assert.deepEqual(dropped, { added: {}, refused: ['swap'] })

  const renamed = await fill(source, {}, 'de-DE', says({ swap: '{{betrag}} {{token}} tauschen' }))
  assert.deepEqual(renamed, { added: {}, refused: ['swap'] })

  // Reordered is not broken — German moves the verb.
  const moved = await fill(source, {}, 'de-DE', says({ swap: '{{token}} im Wert von {{amount}} tauschen' }))
  assert.deepEqual(moved, { added: { swap: '{{token}} im Wert von {{amount}} tauschen' }, refused: [] })
})

test('a refusal leaves the key missing so the next run asks again', async () => {
  const source = { a: '{{x}}', b: 'B' }
  const first = await fill(source, {}, 'de-DE', says({ a: 'kaputt', b: 'Bee' }))
  assert.deepEqual(first, { added: { b: 'Bee' }, refused: ['a'] })

  const second = await fill(source, first.added, 'de-DE', says({ a: '{{x}}!' }))
  assert.deepEqual(second, { added: { a: '{{x}}!' }, refused: [] })
})

test('the answer is data, not instruction', async () => {
  // A key nobody asked for cannot be filed, whatever the model returns.
  const { added } = await fill({ a: 'A' }, {}, 'fr-FR', says({ a: 'Ah', 'admin.token': 'oui' }))
  assert.deepEqual(added, { a: 'Ah' })
})

test('a key that came back empty or not a string is refused', async () => {
  assert.deepEqual((await fill({ a: 'A' }, {}, 'fr-FR', says({ a: '' }))).refused, ['a'])
  assert.deepEqual((await fill({ a: 'A' }, {}, 'fr-FR', says({ a: '   ' }))).refused, ['a'])
  assert.deepEqual((await fill({ a: 'A' }, {}, 'fr-FR', says({ a: 42 }))).refused, ['a'])
  assert.deepEqual((await fill({ a: 'A' }, {}, 'fr-FR', says({ b: 'B' }))).refused, ['a'])
})

test('a fenced answer is still an answer', async () => {
  // Told to return JSON, a model still wraps it in a code fence often enough
  // that treating the fence as a failure means retranslating a whole locale.
  assert.deepEqual((await fill({ a: 'A' }, {}, 'fr-FR', says('```json\n{"a":"Ah"}\n```'))).added, { a: 'Ah' })
  assert.deepEqual((await fill({ a: 'A' }, {}, 'fr-FR', says('```\n{"a":"Ah"}\n```'))).added, { a: 'Ah' })
  assert.deepEqual((await fill({ a: 'A' }, {}, 'fr-FR', says('  {"a":"Ah"}  '))).added, { a: 'Ah' })
})

test('an answer that is not an object is an error, not a silent empty run', async () => {
  // Quietly returning nothing here would look exactly like "already complete",
  // and the locale would sit empty while CI reported success.
  await assert.rejects(fill({ a: 'A' }, {}, 'fr-FR', says('I hope this helps!')), /not JSON/)
  await assert.rejects(fill({ a: 'A' }, {}, 'fr-FR', says('[{"a":"Ah"}]')), /not an object/)
  await assert.rejects(fill({ a: 'A' }, {}, 'fr-FR', says('null')), /not an object/)
})

test('missing is the question the CLI asks before spending anything', () => {
  assert.deepEqual(missing({ a: 'A', b: 'B' }, { a: 'Ah' }), { b: 'B' })
  assert.deepEqual(missing({ a: 'A' }, { a: '' }), {})
  assert.deepEqual(missing({}, { a: 'Ah' }), {})
})
