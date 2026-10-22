import assert from 'node:assert/strict'
import { test } from 'node:test'

import { chat } from '../src/chat.ts'
import { asking, fill, type Strings } from '../src/fill.ts'
import { service } from '../src/service.ts'

type Sent = { url: string; headers: Record<string, string>; body: Record<string, unknown> }

/** A fetch that records each request and answers with `reply(body)`. */
function serve(reply: (body: Record<string, unknown>) => unknown, status = 200): Sent[] {
  const sent: Sent[] = []
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    sent.push({ url, headers: init.headers as Record<string, string>, body })
    const answer = reply(body)
    return { ok: status < 400, status, json: async () => answer, text: async () => JSON.stringify(answer) } as Response
  }) as typeof fetch
  return sent
}

const original = globalThis.fetch
test.afterEach(() => {
  globalThis.fetch = original
})

const terms = { keep: ['Hanzo', 'Claude Code'] }

test('/v1/translate is asked for a batch, in order, with the protected names as its glossary', async () => {
  const sent = serve((body) => ({
    translations: (body.batch as string[]).map((s) => ({ source: s, text: `ar:${s}`, state: 'machine', cached: false })),
    tier: 'quality',
  }))
  const source: Strings = { 'Sign in to Hanzo': 'Sign in to Hanzo', About: 'About' }
  const { added, refused } = await fill(source, {}, 'ar', service('https://api.hanzo.ai/', 'k', 'quality', terms), terms)

  assert.deepEqual(added, { 'Sign in to Hanzo': 'ar:Sign in to Hanzo', About: 'ar:About' })
  assert.deepEqual(refused, [])
  assert.equal(sent[0].url, 'https://api.hanzo.ai/v1/translate')
  assert.equal(sent[0].headers.authorization, 'Bearer k')
  assert.deepEqual(sent[0].body, {
    batch: ['Sign in to Hanzo', 'About'],
    target: 'ar',
    source: 'en',
    tier: 'quality',
    glossary: { Hanzo: 'Hanzo', 'Claude Code': 'Claude Code' },
  })
})

test('a string the endpoint could not translate stays missing for the next run', async () => {
  serve(() => ({ translations: [{ source: 'A', text: 'Ah' }, { source: 'B', error: 'placeholder lost' }] }))
  const { added, refused } = await fill({ a: 'A', b: 'B' }, {}, 'fr-FR', service('https://api.hanzo.ai', 'k', 'bulk'))
  assert.deepEqual(added, { a: 'Ah' })
  assert.deepEqual(refused, ['b'])
})

test('an answer that does not line up with the batch is an error, not a guess', async () => {
  serve(() => ({ translations: [{ text: 'Ah' }] }))
  await assert.rejects(fill({ a: 'A', b: 'B' }, {}, 'fr-FR', service('https://api.hanzo.ai', 'k', 'quality')), /1 translations for 2 strings/)
  serve(() => ({ error: 'insufficient funds' }), 402)
  await assert.rejects(fill({ a: 'A' }, {}, 'fr-FR', service('https://api.hanzo.ai', 'k', 'quality')), /402/)
})

test('a translation that drops a protected name or its {placeholder} is refused, whatever engine wrote it', async () => {
  serve((body) => ({
    translations: (body.batch as string[]).map((s) =>
      s.startsWith('Accelerate') ? { text: 'سرّع كلود كود' } : { text: 'مرحبا' },
    ),
  }))
  const { added, refused } = await fill(
    { 'Accelerate Claude Code with Hanzo': 'Accelerate Claude Code with Hanzo', 'Hello {name}': 'Hello {name}' },
    {},
    'ar',
    service('https://api.hanzo.ai', 'k', 'quality', terms),
    terms,
  )
  assert.deepEqual(added, {})
  assert.deepEqual(refused.sort(), ['Accelerate Claude Code with Hanzo', 'Hello {name}'])
})

test('a local OpenAI-compatible endpoint needs no key and takes template arguments', async () => {
  const sent = serve((body) => {
    const want = JSON.parse((body.messages as { content: string }[])[1].content) as Strings
    const answer = Object.fromEntries(Object.keys(want).map((k) => [k, `مرحبا ${k}`]))
    return { choices: [{ finish_reason: 'stop', message: { content: `<think></think>${JSON.stringify(answer)}` } }] }
  })
  const model = chat('jais3-ar', 'http://127.0.0.1:8733/v1/chat/completions', undefined, {
    chat_template_kwargs: { enable_thinking: false, reasoning_effort: 'low' },
  })
  const { added } = await fill({ Hanzo: 'Hanzo' }, {}, 'ar', asking(model, terms), terms)
  assert.deepEqual(added, { Hanzo: 'مرحبا Hanzo' })
  assert.equal(sent[0].headers.authorization, undefined)
  assert.equal(sent[0].body.model, 'jais3-ar')
  assert.deepEqual(sent[0].body.chat_template_kwargs, { enable_thinking: false, reasoning_effort: 'low' })
  const system = (sent[0].body.messages as { content: string }[])[0].content
  assert.match(system, /into Arabic \(ar\)/)
  assert.match(system, /Modern Standard Arabic/)
  assert.match(system, /Keep these names exactly as written.*Hanzo, Claude Code/)
})

test('a truncated chat answer is an error, so its keys are asked again', async () => {
  serve(() => ({ choices: [{ finish_reason: 'length', message: { content: '{"a": "A' } }] }))
  const model = chat('zen5', 'https://api.hanzo.ai/v1/chat/completions', 'k')
  await assert.rejects(fill({ a: 'A' }, {}, 'fr-FR', asking(model)), /truncated/)
})
