import assert from 'node:assert/strict'
import test from 'node:test'

import { format } from '../src/format.ts'
import { isolate } from '../src/message.ts'

const FSI = '⁨'
const PDI = '⁩'
const en = format('en-US')
const NOW = Date.UTC(2026, 9, 22, 12, 0, 0)

test('English is what toLocaleString writes, byte for byte, for the options a page passes', () => {
  const cases: [number, Intl.NumberFormatOptions][] = [
    [1234567.891, {}],
    [0.5, {}],
    [12.3456, { maximumFractionDigits: 2 }],
    [1234.5, { minimumFractionDigits: 2, maximumFractionDigits: 2 }],
    [999.95, { maximumFractionDigits: 0 }],
    [1e9, { notation: 'compact' }],
  ]
  for (const [value, options] of cases) {
    assert.equal(en.number(value, options), value.toLocaleString('en-US', options))
  }
  const day = new Date(NOW)
  // With no parts named, a date alone, as toLocaleDateString writes it.
  assert.equal(en.date(day), day.toLocaleDateString('en-US'))
  for (const options of [{ timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' }, { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' }] as const) {
    assert.equal(en.date(day, options), day.toLocaleString('en-US', options))
  }
})

test('money, percent, date, relative and list in English', () => {
  assert.equal(en.money(1234.5, 'USD'), '$1,234.50')
  assert.equal(en.money(20, 'USD', { maximumFractionDigits: 0 }), '$20')
  assert.equal(en.percent(0.929, { maximumFractionDigits: 1 }), '92.9%')
  assert.equal(en.date('2026-10-22', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }), 'October 22, 2026')
  assert.equal(en.date(NOW, { timeZone: 'UTC', month: 'short', year: 'numeric' }), 'Oct 2026')
  assert.equal(en.list(['Chat', 'Dev', 'Kai']), 'Chat, Dev, and Kai')
  assert.equal(en.list(['Chat', 'Dev'], { type: 'disjunction' }), 'Chat or Dev')
})

test('relative: the largest unit the span fills, past and future, or the unit asked for', () => {
  const at = (seconds: number, options = {}) => en.relative(NOW + seconds * 1000, { now: NOW, ...options })
  assert.equal(at(-30), '30 seconds ago')
  assert.equal(at(-180), '3 minutes ago')
  assert.equal(at(-2 * 3600), '2 hours ago')
  assert.equal(at(2 * 86400), 'in 2 days')
  assert.equal(at(-86400, { numeric: 'auto' }), 'yesterday')
  assert.equal(at(-14 * 86400), '2 weeks ago')
  assert.equal(at(-60 * 86400), '2 months ago')
  assert.equal(at(-400 * 86400), '1 year ago')
  assert.equal(at(-3 * 86400, { unit: 'hour' }), '72 hours ago')
  assert.equal(en.relative(new Date(NOW - 5000), { now: new Date(NOW), style: 'narrow' }), '5s ago')
})

test('the locale decides its digits as Intl does', () => {
  assert.equal(format('ar-EG').number(1234), isolate(new Intl.NumberFormat('ar-EG').format(1234)))
  assert.match(format('ar-EG').number(1234), /١٬٢٣٤/)
  assert.match(format('fa').number(1234), /۱٬۲۳۴/)
  assert.equal(format('ar').number(1234), isolate(new Intl.NumberFormat('ar').format(1234)))
  assert.equal(format('de-DE').money(1234.5, 'EUR'), new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(1234.5))
  assert.equal(format('hi-IN').number(1234567), '12,34,567')
})

test('right to left, each result is one isolate; a list isolates every item', () => {
  const ar = format('ar')
  for (const result of [ar.number(1234), ar.money(5, 'USD'), ar.percent(0.25), ar.date(NOW, { timeZone: 'UTC' }), ar.relative(NOW - 60000, { now: NOW })]) {
    assert.ok(result.startsWith(FSI) && result.endsWith(PDI), JSON.stringify(result))
    assert.equal([...result].filter((c) => c === FSI).length, 1, JSON.stringify(result))
  }
  const names = ar.list(['Chat', 'Dev', 'Kai'])
  assert.ok(names.startsWith(FSI) && names.endsWith(PDI))
  for (const name of ['Chat', 'Dev', 'Kai']) {
    assert.ok(names.includes(`${FSI}${name}${PDI}`), names)
  }
  assert.equal(format('he').number(7), `${FSI}7${PDI}`)
  assert.equal(en.number(7), '7')
})

test('isolate leaves one whole isolate alone and wraps anything else', () => {
  assert.equal(isolate('5'), `${FSI}5${PDI}`)
  assert.equal(isolate(isolate('5')), `${FSI}5${PDI}`)
  assert.equal(isolate(format('ar').list(['a', 'b'])), format('ar').list(['a', 'b']))
  const two = `${FSI}a${PDI} و ${FSI}b${PDI}`
  assert.equal(isolate(two), `${FSI}${two}${PDI}`)
})

test('a moment Date cannot read is an error, never the words "Invalid Date"', () => {
  assert.throws(() => en.date('not a date'), RangeError)
  assert.throws(() => en.relative('not a date'), RangeError)
})
