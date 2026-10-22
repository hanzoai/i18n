import type { Model } from './fill.ts'

/** Ours. Translation is inference and inference is a Hanzo endpoint. */
export const ORIGIN = 'https://api.hanzo.ai'
export const MODEL = 'zen5'

/**
 * An OpenAI-compatible `/chat/completions` as a `Model`: Hanzo's at
 * `${ORIGIN}/v1/chat/completions`, or a local server (`TRANSLATION_BASE_URL`),
 * which may need no key and may take template arguments such as a reasoning
 * effort.
 */
export function chat(model: string, endpoint: string, key?: string, extra: Record<string, unknown> = {}): Model {
  return async (messages) => {
    const answer = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(key && { authorization: `Bearer ${key}` }) },
      body: JSON.stringify({
        model,
        messages,
        // A string has one best translation, and the file it lands in is
        // reviewed by a person and compared against the last run. Sampling would
        // make a rerun a diff.
        temperature: 0,
        response_format: { type: 'json_object' },
        ...extra,
      }),
    })

    if (!answer.ok) {
      throw new Error(`${endpoint} answered ${answer.status}: ${(await answer.text()).slice(0, 200)}`)
    }
    const body = (await answer.json()) as { choices?: { finish_reason?: string; message?: { content?: string } }[] }
    const choice = body.choices?.[0]
    if (choice?.finish_reason === 'length') {
      throw new Error(`${endpoint} truncated its answer`)
    }
    const content = choice?.message?.content
    if (typeof content !== 'string') {
      throw new Error(`${endpoint} answered with no message`)
    }
    return content
  }
}
