import assert from 'node:assert/strict'
import { test } from 'node:test'

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, direction, locales, preferenceKey, translate } from '../src/index.ts'

test('36 locales, each a canonical tag with a name in its own script', () => {
  assert.equal(locales.length, 36)
  assert.equal(new Set(SUPPORTED_LOCALES).size, 36)
  assert.deepEqual(SUPPORTED_LOCALES, locales.map((l) => l.code))
  for (const l of locales) {
    assert.equal(Intl.getCanonicalLocales(l.code)[0], l.code)
    assert.ok(l.name && l.englishName, l.code)
  }
  assert.ok(SUPPORTED_LOCALES.includes(DEFAULT_LOCALE))
})

test('Chinese ships in both scripts and Spanish in both regions', () => {
  for (const code of ['zh-Hans', 'zh-Hant', 'es-ES', 'es-419', 'ar']) {
    assert.ok(SUPPORTED_LOCALES.includes(code as never), code)
  }
})

test('Arabic is right-to-left and nothing else is', () => {
  assert.equal(direction('ar'), 'rtl')
  assert.equal(direction('ar-AE'), 'rtl')
  for (const l of locales.filter((l) => l.code !== 'ar')) {
    assert.equal(l.dir, 'ltr', l.code)
    assert.equal(direction(l.code), 'ltr', l.code)
  }
  assert.equal(direction(null), 'ltr')
})

test('a missing message is its English, with arguments filled', () => {
  assert.equal(translate({ 'Hello {name}': 'مرحبا {name}' }, 'Hello {name}', { name: 'Ada' }), 'مرحبا Ada')
  assert.equal(translate({}, 'Missing {count}'), 'Missing {count}')
  assert.equal(translate({}, 'Missing {count}', { count: 0 }), 'Missing 0')
})

test('a source string is copy, not a prototype key', () => {
  assert.equal(translate({}, 'constructor'), 'constructor')
  assert.equal(translate({}, '__proto__'), '__proto__')
})

test('the source keeps its edge whitespace whatever the catalog holds', () => {
  // Fragments are joined around links; a catalog that trimmed them would glue words.
  assert.equal(translate({ ' and': 'und' }, ' and'), ' und')
  assert.equal(translate({ 'Terms ': '  Bedingungen  ' }, 'Terms '), 'Bedingungen ')
})

test('each account, and the signed-out visitor, keeps its own choice', () => {
  assert.notEqual(preferenceKey('alice'), preferenceKey('bob'))
  assert.notEqual(preferenceKey('alice'), preferenceKey())
  assert.equal(preferenceKey(null), preferenceKey(undefined))
  assert.equal(preferenceKey('a/b'), 'hanzo.locale.v1:a%2Fb')
})
