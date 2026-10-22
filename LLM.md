# hanzoai/i18n — `@hanzo/i18n`

**One package, and the three CLIs that fill and gate translations.** How to USE the
package is `pkgs/core/README.md` (what npm shows); this file is how it is built and why.

| path | what | publishes | tests |
|---|---|---|---|
| `pkgs/core` → **`@hanzo/i18n`** | `.`: the 36-locale registry (`locales`, `SUPPORTED_LOCALES`), `resolve`, `direction`, `slots`/`parity`, `faults`, file layout, `translate`. `./react`: `I18nProvider`, `LanguagePicker`, `useI18n`, `T`. `./server`: `accept`, `negotiate`, `links`, `alternates`, `sitemap`. `./native`: `detect`, `preferred`. `./rtl.css`. `./catalogs/*` | yes, by `.github/workflows/publish.yml` | 73 + `test:browser` |
| `tools/extract` | scan code → missing keys into `source/<ns>/en-US.json` | private | 18 |
| `tools/translate` | fill what a locale is missing: `/v1/translate`, chat, or a local model | private | 20 |
| `tools/validate` | the gate: presence, slots, protected names, script, Chinese variant | private | 20 |

There used to be seven packages. `@hanzo/i18n-react` (a react-i18next re-export nobody
imported) is gone; `-server` and `-native` are subpaths of the one package, because a
separate install for forty lines of negotiation is how two copies drift. The CLIs stay
separate and private: they are run from this checkout, not installed.

## Content lives here now

This repo was once "toolkit only, no content". It now ships Hanzo's own interface
catalogs in `pkgs/core/catalogs/` — 425 English-source keys × 36 locales, plus
`provenance.json` and `review.json` — because `@hanzo/rooms` and hanzo.ai consume them as
one dependency, lazily. That is a deliberate exception to the old rule, for Hanzo's
shared interface only. Every other product keeps its strings in its own
`translations/source/<ns>/en-US.json` + `translations/translations/<locale>/<ns>.json` and
runs the CLIs with `--source/--translations`; brand words and protected names arrive as
flags and files (`--forbid-literal`, `--terms`), never compiled in.

## The formatter is shared; only DISCOVERY is per-surface

A message renders identically everywhere. What differs is how a surface learns the
person's preference — `navigator.languages`, the OS list, `Accept-Language` — so that is
the only thing `./react`, `./native` and `./server` each answer, and every answer is
`resolve` over a preference list (tests pin `detect` and `negotiate` to it). `resolve`:

1. exact tag, case- and `_`-insensitive
2. same language and script — `zh-TW`/`zh-HK` → `zh-Hant`, never `zh-Hans`; among those the
   same region (`es` maximizes to Spain → `es-ES`), else registry order (`es-MX` → `es-419`)
3. same language (`en-GB` → `en-US`, `pt-PT` → `pt-BR`)
4. `en-US`

Both sides are maximized by `Intl.Locale`; the one alias it does not know is `no` → `nb`.
Registry order is therefore load-bearing: `es-419` before `es-ES`, `zh-Hans` before `zh-Hant`.

## Slots and faults: one definition, asked by both translator and gate

`slots` reads i18next `{{name}}` (bare name) and this package's `{name}` (reported with its
braces, so `{{amount}}` → `{amount}` fails parity). `parity` compares them as a multiset.
`faults(locale, source, value, terms)` is everything else a translation must get right:
`markup`, `names:` (a `terms.keep` name lost — inflection after it allowed, a possessive
ENDING a fragment exempt), `script` (prose in a non-Latin locale must use it), `simplified`
/ `traditional`, and `english` — identical prose, the one SOFT fault: listed for review,
never refused (Filipino keeps five loanwords on purpose). `translate` writes only values
with parity and no hard fault; `validate` fails on exactly those. Answered separately, the
translator writes what the gate refuses.

`pkgs/core/terms.json` is Hanzo's list: 22 protected names (Hanzo, Zen, Enso, Kai, Dev,
Studio, Gen, Lux, Zoo, Claude Code, Claude, Codex, Cursor, Antigravity, Gemini, Copilot,
GitHub, Google, Apple, OpenAI, Anthropic, Hugging Face) kept in Latin script in every
locale, and `brands` that are names but need not survive (only excluded from "is this prose").

## Catalogs

- **Loading.** `src/loaders.ts` holds one literal `import('../catalogs/<code>.json', { with:
  { type: 'json' } })` per locale, so a bundler emits one chunk per catalog (verified: 35 +
  entry) and Node imports them natively. The relative path is the same from `src/` and
  `dist/`. `src/json.d.ts` types them instead of `resolveJsonModule`, which would pull the
  JSON into the program outside `rootDir`.
- **Review.** `catalogs/review.json` is `{ "<locale>": "<why it waits>" }` (today `am`, `bho`,
  `ha`). `src/review.ts` is generated from it; `test/catalogs.ts` holds them equal. A review
  locale loads by code but is not offered by the picker or chosen from a browser language.
- **Sync.** Catalogs are generated outside the repo (GPU runs) and copied in by ONE script:

  ```sh
  scripts/sync-catalogs.sh <dir with en-US.json, <locale>.json, provenance.json, review.json>
  pnpm test && pnpm --filter @hanzo/i18n validate
  PLAYWRIGHT_CHROMIUM_EXECUTABLE=… pnpm --filter @hanzo/i18n test:browser
  ```

  It refuses a source missing any registry locale, `provenance.json` or `review.json`, and
  regenerates `src/review.ts`.
- **Provenance.** `provenance.json`, per locale, lists every run that wrote: model, pinned
  weights, time, the SHA-256 of `en-US.json`, and its keys. A message's provenance is the
  last run listing it; a run without `keys` covers the rest. `tools/translate --catalogs`
  appends to it.

## Translating

```sh
# Hanzo's endpoint (default): POST /v1/translate {batch, target, source:'en', glossary, tier}
HANZO_API_KEY=$(hanzo kms get /i18n/translator) node tools/translate/dist/cli.js \
  --catalogs pkgs/core/catalogs --terms pkgs/core/terms.json [--tier bulk] [--model <alias>]
# a chat model through api.hanzo.ai
… --mode chat --model zen5
# a local OpenAI-compatible server; no Hanzo key
TRANSLATION_BASE_URL=http://127.0.0.1:8733/v1 TRANSLATION_MODEL=jais3-ar \
  node tools/translate/dist/cli.js --catalogs pkgs/core/catalogs --terms pkgs/core/terms.json --locales ar
```

Only missing keys are sent, in groups of ≤100 keys / 8 KB; a refused or failed key stays
missing so the next run asks again and a reviewer's correction is never overwritten.
`/v1/translate` gets the protected names as its glossary; an entry it answers with `error`
is a refusal. The local mode sends `chat_template_kwargs.reasoning_effort`
(`TRANSLATION_REASONING`, default `low`) and strips a leading `<think>` block.

Generation that built today's catalogs: Arabic by **Jais 3** (`IFM/Jais-3-32B-GGUF` @
`7f88bd89cbf83ccce89d07776ad11f7bd62cc83b`, `Jais-3-32B-Q4_K_M.gguf`, Apache-2.0, on a
llama.cpp build with K2 Horizon support, `--jinja`, alias `jais3-ar`, reasoning low); the
rest by `halogen-qwen3.8-flash-next` on evo. Weights never enter this repo or the package.
Every catalog is machine-made; native review is pending for all, flagged for `review.json`'s.

## Source runs; `dist/` ships

Source imports name the file that exists (`./locales.ts`), so Node runs the tree under
`--experimental-strip-types` and a test needs no build. What publishes is JavaScript:
`tsc` emits `dist/`, `rewriteRelativeImportExtensions` turns `.ts` specifiers into `.js`.
Node REFUSES to strip types under `node_modules` at every version, so a `.ts` `main` is
unimportable once installed — verify packaging by installing the TARBALL, never from the
repo. `scripts/verify-package.sh <tgz>` does that where no dev dependency exists: plain
Node import of `.`, `./server`, `./native`; an esbuild bundle of `./react` + `rtl.css`; a
strict `tsc` against the declarations under `bundler` and `nodenext`. The workflow
publishes that same tarball. `"sideEffects": ["*.css"]` keeps `rtl.css` from being
tree-shaken. Tools import `@hanzo/i18n` from its `dist`, so `pnpm test`/`typecheck` build
core first.

## Release

Bump `pkgs/core/package.json` `version`, merge to main. `publish.yml` checks every PR
(typecheck, tests, catalog gate, build, tarball verification) and, on main, publishes when
npm lacks the version; `NPM_TOKEN` comes from KMS (`KMS_CLIENT_ID`/`KMS_CLIENT_SECRET`, env
prod). The browser test needs a Chromium and runs locally, not in CI.

## Rules

1. One package publishes: `@hanzo/i18n`. Tools are `private`.
2. Adding a locale: append to `src/locales.ts`, add its loader, generate its catalog, sync.
3. Brand content arrives as data (`--terms`, `--forbid-literal`); only `terms.json` and
   `catalogs/` hold Hanzo's.
4. CLIs take paths as flags; no `~/work/...` anywhere.
5. Inference goes through `api.hanzo.ai` or a local model; keys come from KMS via
   `HANZO_API_KEY` and are never committed.
