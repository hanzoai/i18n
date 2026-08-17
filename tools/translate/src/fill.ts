import { parity } from '@hanzo/i18n'

export type Strings = Record<string, string>

export interface Message {
  role: 'system' | 'user'
  content: string
}

/** Something you can ask. `chat` binds one to Hanzo's gateway; a test binds a fake. */
export type Model = (messages: Message[]) => Promise<string>

export interface Filled {
  /** Sound translations for keys that had none. */
  added: Strings
  /** Keys the answer got wrong. They stay missing, so the next run asks again. */
  refused: string[]
}

/** The keys a locale still owes. */
export function missing(source: Strings, existing: Strings): Strings {
  return Object.fromEntries(Object.entries(source).filter(([key]) => existing[key] === undefined))
}

/**
 * Translate what a locale is missing, and only that.
 *
 * Existing translations are never sent and never replaced. A translator's
 * correction has to survive the next run or nobody makes a second one, and a
 * tool that retranslated everything would spend a thousand keys to add three.
 */
export async function fill(
  source: Strings,
  existing: Strings,
  locale: string,
  model: Model,
): Promise<Filled> {
  const want = missing(source, existing)
  const added: Strings = {}
  const refused: string[] = []
  if (Object.keys(want).length === 0) {
    return { added, refused }
  }

  const answer = read(await model(prompt(want, locale)))
  // Walked over what was ASKED, never over what came back. The answer is data:
  // a model that returns a key nobody asked for cannot file it, and one that
  // silently drops a key gets that key reported rather than lost.
  for (const [key, english] of Object.entries(want)) {
    const value = answer[key]
    if (typeof value === 'string' && value.trim() !== '' && parity(english, value)) {
      added[key] = value
    } else {
      refused.push(key)
    }
  }
  return { added, refused }
}

function prompt(want: Strings, locale: string): Message[] {
  return [
    {
      role: 'system',
      content: [
        `Translate software interface strings from English into ${locale}.`,
        '',
        'Answer with a JSON object: the same keys, translated values, nothing else.',
        'Leave every {{slot}} exactly as written. They are substituted at runtime, so a',
        'renamed or dropped one prints an empty space where a number or a name belongs.',
        'Keep product names, ticker symbols and code identifiers in English.',
        'Match the register of the source: short, plain, and addressed to one person.',
      ].join('\n'),
    },
    { role: 'user', content: JSON.stringify(want, null, 2) },
  ]
}

function read(raw: string): Record<string, unknown> {
  // Asked for an object, a model still sometimes returns one inside a fenced
  // block, and the fence is not JSON.
  const body = raw
    .trim()
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/```$/, '')
    .trim()

  let value: unknown
  try {
    value = JSON.parse(body)
  } catch {
    throw new Error(`answer was not JSON: ${body.slice(0, 120)}`)
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`answer was not an object: ${body.slice(0, 120)}`)
  }
  return value as Record<string, unknown>
}
