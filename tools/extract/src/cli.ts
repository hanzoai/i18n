#!/usr/bin/env node
/**
 * Write the keys a codebase asks for into the file a translator reads.
 *
 *   i18n-extract --code ./apps/web/src --source ./translations/source
 *
 *   --code <dir>        where to look; repeat for more than one
 *   --source <dir>      the `--source` directory to fill
 *   --namespace <ns>    for keys written without one (default: shared)
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { contents, source } from '@hanzo/i18n'

import { merge, scan, type Key, type Strings } from './scan.ts'

const CODE = /\.[cm]?[jt]sx?$/
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.turbo'])

const { values } = parseArgs({
  options: {
    code: { type: 'string', multiple: true },
    source: { type: 'string' },
    namespace: { type: 'string', default: 'shared' },
  },
})

if (!values.code?.length || !values.source) {
  throw new Error('required: --code <dir> --source <dir>')
}

const root = resolve(values.source)
const found: Key[] = []
for (const dir of values.code) {
  for await (const path of walk(resolve(dir))) {
    found.push(...scan(await readFile(path, 'utf8'), values.namespace))
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
  // then gets translated into thirteen languages exactly that faithfully.
  const bare = Object.entries(after).filter(([k, v]) => k === v)
  if (bare.length > 0) {
    console.log(`  ${bare.length} awaiting English: ${bare.map(([k]) => k).join(', ')}`)
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

async function read(path: string): Promise<Strings> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Strings
  } catch {
    return {}
  }
}
