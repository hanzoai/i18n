#!/usr/bin/env node
/**
 * Fill in the locales a product is missing.
 *
 *   HANZO_API_KEY=$(hanzo kms get /i18n/translator) i18n-translate \
 *     --source ./translations/source --translations ./translations/translations
 *   HANZO_API_KEY=… i18n-translate --catalogs ./catalogs --terms ./terms.json
 *   TRANSLATION_BASE_URL=http://127.0.0.1:8733/v1 TRANSLATION_MODEL=jais3-ar \
 *     i18n-translate --catalogs ./catalogs --locales ar
 *   MADLAD_PYTHON=.venv/bin/python i18n-translate --catalogs ./catalogs --locales my \
 *     --mode madlad --model ./madlad400-3b-mt-ct2-int8
 *
 *   --source <dir>        the reviewed English, one directory per namespace
 *   --translations <dir>  where the other locales go
 *   --catalogs <dir>      instead of both: one flat directory, en-US.json and <locale>.json;
 *                         each run that writes is recorded in <dir>/provenance.json
 *   --namespaces a,b      default: every namespace under --source
 *   --locales a,b         default: every locale the toolkit ships
 *   --terms <file>        { "keep": [protected names], "brands": [...] }, as for i18n-validate
 *   --mode translate|chat|madlad
 *                         default translate: POST /v1/translate; chat: /v1/chat/completions;
 *                         madlad: MADLAD-400 on this machine (madlad.py, CTranslate2, CPU)
 *   --tier quality|bulk   the /v1/translate tier, default quality
 *   --model <id>          chat: default zen5; translate: the quality tier's model, default the org's;
 *                         madlad: the CTranslate2 conversion directory
 *   --endpoint <origin>   default https://api.hanzo.ai
 *   --weights <ref>       recorded in provenance for a pinned artifact (repo@revision/file)
 *   --jobs <n>            locales asked at once, default 1: a server with several slots
 *                         answers several locales in the time it answers one
 *
 * The key is HANZO_API_KEY. TRANSLATION_BASE_URL instead points chat at a local
 * OpenAI-compatible /v1 (TRANSLATION_MODEL, optional TRANSLATION_API_KEY,
 * TRANSLATION_REASONING sent as the template's reasoning_effort, default low).
 * MADLAD_PYTHON is a Python with ctranslate2 and sentencepiece, default python3.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, catalog, contents, source, translation, type Terms } from '@hanzo/i18n'

import { MODEL, ORIGIN, chat } from './chat.ts'
import { asking, fill, missing, type Engine, type Strings } from './fill.ts'
import { madlad, spawnWorker } from './madlad.ts'
import { service, type Tier } from './service.ts'

const { values } = parseArgs({
  options: {
    source: { type: 'string' },
    translations: { type: 'string' },
    catalogs: { type: 'string' },
    namespaces: { type: 'string' },
    locales: { type: 'string' },
    terms: { type: 'string' },
    mode: { type: 'string', default: 'translate' },
    tier: { type: 'string', default: 'quality' },
    model: { type: 'string', default: process.env.HANZO_MODEL },
    endpoint: { type: 'string', default: process.env.HANZO_ENDPOINT ?? ORIGIN },
    weights: { type: 'string' },
    jobs: { type: 'string', default: '1' },
  },
})

if (!values.catalogs === !(values.source && values.translations)) {
  throw new Error('required: --source <dir> --translations <dir>, or --catalogs <dir>')
}
if (values.mode !== 'translate' && values.mode !== 'chat' && values.mode !== 'madlad') {
  throw new Error(`--mode is translate, chat or madlad, not ${values.mode}`)
}
if (values.tier !== 'quality' && values.tier !== 'bulk') {
  throw new Error(`--tier is quality or bulk, not ${values.tier}`)
}

// One namespace in a flat directory, or one directory per namespace.
const flat = values.catalogs ? resolve(values.catalogs) : undefined
const english = resolve(values.source ?? '.')
const out = resolve(values.translations ?? '.')
const namespaces = flat ? ['catalogs'] : values.namespaces ? list(values.namespaces) : await under(english)
const sourceOf = (ns: string) => (flat ? catalog(flat, DEFAULT_LOCALE) : source(english, ns))
const translationOf = (locale: string, ns: string) => (flat ? catalog(flat, locale) : translation(out, locale, ns))
const locales = values.locales ? known(list(values.locales)) : [...SUPPORTED_LOCALES]
const terms: Terms = values.terms ? (JSON.parse(await readFile(resolve(values.terms), 'utf8')) as Terms) : {}
const { engine, label, close } = connect()

const provenance: Provenance = flat ? await provenanceIn(flat) : {}

let failed = 0
const jobs = Math.max(1, Number.parseInt(values.jobs, 10) || 1)
// Provenance is one file every locale writes to; its saves go one after another.
let saving = Promise.resolve()
for (const namespace of namespaces) {
  const strings = await read(sourceOf(namespace))
  if (Object.keys(strings).length === 0) {
    console.log(`${namespace}: no source strings`)
    continue
  }
  const sourceSha256 = createHash('sha256').update(JSON.stringify(strings)).digest('hex')
  const queue = locales.filter((l) => l !== DEFAULT_LOCALE)
  const one = async (locale: string): Promise<void> => {
    const path = translationOf(locale, namespace)
    const existing = await read(path)
    const owed = Object.keys(missing(strings, existing)).length
    if (owed === 0) {
      return
    }

    try {
      const { added, refused, kept } = await fill(strings, existing, locale, engine, terms)
      if (Object.keys(added).length > 0) {
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, contents({ ...existing, ...added }), 'utf8')
        if (flat) {
          const entry = (provenance[locale] ??= { review: 'machine-translated; native-speaker review pending', runs: [] })
          const generatedAt = new Date().toISOString()
          const translated = Object.keys(added).filter((key) => !kept.includes(key))
          if (translated.length > 0) {
            entry.runs.push({ model: label, ...(values.weights && { weights: values.weights }), generatedAt, sourceSha256, keys: translated })
          }
          if (kept.length > 0) {
            entry.runs.push({ model: 'source', note: `label kept as written: ${label} transliterated a protected name`, generatedAt, sourceSha256, keys: kept })
          }
          saving = saving.then(() => save(`${flat}/provenance.json`, `${JSON.stringify(provenance, null, 2)}\n`))
          await saving
        }
      }
      console.log(`${locale}/${namespace}: ${Object.keys(added).length} of ${owed}${kept.length > 0 ? ` (${kept.length} labels kept as written)` : ''}`)
      if (refused.length > 0) {
        // Left missing on purpose. Writing a translation whose slots do not
        // match ships a screen with a blank where an amount goes; leaving it
        // missing means the next run asks again and the gate reports it now.
        console.log(`  ${refused.length} came back wrong: ${refused.join(', ')}`)
      }
    } catch (error) {
      // One locale's model call failing is not a reason to abandon the others;
      // the exit code still says the run was not complete.
      failed++
      console.error(`${locale}/${namespace}: ${(error as Error).message}`)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(jobs, queue.length) }, async () => {
      for (let locale = queue.shift(); locale; locale = queue.shift()) {
        await one(locale)
      }
    }),
  )
}

close()
if (failed > 0) {
  process.exitCode = 1
}

/** The engine this run asks, the name its provenance records, and how to let it go. */
function connect(): { engine: Engine; label: string; close: () => void } {
  const none = () => {}
  if (values.mode === 'madlad') {
    if (!values.model) {
      throw new Error('--mode madlad needs --model <CTranslate2 conversion directory>')
    }
    const { worker, close } = spawnWorker(process.env.MADLAD_PYTHON ?? 'python3', resolve(values.model))
    return { engine: madlad(worker, terms), label: basename(resolve(values.model)), close }
  }
  const local = process.env.TRANSLATION_BASE_URL
  if (local) {
    const model = process.env.TRANSLATION_MODEL ?? values.model
    if (!model) {
      throw new Error('TRANSLATION_BASE_URL needs TRANSLATION_MODEL')
    }
    const endpoint = `${local.replace(/\/+$/, '')}/chat/completions`
    const reasoning = process.env.TRANSLATION_REASONING ?? 'low'
    const extra = { chat_template_kwargs: { enable_thinking: false, reasoning_effort: reasoning } }
    return { engine: asking(chat(model, endpoint, process.env.TRANSLATION_API_KEY, extra), terms), label: model, close: none }
  }

  const key = process.env.HANZO_API_KEY
  if (!key) {
    throw new Error('HANZO_API_KEY is not set (or set TRANSLATION_BASE_URL for a local endpoint)')
  }
  const origin = values.endpoint.replace(/\/+$/, '')
  if (values.mode === 'chat') {
    const model = values.model ?? MODEL
    return { engine: asking(chat(model, `${origin}/v1/chat/completions`, key), terms), label: model, close: none }
  }
  const tier = values.tier as Tier
  return { engine: service(origin, key, tier, terms, values.model), label: `translate/${tier}${values.model ? `/${values.model}` : ''}`, close: none }
}

/**
 * Per locale, every run that wrote to it: which model, when, against which
 * English (its SHA-256), and the keys it wrote. A message's provenance is the
 * last run listing it; a run with no `keys` covers whatever no later run lists.
 */
type Provenance = Record<string, { review: string; runs: Record<string, unknown>[] }>

async function provenanceIn(dir: string): Promise<Provenance> {
  let text: string
  try {
    text = await readFile(`${dir}/provenance.json`, 'utf8')
  } catch {
    return {}
  }
  return parse(text, `${dir}/provenance.json`) as unknown as Provenance
}

/** Written whole or not at all, so an interrupted run never leaves half a file. */
async function save(path: string, text: string): Promise<void> {
  await writeFile(`${path}.tmp`, text, 'utf8')
  await rename(`${path}.tmp`, path)
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
 * MISSING and BROKEN are different facts and only one is safe to read as empty.
 * This tool writes `{...existing, ...added}`, so answering `{}` for a file
 * somebody mis-edited does not merely overwrite the reviewed translations — it
 * DELETES them, because a key the model refused has no replacement to take its
 * place. That is the opposite of this tool's one promise, that a reviewer's
 * correction survives every later run.
 *
 * So absent is empty and unreadable stops the run, matching `validate`.
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
