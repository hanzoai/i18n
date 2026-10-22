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
        // Streamed, so the answer's headers arrive at once. Unstreamed, a batch a
        // slow local model writes for longer than fetch waits for headers (five
        // minutes) is cut off: Jais 3 at four tokens a second per slot took ten.
        stream: true,
        ...extra,
      }),
    })

    if (!answer.ok) {
      throw new Error(`${endpoint} answered ${answer.status}: ${(await answer.text()).slice(0, 200)}`)
    }
    const { content, finish } = answer.headers?.get('content-type')?.includes('text/event-stream') ? await streamed(answer) : whole(await answer.json())
    if (finish === 'length') {
      throw new Error(`${endpoint} truncated its answer`)
    }
    if (typeof content !== 'string') {
      throw new Error(`${endpoint} answered with no message`)
    }
    return content
  }
}

type Said = { content?: string; finish?: string }

/** An answer sent whole: one message. */
function whole(body: unknown): Said {
  const choice = (body as { choices?: { finish_reason?: string; message?: { content?: string } }[] }).choices?.[0]
  return { content: choice?.message?.content, finish: choice?.finish_reason }
}

/** An answer streamed as server-sent events: the deltas joined, and why it stopped. */
async function streamed(answer: Response): Promise<Said> {
  const text = await answer.text()
  let content: string | undefined
  let finish: string | undefined
  for (const line of text.split('\n')) {
    const data = line.startsWith('data:') ? line.slice(5).trim() : ''
    if (!data || data === '[DONE]') {
      continue
    }
    const choice = (JSON.parse(data) as { choices?: { finish_reason?: string | null; delta?: { content?: string | null } }[] }).choices?.[0]
    if (typeof choice?.delta?.content === 'string') {
      content = (content ?? '') + choice.delta.content
    }
    finish = choice?.finish_reason ?? finish
  }
  return { content, finish }
}
