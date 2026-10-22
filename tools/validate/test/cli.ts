import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'

const run = promisify(execFile)
const cli = new URL('../src/cli.ts', import.meta.url).pathname

/** A product tree with one namespace and whatever locales are handed in. */
async function product(source: object, locales: Record<string, object | string>): Promise<string[]> {
  const dir = await mkdtemp(join(tmpdir(), 'i18n-'))
  const english = join(dir, 'source')
  const out = join(dir, 'translations')
  await mkdir(join(english, 'exchange'), { recursive: true })
  await writeFile(join(english, 'exchange', 'en-US.json'), JSON.stringify(source))
  for (const [locale, strings] of Object.entries(locales)) {
    await mkdir(join(out, locale), { recursive: true })
    await writeFile(join(out, locale, 'exchange.json'), typeof strings === 'string' ? strings : JSON.stringify(strings))
  }
  return [cli, '--source', english, '--translations', out, '--locales', Object.keys(locales).join(',') || 'ja-JP']
}

test('a clean product exits zero', async () => {
  const args = await product({ a: 'A {{x}}' }, { 'ja-JP': { a: 'あ {{x}}' } })
  const { stdout } = await run('node', args)
  assert.match(stdout, /clean/)
})

test('a gate that cannot fail is not a gate', async () => {
  // The exit code is the entire product of this tool. A version that printed
  // problems and exited zero would pass every PR it was meant to stop.
  const missing = await product({ a: 'A', b: 'B' }, { 'ja-JP': { a: 'あ' } })
  const failure = await run('node', missing).then(
    () => undefined,
    (e: { code: number; stderr: string }) => e,
  )
  assert.equal(failure?.code, 1)
  assert.match(failure?.stderr ?? '', /ja-JP\/exchange b: is missing/)
})

test('a hand-broken file fails loudly rather than reading as empty', async () => {
  // Unreadable is not "nobody has started this locale": silently treating it as
  // absent would report a hundred missing keys and hide the real cause.
  const broken = await product({ a: 'A' }, { 'ja-JP': '{"a": ' })
  await assert.rejects(run('node', broken), /JSON/)
})

test('the forbid list comes from the product, not from here', async () => {
  const args = await product({ a: 'Open Lux Wallet' }, { 'ja-JP': { a: 'Lux Walletを開く' } })
  await run('node', args)

  const failure = await run('node', [...args, '--forbid-literal', 'Lux Wallet,zoo.exchange']).then(
    () => undefined,
    (e: { code: number; stderr: string }) => e,
  )
  assert.equal(failure?.code, 1)
  assert.match(failure?.stderr ?? '', /en-US\/exchange a: holds "Lux Wallet"/)
  assert.match(failure?.stderr ?? '', /ja-JP\/exchange a: holds "Lux Wallet"/)
})

test('a flat catalog directory is gated the same way, with the product’s protected names', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'i18n-'))
  await writeFile(join(dir, 'en-US.json'), JSON.stringify({ 'Accelerate Codex with Hanzo': 'Accelerate Codex with Hanzo', 'Open source': 'Open source' }))
  await writeFile(join(dir, 'ar.json'), JSON.stringify({ 'Accelerate Codex with Hanzo': 'سرّع Codex مع Hanzo', 'Open source': 'مفتوح المصدر' }))
  await writeFile(join(dir, 'nl.json'), JSON.stringify({ 'Accelerate Codex with Hanzo': 'Versnel Codex met Hanzo', 'Open source': 'Open source' }))
  await writeFile(join(dir, 'ja-JP.json'), JSON.stringify({ 'Accelerate Codex with Hanzo': 'コーデックスを高速化', 'Open source': 'オープンソース' }))
  const terms = join(dir, 'terms.json')
  await writeFile(terms, JSON.stringify({ keep: ['Hanzo', 'Codex'] }))

  const args = [cli, '--catalogs', dir, '--terms', terms, '--locales', 'ar,nl,ja-JP']
  const failure = await run('node', args).then(
    () => undefined,
    (e: { code: number; stdout: string; stderr: string }) => e,
  )
  assert.equal(failure?.code, 1)
  assert.match(failure?.stderr ?? '', /ja-JP\/catalogs Accelerate Codex with Hanzo: drops Codex, Hanzo/)
  assert.doesNotMatch(failure?.stderr ?? '', /(ar|nl)\//)
  // Identical prose is listed for a person, and is not what failed the run.
  assert.match(failure?.stdout ?? '', /review nl\/catalogs: 1 identical to the English: "Open source"/)

  const { stdout } = await run('node', [cli, '--catalogs', dir, '--terms', terms, '--locales', 'ar,nl'])
  assert.match(stdout, /clean/)
})

test('a terms file that is not names is refused, not read as none', async () => {
  const args = await product({ a: 'A' }, { 'ja-JP': { a: 'あ' } })
  const dir = await mkdtemp(join(tmpdir(), 'i18n-'))
  await writeFile(join(dir, 'terms.json'), JSON.stringify({ keep: 'Hanzo' }))
  await assert.rejects(run('node', [...args, '--terms', join(dir, 'terms.json')]), /keep must be a list of names/)
})
