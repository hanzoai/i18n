import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { Terms } from '@hanzo/i18n'

import type { Engine } from './fill.ts'

/** Translates texts into one MADLAD-400 target language, answering in the same order. */
export type Worker = (target: string, texts: string[]) => Promise<string[]>

/** Where MADLAD names a target other than by the tag's language. */
const TARGET: Record<string, string> = { 'fa-AF': 'prs', 'zh-HK': 'zh_Hant', 'zh-Hant': 'zh_Hant' }

/**
 * MADLAD-400 (a sentence translation model, not a chat model) as an `Engine`.
 *
 * It takes no instructions, so a protected name goes through as a numbered `{n}`
 * placeholder, which it carries unchanged, and is put back after. Numbers start past
 * any numbered slot the source already holds.
 */
export function madlad(worker: Worker, terms: Terms = {}): Engine {
  const keep = [...(terms.keep ?? [])].sort((a, b) => b.length - a.length)
  const named = keep.length > 0 ? new RegExp(`\\b(?:${keep.map(escape).join('|')})\\b`, 'g') : undefined
  return async (want, locale) => {
    const keys = Object.keys(want)
    const masked = keys.map((key) => {
      const text = want[key].trim()
      const first = Math.max(-1, ...[...text.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1]))) + 1
      const names: string[] = []
      const out = named ? text.replace(named, (name) => `{${first + names.push(name) - 1}}`) : text
      return { out, names, first }
    })
    const answer = await worker(TARGET[locale] ?? new Intl.Locale(locale).language, masked.map((m) => m.out))
    if (answer.length !== keys.length) {
      throw new Error(`madlad answered ${answer.length} translations for ${keys.length} strings`)
    }
    return Object.fromEntries(
      keys.map((key, i) => {
        const { names, first } = masked[i]
        return [key, answer[i].replace(/\{(\d+)\}/g, (slot, n: string) => names[Number(n) - first] ?? slot)]
      }),
    )
  }
}

/**
 * `madlad.py` in a Python that has `ctranslate2` and `sentencepiece`, serving the
 * CTranslate2 conversion of the model in `model`. One process for the whole run;
 * `close` ends it.
 */
export function spawnWorker(python: string, model: string): { worker: Worker; close: () => void } {
  const child = spawn(python, ['-I', new URL('../madlad.py', import.meta.url).pathname, model], { stdio: ['pipe', 'pipe', 'inherit'] })
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]()
  let queue = Promise.resolve<unknown>(undefined)
  const worker: Worker = (target, texts) => {
    const turn = queue.then(async () => {
      child.stdin.write(`${JSON.stringify({ target, texts })}\n`)
      const { value, done } = await lines.next()
      if (done) {
        throw new Error(`madlad worker exited (${child.exitCode ?? 'no code'})`)
      }
      return (JSON.parse(value) as { out: string[] }).out
    })
    queue = turn.catch(() => undefined)
    return turn
  }
  return { worker, close: () => child.stdin.end() }
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
