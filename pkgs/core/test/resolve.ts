import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolve } from '../src/resolve.ts'

test('an exact tag is itself', () => {
  assert.equal(resolve('zh-TW'), 'zh-TW')
  assert.equal(resolve('ja-JP'), 'ja-JP')
})

test('case is not meaning', () => {
  // Accept-Language and OS APIs disagree about case; a person does not.
  assert.equal(resolve('ZH-tw'), 'zh-TW')
  assert.equal(resolve('pt-pt'), 'pt-PT')
})

test('a region we do not ship falls to the same language', () => {
  assert.equal(resolve('en-GB'), 'en-US')
  assert.equal(resolve('es-MX'), 'es-ES')
  assert.equal(resolve('fr-CA'), 'fr-FR')
})

test('script decides between two regions of one language', () => {
  // The case that punishes matching on language alone: zh-CN and zh-TW differ by
  // writing system, and zh-CN is listed first, so a naive match hands a
  // traditional-script reader simplified characters.
  assert.equal(resolve('zh-Hant'), 'zh-TW')
  assert.equal(resolve('zh-Hant-HK'), 'zh-TW')
  assert.equal(resolve('zh-HK'), 'zh-TW')
  assert.equal(resolve('zh-Hans'), 'zh-CN')
  assert.equal(resolve('zh-Hans-SG'), 'zh-CN')
  assert.equal(resolve('zh-SG'), 'zh-CN')
})

test('the first preference we can serve wins over a later exact one', () => {
  // Someone listing [fr, en] would rather read approximate French than perfect
  // English. Answering en-US here would be serving our convenience.
  assert.equal(resolve(['fr-CA', 'en-US']), 'fr-FR')
  assert.equal(resolve(['xx-XX', 'de-AT', 'en-US']), 'de-DE')
})

test('an unshippable request is the default, never an error', () => {
  // This runs while someone is waiting for a page. It has no failure mode.
  assert.equal(resolve('cy-GB'), 'en-US')
  assert.equal(resolve([]), 'en-US')
  assert.equal(resolve(null), 'en-US')
  assert.equal(resolve(undefined), 'en-US')
  assert.equal(resolve(''), 'en-US')
  assert.equal(resolve('....'), 'en-US')
  assert.equal(resolve(['', null as unknown as string, 'de-DE']), 'de-DE')
})

test('a caller may state its own supported set', () => {
  // A product that ships fewer locales than the registry still negotiates the
  // same way, rather than reimplementing the rule against its own list.
  assert.equal(resolve('de-DE', ['en-US', 'ja-JP']), 'en-US')
  assert.equal(resolve('ja-JP', ['en-US', 'ja-JP']), 'ja-JP')
})
