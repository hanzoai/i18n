import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'

const run = promisify(execFile)
const cli = new URL('../src/cli.ts', import.meta.url).pathname

test('a codebase becomes a file a translator can read', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'i18n-'))
  const code = join(dir, 'code')
  const strings = join(dir, 'strings')

  await mkdir(join(code, 'ui'), { recursive: true })
  await mkdir(join(code, 'node_modules', 'junk'), { recursive: true })
  await writeFile(join(code, 'ui', 'swap.tsx'), `t('exchange:swap.go', 'Swap')\nt('nav.home', 'Home')\n`)
  await writeFile(join(code, 'ui', 'notes.md'), `t('never.extracted', 'no')\n`)
  await writeFile(join(code, 'node_modules', 'junk', 'index.ts'), `t('vendor.key', 'no')\n`)

  await run('node', [cli, '--code', code, '--source', strings, '--namespace', 'app'])

  // Namespaces come from the keys; the flag names the one for keys without.
  assert.deepEqual(JSON.parse(await readFile(join(strings, 'exchange', 'en-US.json'), 'utf8')), {
    'swap.go': 'Swap',
  })
  assert.deepEqual(JSON.parse(await readFile(join(strings, 'app', 'en-US.json'), 'utf8')), {
    'nav.home': 'Home',
  })

  // A vendored copy of a dependency is not this product's copy to translate,
  // and a markdown file is not code.
  const all = JSON.stringify([
    await readFile(join(strings, 'exchange', 'en-US.json'), 'utf8'),
    await readFile(join(strings, 'app', 'en-US.json'), 'utf8'),
  ])
  assert.ok(!all.includes('vendor.key'))
  assert.ok(!all.includes('never.extracted'))
})

test('running it again changes nothing on disk', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'i18n-'))
  const code = join(dir, 'code')
  const strings = join(dir, 'strings')
  await mkdir(code, { recursive: true })
  await writeFile(join(code, 'a.ts'), `t('b', 'B')\nt('a', 'A')\n`)

  const extract = () => run('node', [cli, '--code', code, '--source', strings])
  await extract()
  const first = await readFile(join(strings, 'shared', 'en-US.json'), 'utf8')

  // Someone reviews the English between runs. Extraction is not allowed to
  // undo that, and a rerun on an unchanged codebase is not allowed to show up
  // in a diff at all.
  await writeFile(join(strings, 'shared', 'en-US.json'), first.replace('"A"', '"Accept"'))
  await extract()
  const second = await readFile(join(strings, 'shared', 'en-US.json'), 'utf8')
  assert.equal(second, first.replace('"A"', '"Accept"'))

  await extract()
  assert.equal(await readFile(join(strings, 'shared', 'en-US.json'), 'utf8'), second)
})

test('it refuses to guess where the code or the strings are', async () => {
  await assert.rejects(run('node', [cli, '--code', '.']), /required/)
  await assert.rejects(run('node', [cli, '--source', '.']), /required/)
  await assert.rejects(run('node', [cli, '--code', '.', '--source', '.', '--wat', 'x']))
})

test('a strings file nobody can parse stops the run instead of replacing it', async () => {
  // The whole tool writes back what it read, so reading an unparseable file as
  // empty does not merely fail to merge — it REPLACES a reviewed English file
  // with whatever this one run happened to scan, reports "1 new, 1 total", and
  // exits 0. One trailing comma is enough. `validate` already drew this
  // distinction ("unreadable is not absent") and these two did not.
  const dir = await mkdtemp(join(tmpdir(), 'i18n-'))
  const code = join(dir, 'code')
  const strings = join(dir, 'strings')
  await mkdir(join(code), { recursive: true })
  await mkdir(join(strings, 'exchange'), { recursive: true })
  await writeFile(join(code, 'a.tsx'), `t('exchange:swap.title', 'Swap')\n`)

  const reviewed = '{\n  "swap.title": "Swap tokens instantly",\n  "swap.blurb": "carefully worded",\n}\n'
  const path = join(strings, 'exchange', 'en-US.json')
  await writeFile(path, reviewed)

  await assert.rejects(run('node', [cli, '--code', code, '--source', strings]))
  assert.equal(await readFile(path, 'utf8'), reviewed, 'the reviewed file must survive')
})

test('the failure names the file, because a run walks many of them', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'i18n-'))
  const code = join(dir, 'code')
  const strings = join(dir, 'strings')
  await mkdir(code, { recursive: true })
  await mkdir(join(strings, 'exchange'), { recursive: true })
  await writeFile(join(code, 'a.tsx'), `t('exchange:k', 'v')\n`)
  await writeFile(join(strings, 'exchange', 'en-US.json'), '{,}')

  const err = await run('node', [cli, '--code', code, '--source', strings]).then(
    () => undefined,
    (e: {stderr?: string}) => e,
  )
  assert.ok(err?.stderr?.includes('exchange/en-US.json'), err?.stderr)
})

test('a missing file is still simply empty', async () => {
  // The other half of the distinction: absent is not broken, and a first run
  // against a product with no strings yet must still write one.
  const dir = await mkdtemp(join(tmpdir(), 'i18n-'))
  const code = join(dir, 'code')
  const strings = join(dir, 'strings')
  await mkdir(code, { recursive: true })
  await writeFile(join(code, 'a.tsx'), `t('exchange:k', 'v')\n`)

  await run('node', [cli, '--code', code, '--source', strings])
  assert.deepEqual(JSON.parse(await readFile(join(strings, 'exchange', 'en-US.json'), 'utf8')), {k: 'v'})
})
