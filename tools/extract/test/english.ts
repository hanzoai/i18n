import assert from 'node:assert/strict'
import test from 'node:test'

import { catalogue, english } from '../src/english.ts'

test('a sentence is its own key, with apostrophes, colons and either quote', () => {
  const code = `
    const a = t("Hanzo's Terms of Service")
    const b = t('Note: {n} tasks', { n })
    const c = i18n.t(\`Sign in\`)
    const d = phrase('About Us')
  `
  assert.deepEqual(english(code, 'a.ts'), ["Hanzo's Terms of Service", 'Note: {n} tasks', 'Sign in', 'About Us'])
})

test('JSX attributes and children are read; a comment or doc example is not', () => {
  const code = `
    // t('in a comment')
    /** \`t('in a doc example')\` */
    export const A = () => <a aria-label={t('Open the menu')}>{t('Menu')}</a>
  `
  assert.deepEqual(english(code, 'a.tsx'), ['Open the menu', 'Menu'])
})

test('both arms of a choice, and the literal side of a fallback', () => {
  assert.deepEqual(english(`t(open ? 'Close' : 'Open'); t(name ?? 'Untitled')`, 'a.ts'), ['Close', 'Open', 'Untitled'])
})

test('a key built at runtime, or a template with a substitution, is not extracted', () => {
  assert.deepEqual(english('t(label); t(`Hello ${name}`); format("x"); at("y")', 'a.ts'), [])
})

test('the catalog adds what is found; pruning keeps only what is found', () => {
  assert.deepEqual(catalogue({ Old: 'Old', Kept: 'Kept' }, ['Kept', 'New'], false), { Old: 'Old', Kept: 'Kept', New: 'New' })
  assert.deepEqual(catalogue({ Old: 'Old', Kept: 'Kept' }, ['Kept', 'New'], true), { Kept: 'Kept', New: 'New' })
})
