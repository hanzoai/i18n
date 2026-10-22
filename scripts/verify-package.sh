#!/usr/bin/env bash
# Install a packed @hanzo/i18n tarball where none of this repo's dev dependencies
# exist, and use it the three ways a consumer does: import it in plain Node,
# bundle `@hanzo/i18n/react` + `rtl.css` (one lazy chunk per catalog), and
# typecheck against its declarations. What ships is the tarball, so it is the
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
  if (core.locales.length !== 36) throw new Error('registry: ' + core.locales.length)
  if (core.resolve('zh-TW') !== 'zh-Hant' || core.direction('ar') !== 'rtl') throw new Error('negotiation')
  if (server.negotiate('es-MX,es;q=0.9') !== 'es-419' || typeof native.detect !== 'function') throw new Error('subpaths')
  console.log('node: @hanzo/i18n, /server, /native import')
"

cat > entry.js <<'JS'
import '@hanzo/i18n/rtl.css'
import { I18nProvider, LanguagePicker, useI18n } from '@hanzo/i18n/react'
console.log(typeof I18nProvider, typeof LanguagePicker, typeof useI18n)
JS
npx esbuild entry.js --bundle --splitting --format=esm --platform=browser --outdir=out --log-level=warning
chunks=$(ls out/*.js | wc -l)
[ -s out/entry.css ] || { echo "rtl.css did not bundle" >&2; exit 1; }
[ "$chunks" -ge 36 ] || { echo "expected the entry plus 35 lazy catalog chunks, got $chunks files" >&2; exit 1; }
echo "bundle: @hanzo/i18n/react and rtl.css, $chunks chunks"

cat > check.ts <<'TS'
import { locales, resolve, type Locale } from '@hanzo/i18n'
import { I18nProvider, LanguagePicker, useI18n, type I18n } from '@hanzo/i18n/react'
import { negotiate } from '@hanzo/i18n/server'
const first: Locale = locales[0]
const code: string = resolve(first.code)
const t: I18n['t'] = (s) => s
export { I18nProvider, LanguagePicker, useI18n, negotiate, code, t }
TS
for resolution in bundler nodenext; do
  module=$([ "$resolution" = bundler ] && echo esnext || echo nodenext)
  npx tsc --noEmit --strict --skipLibCheck false --module "$module" --moduleResolution "$resolution" --target es2022 --lib es2022,dom check.ts
done
echo "types: resolve under bundler and nodenext"
