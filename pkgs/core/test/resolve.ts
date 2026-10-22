import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolve } from '../src/resolve.ts'

test('an exact tag is itself', () => {
  assert.equal(resolve('zh-Hant'), 'zh-Hant')
  assert.equal(resolve('ja-JP'), 'ja-JP')
  assert.equal(resolve('es-419'), 'es-419')
})

test('case is not meaning', () => {
  // Accept-Language and OS APIs disagree about case; a person does not.
  assert.equal(resolve('ZH-hant'), 'zh-Hant')
  assert.equal(resolve('pt-br'), 'pt-BR')
})

test('an underscore is a hyphen', () => {
  // POSIX locales (`LANG=zh_HK.UTF-8`, Java, Android resources) write one.
  assert.equal(resolve('zh_HK'), 'zh-Hant')
  assert.equal(resolve('en_US'), 'en-US')
  assert.equal(resolve(' de_AT '), 'de-DE')
})

test('a region we do not ship falls to the same language', () => {
  assert.equal(resolve('en-GB'), 'en-US')
  assert.equal(resolve('fr-CA'), 'fr-FR')
  assert.equal(resolve('pt-PT'), 'pt-BR')
  assert.equal(resolve('ar-AE'), 'ar')
  assert.equal(resolve('ru-UA'), 'ru')
})

test('a region we ship beats registry order, and order decides the rest', () => {
  // Bare `es` maximizes to Spain, so it reads European Spanish; every other
  // Spanish region reads Latin-American, which the registry lists first.
  assert.equal(resolve('es'), 'es-ES')
  assert.equal(resolve('es-ES'), 'es-ES')
  assert.equal(resolve('es-MX'), 'es-419')
  assert.equal(resolve('es-AR'), 'es-419')
  assert.equal(resolve('es-US'), 'es-419')
  assert.equal(resolve('pt'), 'pt-BR')
  assert.equal(resolve('en'), 'en-US')
})

test('a language spelled by its alias is still that language', () => {
  assert.equal(resolve('no'), 'nb') // macrolanguage; every OS that sends it means Bokmål
  assert.equal(resolve('no-NO'), 'nb')
  assert.equal(resolve('nb-NO'), 'nb')
  assert.equal(resolve('tl'), 'fil') // Intl canonicalizes this one
  assert.equal(resolve('in'), 'id-ID')
})

test('script decides between two regions of one language', () => {
  // The case that punishes matching on language alone: zh-Hans and zh-Hant differ
  // by writing system, and zh-Hans is listed first, so a naive match hands a
  // traditional-script reader simplified characters.
  assert.equal(resolve('zh-TW'), 'zh-Hant')
  assert.equal(resolve('zh-Hant-HK'), 'zh-Hant')
  assert.equal(resolve('zh-HK'), 'zh-Hant')
  assert.equal(resolve('zh-MO'), 'zh-Hant')
  assert.equal(resolve('zh-CN'), 'zh-Hans')
  assert.equal(resolve('zh-Hans-SG'), 'zh-Hans')
  assert.equal(resolve('zh-SG'), 'zh-Hans')
  assert.equal(resolve('zh'), 'zh-Hans')
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
