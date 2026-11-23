import { DEFAULT_LOCALE, LOCALES } from "@lockin/i18n";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const messages = (await import(`../../messages/${locale}.json`)).default;
  // Untranslated keys fall back to English instead of rendering blank.
  const fallback =
    locale === DEFAULT_LOCALE
      ? {}
      : (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default;

  return {
    locale,
    messages: deepMerge(fallback, messages),
    timeZone: "Asia/Kolkata",
    formats: {
      number: { inr: { style: "currency", currency: "INR", maximumFractionDigits: 0 } },
    },
    onError(error) {
      if (process.env.NODE_ENV !== "production")
        console.warn(`[i18n:${LOCALES[locale].code}]`, error.message);
    },
  };
});

type Messages = Record<string, unknown>;

function deepMerge(base: Messages, override: Messages): Messages {
  const result: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = result[key];
    result[key] =
      isPlainObject(existing) && isPlainObject(value) ? deepMerge(existing, value) : value;
  }
  return result;
}

function isPlainObject(value: unknown): value is Messages {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
