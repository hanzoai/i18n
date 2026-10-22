import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { isolate, phrase, pieces, translate } from '../src/index.ts'
import { useI18n } from '../src/react.ts'

test('pieces cut a translation at its arguments, in the translation’s order', () => {
  assert.deepEqual(pieces({ 'By {who} on {day}': 'Am {day} von {who}' }, 'By {who} on {day}'), [
    'Am ',
    { name: 'day' },
    ' von ',
    { name: 'who' },
  ])
  assert.deepEqual(pieces({}, '{n}'), [{ name: 'n' }])
  assert.deepEqual(pieces({}, 'plain'), ['plain'])
})

test('translate is pieces joined, an argument with no value left visible', () => {
  assert.equal(translate({}, '{n} of {total}', { n: 3 }), '3 of {total}')
})

test('isolate wraps text in a first-strong isolate, invisible in any direction', () => {
  assert.equal(isolate('1,150–1,400'), '⁨1,150–1,400⁩')
})

test('phrase is its argument', () => {
  assert.equal(phrase('About Us'), 'About Us')
})

/** What `t` returns, rendered, outside any provider: English, left to right. */
function said(source: string, values?: Record<string, ReactNode>): string {
  function Probe() {
    const { t } = useI18n()
    return createElement('p', null, values ? t(source, values) : t(source))
  }
  return renderToStaticMarkup(createElement(Probe))
}

test('t with text arguments is a string; with an element it is one sentence holding it', () => {
  assert.equal(said('{n} tasks', { n: 39 }), '<p>39 tasks</p>')
  assert.equal(
    said('By continuing, you agree to the {terms}.', { terms: createElement('a', { href: '/terms' }, 'Terms') }),
    '<p>By continuing, you agree to the <a href="/terms">Terms</a>.</p>',
  )
})
