/**
 * Locale registry — the single source of truth for every language LOCKIN knows about.
 *
 * Adding a language = add an entry here, add `apps/web/messages/<code>.json`,
 * then flip `enabled` to true. No other code changes are required.
 */

export const LOCALE_CODES = ["en", "kn", "hi"] as const;

export type LocaleCode = (typeof LOCALE_CODES)[number];

export type Script = "Latn" | "Knda" | "Deva";

export interface LocaleDefinition {
  code: LocaleCode;
  /** English name, used in admin screens. */
  englishName: string;
  /** Name in the language itself, used in the language switcher. */
  nativeName: string;
  script: Script;
  /** BCP 47 tag used for Intl formatting (dates, numbers, currency). */
  intlTag: string;
  dir: "ltr" | "rtl";
  /** Disabled locales are registered (DB, CMS) but not routable for end users. */
  enabled: boolean;
}

export const LOCALES: Readonly<Record<LocaleCode, LocaleDefinition>> = {
  en: {
    code: "en",
    englishName: "English",
    nativeName: "English",
    script: "Latn",
    intlTag: "en-IN",
    dir: "ltr",
    enabled: true,
  },
  kn: {
    code: "kn",
    englishName: "Kannada",
    nativeName: "ಕನ್ನಡ",
    script: "Knda",
    intlTag: "kn-IN",
    dir: "ltr",
    enabled: false,
  },
  hi: {
    code: "hi",
    englishName: "Hindi",
    nativeName: "हिन्दी",
    script: "Deva",
    intlTag: "hi-IN",
    dir: "ltr",
    enabled: false,
  },
};

export const DEFAULT_LOCALE: LocaleCode = "en";

/** Locales end users can currently select and route to. */
export const ENABLED_LOCALES: readonly LocaleCode[] = LOCALE_CODES.filter(
  (code) => LOCALES[code].enabled,
);

export function isLocaleCode(value: unknown): value is LocaleCode {
  return typeof value === "string" && (LOCALE_CODES as readonly string[]).includes(value);
}

export function isEnabledLocale(value: unknown): value is LocaleCode {
  return isLocaleCode(value) && LOCALES[value].enabled;
}

/**
 * Order in which translations are tried for a requested locale.
 * Always ends with the default locale so content is never blank.
 */
export function fallbackChain(locale: LocaleCode): LocaleCode[] {
  return locale === DEFAULT_LOCALE ? [DEFAULT_LOCALE] : [locale, DEFAULT_LOCALE];
}

/**
 * Pick the best available translation from a map keyed by locale.
 * Returns undefined only if neither the requested nor the default locale exists.
 */
export function resolveTranslation<T>(
  translations: Partial<Record<LocaleCode, T>>,
  locale: LocaleCode,
): { value: T; locale: LocaleCode; isFallback: boolean } | undefined {
  for (const candidate of fallbackChain(locale)) {
    const value = translations[candidate];
    if (value !== undefined) {
      return { value, locale: candidate, isFallback: candidate !== locale };
    }
  }
  return undefined;
}
