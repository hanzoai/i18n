# `@hanzo/i18n` — translation toolkit

**A brand-neutral, content-neutral toolkit for managing translations.**
No content lives here. Each product owns its own `translations/` directory and
consumes the toolkit packages + CLIs.

## What lives here (toolkit)

| package                  | role | state |
|--------------------------|------|-------|
| `@hanzo/i18n`            | locales, negotiation (`resolve`), slot parity (`slots`, `parity`), file layout (`source`, `translation`, `contents`) | **built**, 18 tests |
| `@hanzo/i18n-native`     | which language a device is set to (`detect`) | **built**, 5 tests |
| `@hanzo/i18n-react`      | React bindings — `useT`, `<Trans>`, `buildResources` | thin re-export of react-i18next |
| `@hanzo/i18n-server`     | which language a request asks for (`accept`, `negotiate`), and the `hreflang` + sitemap surface that makes a translated page findable | **built**, 21 tests |
| `@hanzo/i18n-extract`    | scan a codebase → write missing keys into `source/<ns>/en-US.json` | **built**, 13 tests |
| `@hanzo/i18n-translate`  | fill missing locales through `api.hanzo.ai` | **built**, 9 tests |
| `@hanzo/i18n-validate`   | the gate — every key in every locale, slot parity, no product's words in ours | **built**, 15 tests |

The state column is load-bearing. It once read as though all seven existed while
two of them were empty directories, which is the shape that gets a package
adopted on paper and discovered missing by whoever imports it.

## The formatter is shared; only DISCOVERY is per-surface

A message renders identically on web, desktop and mobile — ICU is ICU and the
bindings are the same React, so there is nothing platform-specific about
formatting one. What actually differs is how each surface learns the person's
preference: a browser has `navigator.languages`, a phone has an OS list, a server
has `Accept-Language`.

So that is the ONLY axis packages split on, and it is why `@hanzo/i18n-native` is
a few dozen lines rather than a mobile port of the toolkit. A second formatter
"for mobile" is how one string comes to render two ways.

`resolve` is the counterpart and lives in core precisely because every surface
needs it: turning `en-GB`, `es-419` or `zh-Hant-HK` into a locale we ship is one
decision, and a surface that answers it locally is a surface where the same
person sees a different language depending on which app they opened.
`@hanzo/i18n-native` and `@hanzo/i18n-server` exist to ANSWER what a device or a
request wants, never to re-decide what we serve — `detect` and `negotiate` are
both `resolve` over a preference list, and each package carries a test pinning
that it cannot disagree with core.

Script is the part a naive matcher drops: `zh-CN` and `zh-TW` differ by writing
system and neither tag says so, so both sides are maximized through `Intl.Locale`
before comparing. Without it a Hong Kong reader gets simplified characters
because `zh-CN` is listed first.

Slot parity is the same story one level down. `{{amount}}` surviving translation
is what stands between a person and a screen with a blank where a number goes, so
`slots` and `parity` live in core and both the translator and the gate ask there.
Answered separately, the translator writes a file the gate then refuses.

## What does NOT live here (content)

Each product's strings live with the product:

```
~/work/lux/exchange/translations/
├── source/<ns>/en-US.json           ← the canonical English strings
└── translations/<locale>/<ns>.json   ← translator output, human-reviewed

~/work/zoo/exchange/translations/      ← (or a soft-link to lux's upstream)
~/work/hanzo/chat/translations/
~/work/hanzo/console/translations/
~/work/hanzo/iam/translations/
~/work/hanzo/id/translations/
~/work/lux/bridge/translations/
```

The toolkit doesn't care which product calls it — every CLI takes `--source`
and `--translations` directory args.

## CLI usage from a product repo

```bash
# new keys from code → source/<ns>/en-US.json
pnpm dlx @hanzo/i18n-extract \
  --code ./apps/web/src \
  --source ./translations/source

# fill what the other thirteen locales are missing
HANZO_API_KEY=$(hanzo kms get /i18n/translator) \
pnpm dlx @hanzo/i18n-translate \
  --source ./translations/source \
  --translations ./translations/translations

# the gate, on every PR
pnpm dlx @hanzo/i18n-validate \
  --source ./translations/source \
  --translations ./translations/translations \
  --forbid-literal "Lux Wallet,lux.exchange,Zoo Wallet,zoo.exchange"
```

`extract` reads `t('key')`, `t('key', 'English')`, `t('ns:key')` and
`<Trans i18nKey="key">`. A key built at runtime is not extracted, because nothing
static can know what it holds — those belong in the source file by hand.

`translate` only ever writes keys that are missing, so a reviewer's correction
survives every later run and a second CI run costs nothing. A translation whose
slots don't match its source is refused rather than written, which leaves the key
missing for the next run and visible to the gate now.

The `--forbid-literal` list belongs to the product, not the toolkit. Different
products forbid different brand strings.

## Library usage from a product repo

```ts
// apps/web/src/i18n.ts
import { buildResources, useT } from '@hanzo/i18n-react'
import enUS from '../translations/source/exchange/en-US.json'
import esES from '../translations/translations/es-ES/exchange.json'

i18n.init({
  fallbackLng: 'en-US',
  resources: buildResources({ 'en-US': { exchange: enUS }, 'es-ES': { exchange: esES } }),
})
```

```ts
// any server: which language, and how a crawler finds the other thirteen
import { links, negotiate, sitemap } from '@hanzo/i18n-server'

const locale = negotiate(request.headers.get('accept-language'))

const site = { origin: 'https://hanzo.ai' }
links('/pricing', site)                       // <link rel="alternate" hreflang="…"> for the head
sitemap(['/', '/pricing', '/docs'], site)     // every locale of every path
```

Each localized URL is its own sitemap entry carrying the whole alternate set,
including `x-default`. The set counts only when it is reciprocal, so the shorter
version — one entry for the default URL listing the translations — is ignored and
the translations go unindexed. Pass `url` on the site to keep locales somewhere
other than a path prefix.

The toolkit knows nothing about exchanges, wallets, chats, or any specific
product. It only knows what a "translation" is, what locales are supported,
where the files sit, and how to check slot parity.

## Brand interpolation contract

`@hanzo/i18n` exports a `BrandInterpolation` type — the standard slot names
that all white-label products use. Products are free to extend it with their
own slots; the toolkit just enforces parity between source and translations.

```ts
export interface BrandInterpolation {
  brandName: string
  brandTitle: string
  walletName: string
  protocolName: string
  coinSymbol: string
  appDomain: string
  legalEntity: string
  copyrightHolder: string
  [key: string]: string  // products can extend
}
```

## One way to do everything

Source-of-truth English lives in the **product** repo at
`translations/source/<ns>/en-US.json`; `translate` fills
`translations/translations/<locale>/<ns>.json` for the other thirteen; apps
import statically from their own `translations/` dir. A typo in production is a
PR, and CI takes under five minutes — that IS the hot-fix path.

Packages ship TypeScript. `main` is `src/index.ts`, Node strips types, and every
bundler downstream reads them, so there is no build step and nothing to keep in
sync with a `dist/`.

## Supported locales (toolkit-defined)

```
en-US  zh-CN  zh-TW  nl-NL  fr-FR  de-DE  id-ID  ja-JP  ko-KR
pt-PT  ru-RU  es-ES  tr-TR  vi-VN
```

Adding a locale: edit `pkgs/core/src/locales.ts`, ship a new `@hanzo/i18n@x.y.z`,
products `pnpm up @hanzo/i18n` and rerun `@hanzo/i18n-translate`.

## Rules

1. Toolkit packages do NOT import or know about any product's content.
2. Products consume the toolkit, never extend it with brand-specific code.
3. Brand-name forbid lists are passed to `validate` as flags, never hardcoded.
4. CLIs are configured via flags — no hardcoded paths to `~/work/...` anywhere.
5. Inference goes to `api.hanzo.ai`. The key comes from KMS via `HANZO_API_KEY`
   and is never committed.
6. `pnpm test` and `pnpm typecheck` from the root run every package.
