import { DEFAULT_LOCALE, LOCALES, LOCALE_CODES } from "@lockin/i18n";
import { sql } from "drizzle-orm";
import type { Database } from "../client";
import { locales } from "../schema";

/** Keep content.locales in sync with the @lockin/i18n registry (idempotent). */
export async function seedLocales(db: Database): Promise<number> {
  const rows = LOCALE_CODES.map((code) => {
    const definition = LOCALES[code];
    return {
      code,
      englishName: definition.englishName,
      nativeName: definition.nativeName,
      script: definition.script,
      enabled: definition.enabled,
      isDefault: code === DEFAULT_LOCALE,
    };
  });

  await db
    .insert(locales)
    .values(rows)
    .onConflictDoUpdate({
      target: locales.code,
      set: {
        englishName: sql`excluded.english_name`,
        nativeName: sql`excluded.native_name`,
        script: sql`excluded.script`,
        enabled: sql`excluded.enabled`,
        isDefault: sql`excluded.is_default`,
        updatedAt: sql`now()`,
      },
    });

  return rows.length;
}
