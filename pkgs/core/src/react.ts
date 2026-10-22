'use client'
import {
  Fragment,
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from 'react'

import { loadAccountLocale, saveAccountLocale, type Account } from './account.ts'
import { format, type Format } from './format.ts'
import { loaders, type Catalog } from './loaders.ts'
import { DEFAULT_LOCALE, OFFERED, locales } from './locales.ts'
import { PAINTED, isolate, pieces, preferenceKey, translate } from './message.ts'
import { direction, resolve } from './resolve.ts'

export type { Account } from './account.ts'
export type { Format, Moment, Relative } from './format.ts'
export type { Catalog } from './loaders.ts'

type Values = Readonly<Record<string, string | number>>
type Nodes = Readonly<Record<string, ReactNode>>

/**
 * Authored English in, the reader's language out. Arguments fill `{name}`:
 * `t('{n} tasks', { n })` is a string; give one argument an element and the whole
 * message is a node, so a link or a styled figure stays inside ONE sentence that a
 * translator can reorder — `t('By continuing, you agree to the {terms}.', { terms: <a…/> })`.
 * In a right-to-left locale each argument is isolated (`<bdi>`, or Unicode's isolate in
 * a string), so a number, a range or a Latin name keeps its own order in Arabic prose.
 */
export interface Say {
  (source: string, values?: Values): string
  (source: string, values: Nodes): ReactNode
}

export interface I18n {
  locale: string
  dir: 'ltr' | 'rtl'
  messages: Readonly<Record<string, string>>
  loading: boolean
  error: string | null
  setLocale: (locale: string) => Promise<void>
  t: Say
  /** Figures, money, dates, spans and lists in this locale (`./format.ts`). */
  format: Format
}

export interface I18nProviderProps {
  children?: ReactNode
  /** The signed-in subject. Each account, and the signed-out visitor, keeps its own choice. */
  userId?: string | null
  /** What a server prerender and a first-time signed-in visitor see. */
  initialLocale?: string
  /** Hanzo IAM, to load and save the choice on the account across devices. */
  account?: Account
  /** Replaces the bundled catalogs, e.g. to serve them from a CDN. */
  loadCatalog?: (code: string) => Promise<Catalog>
}

const Context = createContext<I18n>({
  locale: DEFAULT_LOCALE,
  dir: 'ltr',
  messages: {},
  loading: false,
  error: null,
  t: say({}, false),
  format: format(DEFAULT_LOCALE),
  setLocale: async () => {
    throw new Error('Changing language requires I18nProvider')
  },
})

export function I18nProvider({
  children,
  userId,
  initialLocale = DEFAULT_LOCALE,
  account,
  loadCatalog = (code) => {
    const load = loaders[code]
    return load ? load() : Promise.reject(new Error(`no catalog for ${code}`))
  },
}: I18nProviderProps): ReactNode {
  const [state, setState] = useState<{ locale: string; messages: Record<string, string> }>({
    locale: resolve(initialLocale),
    messages: {},
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sequence = useRef(0)
  const writes = useRef<Promise<void>>(Promise.resolve())
  const identity = useRef(userId)
  identity.current = userId

  /**
   * Load and show `value`. `save` says where the choice is kept: `account` (a person
   * chose it: this browser and IAM), `device` (IAM's choice, mirrored so the next load
   * starts in it), or nowhere (a choice already kept, re-applied).
   */
  async function select(value: string, save: 'account' | 'device' | false = 'account'): Promise<void> {
    const locale = resolve(value)
    const request = ++sequence.current
    const owner = identity.current
    setLoading(true)
    setError(null)
    try {
      const loaded: Catalog = locale === DEFAULT_LOCALE ? {} : await loadCatalog(locale)
      if (sequence.current !== request || identity.current !== owner) {
        return
      }
      const messages = ('default' in loaded ? loaded.default : loaded) as Record<string, string>
      setState({ locale, messages })
      document.documentElement.lang = locale
      document.documentElement.dir = direction(locale)
      try {
        // What the document shows is what bootScript paints first on the next load.
        localStorage.setItem(PAINTED, locale)
        if (save) {
          localStorage.setItem(preferenceKey(owner), locale)
        }
      } catch {
        // Private browsing may refuse storage; the choice still holds for this page.
      }
      if (save === 'account' && owner && account?.token) {
        const credentials = account
        writes.current = writes.current
          .catch(() => {})
          .then(async () => {
            if (identity.current !== owner) {
              return
            }
            await saveAccountLocale(credentials, locale, AbortSignal.timeout(10000))
          })
          .catch(() => {
            if (sequence.current === request && identity.current === owner) {
              setError('Language saved on this device. Account sync failed; select the language again to retry.')
            }
          })
      }
    } catch {
      if (sequence.current === request) {
        setError('Unable to load this language. Please try again.')
      }
    } finally {
      if (sequence.current === request) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    let saved: string | null = null
    try {
      saved = localStorage.getItem(preferenceKey(userId))
    } catch {
      // Storage is optional.
    }
    // A saved choice is honoured by code, review or not. A browser language only
    // selects what the picker offers. A different account never inherits the
    // preceding account's choice, so a signed-in first visit starts at initialLocale.
    void select(saved || (userId ? initialLocale : resolve(navigator.languages ?? [navigator.language], OFFERED)), false)
    const changed = (event: StorageEvent) => {
      if (event.key === preferenceKey(userId)) {
        void select(event.newValue || initialLocale, false)
      }
    }
    window.addEventListener('storage', changed)
    return () => {
      ++sequence.current
      window.removeEventListener('storage', changed)
    }
  }, [userId, initialLocale])

  useEffect(() => {
    if (!userId || !account?.token) {
      return
    }
    const stop = new AbortController()
    const before = sequence.current
    loadAccountLocale(account, stop.signal)
      .then((locale) => {
        if (locale && sequence.current === before && !stop.signal.aborted) {
          void select(locale, 'device')
        }
      })
      .catch(() => {}) // The device's choice stays usable offline.
    return () => stop.abort()
  }, [userId, account?.base, account?.token])

  const formats = useMemo(() => format(state.locale), [state.locale])
  const value = useMemo<I18n>(
    () => ({
      ...state,
      dir: direction(state.locale),
      loading,
      error,
      setLocale: select,
      t: say(state.messages, direction(state.locale) === 'rtl'),
      format: formats,
    }),
    [state, formats, loading, error, userId, account?.base, account?.token],
  )
  return createElement(Context.Provider, { value }, children)
}

export function useI18n(): I18n {
  return useContext(Context)
}

/** `<T>Settings</T>` — `t` as an element. */
export function T({ children, values }: { children: string; values?: Nodes }): ReactNode {
  return useI18n().t(children, values ?? {})
}

/** `t` over one catalog: a string while every argument is text, a node once one is not. */
function say(messages: Readonly<Record<string, string>>, rtl: boolean): Say {
  return ((source: string, values: Nodes = {}) => {
    const text = Object.values(values).every((v) => typeof v === 'string' || typeof v === 'number')
    if (text) {
      const plain = values as Values
      return translate(messages, source, rtl ? Object.fromEntries(Object.entries(plain).map(([k, v]) => [k, isolate(String(v))])) : plain)
    }
    const parts = pieces(messages, source).map((piece) => {
      if (typeof piece === 'string') {
        return piece
      }
      if (!Object.hasOwn(values, piece.name)) {
        return `{${piece.name}}`
      }
      const value = values[piece.name]
      if (!rtl) {
        return value
      }
      return typeof value === 'string' || typeof value === 'number' ? isolate(String(value)) : createElement('bdi', null, value)
    })
    return createElement(Fragment, null, ...parts)
  }) as Say
}

export interface LanguagePickerProps {
  className?: string
  style?: CSSProperties
  /** Also offer locales waiting for native review. The current one is always shown. */
  review?: boolean
}

export function LanguagePicker({ className, style, review = false }: LanguagePickerProps): ReactNode {
  const { locale, setLocale, t, loading, error } = useI18n()
  const offered = locales.filter((l) => review || !l.review || l.code === locale)
  return createElement(
    'label',
    { className, style: { display: 'inline-flex', flexDirection: 'column', gap: 4, maxWidth: '100%', ...style } },
    createElement('span', null, t('Language')),
    createElement(
      'select',
      {
        'aria-label': t('Language'),
        'aria-busy': loading,
        value: locale,
        onChange: (event: ChangeEvent<HTMLSelectElement>) => void setLocale(event.target.value),
        style: {
          maxWidth: '100%',
          minHeight: 36,
          color: 'inherit',
          background: 'var(--background, Canvas)',
          border: '1px solid var(--border, GrayText)',
          borderRadius: 6,
          paddingInline: 8,
          font: 'inherit',
        },
      },
      offered.map((item) => createElement('option', { key: item.code, value: item.code, lang: item.code, dir: item.dir }, item.name)),
    ),
    error && createElement('span', { role: 'alert' }, t(error)),
  )
}
