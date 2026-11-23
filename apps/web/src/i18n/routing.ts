import { DEFAULT_LOCALE, ENABLED_LOCALES } from "@lockin/i18n";
import { defineRouting } from "next-intl/routing";

/** Routing is driven entirely by the @lockin/i18n registry. */
export const routing = defineRouting({
  locales: ENABLED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
});
