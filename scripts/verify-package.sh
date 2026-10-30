#!/usr/bin/env bash
# Install a packed @hanzo/i18n tarball where none of this repo's dev dependencies
# exist, and use it the ways a consumer does: import it in plain Node, bundle
# `@hanzo/i18n/react` + `rtl.css` (no catalog), `@hanzo/i18n/bundled` (one lazy
# chunk per catalog), bundle
# `@hanzo/i18n/boot` for a server with no React in it, and typecheck against its
# declarations. What ships is the tarball, so it is the
# tarball that is checked, never the workspace.
#
#   scripts/verify-package.sh path/to/hanzo-i18n-<version>.tgz
set -euo pipefail

tgz=$(cd -- "$(dirname -- "${1:?usage: scripts/verify-package.sh <tarball>}")" && pwd)/$(basename -- "$1")
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cd "$work"

cat > package.json <<'JSON'
{ "name": "consumer", "private": true, "type": "module" }
JSON
npm install --no-audit --no-fund --loglevel=error "$tgz" react@19.2.8 @types/react@19.2.18 esbuild@0.28.2 typescript@6.0.3 >/dev/null

node --input-type=module -e "
  const core = await import('@hanzo/i18n')
  const server = await import('@hanzo/i18n/server')
  const native = await import('@hanzo/i18n/native')
  const boot = await import('@hanzo/i18n/boot')
  if (core.locales.length !== 79) throw new Error('registry: ' + core.locales.length)
  if (core.resolve('zh-TW') !== 'zh-Hant' || core.direction('ar') !== 'rtl') throw new Error('negotiation')
  if (server.negotiate('es-CO,es;q=0.9') !== 'es-419' || typeof native.detect !== 'function') throw new Error('subpaths')
  if (!/^\(\(\)=>\{try\{.*'rtl'.*\}catch\{\}\}\)\(\)$/.test(boot.bootScript())) throw new Error('boot')
  if (core.format('en-US').money(1234.5, 'USD') !== '\$1,234.50' || !/١٬٢٣٤/.test(core.format('ar-EG').number(1234))) throw new Error('format')
  console.log('node: @hanzo/i18n, /server, /native, /boot import')
"

cat > entry.js <<'JS'
import '@hanzo/i18n/rtl.css'
import { I18nProvider, LanguagePicker, useI18n } from '@hanzo/i18n/react'
console.log(typeof I18nProvider, typeof LanguagePicker, typeof useI18n)
JS
npx esbuild entry.js --bundle --splitting --format=esm --platform=browser --outdir=out --log-level=warning
chunks=$(ls out/*.js | wc -l)
[ -s out/entry.css ] || { echo "rtl.css did not bundle" >&2; exit 1; }
[ "$chunks" -eq 1 ] || { echo "@hanzo/i18n/react alone must carry no catalog, got $chunks files" >&2; exit 1; }
echo "bundle: @hanzo/i18n/react and rtl.css, no catalog"

cat > whole.js <<'JS'
import { bundled } from '@hanzo/i18n/bundled'
console.log(typeof bundled)
JS
npx esbuild whole.js --bundle --splitting --format=esm --platform=browser --outdir=whole --log-level=warning
chunks=$(ls whole/*.js | wc -l)
[ "$chunks" -ge 79 ] || { echo "expected the entry plus 78 lazy catalog chunks, got $chunks files" >&2; exit 1; }
echo "bundle: @hanzo/i18n/bundled, $chunks chunks"

cat > head.js <<'JS'
import { bootScript } from '@hanzo/i18n/boot'
console.log(bootScript().length)
JS
npx esbuild head.js --bundle --format=esm --platform=node --metafile=head.json --outfile=head.out.js --log-level=warning
node -e "if (Object.keys(require('./head.json').inputs).some((p) => /node_modules\/react(-dom)?\//.test(p))) throw new Error('@hanzo/i18n/boot pulls in React')"
echo "bundle: @hanzo/i18n/boot without React, a $(node head.out.js)-byte script"

cat > check.ts <<'TS'
import { format, locales, resolve, type Locale } from '@hanzo/i18n'
import { I18nProvider, LanguagePicker, useI18n, type Format, type I18n } from '@hanzo/i18n/react'
import { negotiate } from '@hanzo/i18n/server'
import { bootScript } from '@hanzo/i18n/boot'
import { bundled } from '@hanzo/i18n/bundled'
const load: Parameters<typeof I18nProvider>[0]['loadCatalog'] = bundled
const head: string = bootScript()
const first: Locale = locales[0]
const code: string = resolve(first.code)
const t: I18n['t'] = (s) => s
const figures: Format = format('ar')
const money: string = figures.money(5, 'USD', { maximumFractionDigits: 0 })
export { I18nProvider, LanguagePicker, useI18n, negotiate, code, t, head, money, load }
TS
for resolution in bundler nodenext; do
  module=$([ "$resolution" = bundler ] && echo esnext || echo nodenext)
  npx tsc --noEmit --strict --skipLibCheck false --module "$module" --moduleResolution "$resolution" --target es2022 --lib es2022,dom check.ts
done
echo "types: resolve under bundler and nodenext"
