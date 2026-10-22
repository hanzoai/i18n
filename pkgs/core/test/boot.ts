import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

import { bootScript } from '../src/boot.ts'
import { OFFERED, SUPPORTED_LOCALES } from '../src/locales.ts'
import { PAINTED, preferenceKey } from '../src/message.ts'
import { direction, resolve } from '../src/resolve.ts'

interface Page {
  languages?: readonly string[]
  stored?: Record<string, string>
  /** `true`: reading `localStorage` throws, as a sandboxed frame does. `'get'`: `getItem` throws. */
  blocked?: true | 'get'
  lang?: string
  dir?: string
}

/** Run the script in a fresh realm against a document with only `lang` and `dir`; report what it wrote. */
function boot({ languages = ['en-US'], stored = {}, blocked, lang = 'en-US', dir = '' }: Page) {
  const writes: string[] = []
  const root = new Proxy(
    { lang, dir },
    {
      set(target, key, value) {
        writes.push(`${String(key)}=${value}`)
        return Reflect.set(target, key, value)
      },
    },
  )
  const storage = {
    getItem(key: string) {
      if (blocked === 'get') {
        throw new Error('SecurityError')
      }
      return Object.hasOwn(stored, key) ? stored[key] : null
    },
  }
  const context = {
    document: { documentElement: root },
    navigator: { languages, language: languages[0] },
    get localStorage() {
      if (blocked === true) {
        throw new Error('SecurityError')
      }
      return storage
    },
  }
  runInNewContext(bootScript(), context)
  // No `dir` attribute is left to right.
  return { lang: root.lang, dir: root.dir || 'ltr', writes }
}

/** Regional, script and alias requests a browser sends, beside every registry tag. */
const REQUESTS = [
  'pa-Arab', 'pa-Arab-PK', 'pa-IN', 'pnb', 'prs', 'fa-IR', 'fa-AF', 'ckb-IR', 'ur-IN', 'iw', 'he-IL',
  'zh-TW', 'zh-CN', 'zh-MO', 'zh-SG', 'zh-Hant-HK', 'zh-Hant-TW', 'zh-Hans-HK', 'zh-Hans-SG', 'zh-Latn', 'zh',
  'es-CO', 'es-US', 'es-PR', 'es', 'es-GQ', 'es-Latn-419', 'es-Latn-AR', 'pt-AO', 'pt-MO', 'pt-MZ', 'pt',
  'ar-IQ', 'ar-SD', 'ar-AE', 'ar-KW', 'ar-DZ', 'ar-TN', 'ar-JO', 'ar-SY', 'ar-Arab-EG', 'ar-Latn',
  'fr-BE', 'fr-CH', 'fr-SN', 'fr-Latn-CA', 'fr', 'no', 'no-NO', 'nb-NO', 'nn', 'in', 'tl', 'kmr',
  'en-GB', 'en', 'de-AT', 'de_CH', ' ja ', 'ZH-hant', 'pt-br', 'hi', 'bn-IN', 'ms-SG', 'ru-UA',
  'sr-Latn', 'uz-Arab', 'cy-GB', 'xx', 'und', 'en-', '....', '', 'constructor', '__proto__',
]

test('the script negotiates a browser language exactly as resolve does, for every registry tag and request', () => {
  const tags = [...SUPPORTED_LOCALES, ...REQUESTS]
  for (const tag of tags) {
    const { lang, dir } = boot({ languages: [tag] })
    const want = resolve([tag], OFFERED)
    assert.deepEqual([lang, dir], [want, direction(want)], JSON.stringify(tag))
  }
})

test('the first language the script can serve wins, as in resolve', () => {
  for (const list of [['xx-XX', 'de-AT', 'en-US'], ['cy', 'pa-Arab', 'fr-BE'], ['am', 'ar-DZ', 'ja'], ['ku', 'ckb'], [], ['', 'iw']]) {
    assert.equal(boot({ languages: list }).lang, resolve(list, OFFERED), list.join())
  }
})

test('a stored locale is painted as written, review or not, whatever the browser says', () => {
  for (const code of SUPPORTED_LOCALES) {
    const page = boot({ languages: ['ja-JP'], stored: { [PAINTED]: code } })
    assert.equal(page.lang, code)
    assert.equal(page.dir, direction(code), code)
  }
})

test('the painted locale wins over the signed-out choice, which wins over the browser', () => {
  assert.equal(boot({ stored: { [PAINTED]: 'he', [preferenceKey(null)]: 'fr-FR' } }).lang, 'he')
  assert.equal(boot({ stored: { [preferenceKey(null)]: 'ur' } }).dir, 'rtl')
})

test('a per-user choice reaches the script through what the provider painted', () => {
  // The script cannot know who is signed in. The provider paints every locale it
  // shows, and mirrors an account's IAM choice into the per-user key as it does.
  assert.equal(boot({ languages: ['en-US'], stored: { [preferenceKey('alice')]: 'ar' } }).lang, 'en-US')
  assert.equal(boot({ languages: ['en-US'], stored: { [preferenceKey('alice')]: 'ar', [PAINTED]: 'ar' } }).dir, 'rtl')
})

test('an unknown stored value is no choice', () => {
  for (const value of ['xx-YY', 'AR', 'ar ar-EG', ' ar', '', 'constructor', '__proto__']) {
    assert.equal(boot({ languages: ['fa-IR'], stored: { [PAINTED]: value } }).lang, 'fa', JSON.stringify(value))
  }
})

test('blocked storage falls back to the browser, and nothing throws', () => {
  assert.equal(boot({ languages: ['ar-IQ'], blocked: true }).dir, 'rtl')
  assert.equal(boot({ languages: ['ar-IQ'], blocked: 'get' }).lang, 'ar')
  assert.doesNotThrow(() => runInNewContext(bootScript(), {}))
  assert.doesNotThrow(() => runInNewContext(bootScript(), { document: {}, navigator: {}, localStorage: null }))
})

test('it writes lang and dir only where they differ, and nothing else', () => {
  assert.deepEqual(boot({ languages: ['en-US'] }).writes, [])
  assert.deepEqual(boot({ languages: ['en-US'], dir: 'ltr' }).writes, [])
  assert.deepEqual(boot({ languages: ['en-GB'], lang: 'en' }).writes, ['lang=en-US'])
  assert.deepEqual(boot({ languages: ['ar'] }).writes, ['lang=ar', 'dir=rtl'])
  assert.deepEqual(boot({ languages: ['de'], lang: 'ar', dir: 'rtl' }).writes, ['lang=de-DE', 'dir=ltr'])
})

test('the script stays small', () => {
  assert.ok(Buffer.byteLength(bootScript()) <= 1600, `${Buffer.byteLength(bootScript())} bytes`)
})
