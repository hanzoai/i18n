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
    assert.deepEqual(english(`const a = ${element}`, 'a.tsx'), [runtime], element)
  }
})

test('children that are not one string are not a key, and T would not get one either', () => {
  for (const element of ['<T>Hello {name}</T>', "<T>{'a'}{'b'}</T>", "<T> {'x'}</T>", '<T><b>bold</b></T>', '<T>{label}</T>']) {
    assert.deepEqual(english(`const a = ${element}`, 'a.tsx'), [], element)
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
  assert.deepEqual(english(`<T>{open ? 'Close' : 'Open'}</T>`, 'a.tsx'), ['Close', 'Open'])
  assert.deepEqual(english('<Text>Plain</Text>; <T />', 'a.tsx'), [])
  assert.deepEqual(english('<Say>Hello</Say>', 'a.tsx', ['t'], ['Say']), ['Hello'])
})
