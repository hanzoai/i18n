#!/usr/bin/env tsx
/**
 * @hanzo/i18n-validate — CI gate for any product's translations.
 *
 * Usage (from a product repo):
 *   pnpm dlx @hanzo/i18n-validate \
 *     --source ./translations/source \
 *     --translations ./translations/translations \
 *     --forbid-literal "Lux Wallet,lux.exchange,Zoo Wallet,zoo.exchange"
 *
 * Exits non-zero on:
 *   - missing key in any locale
 *   - {{slot}} parity mismatch between source and translation
 *   - source string containing a forbidden literal (brand leak detection)
 *
 * The forbid list is provided by the product, not baked into the toolkit.
 */

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { readdir } from 'node:fs/promises'
import { SUPPORTED_LOCALES } from '@hanzo/i18n'

interface Args {
  source: string
  translations: string
  locales: string[]
  forbidLiterals: string[]
  namespaces?: string[]
}

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = { forbidLiterals: [], locales: [...SUPPORTED_LOCALES] }
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
      case '--locales':
        out.locales = next().split(',').map((s) => s.trim()).filter(Boolean)
        break
      case '--namespaces':
        out.namespaces = next().split(',').map((s) => s.trim()).filter(Boolean)
        break
      case '--forbid-literal':
        out.forbidLiterals = next().split(',').map((s) => s.trim()).filter(Boolean)
        break
      default:
        throw new Error(`Unknown flag: ${a}`)
    }
  }
  if (!out.source || !out.translations) {
    throw new Error('Required flags: --source --translations')
  }
  return out as Args
}

type Map = Record<string, string>

async function readJson(path: string): Promise<Map> {
  if (!existsSync(path)) return {}
  return JSON.parse(await readFile(path, 'utf8')) as Map
}

function listSlots(s: string): string[] {
  return (s.match(/\{\{[^}]+\}\}/g) ?? []).slice().sort()
}

async function discoverNamespaces(sourceDir: string): Promise<string[]> {
  if (!existsSync(sourceDir)) return []
  const entries = await readdir(sourceDir, { withFileTypes: true })
  return entries.filter((e) => e.isDirectory()).map((e) => e.name)
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const namespaces = args.namespaces ?? (await discoverNamespaces(args.source))
  let errors = 0

  for (const namespace of namespaces) {
    const sourcePath = join(args.source, namespace, 'en-US.json')
    if (!existsSync(sourcePath)) continue
    const source = await readJson(sourcePath)

    if (args.forbidLiterals.length > 0) {
      for (const [k, v] of Object.entries(source)) {
        for (const term of args.forbidLiterals) {
          if (v.includes(term)) {
            console.error(`[i18n-validate] ${namespace}/en-US.json: "${k}" contains forbidden literal "${term}"`)
            errors++
          }
        }
      }
    }

    for (const locale of args.locales) {
      if (locale === 'en-US') continue
      const targetPath = join(args.translations, locale, `${namespace}.json`)
      const target = await readJson(targetPath)
      for (const [key, sourceVal] of Object.entries(source)) {
        const translated = target[key]
        if (translated === undefined) {
          console.error(`[i18n-validate] ${locale}/${namespace}: missing "${key}"`)
          errors++
          continue
        }
        const sslots = listSlots(sourceVal)
        const tslots = listSlots(translated)
        if (sslots.length !== tslots.length || !sslots.every((s, i) => s === tslots[i])) {
          console.error(`[i18n-validate] ${locale}/${namespace}: slot mismatch on "${key}"`)
          console.error(`           source slots: ${JSON.stringify(sslots)}`)
          console.error(`           target slots: ${JSON.stringify(tslots)}`)
          errors++
        }
      }
    }
  }

  if (errors > 0) {
    console.error(`[i18n-validate] FAILED with ${errors} error(s).`)
    process.exit(1)
  }
  console.log('[i18n-validate] all locales clean.')
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
