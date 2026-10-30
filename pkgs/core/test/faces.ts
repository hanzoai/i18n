import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import { faces, letters } from '../src/faces.ts'

const g = globalThis as Record<string, unknown>
afterEach(() => {
  delete g.document
  delete g.getComputedStyle
})

/** A page whose body is set in `stack`, and a font set that holds faces for `held`. */
function page(stack: string, held: Record<string, RegExp>, delay = 0) {
  const asked: string[] = []
  g.getComputedStyle = () => ({ fontFamily: stack, fontWeight: '400' })
  g.document = {
    body: {},
    fonts: {
      load: async (font: string, text: string) => {
        asked.push(font)
        const family = font.replace(/^400 16px /, '').replace(/"/g, '')
        if (delay) await new Promise((done) => setTimeout(done, delay))
        return held[family]?.test(text) ? [{ family }] : []
      },
    },
  }
  return asked
}

const ARABIC = { a: 'كل ما يحتاجه', b: 'Hanzo' }

test('letters: each character once', () => {
  assert.equal(letters({ a: 'aab', b: 'ba' }), 'ab')
  assert.equal(letters({}), '')
})

test('asks the stack in order and stops at the first family with a face for the words', async () => {
  const asked = page('"Noto Kufi Arabic", Zen, sans-serif', { 'Noto Kufi Arabic': /[؀-ۿ]/, Zen: /./ })
  await faces(ARABIC)
  assert.deepEqual(asked, ['400 16px "Noto Kufi Arabic"'])
})

test('passes over a family with no face for these letters', async () => {
  const asked = page('"Noto Kufi Arabic", Zen, sans-serif', { 'Noto Kufi Arabic': /[؀-ۿ]/, Zen: /./ })
  await faces({ a: 'Bonjour' })
  assert.deepEqual(asked, ['400 16px "Noto Kufi Arabic"', '400 16px Zen'])
})

test('holds the words no longer than the block period', async () => {
  page('"Noto Kufi Arabic", Zen', { 'Noto Kufi Arabic': /./ }, 1500)
  const start = Date.now()
  await faces(ARABIC, 50)
  assert.ok(Date.now() - start < 1000, 'returned on the wait, not the face')
})

test('costs nothing without a document, the Font Loading API, or words', async () => {
  await faces(ARABIC)
  g.document = { body: {} }
  await faces(ARABIC)
  const asked = page('Zen', { Zen: /./ })
  await faces({})
  assert.deepEqual(asked, [])
})
