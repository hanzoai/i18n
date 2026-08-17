#!/usr/bin/env node
/**
 * The gate. Every key in every locale, every slot intact, no product's words
 * hardcoded in the toolkit's files.
 *
 *   i18n-validate --source ./translations/source --translations ./translations/translations \
 *     --forbid-literal "Lux Wallet,lux.exchange"
 *
 *   --source <dir>          the reviewed English
 *   --translations <dir>    the other locales
 *   --namespaces a,b        default: every namespace under --source
 *   --locales a,b           default: every locale the toolkit ships
 *   --forbid-literal a,b    strings that must never be written into copy
 */
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { SUPPORTED_LOCALES, source, translation } from '@hanzo/i18n'

import { check, line, type Strings } from './check.ts'

const { values } = parseArgs({
  options: {
    source: { type: 'string' },
    translations: { type: 'string' },
    namespaces: { type: 'string' },
    locales: { type: 'string' },
    'forbid-literal': { type: 'string' },
  },
})

if (!values.source || !values.translations) {
  throw new Error('required: --source <dir> --translations <dir>')
}

const english = resolve(values.source)
const out = resolve(values.translations)
const namespaces = values.namespaces ? list(values.namespaces) : await under(english)
const locales = values.locales ? list(values.locales) : [...SUPPORTED_LOCALES]
const forbid = values['forbid-literal'] ? list(values['forbid-literal']) : []

let problems = 0
for (const name of namespaces) {
  const strings = await read(source(english, name))
  if (!strings) {
    console.error(`${name}: no source strings`)
    problems++
    continue
  }

  const found: Record<string, Strings | undefined> = {}
  for (const locale of locales) {
    found[locale] = await read(translation(out, locale, name))
  }

  for (const problem of check({ name, source: strings, locales: found }, forbid)) {
    console.error(line(problem))
    problems++
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
  return JSON.parse(text) as Strings
}
