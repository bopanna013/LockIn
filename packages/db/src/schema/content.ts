import {
  boolean,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { contentSchema } from "./schemas";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const CONTENT_WORKFLOW_STATUSES = ["draft", "in_review", "published", "archived"] as const;
export type ContentWorkflowStatus = (typeof CONTENT_WORKFLOW_STATUSES)[number];

/**
 * Languages known to the platform. Mirrors the registry in @lockin/i18n and is the
 * foreign-key target for every `*_translations` table.
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

/**
 * Immutable content releases. Every student recommendation or 4-year roadmap
 * records the `release_id` it was generated against so future CMS edits never
 * silently mutate a student's existing roadmap.
 */
export const contentReleases = contentSchema.table(
  "content_releases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    versionNumber: integer("version_number").notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    notes: text("notes"),
    publishedByEmail: varchar("published_by_email", { length: 255 }).notNull(),
    isActive: boolean("is_active").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("content_releases_version_idx").on(table.versionNumber),
    index("content_releases_active_idx").on(table.isActive),
  ],
);

/**
 * Dimension weights (0–100) used by the pure recommendation engine in Phase 3
 * to match a student's assessment profile against each engineering branch.
 */
export interface BranchFitWeights {
  programmingAndAlgorithms: number;
  electronicsAndHardware: number;
  physicsAndMechanics: number;
  chemistryAndMaterials: number;
  biologyAndLifeSciences: number;
  mathematicsAndModeling: number;
  designAndInfrastructure: number;
}

/**
 * Core B.E./B.Tech engineering branches (India-focused).
 * Language-independent attributes live here; localized text lives in `branch_translations`.
 */
export const branches = contentSchema.table(
  "branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull(),
    code: varchar("code", { length: 16 }).notNull(),
    category: varchar("category", { length: 48 }).notNull(),
    durationYears: integer("duration_years").notNull().default(4),
    totalSemesters: integer("total_semesters").notNull().default(8),
    entrySalaryMinInr: integer("entry_salary_min_inr").notNull(),
    entrySalaryMaxInr: integer("entry_salary_max_inr").notNull(),
    midCareerSalaryMaxInr: integer("mid_career_salary_max_inr").notNull(),
    fitWeights: jsonb("fit_weights").$type<BranchFitWeights>().notNull(),
    entranceExamSlugs: jsonb("entrance_exam_slugs").$type<string[]>().notNull().default([]),
    status: varchar("status", { length: 24 })
      .$type<ContentWorkflowStatus>()
      .notNull()
      .default("draft"),
    displayOrder: integer("display_order").notNull().default(100),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("branches_slug_idx").on(table.slug),
    index("branches_status_order_idx").on(table.status, table.displayOrder),
  ],
);

export const branchTranslations = contentSchema.table(
  "branch_translations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 8 })
      .notNull()
      .references(() => locales.code, { onDelete: "restrict" }),
    title: varchar("title", { length: 160 }).notNull(),
    shortSummary: text("short_summary").notNull(),
    overview: text("overview").notNull(),
    whoItSuits: text("who_it_suits").notNull(),
    coreSubjects: jsonb("core_subjects").$type<string[]>().notNull().default([]),
    keySkills: jsonb("key_skills").$type<string[]>().notNull().default([]),
    careerRoles: jsonb("career_roles").$type<string[]>().notNull().default([]),
    topRecruitersIndia: jsonb("top_recruiters_india").$type<string[]>().notNull().default([]),
    higherStudiesPaths: jsonb("higher_studies_paths").$type<string[]>().notNull().default([]),
    status: varchar("status", { length: 24 })
      .$type<ContentWorkflowStatus>()
      .notNull()
      .default("published"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("branch_translations_branch_locale_idx").on(table.branchId, table.locale),
  ],
);

/**
 * Indian engineering entrance exams (JEE Main, JEE Advanced, KCET, COMEDK, BITSAT, GATE, etc.).
 */
export const entranceExams = contentSchema.table(
  "entrance_exams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull(),
    shortName: varchar("short_name", { length: 32 }).notNull(),
    level: varchar("level", { length: 32 }).notNull(), // "National" | "State (Karnataka)" | "University"
    conductingBody: varchar("conducting_body", { length: 160 }).notNull(),
    typicalMonth: varchar("typical_month", { length: 64 }).notNull(),
    officialUrl: varchar("official_url", { length: 255 }).notNull(),
    status: varchar("status", { length: 24 })
      .$type<ContentWorkflowStatus>()
      .notNull()
      .default("published"),
    ...timestamps,
  },
  (table) => [uniqueIndex("entrance_exams_slug_idx").on(table.slug)],
);

export const entranceExamTranslations = contentSchema.table(
  "entrance_exam_translations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => entranceExams.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 8 })
      .notNull()
      .references(() => locales.code, { onDelete: "restrict" }),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    summary: text("summary").notNull(),
    eligibilitySummary: text("eligibility_summary").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("entrance_exam_translations_exam_locale_idx").on(table.examId, table.locale),
  ],
);

export interface RoadmapTemplateMilestone {
  code: string;
  semester: number; // 1..8
  category:
    | "academics"
    | "skills"
    | "projects"
    | "internships"
    | "competitions"
    | "certifications"
    | "higher_studies";
  title: string;
  description: string;
  estimatedHours?: number;
}

/**
 * 8-semester B.E./B.Tech roadmap templates per branch and locale.
 */
export const roadmapTemplates = contentSchema.table(
  "roadmap_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 8 })
      .notNull()
      .references(() => locales.code, { onDelete: "restrict" }),
    releaseId: uuid("release_id").references(() => contentReleases.id, { onDelete: "set null" }),
    title: varchar("title", { length: 200 }).notNull(),
    milestones: jsonb("milestones").$type<RoadmapTemplateMilestone[]>().notNull().default([]),
    status: varchar("status", { length: 24 })
      .$type<ContentWorkflowStatus>()
      .notNull()
      .default("published"),
    ...timestamps,
  },
  (table) => [uniqueIndex("roadmap_templates_branch_locale_idx").on(table.branchId, table.locale)],
);

export type Locale = typeof locales.$inferSelect;
export type NewLocale = typeof locales.$inferInsert;
export type ContentRelease = typeof contentReleases.$inferSelect;
export type Branch = typeof branches.$inferSelect;
export type BranchTranslation = typeof branchTranslations.$inferSelect;
export type EntranceExam = typeof entranceExams.$inferSelect;
export type EntranceExamTranslation = typeof entranceExamTranslations.$inferSelect;
export type RoadmapTemplate = typeof roadmapTemplates.$inferSelect;
