#!/usr/bin/env node
/**
 * The gate. Every key in every locale, every slot intact, protected names kept,
 * each locale in its own script, no product's words hardcoded in the toolkit's
 * files.
 *
 *   i18n-validate --source ./translations/source --translations ./translations/translations \
 *     --forbid-literal "Lux Wallet,lux.exchange" --terms ./translations/terms.json
 *   i18n-validate --catalogs ./catalogs --terms ./terms.json
 *
 *   --source <dir>          the reviewed English, one directory per namespace
 *   --translations <dir>    the other locales
 *   --catalogs <dir>        instead of both: one flat directory, en-US.json and <locale>.json
 *   --namespaces a,b        default: every namespace under --source
 *   --locales a,b           default: every locale the toolkit ships
 *   --forbid-literal a,b    strings that must never be written into copy
 *   --terms <file>          { "keep": [protected names], "brands": [names that are not prose] }
 *
 * Exits 1 on any fault. English-identical prose is listed for review and does not fail.
 */
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, catalog, source, translation, type Terms } from '@hanzo/i18n'

import { check, line, partials, type Problem, type Strings } from './check.ts'

const { values } = parseArgs({
  options: {
    source: { type: 'string' },
    translations: { type: 'string' },
    namespaces: { type: 'string' },
    locales: { type: 'string' },
    'forbid-literal': { type: 'string' },
    catalogs: { type: 'string' },
    terms: { type: 'string' },
  },
})

if (!values.catalogs === !(values.source && values.translations)) {
  throw new Error('required: --source <dir> --translations <dir>, or --catalogs <dir>')
}

// One namespace in a flat directory, or one directory per namespace.
const flat = values.catalogs ? resolve(values.catalogs) : undefined
const english = resolve(values.source ?? '.')
const out = resolve(values.translations ?? '.')
const namespaces = flat ? ['catalogs'] : values.namespaces ? list(values.namespaces) : await under(english)
const sourceOf = (ns: string) => (flat ? catalog(flat, DEFAULT_LOCALE) : source(english, ns))
const translationOf = (locale: string, ns: string) => (flat ? catalog(flat, locale) : translation(out, locale, ns))
const locales = values.locales ? list(values.locales) : [...SUPPORTED_LOCALES]
const terms = values.terms ? await termsIn(resolve(values.terms)) : {}

// The English is the source, so it is what everything is checked AGAINST and is
// never itself checked. `--locales en-US` therefore asks the gate to examine
// nothing, and it answered "clean" and exited 0 — a gate that cannot fail,
// wearing the same output as a gate that passed. That is worse than no gate,
// because CI is green either way and only one of them looked.
if (locales.every((l) => l === DEFAULT_LOCALE)) {
  throw new Error(
    `--locales names only ${DEFAULT_LOCALE}, which is the source every other locale is checked against; ` +
      `there would be nothing to check`,
  )
}
const forbid = values['forbid-literal'] ? list(values['forbid-literal']) : []

// A flat catalog's review.json says which locales under review may lack keys (`partials`).
const partial = flat ? partials(await reviewIn(`${flat}/review.json`)) : new Set<string>()

let problems = 0
const review: Problem[] = []
for (const name of namespaces) {
  const strings = await read(sourceOf(name))
  if (!strings) {
    console.error(`${name}: no source strings`)
    problems++
    continue
  }

  const found: Record<string, Strings | undefined> = {}
  for (const locale of locales) {
    found[locale] = await read(translationOf(locale, name))
  }

  for (const problem of check({ name, source: strings, locales: found, partial }, forbid, terms)) {
    if (problem.review) {
      review.push(problem)
      continue
    }
    console.error(line(problem))
    problems++
  }
}

// One line per locale: a reviewer wants the list, the log does not want a line per loanword.
const byLocale = new Map<string, Problem[]>()
for (const p of review) {
  const where = `${p.locale}/${p.namespace}`
  byLocale.set(where, [...(byLocale.get(where) ?? []), p])
}
for (const [where, found] of byLocale) {
  for (const p of found.filter((p) => p.key === undefined)) {
    console.log(`review ${where}: ${p.what}`)
  }
  const same = found.filter((p) => p.key !== undefined)
  if (same.length > 0) {
    const keys = same.map((p) => JSON.stringify(p.key))
    console.log(`review ${where}: ${same.length} identical to the English: ${keys.slice(0, 6).join(', ')}${keys.length > 6 ? ', …' : ''}`)
  }
}

if (problems > 0) {
  console.error(`${problems} to fix`)
  process.exitCode = 1
} else {
  console.log(`${namespaces.length} namespaces, ${locales.length} locales, clean`)
}

function list(flag: string): string[] {
  return flag
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

async function under(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  return entries.filter((e) => e.isDirectory()).map((e) => e.name)
}

/**
 * The strings in `text`, or a failure that says WHICH file and where.
 *
 * A bare `JSON.parse` throws "Expected double-quoted property name at position
 * 106", which is true and useless to the person who has to fix it: a run walks
 * every locale across several namespaces, so the one thing the message has
 * to carry is the path.
 */
function parse(text: string, path: string): Strings {
  try {
    return JSON.parse(text) as Strings
  } catch (err) {
    throw new Error(`${path}: ${(err as Error).message}`)
  }
}

/** review.json, or no entries where a catalog has none. */
async function reviewIn(path: string): Promise<Record<string, unknown>> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch {
    return {}
  }
  return parse(text, path) as unknown as Record<string, unknown>
}

/** A product's names, from `--terms`. A file that is not the shape is an error, not an empty list. */
async function termsIn(path: string): Promise<Terms> {
  const terms = parse(await readFile(path, 'utf8'), path) as unknown as Terms
  for (const field of ['keep', 'brands'] as const) {
    const names = terms[field]
    if (names !== undefined && !(Array.isArray(names) && names.every((n) => typeof n === 'string' && n.trim() !== ''))) {
      throw new Error(`${path}: ${field} must be a list of names`)
    }
  }
  return terms
}

/** `undefined` for a file that is not there — which the gate reports as its own fact. */
async function read(path: string): Promise<Strings | undefined> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch {
    return undefined
  }
  // Unreadable is not absent. A file somebody broke while hand-editing must fail
  // the gate rather than read as a locale nobody has started.
  return parse(text, path)
}
