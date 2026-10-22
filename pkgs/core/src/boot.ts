import { DEFAULT_LOCALE, OFFERED, locales } from './locales.ts'
import { PAINTED, preferenceKey } from './message.ts'
import { MACRO, SERVES, direction, parse, pick, region } from './resolve.ts'

/**
 * A script to inline in `<head>`: it sets `<html lang dir>` before the first paint,
 * so a right-to-left reader never sees a left-to-right layout turn around when the
 * provider mounts.
 *
 * It answers what `I18nProvider` will: the locale this browser's document last
 * showed (`PAINTED`), else the signed-out visitor's saved choice, else the browser's
 * languages negotiated by `resolve` over the locales a browser may select. It writes
 * `lang` and `dir` only where they differ, touches nothing else, and never throws.
 *
 *   <html suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: bootScript() }} />
 */
export function bootScript(): string {
  return SCRIPT
}

/**
 * Step 2 of `resolve`, answered ahead of time for each language with more than one
 * offered locale: the locale no region changes, then each other locale followed by
 * the regions that reach it. `<language>-<script>` holds a script's own answers where
 * they differ from the language's. A language with one offered locale has no entry:
 * the script reaches that locale by its language subtag.
 */
function groups(): Record<string, string[]> {
  const byLanguage = new Map<string, string[]>()
  for (const code of OFFERED) {
    const language = parse(code).language
    byLanguage.set(language, [...(byLanguage.get(language) ?? []), code])
  }
  const out: Record<string, string[]> = {}
  for (const [language, tags] of byLanguage) {
    if (tags.length === 1 && OFFERED.filter((code) => code.split('-')[0] === language).join() === tags[0]) {
      continue
    }
    const own = parse(language).region
    const any = group(tags, own)
    out[language] = any
    for (const script of new Set(tags.map((tag) => parse(tag).script))) {
      const one = group(tags.filter((tag) => parse(tag).script === script), own)
      if (script && one.join() !== any.join()) {
        out[`${language}-${script}`] = one
      }
    }
  }
  return out
}

/** `pick` for every region that changes its answer, inverted: `[fallback, 'locale region…', …]`. */
function group(near: readonly string[], own: string | undefined): string[] {
  const fallback = pick(near, undefined, own) as string
  const reach = new Map<string, string[]>()
  for (const wanted of new Set(near.flatMap((tag) => [region(tag) ?? '', ...(SERVES[tag] ?? [])]).filter(Boolean))) {
    const answer = pick(near, wanted, own) as string
    if (answer !== fallback) {
      reach.set(answer, [...(reach.get(answer) ?? [answer]), wanted])
    }
  }
  return [fallback, ...[...reach.values()].map((entry) => entry.join(' '))]
}

/** JSON, with the keys that are identifiers unquoted. */
function literal(value: object): string {
  return JSON.stringify(value).replace(/"(\w+)":/g, '$1:')
}

// Every registry tag; `~` marks one a browser's language may not select (review),
// `!` one written right to left.
const codes = locales.map((l) => `${l.review ? '~' : ''}${direction(l.code) === 'rtl' ? '!' : ''}${l.code}`).join(' ')

// A stored value counts only as a registry tag, exactly as written. A requested tag
// becomes an offered locale or nothing, in `resolve`'s order: exact (any case), then
// the maximized language (aliases folded) and script, then the region.
const SCRIPT =
  `(()=>{try{let d=document.documentElement,C=${JSON.stringify(codes)}.split(' '),A=C.map(c=>c.replace(/[~!]/g,'')),` +
  `O=A.filter((c,i)=>C[i][0]!='~'),R=A.filter((c,i)=>/!/.test(C[i])),G=${literal(groups())},M=${literal(MACRO)},` +
  `g=k=>{try{k=localStorage.getItem(k)}catch{}return A.includes(k)?k:''},` +
  `m=t=>{let l,s,r,x,q;t=t.trim().replace(/_/g,'-');l=t.toLowerCase();x=O.find(o=>o.toLowerCase()==l);if(x)return x;` +
  `try{x=new Intl.Locale(t).maximize();l=x.language;s=x.script;r=x.region}catch{l=l.split('-')[0]}` +
  `l=M[l]||l;q=G[l+'-'+s]||G[l];` +
  `if(q)return((x=q.find(e=>e.split(' ').indexOf(r)>0))||q[0]).split(' ')[0];return O.find(o=>o.split('-')[0]==l)},` +
  `c=g(${JSON.stringify(PAINTED)})||g(${JSON.stringify(preferenceKey(null))})||` +
  `(navigator.languages||[navigator.language]).map(m).find(x=>x)||${JSON.stringify(DEFAULT_LOCALE)},` +
  `r=R.includes(c)?'rtl':'ltr';d.lang!=c&&(d.lang=c);(d.dir||'ltr')!=r&&(d.dir=r)` +
  `}catch{}})()`
