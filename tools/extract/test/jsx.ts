import assert from 'node:assert/strict'
import test from 'node:test'

import { transformSync } from 'esbuild'

import { english } from '../src/english.ts'
import { text } from '../src/jsx.ts'

/**
 * What `T` is handed at runtime: the element compiled by a real JSX compiler (React's
 * automatic runtime, as Next and every Hanzo package build it) and run.
 */
function handed(element: string): unknown {
  const js = transformSync(`const out = ${element}`, { loader: 'tsx', jsx: 'automatic', format: 'cjs' }).code
  const T = () => null
  const jsx = (type: unknown, props: { children?: unknown }) => (type === T ? props.children : { type })
  const run = new Function('require', 'T', 'n', 'name', 'label', `${js}\nreturn out`)
  return run(() => ({ jsx, jsxs: jsx }), T, 3, 'Ada', 'Pricing')
}

const IMPORT = "import { T } from '@hanzo/i18n/react'\nimport * as i18n from '@hanzo/i18n/react'\n"

// Each is an element whose children ARE a key; the extractor must read exactly what T receives.
const KEYS: readonly string[] = [
  '<T>Sign in</T>',
  `<T>
    The core of the platform is open source:
    every repository to read, run and fork.
  </T>`,
  `<T>
    One

    two
  </T>`,
  '<T>\n\tIndented\n\t\twith tabs\n</T>',
  '<T>Tab\tinside</T>',
  '<T>  spaced on one line  </T>',
  '<T>Hello   \n   world</T>',
  '<T>First line\n    second line</T>',
  '<T>\r\n  Windows\r\n  lines\r\n</T>',
  '<T>Line one\n   \nLine two</T>',
  `<T>Don't "quote" me</T>`,
  '<T>Hanzo&apos;s &amp; Zen &#8212; &#x2014; done&nbsp;now &copy; &hellip;</T>',
  '<T>a &bogus; b &amp c</T>',
  `<T values={{ n }}>
    {'{n} tasks left'}
  </T>`,
  '<T>{`Save {percent}%`}</T>',
  '<T>{/* why it says this */}Pricing</T>',
  `<T>
    {/* why */}
    Pricing
  </T>`,
  '<i18n.T>Settings</i18n.T>',
]

test('the key read from <T> is the string T is handed, compiled for real', () => {
  for (const element of KEYS) {
    const runtime = handed(element.replace('<i18n.T>', '<T>').replace('</i18n.T>', '</T>'))
    assert.equal(typeof runtime, 'string', element)
    assert.deepEqual(english(`${IMPORT}const a = ${element}`, 'a.tsx'), [runtime], element)
  }
})

test('children that are not one string are not a key, and T would not get one either', () => {
  for (const element of ['<T>Hello {name}</T>', "<T>{'a'}{'b'}</T>", "<T> {'x'}</T>", '<T><b>bold</b></T>', '<T>{label}</T>']) {
    assert.deepEqual(english(`${IMPORT}const a = ${element}`, 'a.tsx'), [], element)
    if (!element.includes('{label}')) {
      assert.notEqual(typeof handed(element), 'string', element)
    }
  }
})

test('multi-line JSX text is one line, joined by single spaces', () => {
  // SWC, TypeScript and esbuild keep a tab inside a line (Babel alone makes it a space).
  assert.equal(text('Tab\tinside'), 'Tab\tinside')
  assert.equal(text('\n    Build what\n    is next,\n\n    together.\n  '), 'Build what is next, together.')
  assert.equal(text('\n  \n'), '')
  assert.equal(text(' kept '), ' kept ')
  // An entity's line break breaks the line; an entity's space or tab is never trimmed.
  assert.equal(text('a&#10;b'), 'a b')
  assert.equal(text('x &#10; y'), 'x y')
  assert.equal(text('a&#32;\n  b'), 'a  b')
  assert.equal(text('&#32;\n  x'), '  x')
  assert.equal(text('a &#9;\n b'), 'a \t b')
  assert.equal(text('a\u2029b'), 'a b')
  assert.equal(text('&check; &#X41; &#x41; &lang;'), '&check; &#X41; A \u2329')
})

test('both arms of a choice in braces; another element name is not read; a self-closing T has none', () => {
  assert.deepEqual(english(`${IMPORT}<T>{open ? 'Close' : 'Open'}</T>`, 'a.tsx'), ['Close', 'Open'])
  assert.deepEqual(english(`${IMPORT}<Text>Plain</Text>; <T />`, 'a.tsx'), [])
})

test('a T the file defines itself is not the one that translates', () => {
  // hanzo.ai's components/analytics/OpenSource.tsx draws code with a local syntax-token T.
  const local = `
    function T({ k, children }: { k: string; children: React.ReactNode }) {
      return <span className={k}>{children}</span>
    }
    export const Sample = () => (
      <pre><T k="key">import</T> <T k="punct">{'{'}</T> <T k="name">HanzoAnalytics</T> <T k="punct">{'}'}</T></pre>
    )
  `
  assert.deepEqual(english(local, 'OpenSource.tsx'), [])
  assert.deepEqual(english(`import { T } from './tokens'\n<T>From elsewhere</T>`, 'a.tsx'), [])
  assert.deepEqual(english(`import type { T } from '@hanzo/i18n/react'\n<T>Only a type</T>`, 'a.tsx'), [])
  assert.deepEqual(english(`import { T } from '@hanzo/i18n'\n<T>The root has no T</T>`, 'a.tsx'), [])
})

test('the imported T is read under the name the file gives it', () => {
  const aliased = `import { T as Say, useI18n } from '@hanzo/i18n/react'\nconst T = (p: object) => null;\n<Say>Hello</Say>; <T>Not this one</T>`
  assert.deepEqual(english(aliased, 'a.tsx'), ['Hello'])
  assert.deepEqual(english(`import * as i18n from '@hanzo/i18n/react'\n<i18n.T>Settings</i18n.T>; <T>Bare</T>`, 'a.tsx'), ['Settings'])
  // --tag names the export, so a renamed export is read wherever it is imported.
  assert.deepEqual(english(`import { Say as S } from '@hanzo/i18n/react'\n<S>Hi</S>`, 'a.tsx', ['t'], ['Say']), ['Hi'])
})
