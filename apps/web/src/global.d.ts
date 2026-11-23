import type { routing } from "@/i18n/routing";
import type messages from "../messages/en.json";

/** Type-safe translation keys: a typo in t("...") fails `tsc`. */
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
