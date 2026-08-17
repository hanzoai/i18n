import { resolve, type SupportedLocale } from '@hanzo/i18n'

/**
 * Which language a phone is set to.
 *
 * This package is small on purpose, and the reason is the whole design: a
 * message is formatted identically on every surface, because ICU is ICU and the
 * bindings are the same React. What genuinely differs between a browser, a
 * phone and a server is only how you LEARN the person's preference — so that is
 * all that gets its own package, and everything downstream of it is shared.
 *
 * A second implementation of the formatter for "mobile" is how the same string
 * comes to render two ways.
 */

/** What a host platform can tell us, so a caller can supply it in a test. */
export interface Source {
  /** Preferred locales, best first, as BCP-47 tags. */
  locales(): readonly string[]
}

/**
 * The device's preferred locales, best first.
 *
 * `Intl` is asked first and is enough on its own for any current React Native:
 * Hermes has shipped full ICU since 0.71, and `Intl` is the same API the web and
 * the server answer from — one question, one shape, three platforms.
 *
 * There is no `NativeModules` fallback and that is deliberate. One was written,
 * and it could not run: this package is ESM, `require` is not defined there, and
 * the ReferenceError went straight into the catch — so the branch that was
 * supposed to rescue an older runtime silently returned nothing on every
 * runtime. It was also aimed below our own floor, since the declared peer is
 * react-native >= 0.71 and Hermes has shipped full ICU since exactly there.
 *
 * A runtime with no `Intl` gets an empty list, which `resolve` answers with the
 * default — the honest answer to "what language is this device" when nothing can
 * say.
 */
export function locales(): readonly string[] {
  const tag = intlLocale()
  return tag ? [tag] : []
}

/** The one locale to render in — device preference, negotiated against what we ship. */
export function detect(source: Source = { locales }): SupportedLocale {
  return resolve(source.locales())
}

function intlLocale(): string | undefined {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().locale || undefined
  } catch {
    return undefined
  }
}

