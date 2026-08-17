#!/usr/bin/env node
/**
 * Fill in the locales a product is missing, using Hanzo's own models.
 *
 *   HANZO_API_KEY=$(hanzo kms get /i18n/translator) i18n-translate \
 *     --source ./translations/source --translations ./translations/translations
 *
 *   --source <dir>        the reviewed English
 *   --translations <dir>  where the other locales go
 *   --namespaces a,b      default: every namespace under --source
 *   --locales a,b         default: every locale the toolkit ships
 *   --model <id>          default: zen5
 *   --endpoint <url>      default: api.hanzo.ai
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, contents, source, translation } from '@hanzo/i18n'

import { ENDPOINT, MODEL, chat } from './chat.ts'
import { fill, missing, type Strings } from './fill.ts'

const { values } = parseArgs({
  options: {
    source: { type: 'string' },
    translations: { type: 'string' },
    namespaces: { type: 'string' },
    locales: { type: 'string' },
    model: { type: 'string', default: process.env.HANZO_MODEL ?? MODEL },
    endpoint: { type: 'string', default: process.env.HANZO_ENDPOINT ?? ENDPOINT },
  },
})

if (!values.source || !values.translations) {
  throw new Error('required: --source <dir> --translations <dir>')
}
const key = process.env.HANZO_API_KEY
if (!key) {
  throw new Error('HANZO_API_KEY is not set')
}

const english = resolve(values.source)
const out = resolve(values.translations)
const namespaces = values.namespaces ? list(values.namespaces) : await under(english)
const locales = values.locales ? known(list(values.locales)) : [...SUPPORTED_LOCALES]
const model = chat(values.model, values.endpoint, key)

let failed = 0
for (const namespace of namespaces) {
  const strings = await read(source(english, namespace))
  if (Object.keys(strings).length === 0) {
    console.log(`${namespace}: no source strings`)
    continue
  }

  for (const locale of locales) {
    if (locale === DEFAULT_LOCALE) {
      continue
    }
    const path = translation(out, locale, namespace)
    const existing = await read(path)
    const owed = Object.keys(missing(strings, existing)).length
    if (owed === 0) {
      continue
    }

    try {
      const { added, refused } = await fill(strings, existing, locale, model)
      if (Object.keys(added).length > 0) {
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, contents({ ...existing, ...added }), 'utf8')
      }
      console.log(`${locale}/${namespace}: ${Object.keys(added).length} of ${owed}`)
      if (refused.length > 0) {
        // Left missing on purpose. Writing a translation whose slots do not
        // match ships a screen with a blank where an amount goes; leaving it
        // missing means the next run asks again and the gate reports it now.
        console.log(`  ${refused.length} came back wrong: ${refused.join(', ')}`)
      }
    } catch (error) {
      // One locale's model call failing is not a reason to abandon the other
      // twelve; the exit code still says the run was not complete.
      failed++
      console.error(`${locale}/${namespace}: ${(error as Error).message}`)
    }
  }
}

if (failed > 0) {
  process.exitCode = 1
}

function list(flag: string): string[] {
  return flag
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function known(asked: string[]): string[] {
  // A locale the toolkit does not ship would be written to a directory nothing
  // reads and no gate checks — a translation bill paid for a file with no reader.
  const stranger = asked.find((l) => !SUPPORTED_LOCALES.includes(l as never))
  if (stranger) {
    throw new Error(`unsupported locale: ${stranger}`)
  }
  return asked
}

async function under(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  return entries.filter((e) => e.isDirectory()).map((e) => e.name)
}

async function read(path: string): Promise<Strings> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Strings
  } catch {
    return {}
  }
}
