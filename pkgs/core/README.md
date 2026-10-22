# @hanzo/i18n

Hanzo's localization in one package: a registry of 79 locales, the negotiation
every surface shares, a React provider and language picker, right-to-left
layout, and the interface catalogs, each loaded only when chosen.

```sh
pnpm add @hanzo/i18n
```

## React

```tsx
import { I18nProvider, LanguagePicker, useI18n } from '@hanzo/i18n/react'
import '@hanzo/i18n/rtl.css'

<I18nProvider userId={subject} account={{ base: 'https://hanzo.id', token }}>
  <LanguagePicker />
  <App />
</I18nProvider>

function Title({ name }: { name: string }) {
  const { t } = useI18n()
  return <h1>{t('Welcome back, {name}', { name })}</h1>
}
```

`t('English source', { values })` translates authored interface copy; a message a
catalog lacks renders its English. Never pass user content, organization names, code
or API responses through it. Rendering never calls a model.

- **Choice.** Saved per account in this browser, with a separate signed-out choice;
  other tabs follow. With `account`, it is also read from and written to IAM's
  `/v1/iam/preferences` (only `locale`), so it follows the person across devices, and
  the account's choice is kept in this browser so the next load opens in it.
  A failed save keeps the device choice and reports it; a failed catalog load keeps
  the current language and offers a retry.
- **First visit.** Signed out, the browser's languages pick one; signed in,
  `initialLocale` (English). A server prerender is English and hydrates; with
  `bootScript` in the head, `<html lang dir>` is right before the first paint.
- **Review.** Locales in `catalogs/review.json` are machine translations waiting for
  a native reader. They load by code, so a person who chose one keeps it, but the
  picker does not offer them and a browser language does not select them.
  `<LanguagePicker review />` offers them.
- **Right-to-left.** Every locale in Arabic or Hebrew script (Arabic and its regional
  variants, Persian, Dari, Hebrew, Urdu, Pashto, Central Kurdish, Sindhi, Uyghur,
  Punjabi in Shahmukhi) sets `<html lang dir="rtl">`. Lay out with logical properties
  (`margin-inline-start`, `text-align: start`). `rtl.css` selects on `:dir(rtl)`, so it
  holds on a right-to-left page and inside any `dir="rtl"` region: it keeps code, URLs,
  email inputs and `[data-i18n-ltr]` left-to-right, and mirrors `[data-i18n-mirror]`
  icons. Language names are in their own scripts, never flags.
- **Scripts.** Load a Noto family per script you serve. Urdu and Punjabi (Pakistan) read
  best in Nastaliq, which needs `line-height` of about 2.2; Noto Naskh Arabic is the
  compact choice. Persian spells with the zero-width non-joiner (U+200C): do not strip
  it. Burmese, Khmer, Lao and Thai put no spaces between words, so keep
  `word-break: normal` and let the browser's dictionary break lines; their stacked marks
  want `line-height` of 1.7 or more. Georgian has no letter case: do not
  `text-transform: uppercase` it.

### Before the first paint

A static export arrives in English. Put `bootScript()` first in the head and the page
opens in the reader's direction, before any bundle runs:

```tsx
import { bootScript } from '@hanzo/i18n/boot'
// the root layout: first in <head>
<html lang="en-US" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: bootScript() }} />…</head>…</html>
```

It sets `<html lang dir>` to what the provider last showed in this browser, or else the
browser's languages negotiated as `resolve` does, and touches nothing else. About 1.5 KB,
no React, safe in a server component.

### Send sentences, not fragments

A string is translated alone. A sentence split around a link
(`"By continuing, you agree to Hanzo's " + <a>Terms</a>`) cannot be put in another
language's order: Arabic places the owner after the noun, inside the link, so the
fragment's translation drops "Hanzo". Pass the whole sentence as one string with the
link as a placeholder (an argument with no value stays in place) and split on it:

```tsx
const [before, after] = t('By continuing, you agree to the {terms}.').split('{terms}')
return <p>{before}<a href="/terms">{t("Hanzo's Terms of Service")}</a>{after}</p>
```

## Everywhere else

```ts
import { locales, resolve, direction, translate } from '@hanzo/i18n'
import { negotiate, links, sitemap } from '@hanzo/i18n/server'
import { detect } from '@hanzo/i18n/native'

resolve(['zh-TW', 'en'])            // 'zh-Hant' — script decides, then region
resolve('es-CO')                    // 'es-419' — the variant that serves Colombia
negotiate(request.headers.get('accept-language'))
links('/pricing', { origin: 'https://hanzo.ai' })   // reciprocal hreflang set, x-default included
detect()                            // the device's language, negotiated the same way
```

Catalogs are also importable directly: `@hanzo/i18n/catalogs/ar.json`.

## Locales

79 locales: am, ar, ar-EG, ar-LB, ar-MA, ar-SA, hy, as, az, bn, bho, my, ceb, ckb, zh-HK,
zh-Hans, zh-Hant, da, fa-AF, nl, en-US, fil, fi, fr-CA, fr-FR, ka, de-DE, gu, ht, ha, he,
hi-IN, id-ID, it-IT, ja-JP, jv, kn, kk, km, ko-KR, ku, ky, lo, ms, ml, mr, mn, ne, nb, or,
om, ps, fa, pt-BR, pt-PT, pa, pa-PK, ru, sd, si, so, es-AR, es-419, es-MX, es-ES, su, sw,
sv, tg, ta, te, th, tr, tk, uk, ur, ug, uz, vi. Those in `catalogs/review.json` wait for a
native reader and are not offered until one clears them. Every translation is
machine-made and validated (placeholders, protected names in Latin script, the locale's
own script, the right Chinese); `catalogs/provenance.json` records the model and run
behind each message.
