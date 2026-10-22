import assert from 'node:assert/strict'
import { test } from 'node:test'

import { madlad, type Worker } from '../src/madlad.ts'

const terms = { keep: ['Claude Code', 'Claude', 'Hanzo', 'Cursor'] }

/** A worker that records what it was handed and answers with `reply`. */
function recording(reply: (texts: string[]) => string[]): { worker: Worker; asked: [string, string[]][] } {
  const asked: [string, string[]][] = []
  return { asked, worker: async (target, texts) => (asked.push([target, texts]), reply(texts)) }
}

test('protected names cross MADLAD as numbered placeholders and come back as written', async () => {
  const { worker, asked } = recording((texts) => texts.map((t) => `T(${t})`))
  const answer = await madlad(worker, terms)({ a: 'Accelerate Cursor with Hanzo', b: 'Claude Code, Claude', c: ' Start ' }, 'my')
  assert.deepEqual(asked, [['my', ['Accelerate {0} with {1}', '{0}, {1}', 'Start']]])
  assert.deepEqual(answer, { a: 'T(Accelerate Cursor with Hanzo)', b: 'T(Claude Code, Claude)', c: 'T(Start)' })
})

test('a numbered slot the source holds is not mistaken for a name', async () => {
  const { worker, asked } = recording((texts) => texts)
  const answer = await madlad(worker, terms)({ a: '{0} files in Hanzo' }, 'km')
  assert.deepEqual(asked[0][1], ['{0} files in {1}'])
  assert.deepEqual(answer, { a: '{0} files in Hanzo' })
})

test('the target is the language MADLAD names', async () => {
  const { worker, asked } = recording((texts) => texts)
  for (const locale of ['my', 'fa-AF', 'zh-HK', 'pa-PK', 'es-MX']) {
    await madlad(worker)({ a: 'A' }, locale)
  }
  assert.deepEqual(asked.map(([target]) => target), ['my', 'prs', 'zh_Hant', 'pa', 'es'])
})

test('an answer that does not line up with the batch is an error', async () => {
  const { worker } = recording(() => ['one'])
  await assert.rejects(madlad(worker)({ a: 'A', b: 'B' }, 'my'), /1 translations for 2 strings/)
})
