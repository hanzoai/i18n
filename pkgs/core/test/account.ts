import assert from 'node:assert/strict'
import { test } from 'node:test'

import { loadAccountLocale, saveAccountLocale } from '../src/account.ts'

type Call = { url: string } & RequestInit

function serve(answer: unknown): Call[] {
  const calls: Call[] = []
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, ...init })
    return { ok: true, status: 200, json: async () => answer } as Response
  }) as typeof fetch
  return calls
}

const original = globalThis.fetch
test.afterEach(() => {
  globalThis.fetch = original
})

test('IAM sync reads with an empty merge and writes only the locale', async () => {
  const calls = serve({ status: 'ok', data: { locale: 'ar', appearance: { density: 'compact' } } })
  const account = { base: 'https://identity.example/', token: 'test-only' }
  assert.equal(await loadAccountLocale(account), 'ar')
  await saveAccountLocale(account, 'ar-AE')
  assert.equal(calls[0].body, '{}')
  assert.deepEqual(JSON.parse(String(calls[1].body)), { locale: 'ar' })
  assert.equal(calls[1].credentials, 'omit')
  assert.equal((calls[1].headers as Record<string, string>).Authorization, 'Bearer test-only')
  assert.equal(calls[1].url, 'https://identity.example/v1/iam/preferences')
})

test('a locale IAM holds that we do not ship is no locale', async () => {
  serve({ status: 'ok', data: { locale: 'xx-YY' } })
  assert.equal(await loadAccountLocale({ base: 'https://identity.example', token: 't' }), undefined)
})

test('an error inside HTTP 200, and a write IAM did not keep, are refused', async () => {
  serve({ status: 'error' })
  await assert.rejects(saveAccountLocale({ base: 'https://identity.example', token: 't' }, 'ar'))
  serve({ status: 'ok', data: { locale: 'en-US' } })
  await assert.rejects(saveAccountLocale({ base: 'https://identity.example', token: 't' }, 'ar'))
})
