#!/usr/bin/env bash
# Copy generated catalogs into the package: one <locale>.json per registry entry
# (en-US.json is the source), provenance.json, and review.json, whose locales
# become src/review.ts. Refuses a source missing any locale, so a half-finished
# generation run cannot be shipped as if it were complete.
#
#   scripts/sync-catalogs.sh /path/to/catalogs
#   pnpm test && pnpm --filter @hanzo/i18n validate
set -euo pipefail

from=${1:?usage: scripts/sync-catalogs.sh <directory holding en-US.json, <locale>.json, provenance.json, review.json>}
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
pkg=$root/pkgs/core

codes=$(node --experimental-strip-types --no-warnings --input-type=module -e \
  "const { SUPPORTED_LOCALES } = await import('$pkg/src/locales.ts'); console.log(SUPPORTED_LOCALES.join(' '))")

for code in $codes; do
  [ -f "$from/$code.json" ] || { echo "sync-catalogs: $from/$code.json is missing" >&2; exit 1; }
done
for file in provenance.json review.json; do
  [ -f "$from/$file" ] || { echo "sync-catalogs: $from/$file is missing" >&2; exit 1; }
done

for code in $codes; do
  cp "$from/$code.json" "$pkg/catalogs/$code.json"
done
cp "$from/provenance.json" "$from/review.json" "$pkg/catalogs/"

node --input-type=module -e '
  import { readFileSync, writeFileSync } from "node:fs"
  const [file, out] = process.argv.slice(1)
  const review = JSON.parse(readFileSync(file, "utf8"))
  if (!review || typeof review !== "object" || Array.isArray(review)) throw new Error(`${file}: expected { "<locale>": "<reason>" }`)
  // Under review: a bare reason, or an entry with `why`. An entry with only `partial`
  // is an offered locale a run has not finished: it stays offered and reads English
  // where it lacks a key.
  const waits = (entry) => typeof entry === "string" || (typeof entry?.why === "string" && entry.why.trim() !== "")
  const codes = Object.keys(review).filter((c) => waits(review[c])).sort().map((c) => `\x27${c}\x27`).join(", ")
  writeFileSync(out, `// Written by scripts/sync-catalogs.sh from catalogs/review.json; test/catalogs.ts holds the two equal.\nexport const REVIEW: readonly string[] = [${codes}]\n`)
' "$pkg/catalogs/review.json" "$pkg/src/review.ts"

echo "synced $(echo "$codes" | wc -w) locales from $from; under review: $(cat "$pkg/src/review.ts" | tail -1)"
