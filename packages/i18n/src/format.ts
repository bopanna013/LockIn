import { DEFAULT_LOCALE, LOCALES, type LocaleCode } from "./locales";

/** Format an amount in Indian Rupees using the locale's conventions (e.g. ₹12,00,000). */
export function formatInr(
  amount: number,
  locale: LocaleCode = DEFAULT_LOCALE,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(LOCALES[locale].intlTag, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    ...options,
  }).format(amount);
}

export function formatDate(
  date: Date,
  locale: LocaleCode = DEFAULT_LOCALE,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  return new Intl.DateTimeFormat(LOCALES[locale].intlTag, {
    timeZone: "Asia/Kolkata",
    ...options,
  }).format(date);
}
