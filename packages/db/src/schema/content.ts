import { boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { contentSchema } from "./schemas";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * Languages known to the platform. Mirrors the registry in @lockin/i18n and is the
 * foreign-key target for every `*_translations` table added from Phase 2 onward.
 */
export const locales = contentSchema.table("locales", {
  code: varchar("code", { length: 8 }).primaryKey(),
  englishName: varchar("english_name", { length: 64 }).notNull(),
  nativeName: varchar("native_name", { length: 64 }).notNull(),
  script: varchar("script", { length: 8 }).notNull(),
  enabled: boolean("enabled").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  ...timestamps,
});

export type Locale = typeof locales.$inferSelect;
export type NewLocale = typeof locales.$inferInsert;
