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
