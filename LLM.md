# `@hanzo/i18n` — translation toolkit

**A brand-neutral, content-neutral toolkit for managing translations.**
No content lives here. Each product owns its own `translations/` directory and
consumes the toolkit packages + CLIs.

## What lives here (toolkit)

| package                  | role | state |
|--------------------------|------|-------|
| `@hanzo/i18n`            | locale registry, negotiation (`resolve`), types, brand-interpolation contract | **built**, tested |
| `@hanzo/i18n-native`     | which language a device is set to (`detect`) | **built**, tested |
| `@hanzo/i18n-react`      | React bindings — `useT`, `<Trans>`, `buildResources` | thin re-export of react-i18next |
| `@hanzo/i18n-server`     | Node / SSR helpers | **not written** |
| `@hanzo/i18n-extract`    | scan a codebase → write missing keys into `source/<ns>/en-US.json` | **not written** |
| `@hanzo/i18n-translate`  | zen-translator CLI — calls `llm.hanzo.ai`, fills missing locales | **not written** |
| `@hanzo/i18n-validate`   | CI gate — every key translated in every locale, `{{slot}}` parity | **not written** |

The state column is not decoration. This table described all seven as though
they existed while `native/` and `server/` were EMPTY DIRECTORIES, which is the
shape that gets a package adopted on paper and discovered missing by whoever
imports it.

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
`@hanzo/i18n-native` exists to ANSWER what the device wants, never to re-decide
what we serve — `detect` is `resolve` over the device list, and a test pins that
the two cannot disagree.

Script is the part a naive matcher drops: `zh-CN` and `zh-TW` differ by writing
system and neither tag says so, so both sides are maximized through `Intl.Locale`
before comparing. Without it a Hong Kong reader gets simplified characters
because `zh-CN` is listed first.

## What does NOT live here (content)

Each product's strings live with the product:

```
~/work/lux/exchange/translations/
├── source/<ns>/en-US.json           ← the canonical English strings
└── translations/<locale>/<ns>.json   ← zen-translator output, human-reviewed

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
# CI: extract new keys from code → source/exchange/en-US.json
pnpm dlx @hanzo/i18n-extract \
  --code ./apps/web/src \
  --source ./translations/source

# CI: fill missing translations via zen-translator
HANZO_LLM_API_KEY=$(hanzo-kms get /i18n/zen-translator-key) \
pnpm dlx @hanzo/i18n-translate \
  --source ./translations/source \
  --translations ./translations/translations \
  --namespaces exchange,wallet

# CI: validate every PR
pnpm dlx @hanzo/i18n-validate \
  --source ./translations/source \
  --translations ./translations/translations \
  --forbid-literal "Lux Wallet,lux.exchange,Zoo Wallet,zoo.exchange"
```

The `--forbid-literal` list belongs to the product, not the toolkit. Different
products forbid different brand strings.

## Library usage from a product repo

```ts
// apps/web/src/i18n.ts in lux/exchange
import { buildResources, useT } from '@hanzo/i18n-react'
import { SUPPORTED_LOCALES } from '@hanzo/i18n'
import enUS from '../translations/source/exchange/en-US.json'
import esES from '../translations/translations/es-ES/exchange.json'
// …

i18n.init({
  fallbackLng: 'en-US',
  resources: buildResources({
    'en-US': { exchange: enUS },
    'es-ES': { exchange: esES },
    // …
  }),
})
```

The toolkit knows nothing about exchanges, wallets, chats, or any specific
product. It only knows what a "translation" is, what locales are supported,
and how to validate slot parity.

## Brand interpolation contract

`@hanzo/i18n` exports a `BrandInterpolation` type — the standard slot names
that all white-label products use. Products are free to extend it with their
own slots; the toolkit just enforces parity between source and translations.

```ts
// @hanzo/i18n/types
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

1. Source-of-truth English strings live in the **product** repo: `translations/source/<ns>/en-US.json`.
2. zen-translator fills `translations/translations/<locale>/<ns>.json` for the other 13 locales.
3. Apps import statically from their own `translations/` dir.
4. Typo in production? `PR → review → merge → ship`. CI takes <5 minutes. That IS the hot-fix path.

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
