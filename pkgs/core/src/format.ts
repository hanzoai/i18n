import { isolate } from './message.ts'
import { direction } from './resolve.ts'

/**
 * Figures, money, dates, spans of time and lists as the reader's language writes them.
 *
 * Every helper is `Intl` at the locale, and `options` are Intl's own, passed through:
 * en-US output is byte for byte `toLocaleString('en-US', options)`, so a page moved
 * onto these keeps its English. The locale decides its digits, separators and calendar
 * as Intl does — `ar` writes 1,234 and `ar-EG` ١٬٢٣٤, `fa` dates by the solar calendar —
 * and a caller who needs otherwise says so (`numberingSystem`, `calendar`).
 *
 * Right to left, every result is isolated as `t`'s arguments are (`isolate`), so a
 * figure keeps its own order inside Arabic prose; a list isolates each item too, so
 * Latin names read in the list's order, not the line's. Passed on to `t`, a result is
 * not isolated twice.
 */
export interface Format {
  /** `1234.5` → `1,234.5`; `١٬٢٣٤٫٥` in ar-EG. */
  number(value: number | bigint, options?: Intl.NumberFormatOptions): string
  /** A fraction: `0.929` → `93%`, or `92.9%` with `{ maximumFractionDigits: 1 }`. */
  percent(value: number, options?: Intl.NumberFormatOptions): string
  /** `money(1234.5, 'USD')` → `$1,234.50`; `currency` is ISO 4217. */
  money(amount: number, currency: string, options?: Intl.NumberFormatOptions): string
  /** A moment, written by `options` (date parts, time parts or both); without them, the date as toLocaleDateString writes it. */
  date(value: Moment, options?: Intl.DateTimeFormatOptions): string
  /** How far a moment is from now: `3 minutes ago`, `in 2 days`, in the largest unit it spans. */
  relative(value: Moment, options?: Relative): string
  /** `['Chat', 'Dev', 'Kai']` → `Chat, Dev, and Kai`. */
  list(items: readonly string[], options?: Intl.ListFormatOptions): string
}

/** A `Date`, milliseconds since the epoch, or a string `Date` parses (ISO 8601). */
export type Moment = Date | number | string

export interface Relative extends Intl.RelativeTimeFormatOptions {
  /** What the moment is measured from; the clock when absent. */
  now?: Moment
  /** Always this unit, rather than the largest the span fills. */
  unit?: Intl.RelativeTimeFormatUnit
}

const SECONDS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86400],
  ['month', 30 * 86400],
  ['week', 7 * 86400],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
]

/** The helpers for one locale. Formatters are built once per set of options and kept. */
export function format(locale: string): Format {
  const rtl = direction(locale) === 'rtl'
  const kept = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat | Intl.ListFormat>()
  function made<F extends Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat | Intl.ListFormat>(
    kind: string,
    options: object,
    make: () => F,
  ): F {
    const key = `${kind}:${JSON.stringify(options)}`
    let formatter = kept.get(key) as F | undefined
    if (!formatter) {
      formatter = make()
      kept.set(key, formatter)
    }
    return formatter
  }
  const out = (text: string) => (rtl ? isolate(text) : text)
  const number = (value: number | bigint, options: Intl.NumberFormatOptions) =>
    out(made('number', options, () => new Intl.NumberFormat(locale, options)).format(value))

  return {
    number: (value, options = {}) => number(value, options),
    percent: (value, options = {}) => number(value, { ...options, style: 'percent' }),
    money: (amount, currency, options = {}) => number(amount, { ...options, style: 'currency', currency }),
    date: (value, options = {}) => out(made('date', options, () => new Intl.DateTimeFormat(locale, options)).format(moment(value))),
    relative: (value, { now, unit, ...options } = {}) => {
      const span = (moment(value).getTime() - moment(now ?? Date.now()).getTime()) / 1000
      const [name, size] = SECONDS.find(([u, s]) => (unit ? u === unit : Math.abs(span) >= s)) ?? ['second', 1]
      return out(made('relative', options, () => new Intl.RelativeTimeFormat(locale, options)).format(Math.round(span / size), name))
    },
    list: (items, options = {}) => out(made('list', options, () => new Intl.ListFormat(locale, options)).format(rtl ? items.map(isolate) : items)),
  }
}

function moment(value: Moment): Date {
  return value instanceof Date ? value : new Date(value)
}
