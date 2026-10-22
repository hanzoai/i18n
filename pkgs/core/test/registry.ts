import assert from 'node:assert/strict'
import { test } from 'node:test'

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, direction, locales, preferenceKey, translate } from '../src/index.ts'

test('79 locales, each a canonical tag with a name in its own script', () => {
  assert.equal(locales.length, 79)
  assert.equal(new Set(SUPPORTED_LOCALES).size, 79)
  assert.deepEqual(SUPPORTED_LOCALES, locales.map((l) => l.code))
  for (const l of locales) {
    assert.equal(Intl.getCanonicalLocales(l.code)[0], l.code)
    assert.ok(l.name && l.englishName, l.code)
  }
  assert.ok(SUPPORTED_LOCALES.includes(DEFAULT_LOCALE))
})

test('regional variants ship beside their language', () => {
  for (const code of ['zh-Hans', 'zh-Hant', 'zh-HK', 'es-ES', 'es-419', 'es-MX', 'es-AR', 'pt-BR', 'pt-PT', 'fr-FR', 'fr-CA', 'ar', 'ar-EG', 'ar-SA', 'ar-MA', 'ar-LB', 'fa', 'fa-AF', 'pa', 'pa-PK']) {
    assert.ok(SUPPORTED_LOCALES.includes(code as never), code)
  }
})

test('the picker lists languages by English name', () => {
  const names = locales.map((l) => l.englishName)
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'en')))
})

/** Scripts written right to left, by their ISO 15924 code. */
const RTL = new Set(['Adlm', 'Arab', 'Hebr', 'Mand', 'Nkoo', 'Rohg', 'Samr', 'Syrc', 'Thaa'])

test('a locale is right-to-left exactly when its script is', () => {
  // The script comes from the tag (`ur` → Arab, `pa-PK` → Arab, `ku` → Latn), not
  // from a list kept beside the registry, so a new locale cannot ship the wrong way.
  for (const l of locales) {
    const script = new Intl.Locale(l.code).maximize().script ?? ''
    assert.equal(l.dir, RTL.has(script) ? 'rtl' : 'ltr', `${l.code} (${script})`)
    assert.equal(direction(l.code), l.dir, l.code)
  }
  assert.deepEqual(
    locales.filter((l) => l.dir === 'rtl').map((l) => l.code).sort(),
    ['ar', 'ar-EG', 'ar-LB', 'ar-MA', 'ar-SA', 'ckb', 'fa', 'fa-AF', 'he', 'pa-PK', 'ps', 'sd', 'ug', 'ur'],
  )
})

test('a request resolves to the direction of the locale it reaches', () => {
  for (const tag of ['ar-AE', 'fa-IR', 'prs', 'iw', 'he-IL', 'ur-IN', 'ckb-IR', 'pa-Arab', 'pnb']) {
    assert.equal(direction(tag), 'rtl', tag)
  }
  for (const tag of ['ku', 'kmr', 'pa-IN', 'en-GB', 'zh-HK']) {
    assert.equal(direction(tag), 'ltr', tag)
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
