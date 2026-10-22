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
  assert.equal(resolve('zh_HK'), 'zh-HK')
  assert.equal(resolve('en_US'), 'en-US')
  assert.equal(resolve(' de_AT '), 'de-DE')
})

test('a region we do not ship falls to the same language', () => {
  assert.equal(resolve('en-GB'), 'en-US')
  assert.equal(resolve('ru-UA'), 'ru')
  assert.equal(resolve('ms-SG'), 'ms')
})

test('a region we ship is itself', () => {
  for (const tag of ['es-MX', 'es-AR', 'pt-PT', 'fr-CA', 'zh-HK', 'ar-EG', 'ar-SA', 'ar-MA', 'ar-LB', 'fa-AF', 'pa-PK']) {
    assert.equal(resolve(tag), tag)
  }
  // Stated by script and region, not by the tag we list.
  assert.equal(resolve('zh-Hant-HK'), 'zh-HK')
  assert.equal(resolve('ar-Arab-EG'), 'ar-EG')
  assert.equal(resolve('pa-Arab-PK'), 'pa-PK')
})

test('American Spanish reads Latin-American, Spain and the rest European', () => {
  // CLDR's parent locale: es-419 for every Spanish of the Americas.
  for (const tag of ['es-CO', 'es-CL', 'es-PE', 'es-VE', 'es-US', 'es-PR']) {
    assert.equal(resolve(tag), 'es-419', tag)
  }
  assert.equal(resolve('es'), 'es-ES') // maximizes to Spain
  assert.equal(resolve('es-GQ'), 'es-ES') // no variant serves it: the language's own region
})

test('Portuguese outside Brazil reads European', () => {
  for (const tag of ['pt-AO', 'pt-MZ', 'pt-CV', 'pt-MO', 'pt-TL']) {
    assert.equal(resolve(tag), 'pt-PT', tag)
  }
  assert.equal(resolve('pt'), 'pt-BR')
})

test('French outside Canada reads the French of France', () => {
  for (const tag of ['fr', 'fr-BE', 'fr-CH', 'fr-SN']) {
    assert.equal(resolve(tag), 'fr-FR', tag)
  }
  assert.equal(resolve('fr-Latn-CA'), 'fr-CA')
})

test('Arabic regions read their dialect area, and the rest Modern Standard Arabic', () => {
  for (const tag of ['ar-AE', 'ar-KW', 'ar-QA', 'ar-BH', 'ar-OM', 'ar-YE']) {
    assert.equal(resolve(tag), 'ar-SA', tag)
  }
  for (const tag of ['ar-DZ', 'ar-TN', 'ar-LY', 'ar-MR']) {
    assert.equal(resolve(tag), 'ar-MA', tag)
  }
  for (const tag of ['ar-JO', 'ar-SY', 'ar-PS']) {
    assert.equal(resolve(tag), 'ar-LB', tag)
  }
  // `ar` maximizes to Egypt, yet it names no region: Iraq and Sudan read the variant with none.
  assert.equal(resolve('ar-IQ'), 'ar')
  assert.equal(resolve('ar-SD'), 'ar')
  assert.equal(resolve('ar'), 'ar')
})

test('Persian, Punjabi and Kurdish find their script and variety', () => {
  assert.equal(resolve('fa-IR'), 'fa')
  assert.equal(resolve('prs'), 'fa-AF') // Dari, canonicalized by Intl
  assert.equal(resolve('pa-IN'), 'pa')
  assert.equal(resolve('pa-Arab'), 'pa-PK') // Shahmukhi, never Gurmukhi
  assert.equal(resolve('pnb'), 'pa-PK') // Western Punjabi: Intl calls it lah
  assert.equal(resolve('kmr'), 'ku') // Kurmanji, Latin script
  assert.equal(resolve('ckb-IR'), 'ckb')
  assert.equal(resolve('iw'), 'he')
})

test('the language falls to its own region when no variant serves the request', () => {
  assert.equal(resolve('pt'), 'pt-BR')
  assert.equal(resolve('en'), 'en-US')
  assert.equal(resolve('de'), 'de-DE')
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
  assert.equal(resolve('zh-Hant-TW'), 'zh-Hant')
  assert.equal(resolve('zh-HK'), 'zh-HK')
  assert.equal(resolve('zh-MO'), 'zh-HK') // CLDR: Macau's parent is Hong Kong
  assert.equal(resolve('zh-CN'), 'zh-Hans')
  assert.equal(resolve('zh-Hans-SG'), 'zh-Hans')
  assert.equal(resolve('zh-SG'), 'zh-Hans')
  assert.equal(resolve('zh'), 'zh-Hans')
})

test('the first preference we can serve wins over a later exact one', () => {
  // Someone listing [fr, en] would rather read approximate French than perfect
  // English. Answering en-US here would be serving our convenience.
  assert.equal(resolve(['fr-BE', 'en-US']), 'fr-FR')
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
