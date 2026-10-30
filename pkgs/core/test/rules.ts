import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { SOFT, faults, type Terms } from '../src/rules.ts'

const terms = JSON.parse(readFileSync(new URL('../terms.json', import.meta.url), 'utf8')) as Terms

test('a protected name stays Latin; inflection after it is allowed', () => {
  assert.deepEqual(faults('hi-IN', 'Hand Hanzo Dev a task', 'हैंज़ो डेव को काम दें', terms), ['names:Hanzo+Dev'])
  assert.deepEqual(faults('fi', 'Examples and recipes for Kai decisions.', 'Esimerkkejä Kain päätöksiin.', terms), [])
  // A name ending a hyphenated word is the word's: "Next-Gen" is no Gen.
  assert.deepEqual(faults('fr-FR', 'Next-Gen Commerce', 'Commerce nouvelle génération', terms), [])
  assert.deepEqual(faults('fr-FR', 'Hanzo Gen runs agents', 'Hanzo exécute des agents', terms), ['names:Gen'])
  assert.deepEqual(faults('ar', "Hanzo's cloud", 'سحابة', terms), ['names:Hanzo'])
})

test('a multi-word name is one name', () => {
  assert.deepEqual(faults('de-DE', 'Accelerate Claude Code with Hanzo', 'Claude Code mit Hanzo beschleunigen', terms), [])
  assert.deepEqual(faults('de-DE', 'Accelerate Claude Code with Hanzo', 'Claude-Code mit Hanzo beschleunigen', terms), [
    'names:Claude Code',
  ])
  assert.deepEqual(faults('ja-JP', 'Models from Hugging Face', 'ハギングフェイスのモデル', terms), ['names:Hugging Face'])
  assert.deepEqual(faults('ml', 'Claude Code, Codex, Cursor', 'ക്ലോഡ് കോഡ്, കോഡെക്സ്, കഴ്സർ', terms), ['names:Claude Code+Codex+Cursor'])
  assert.deepEqual(faults('te', 'GitHub', 'గిట్‌హబ్', terms), ['names:GitHub'])
})

test('a fragment that ends in a possessive may move the owner into the next fragment', () => {
  // "By continuing, you agree to Hanzo's " + <a>Terms</a>: Arabic puts the owner
  // after the noun, inside the link. The host fix is one string with the link as
  // a slot; until then the fragment is not refused for it.
  assert.deepEqual(faults('ar', "By continuing, you agree to Hanzo's ", 'بمتابعتك، فإنك توافق على ', terms), [])
})

test('the toolkit protects nothing a product did not name', () => {
  assert.deepEqual(faults('hi-IN', 'Hand Hanzo Dev a task', 'हैंज़ो डेव को काम दें'), [])
})

test('script, Chinese variants and markup are faults', () => {
  assert.deepEqual(faults('ja-JP', 'Pending Invitations', 'Pending invites', terms), ['script'])
  assert.deepEqual(faults('zh-Hant', 'Account and organization', '账户和组织机构', terms), ['simplified'])
  assert.deepEqual(faults('zh-Hans', 'Account and organization', '帳戶和組織機構', terms), ['traditional'])
  assert.deepEqual(faults('de-DE', 'About Us', 'Über uns<script>', terms), ['markup'])
})

test('English-identical prose is for review, not refusal; code, paths and names are not prose', () => {
  assert.deepEqual(faults('nl', 'Open source', 'Open source', terms), ['english'])
  assert.ok(SOFT.has('english'))
  for (const s of ['src/middleware/auth.ts', '  return next(req);', 'Claude Code, Codex, Cursor', 'Hanzo Dev', 'Traefik', 'GPQA Diamond']) {
    assert.deepEqual(faults('de-DE', s, s, terms), [], s)
  }
  assert.deepEqual(faults('en-US', 'Open source', 'Open source', terms), [])
})

test('every locale in a non-Latin script is held to it, and Hong Kong to Traditional characters', () => {
  assert.deepEqual(faults('fa', 'Account and organization', 'Account va sazman', terms), ['script'])
  assert.deepEqual(faults('he', 'Account and organization', 'חשבון וארגון', terms), [])
  assert.deepEqual(faults('pa-PK', 'Account and organization', 'ਖਾਤਾ ਅਤੇ ਸੰਸਥਾ', terms), ['script'])
  assert.deepEqual(faults('pa', 'Account and organization', 'ਖਾਤਾ ਅਤੇ ਸੰਸਥਾ', terms), [])
  assert.deepEqual(faults('my', 'Account and organization', 'အကောင့်နှင့် အဖွဲ့အစည်း', terms), [])
  assert.deepEqual(faults('zh-HK', 'Account and organization', '账户和组织机构', terms), ['simplified'])
  assert.deepEqual(faults('zh-HK', 'Account and organization', '帳戶和組織', terms), [])
  // Latin-script locales have no script to hold: Kurmanji, Uzbek, Malay.
  assert.deepEqual(faults('ku', 'Account and organization', 'Hesab û rêxistin', terms), [])
})
