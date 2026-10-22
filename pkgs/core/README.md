# @hanzo/i18n

Hanzo's localization in one package: a registry of 36 locales, the negotiation
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
  `/v1/iam/preferences` (only `locale`), so it follows the person across devices.
  A failed save keeps the device choice and reports it; a failed catalog load keeps
  the current language and offers a retry.
- **First visit.** Signed out, the browser's languages pick one; signed in,
  `initialLocale` (English). A server prerender is English and hydrates.
- **Review.** Locales in `catalogs/review.json` are machine translations waiting for
  a native reader. They load by code, so a person who chose one keeps it, but the
  picker does not offer them and a browser language does not select them.
  `<LanguagePicker review />` offers them.
- **Right-to-left.** Arabic sets `<html lang dir>`. Lay out with logical properties
  (`margin-inline-start`, `text-align: start`). `rtl.css` keeps code, URLs, email
  inputs and `[data-i18n-ltr]` left-to-right, and mirrors `[data-i18n-mirror]` icons.
  Language names are in their own scripts, never flags.

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

resolve(['zh-HK', 'en'])            // 'zh-Hant' — script decides, then region, then order
negotiate(request.headers.get('accept-language'))
links('/pricing', { origin: 'https://hanzo.ai' })   // reciprocal hreflang set, x-default included
detect()                            // the device's language, negotiated the same way
```

Catalogs are also importable directly: `@hanzo/i18n/catalogs/ar.json`.

## Locales

am, ar, bn, bho, zh-Hans, zh-Hant, da, nl, en-US, fil, fi, fr-FR, de-DE, gu, ha, hi-IN,
id-ID, it-IT, ja-JP, kn, ko-KR, ml, mr, nb, pt-BR, ru, es-419, es-ES, sw, sv, ta, te, th,
tr, uk, vi. Every translation is machine-made and validated (placeholders, protected
names in Latin script, the locale's own script, the right Chinese); `catalogs/provenance.json`
records the model and run behind each message.
