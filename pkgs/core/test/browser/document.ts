/**
 * A whole static-export page as a host renders it: React owns `<html>`, the head
 * carries `bootScript()`, and the provider sits in the body. The server renders it
 * to a string (English, as an export is) and `hydrate.ts` hydrates the document.
 */
import { createElement as h, type ReactNode } from 'react'

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

function Page(): ReactNode {
  const { t, dir } = useI18n()
  return h('main', null, h(LanguagePicker), h('h1', null, t('Welcome')), h('aside', { 'data-side': dir === 'rtl' ? 'right' : 'left' }))
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
    h('body', null, h(I18nProvider, { userId: user, account, loadCatalog }, h(Page)), h('script', { type: 'module', src: '/hydrate.js' })),
  )
}
