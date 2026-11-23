import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  ENABLED_LOCALES,
  LOCALES,
  LOCALE_CODES,
  fallbackChain,
  isEnabledLocale,
  isLocaleCode,
  resolveTranslation,
} from "./locales";
import { formatInr } from "./format";

describe("locale registry", () => {
  it("has a definition for every locale code", () => {
    for (const code of LOCALE_CODES) {
      expect(LOCALES[code].code).toBe(code);
    }
  });

  it("always has the default locale enabled", () => {
    expect(ENABLED_LOCALES).toContain(DEFAULT_LOCALE);
  });

  it("only enables English for the MVP", () => {
    expect(ENABLED_LOCALES).toEqual(["en"]);
  });

  it("validates locale codes", () => {
    expect(isLocaleCode("kn")).toBe(true);
    expect(isLocaleCode("fr")).toBe(false);
    expect(isEnabledLocale("kn")).toBe(false);
    expect(isEnabledLocale("en")).toBe(true);
  });
});

describe("translation fallback", () => {
  it("falls back to English when a translation is missing", () => {
    expect(fallbackChain("kn")).toEqual(["kn", "en"]);
    expect(resolveTranslation({ en: "Civil" }, "kn")).toEqual({
      value: "Civil",
      locale: "en",
      isFallback: true,
    });
  });

  it("prefers the requested locale when present", () => {
    expect(resolveTranslation({ en: "Civil", kn: "ಸಿವಿಲ್" }, "kn")?.value).toBe("ಸಿವಿಲ್");
  });

  it("returns undefined when nothing is available", () => {
    expect(resolveTranslation({}, "hi")).toBeUndefined();
  });
});

describe("formatting", () => {
  it("formats rupees with Indian digit grouping", () => {
    expect(formatInr(1200000)).toBe("₹12,00,000");
  });
});
