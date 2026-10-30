/**
 * A whole static-export page as a host renders it: React owns `<html>`, the head
 * carries `bootScript()`, and the provider sits in the body. The server renders it
 * to a string (English, as an export is) and `hydrate.ts` hydrates the document.
 */
import { Suspense, createElement as h, lazy, useEffect, type ReactNode } from 'react'

import { bootScript } from '../../src/boot.ts'
import { I18nProvider, LanguagePicker, useI18n } from '../../src/react.ts'

export interface Props {
  user: string | null
  account?: { base: string; token: string }
  /** Leave out `suppressHydrationWarning`, to show React does report the changed `<html>`. */
  strict: boolean
}

/** `?user=alice&iam&strict`, read the same way by the server and the browser. */
export function props(href: string): Props {
  const url = new URL(href)
  const user = url.searchParams.get('user')
  return {
    user,
    account: user && url.searchParams.has('iam') ? { base: url.origin, token: 'test-only' } : undefined,
    strict: url.searchParams.has('strict'),
  }
}

async function loadCatalog(code: string) {
  return code === 'ar' || code.startsWith('ar-') ? { Welcome: 'مرحبًا', Language: 'اللغة' } : { Welcome: `Welcome:${code}` }
}

/** A section in a chunk of its own, as a host splits one. */
function Words(): ReactNode {
  // Marks the body once the section (and so the page around it) has hydrated.
  useEffect(() => void (document.body.dataset.late = 'hydrated'), [])
  return h('p', { 'data-late': '' }, useI18n().t('Language'))
}

/**
 * On the client the section's chunk arrives after the catalog has. It holds up the
 * boundary around the page (as a host's split section with no boundary of its own
 * holds up the nearest one), so the page hydrates with the reader's language already
 * loaded, and must still draw what the server wrote first.
 */
const Late =
  typeof window === 'undefined'
    ? Words
    : lazy(() => new Promise<{ default: typeof Words }>((done) => setTimeout(() => done({ default: Words }), 300)))

function Page(): ReactNode {
  const { t, dir } = useI18n()
  return h(
    'main',
    null,
    h(LanguagePicker),
    h('h1', null, t('Welcome')),
    h('aside', { 'data-side': dir === 'rtl' ? 'right' : 'left' }),
    h(Late),
  )
}

export function Document({ user, account, strict }: Props): ReactNode {
  return h(
    'html',
    { lang: 'en-US', suppressHydrationWarning: !strict },
    h(
      'head',
      null,
      h('meta', { charSet: 'utf-8' }),
      h('script', { dangerouslySetInnerHTML: { __html: bootScript() } }),
      h('link', { rel: 'stylesheet', href: '/rtl.css' }),
    ),
    h('body', null, h(I18nProvider, { userId: user, account, loadCatalog }, h(Suspense, { fallback: null }, h(Page))), h('script', { type: 'module', src: '/hydrate.js' })),
  )
}
