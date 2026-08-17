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
 * `NativeModules` is the fallback for an older Hermes or a JSC build, where
 * `Intl` is absent or a stub that reports `en-US` for every device. It is read
 * defensively through `require`, so a package that is not React Native at all —
 * a unit test, a server-side render of a native screen — resolves to the default
 * instead of throwing on a module that was never there.
 */
export function locales(): readonly string[] {
  const fromIntl = intlLocale()
  if (fromIntl) {
    return [fromIntl]
  }
  return nativeLocales()
}

/** The one locale to render in — device preference, negotiated against what we ship. */
export function detect(source: Source = { locales }): SupportedLocale {
  return resolve(source.locales())
}

function intlLocale(): string | undefined {
  try {
    const tag = new Intl.DateTimeFormat().resolvedOptions().locale
    // A stub Intl answers the same tag on every device. It is indistinguishable
    // from a device genuinely set to it, so believing it costs a mis-rendered
    // app for everyone else; NativeModules is asked instead and knows the truth.
    return tag && tag !== 'en-US' ? tag : undefined
  } catch {
    return undefined
  }
}

function nativeLocales(): readonly string[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { NativeModules } = require('react-native') as {
      NativeModules?: {
        SettingsManager?: { settings?: { AppleLanguages?: string[]; AppleLocale?: string } }
        I18nManager?: { localeIdentifier?: string }
      }
    }
    const ios = NativeModules?.SettingsManager?.settings
    if (ios?.AppleLanguages?.length) {
      return ios.AppleLanguages
    }
    if (ios?.AppleLocale) {
      return [ios.AppleLocale]
    }
    const android = NativeModules?.I18nManager?.localeIdentifier
    if (android) {
      // Android reports POSIX form (`en_US`); the rest of the world speaks BCP-47.
      return [android.replace(/_/g, '-')]
    }
  } catch {
    // Not a React Native runtime. The caller gets the default, which is the
    // honest answer to "what language is this device" when there is no device.
  }
  return []
}
