#!/usr/bin/env node
/**
 * Write the keys a codebase asks for into the file a translator reads.
 *
 *   i18n-extract --code ./apps/web/src --source ./translations/source
 *   i18n-extract --code ../rooms/src --code ../app/components --catalogs pkgs/core/catalogs [--prune]
 *
 *   --code <dir>        where to look; repeat for more than one
 *   --source <dir>      the `--source` directory to fill
 *   --namespace <ns>    for keys written without one (default: shared)
 *   --call a,b          what the product named its lookup (default: t)
 *   --catalogs <dir>    instead of --source: a flat catalog whose keys are the English
 *                       (`t('Pricing')`, `phrase('About Us')`), read from the syntax tree;
 *                       --call defaults to t,phrase
 *   --prune             with --catalogs: drop every key the scanned code no longer asks
 *                       for, from en-US.json and every locale beside it. Scan EVERY
 *                       codebase that reads the catalog, or this drops what the others use.
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, catalog, contents, source } from '@hanzo/i18n'

import { catalogue, english } from './english.ts'
import { merge, scan, type Key, type Strings } from './scan.ts'

const CODE = /\.[cm]?[jt]sx?$/
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.turbo'])

const { values } = parseArgs({
  options: {
    code: { type: 'string', multiple: true },
    source: { type: 'string' },
    namespace: { type: 'string', default: 'shared' },
    call: { type: 'string' },
    catalogs: { type: 'string' },
    prune: { type: 'boolean', default: false },
  },
})

if (!values.code?.length || !values.source === !values.catalogs) {
  throw new Error('required: --code <dir>, and --source <dir> or --catalogs <dir>')
}

if (values.catalogs) {
  await flat(resolve(values.catalogs), (values.call ?? 't,phrase').split(',').map((s) => s.trim()).filter(Boolean))
  process.exit(0)
}

const root = resolve(values.source!)
const calls = (values.call ?? 't').split(',').map((s) => s.trim()).filter(Boolean)
const found: Key[] = []
for (const dir of values.code) {
  for await (const path of walk(resolve(dir))) {
    found.push(...scan(await readFile(path, 'utf8'), values.namespace, calls))
  }
}

for (const namespace of new Set(found.map((k) => k.namespace))) {
  const path = source(root, namespace)
  const before = await read(path)
  const after = merge(before, found, namespace)
  const added = Object.keys(after).length - Object.keys(before).length
  if (added > 0) {
    await mkdir(join(root, namespace), { recursive: true })
    await writeFile(path, contents(after), 'utf8')
  }
  console.log(`${namespace}: ${added} new, ${Object.keys(after).length} total`)

  // A key whose English is its own key renders `swap.confirm` to a person and
  // then gets translated into every other language exactly that faithfully.
  const bare = Object.entries(after).filter(([k, v]) => k === v)
  if (bare.length > 0) {
    console.log(`  ${bare.length} awaiting English: ${bare.map(([k]) => k).join(', ')}`)
  }
}

/**
 * The flat catalog: English keys from every `--code` directory into `en-US.json`, and
 * with `--prune`, the keys nobody asks for out of every file beside it.
 */
async function flat(dir: string, calls: string[]): Promise<void> {
  const keys = new Set<string>()
  for (const code of values.code!) {
    for await (const path of walk(resolve(code))) {
      for (const key of english(await readFile(path, 'utf8'), path, calls)) {
        keys.add(key)
      }
    }
  }
  const path = catalog(dir, DEFAULT_LOCALE)
  const before = await read(path)
  const after = catalogue(before, [...keys], values.prune)
  const added = Object.keys(after).filter((k) => !(k in before))
  const dropped = Object.keys(before).filter((k) => !(k in after))
  await writeFile(path, contents(after), 'utf8')
  console.log(`${DEFAULT_LOCALE}: ${keys.size} asked for, ${added.length} new, ${dropped.length} dropped, ${Object.keys(after).length} total`)
  if (dropped.length > 0) {
    for (const locale of SUPPORTED_LOCALES) {
      if (locale === DEFAULT_LOCALE) {
        continue
      }
      const strings = await read(catalog(dir, locale))
      const kept = Object.fromEntries(Object.entries(strings).filter(([k]) => k in after))
      if (Object.keys(kept).length !== Object.keys(strings).length) {
        await writeFile(catalog(dir, locale), contents(kept), 'utf8')
      }
    }
  }
}

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) {
        yield* walk(path)
      }
    } else if (CODE.test(entry.name)) {
      yield path
    }
  }
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

/**
 * A file's strings, or none when there is no file yet.
 *
 * MISSING and BROKEN are different facts and only one of them is safe to read as
 * empty. What this returns is merged and written back, so answering `{}` for a
 * file somebody mis-edited replaces every reviewed English string in it with
 * whatever this run happened to scan — a trailing comma costs the copy, and the
 * run reports "1 new, 1 total" and exits 0 while doing it.
 *
 * So absent is empty and unreadable stops the run, which is the distinction
 * `validate` already draws ("Unreadable is not absent") and the one this file
 * was missing.
 */
async function read(path: string): Promise<Strings> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch {
    return {}
  }
  return parse(text, path)
}
