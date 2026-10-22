import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'

const run = promisify(execFile)
const cli = new URL('../src/cli.ts', import.meta.url).pathname

test('a flat catalog fills through /v1/translate and records what wrote it', async () => {
  const asked: Record<string, unknown>[] = []
  const server = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      const body = JSON.parse(raw) as { batch: string[]; target: string }
      asked.push({ url: req.url, auth: req.headers.authorization, ...body })
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ translations: body.batch.map((s) => ({ text: `${body.target}:${s}` })), tier: 'quality' }))
    })
  }).listen(0, '127.0.0.1')
  await new Promise((r) => server.once('listening', r))
  try {
    const dir = await mkdtemp(join(tmpdir(), 'i18n-'))
    await writeFile(join(dir, 'en-US.json'), JSON.stringify({ About: 'About', Welcome: 'Welcome' }))
    await writeFile(join(dir, 'ar.json'), JSON.stringify({ About: 'حول' }))
    const env = { ...process.env, HANZO_API_KEY: 'k', HANZO_ENDPOINT: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }
    delete env.TRANSLATION_BASE_URL

    const { stdout } = await run('node', [cli, '--catalogs', dir, '--locales', 'ar,de-DE'], { env })
    assert.match(stdout, /ar\/catalogs: 1 of 1/)
    assert.match(stdout, /de-DE\/catalogs: 2 of 2/)

    // Only what was missing was asked for, and a reviewed string was not touched.
    assert.deepEqual(asked.map((a) => [a.url, a.auth, a.target, a.batch]), [
      ['/v1/translate', 'Bearer k', 'ar', ['Welcome']],
      ['/v1/translate', 'Bearer k', 'de-DE', ['About', 'Welcome']],
    ])
    assert.deepEqual(JSON.parse(await readFile(join(dir, 'ar.json'), 'utf8')), { About: 'حول', Welcome: 'ar:Welcome' })

    const provenance = JSON.parse(await readFile(join(dir, 'provenance.json'), 'utf8'))
    assert.equal(provenance.ar.runs.length, 1)
    assert.equal(provenance.ar.runs[0].model, 'translate/quality')
    assert.deepEqual(provenance.ar.runs[0].keys, ['Welcome'])
    assert.match(provenance.ar.runs[0].sourceSha256, /^[0-9a-f]{64}$/)

    // A second run owes nothing and asks nothing.
    await run('node', [cli, '--catalogs', dir, '--locales', 'ar,de-DE'], { env })
    assert.equal(asked.length, 2)
  } finally {
    server.close()
  }
})

test('a locale the toolkit does not ship is refused before anything is spent', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'i18n-'))
  await writeFile(join(dir, 'en-US.json'), JSON.stringify({ About: 'About' }))
  await assert.rejects(run('node', [cli, '--catalogs', dir, '--locales', 'zh-TW'], { env: { ...process.env, HANZO_API_KEY: 'k' } }), /unsupported locale: zh-TW/)
})
