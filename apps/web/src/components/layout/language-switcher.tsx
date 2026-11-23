"use client";

import { LOCALES, type LocaleCode } from "@lockin/i18n";
import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/** Hidden automatically while only one language is enabled. */
export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("a11y");

  if (routing.locales.length < 2) return null;

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t("language")}</span>
      <Languages
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute left-2 size-4"
      />
      <select
        value={locale}
        disabled={isPending}
        onChange={(event) =>
          startTransition(() =>
            router.replace(pathname, { locale: event.target.value as LocaleCode }),
          )
        }
        className="bg-background h-9 appearance-none rounded-md border pr-3 pl-8 text-sm"
      >
        {routing.locales.map((code) => (
          <option key={code} value={code} lang={code}>
            {LOCALES[code].nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
