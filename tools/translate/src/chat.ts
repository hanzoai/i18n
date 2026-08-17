import type { Model } from './fill.ts'

/** Ours. Translation is inference and inference is a Hanzo endpoint. */
export const ENDPOINT = 'https://api.hanzo.ai/v1/chat/completions'
export const MODEL = 'zen5'

export function chat(model: string, endpoint: string, key: string): Model {
  return async (messages) => {
    const answer = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages,
        // A string has one best translation, and the file it lands in is
        // reviewed by a person and compared against the last run. Sampling would
        // make a rerun a diff.
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    })

    if (!answer.ok) {
      throw new Error(`${endpoint} answered ${answer.status}: ${(await answer.text()).slice(0, 200)}`)
    }
    const body = (await answer.json()) as { choices?: { message?: { content?: string } }[] }
    const content = body.choices?.[0]?.message?.content
    if (typeof content !== 'string') {
      throw new Error(`${endpoint} answered with no message`)
    }
    return content
  }
}
