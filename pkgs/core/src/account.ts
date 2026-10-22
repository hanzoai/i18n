import { locales } from './locales.ts'
import { resolve } from './resolve.ts'

/** Where a signed-in person's preferences live: Hanzo IAM, called with their own token. */
export interface Account {
  /** IAM's origin, e.g. `https://hanzo.id`. */
  base: string
  token: string
}

/**
 * IAM's existing preferences merge: POST a patch, receive the merged document.
 * An empty patch is the read. Only `locale` is ever written from here.
 */
async function preferences(account: Account, patch: { locale?: string }, signal?: AbortSignal): Promise<{ locale?: unknown }> {
  const response = await fetch(`${account.base.replace(/\/+$/, '')}/v1/iam/preferences`, {
    method: 'POST',
    credentials: 'omit',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${account.token}` },
    body: JSON.stringify(patch),
  })
  if (!response.ok) {
    throw new Error(`IAM preferences: ${response.status}`)
  }
  // IAM answers its own errors inside an HTTP 200 envelope, so the status alone is not success.
  const body = (await response.json()) as { status?: string; data?: { locale?: unknown } } | null
  if (body?.status !== 'ok') {
    throw new Error('IAM refused the preference')
  }
  return body.data ?? {}
}

/** The locale saved on the account, if it is one we ship. */
export async function loadAccountLocale(account: Account, signal?: AbortSignal): Promise<string | undefined> {
  const data = await preferences(account, {}, signal)
  return locales.some((l) => l.code === data.locale) ? (data.locale as string) : undefined
}

/** Save the locale on the account, and refuse a write IAM did not keep. */
export async function saveAccountLocale(account: Account, locale: string, signal?: AbortSignal): Promise<void> {
  const code = resolve(locale)
  const data = await preferences(account, { locale: code }, signal)
  if (data.locale !== code) {
    throw new Error('IAM did not persist the selected locale')
  }
}
