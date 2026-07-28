#!/usr/bin/env tsx
/**
 * @hanzo/i18n-translate — fills missing locale keys for a product's translation
 * directory. Existing translations are NEVER overwritten.
 *
 * Usage (from a product repo):
 *   HANZO_LLM_API_KEY=$(hanzo-kms get /i18n/zen-translator-key) \
 *   pnpm dlx @hanzo/i18n-translate \
 *     --source ./translations/source \
 *     --translations ./translations/translations \
 *     --namespaces exchange,wallet
 *
 * Flags:
 *   --source <dir>         directory holding `<ns>/en-US.json` source files
 *   --translations <dir>   directory holding `<locale>/<ns>.json` outputs
 *   --namespaces a,b,c     comma-separated list of namespaces to translate
 *   --locales a,b,c        optional locale subset; defaults to SUPPORTED_LOCALES
 *   --model <id>           override LLM model (default: zen-coder-30b-instruct)
 *   --endpoint <url>       override LLM endpoint (default: llm.hanzo.ai)
 *
 * The toolkit knows nothing about which product is calling it.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { SUPPORTED_LOCALES } from '@hanzo/i18n'

interface Args {
  source: string
  translations: string
  namespaces: string[]
  locales: string[]
  model: string
  endpoint: string
}

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = {
    model: process.env.HANZO_LLM_MODEL ?? 'zen-coder-30b-instruct',
    endpoint: process.env.HANZO_LLM_ENDPOINT ?? 'https://llm.hanzo.ai/v1/chat/completions',
    locales: [...SUPPORTED_LOCALES],
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    switch (a) {
      case '--source':
        out.source = resolve(next())
        break
      case '--translations':
        out.translations = resolve(next())
        break
      case '--namespaces':
        out.namespaces = next().split(',').map((s) => s.trim()).filter(Boolean)
        break
      case '--locales':
        out.locales = next().split(',').map((s) => s.trim()).filter(Boolean)
        break
      case '--model':
        out.model = next()
        break
      case '--endpoint':
        out.endpoint = next()
        break
      default:
        throw new Error(`Unknown flag: ${a}`)
    }
  }
  if (!out.source || !out.translations || !out.namespaces) {
    throw new Error('Required flags: --source --translations --namespaces')
  }
  return out as Args
}

type Translation = Record<string, string>

async function readJsonOrEmpty(path: string): Promise<Translation> {
  if (!existsSync(path)) return {}
  return JSON.parse(await readFile(path, 'utf8')) as Translation
}

async function writeJson(path: string, data: Translation): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function listSlots(s: string): string[] {
  return (s.match(/\{\{[^}]+\}\}/g) ?? []).map((slot) => slot)
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function callLlm(messages: ChatMessage[], model: string, endpoint: string): Promise<string> {
  const apiKey = process.env.HANZO_LLM_API_KEY
  if (!apiKey) throw new Error('HANZO_LLM_API_KEY env var not set')
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.0,
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) throw new Error(`LLM ${endpoint} returned ${res.status}: ${await res.text()}`)
  const json: { choices: Array<{ message: { content: string } }> } = await res.json()
  return json.choices[0]?.message.content ?? '{}'
}

async function translateBatch(
  missing: Translation,
  targetLocale: string,
  args: Args,
): Promise<Translation> {
  const slotsByKey: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(missing)) slotsByKey[k] = listSlots(v)

  const sys = `You translate software UI strings from English to ${targetLocale}.
Rules:
- Preserve every {{slot}} EXACTLY — same name, same count, same position semantically.
- Keep the tone professional and concise.
- Translate idioms naturally; don't translate code symbols, addresses, or proper nouns.
- Output ONLY a flat JSON object mapping the same keys to translated strings.`

  const user = `Translate to ${targetLocale}. Each value contains {{slots}} that MUST appear unchanged.

Source:
${JSON.stringify(missing, null, 2)}`

  const raw = await callLlm(
    [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
    args.model,
    args.endpoint,
  )

  let parsed: Translation
  try {
    parsed = JSON.parse(raw) as Translation
  } catch {
    throw new Error(`LLM did not return valid JSON: ${raw.slice(0, 200)}`)
  }

  const validated: Translation = {}
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v !== 'string') continue
    const expected = slotsByKey[k] ?? []
    const actual = listSlots(v)
    if (expected.length !== actual.length || expected.some((s) => !actual.includes(s))) {
      console.warn(`[i18n-translate] dropped "${k}" for ${targetLocale}: slot mismatch`)
      continue
    }
    validated[k] = v
  }
  return validated
}

async function translateNamespace(namespace: string, args: Args): Promise<void> {
  const sourcePath = join(args.source, namespace, 'en-US.json')
  if (!existsSync(sourcePath)) {
    console.warn(`[i18n-translate] no source for "${namespace}" at ${sourcePath}`)
    return
  }
  const source = await readJsonOrEmpty(sourcePath)

  for (const locale of args.locales) {
    if (locale === 'en-US') continue
    const targetPath = join(args.translations, locale, `${namespace}.json`)
    const existing = await readJsonOrEmpty(targetPath)
    const missing: Translation = {}
    for (const [k, v] of Object.entries(source)) {
      if (existing[k] === undefined) missing[k] = v
    }
    if (Object.keys(missing).length === 0) {
      console.log(`[i18n-translate] ${locale}/${namespace} up to date`)
      continue
    }
    console.log(`[i18n-translate] ${locale}/${namespace}: ${Object.keys(missing).length} keys`)
    const translated = await translateBatch(missing, locale, args)
    await writeJson(targetPath, { ...existing, ...translated })
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  for (const ns of args.namespaces) {
    await translateNamespace(ns, args)
  }
  console.log('[i18n-translate] done.')
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
