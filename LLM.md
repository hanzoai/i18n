# hanzoai/i18n — `@hanzo/i18n`

**One package, and the three CLIs that fill and gate translations.** How to USE the
package is `pkgs/core/README.md` (what npm shows); this file is how it is built and why.

| path | what | publishes | tests |
|---|---|---|---|
| `pkgs/core` → **`@hanzo/i18n`** | `.`: the 79-locale registry (`locales`, `SUPPORTED_LOCALES`), `resolve`, `direction`, `slots`/`parity`, `faults`, file layout, `translate`. `./react`: `I18nProvider`, `LanguagePicker`, `useI18n`, `T`. `./server`: `accept`, `negotiate`, `links`, `alternates`, `sitemap`. `./native`: `detect`, `preferred`. `./boot`: `bootScript`. `./rtl.css`. `./catalogs/*` | yes, by `.github/workflows/publish.yml` | 91 + `test:browser` |
| `tools/extract` | scan code → missing keys into `source/<ns>/en-US.json`, or English keys (`t`, `phrase`) into a flat catalog | private | 23 |
| `tools/translate` | fill what a locale is missing: `/v1/translate`, chat, a local model, or MADLAD | private | 27 |
| `tools/validate` | the gate: presence, slots, protected names, script, Chinese variant | private | 20 |

There used to be seven packages. `@hanzo/i18n-react` (a react-i18next re-export nobody
imported) is gone; `-server` and `-native` are subpaths of the one package, because a
separate install for forty lines of negotiation is how two copies drift. The CLIs stay
separate and private: they are run from this checkout, not installed.

## Content lives here now

This repo was once "toolkit only, no content". It now ships Hanzo's own interface
catalogs in `pkgs/core/catalogs/` — 425 English-source keys × 79 locales, plus
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
2. same language and script — `zh-TW` → `zh-Hant`, never `zh-Hans`; `pa-Arab` → `pa-PK`,
   never Gurmukhi `pa`. Among those, in order:
   1. the same region (`es` maximizes to Spain → `es-ES`; `zh-Hant-HK` → `zh-HK`)
   2. the variant that serves the region (`SERVES` in `resolve.ts`): CLDR's parent locales
      for `es-419` (every Spanish of the Americas) and `pt-PT` (Portuguese outside Brazil),
      Macau → `zh-HK`, and the Arabic dialect areas: Gulf → `ar-SA`, Maghreb → `ar-MA`,
      Levant → `ar-LB`
   3. the variant with no region (`ar-IQ` → `ar`, `fa-IR` → `fa`, `zh-TW` → `zh-Hant`)
   4. the language's own region (`fr-BE` → `fr-FR`, `es-GQ` → `es-ES`)
3. same language (`en-GB` → `en-US`)
4. `en-US`

A request is maximized by `Intl.Locale`; a shipped tag is compared by the region it
states (`ar` states none, though it maximizes to Egypt). `Intl` canonicalizes `iw` → `he`,
`prs` → `fa-AF`, `kmr` → `ku`; the aliases it does not know are `no` → `nb` and `lah` (what
`pnb` becomes) → `pa`, so Western Punjabi finds `pa-PK`. Registry order is the picker's (by
English name) and decides nothing in `resolve`.

## `./boot`: lang and dir before the first paint

The sites are static exports, so `<html lang dir>` would change only when the provider
hydrates. `bootScript()` (`src/boot.ts`) is a ~1.5 KB head script that sets them first: the
locale the provider last showed in this browser (`PAINTED`, written wherever the provider
sets `<html lang dir>`), else the signed-out choice, else `navigator.languages` over
`OFFERED`. Its tables are built from the registry when the module loads: every tag (`~`
review, `!` right-to-left), `MACRO`, and step 2 of `resolve` answered per region through
the same `pick` `resolve` calls, so a new locale or `SERVES` entry reaches the script with
no edit, and `test/boot.ts` runs it against `resolve` for every registry tag and a table
of regional, script and alias requests. An account's IAM choice is mirrored into its per-user key and `PAINTED`, so the
next load opens in it. The provider's first render stays the prerender's English, so
hydration matches, and its first choice is the script's, so the page keeps one direction.
`test:browser` hydrates a server-rendered page and records every write to `<html lang
dir>`: `rtl` while the parser is in the head and before `first-paint`, never turned back,
no mismatch (without `suppressHydrationWarning`, React reports one).

## Slots and faults: one definition, asked by both translator and gate

`slots` reads i18next `{{name}}` (bare name) and this package's `{name}` (reported with its
braces, so `{{amount}}` → `{amount}` fails parity). `parity` compares them as a multiset.
`faults(locale, source, value, terms)` is everything else a translation must get right:
`markup`, `names:` (a `terms.keep` name lost — inflection after it allowed, a possessive
ENDING a fragment exempt), `script` (prose in a non-Latin locale must use it), `simplified`
(in `zh-Hant` and `zh-HK`) / `traditional`, and `english` — identical prose, the one SOFT fault: listed for review,
never refused (Filipino keeps five loanwords on purpose). `translate` writes only values
with parity and no hard fault; `validate` fails on exactly those. Answered separately, the
translator writes what the gate refuses.

`pkgs/core/terms.json` is Hanzo's list: 22 protected names (Hanzo, Zen, Enso, Kai, Dev,
Studio, Gen, Lux, Zoo, Claude Code, Claude, Codex, Cursor, Antigravity, Gemini, Copilot,
GitHub, Google, Apple, OpenAI, Anthropic, Hugging Face) kept in Latin script in every
locale, and `brands` that are names but need not survive (only excluded from "is this prose").

## How English enters the catalog

`catalogs/en-US.json` is extracted, never typed. Its keys are the English itself, read
from the syntax tree of every codebase that renders with this package (`tools/extract
--catalogs`, `src/english.ts`): the first argument of `t(…)` and `phrase(…)` when it is
a literal, a template with no substitution, or either arm of a choice. A key built at
runtime is not seen; the literal is wherever the value was written, inside `phrase`.
A comment is not a call, so a doc example never becomes a key.

```sh
node --experimental-strip-types tools/extract/src/cli.ts --catalogs pkgs/core/catalogs --prune \
  --code pkgs/core/src --code <rooms>/src --code <hanzo.ai>/components --code <hanzo.ai>/app --code <hanzo.ai>/lib
```

`--prune` drops what nobody asks for any more from en-US.json and every locale, so it is
run over EVERY reader of the catalog at once (this package's picker, `@hanzo/rooms`,
hanzo.ai), never one. Then translate fills what each locale lacks, and validate gates it.

## `t`: one sentence, its arguments isolated

`t(source, values)` returns a string while every value is text, and a node once one is
an element, so a link or a styled figure stays inside the one sentence a translator
reorders (`pieces` cuts a translation at its arguments). In a right-to-left locale
every argument is isolated — Unicode's first-strong isolate in a string (`isolate`),
`<bdi>` around an element — because a number or range set in Arabic prose otherwise
reorders (`1,150–1,400` read `1,400–1,150`). Isolation applies only right to left, so
an English rendering stays byte for byte what it was. `test:browser` measures the
range's order in Arabic and fails without it.

## Catalogs

- **Loading.** `src/loaders.ts` holds one literal `import('../catalogs/<code>.json', { with:
  { type: 'json' } })` per locale, so a bundler emits one chunk per catalog (78 + entry;
  `scripts/verify-package.sh` counts them) and Node imports them natively. The relative path is the same from `src/` and
  `dist/`. `src/json.d.ts` types them instead of `resolveJsonModule`, which would pull the
  JSON into the program outside `rootDir`.
- **Review.** `catalogs/review.json` is `{ "<locale>": "<why it waits>" }` (34 locales, below).
  `src/review.ts` is generated from it; `test/catalogs.ts` holds them equal. A review locale
  loads by code, so a person who chose one keeps it, but `LanguagePicker` does not offer it
  (unless the host passes `review`) and a browser language does not select it. A native
  reader clears one by deleting its entry and syncing.
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

## Locales

79: 45 offered, 34 waiting for review, none of them hand-written. The tier is
`catalogs/review.json`, nothing else.

- **Offered.** ar, ar-EG, ar-LB, ar-SA, bn, da, de-DE, en-US, es-419, es-AR, es-ES, es-MX, fa,
  fi, fil, fr-CA, fr-FR, gu, he, hi-IN, id-ID, it-IT, ja-JP, kn, ko-KR, ml, mr, ms, nb, nl,
  pt-BR, pt-PT, ru, sv, sw, ta, te, th, tr, uk, ur, vi, zh-HK, zh-Hans, zh-Hant.
- **Review** (`review.json` names why, per locale): am, ar-MA, as, az, bho, ceb, ckb,
  fa-AF, ha, ht, hy, jv, ka, kk, km, ku, ky, lo, mn, my, ne, om, or, pa, pa-PK, ps, sd, si,
  so, su, tg, tk, ug, uz.
- **Right-to-left**, every locale in Arabic or Hebrew script: ar and its four variants,
  ckb, fa, fa-AF, he, pa-PK, ps, sd, ug, ur. `test/registry.ts` derives each locale's script
  from its tag and fails a `dir` that disagrees; `rtl.css` selects on `:dir(rtl)`, so it
  holds inside a right-to-left region of a left-to-right page; `test:browser` turns the page
  for each of them.
- **Not shipped**, until a native translator writes them:
  - `ti` Tigrinya: halogen turned "Install the Hanzo CLI" into "Skip Hanzo CLI" and MADLAD
    produced unrelated text; button labels must be exact.
  - `qu` Quechua, `ay` Aymara: halogen keeps Spanish nouns and MADLAD answers in Spanish.
  - `gn` Guarani: both models mix Spanish into the Guarani.
  - `bo` Tibetan: neither model writes usable interface copy, and line breaks after the
    tsheg (་) vary by browser.
  - `dv` Dhivehi: too little model support to produce copy worth a review.

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

```sh
# MADLAD-400 on this machine: a Python with ctranslate2 + sentencepiece, CPU only
MADLAD_PYTHON=.venv/bin/python node tools/translate/dist/cli.js --catalogs pkgs/core/catalogs \
  --terms pkgs/core/terms.json --locales my --mode madlad --model <madlad400-3b-mt-ct2-int8 dir> \
  --weights Nextcloud-AI/madlad400-3b-mt-ct2-int8@aa32bbdeba7880eff2096ec044cb155a340a9400/model.bin
```

Only missing keys are sent, in groups of ≤100 keys / 8 KB, one locale at a time or
`--jobs n` at once (a server with several slots answers several locales together;
provenance is saved after each, one save at a time); a refused or failed key stays
missing so the next run asks again and a reviewer's correction is never overwritten. The
one exception is a label: a protected name with at most one other word and no slot
(`Hanzo OS`, `Hanzo.Stack`, `Gen 1`) translates to itself, so when an answer transliterates
its name it is written as the source, under a provenance run of model `source`.
`madlad` takes no instructions: protected names cross it as numbered `{n}` placeholders
and are restored after; `tools/translate/madlad.py` is its worker.
`/v1/translate` gets the protected names as its glossary; an entry it answers with `error`
is a refusal. The local mode sends `chat_template_kwargs.reasoning_effort`
(`TRANSLATION_REASONING`, default `low`) and strips a leading `<think>` block.

Generation that built today's catalogs: Arabic and its four regional variants by **Jais 3**
(`IFM/Jais-3-32B-GGUF` @ `7f88bd89cbf83ccce89d07776ad11f7bd62cc83b`, `Jais-3-32B-Q4_K_M.gguf`,
Apache-2.0, on a llama.cpp build with K2 Horizon support, `--jinja`, alias `jais3-ar`,
reasoning low); Burmese by **MADLAD-400 3B** (`google/madlad400-3b-mt` as
`Nextcloud-AI/madlad400-3b-mt-ct2-int8` @ `aa32bbdeba7880eff2096ec044cb155a340a9400`); the
rest by `halogen-qwen3.8-flash-next` on evo. Weights never enter this repo or the package.
Every catalog is machine-made; native review is pending for all, flagged for `review.json`'s.

**MADLAD-400 3B**, measured as the candidate for the long tail: through CTranslate2 int8 on
CPU it translates about 25 tokens/s batched, a 425-string catalog in about three minutes.
Scored by back-translation chrF on the same eight strings in 34 locales, halogen led on 31;
MADLAD serves Burmese, where it led 65 to 39. Its source must end with `</s>`, and it
answers in Spanish for Quechua and Aymara, which is why those wait for a human translator.

**Arabic variants.** `ar-EG`, `ar-SA`, `ar-MA` and `ar-LB` are written in the formal register
an interface uses, so they read as Modern Standard Arabic with regional wording: 76 to 88 of
425 strings differ from `ar`. A dialect-register catalog is its own generation and review.

## Source runs; `dist/` ships

Source imports name the file that exists (`./locales.ts`), so Node runs the tree under
`--experimental-strip-types` and a test needs no build. What publishes is JavaScript:
`tsc` emits `dist/`, `rewriteRelativeImportExtensions` turns `.ts` specifiers into `.js`.
Node REFUSES to strip types under `node_modules` at every version, so a `.ts` `main` is
unimportable once installed — verify packaging by installing the TARBALL, never from the
repo. `scripts/verify-package.sh <tgz>` does that where no dev dependency exists: plain
Node import of `.`, `./server`, `./native`, `./boot`; an esbuild bundle of `./react` +
`rtl.css`, and one of `./boot` that must hold no React; a strict `tsc` against the
declarations under `bundler` and `nodenext`. The workflow
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
2. Adding a locale: insert it in `src/locales.ts` by English name, `dir` from its script
   (the registry test derives the script from the tag), add its loader, generate its
   catalog, sync. A regional variant that should serve other regions goes in `SERVES`.
3. Brand content arrives as data (`--terms`, `--forbid-literal`); only `terms.json` and
   `catalogs/` hold Hanzo's.
4. CLIs take paths as flags; no `~/work/...` anywhere.
5. Inference goes through `api.hanzo.ai` or a local model; keys come from KMS via
   `HANZO_API_KEY` and are never committed.
