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
import type { DimensionVector, RankedBranchRecommendation } from "@lockin/domain/recommendation";
import { contentReleases } from "./content";
import { studentSchema } from "./schemas";
import { organizations, users } from "./system";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const ACADEMIC_BOARDS = [
  "CBSE",
  "ICSE",
  "STATE_KARNATAKA",
  "STATE_OTHER",
  "IB",
  "IGCSE",
] as const;
export type AcademicBoard = (typeof ACADEMIC_BOARDS)[number];

export const EDUCATION_STAGES = [
  "CLASS_11",
  "CLASS_12",
  "DROPPER",
  "BTECH_YEAR_1",
  "BTECH_YEAR_2",
  "BTECH_YEAR_3",
  "BTECH_YEAR_4",
] as const;
export type EducationStage = (typeof EDUCATION_STAGES)[number];

/**
 * Private per-student profile. Protected by Row-Level Security on (org_id, user_id).
 * Under-18 users cannot create or update a profile until their account_status is `active`.
 */
export const studentProfiles = studentSchema.table(
  "profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    educationStage: varchar("education_stage", { length: 32 }).$type<EducationStage>().notNull(),
    academicBoard: varchar("academic_board", { length: 32 }).$type<AcademicBoard>().notNull(),
    currentSemester: integer("current_semester"),
    targetExams: jsonb("target_exams").$type<string[]>().notNull().default([]),
    interests: jsonb("interests").$type<string[]>().notNull().default([]),
    preferredStates: jsonb("preferred_states").$type<string[]>().notNull().default([]),
    careerGoalSummary: text("career_goal_summary"),
    selectedBranchSlug: varchar("selected_branch_slug", { length: 64 }),
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("student_profiles_org_user_idx").on(table.orgId, table.userId),
    index("student_profiles_user_idx").on(table.userId),
  ],
);

export type StudentProfile = typeof studentProfiles.$inferSelect;
export type NewStudentProfile = typeof studentProfiles.$inferInsert;

/**
 * Student discovery assessment responses. Protected by Row-Level Security on (org_id, user_id).
 */
export const assessmentResponses = studentSchema.table(
  "assessment_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    answers: jsonb("answers").$type<Record<string, number>>().notNull(),
    dimensionScores: jsonb("dimension_scores").$type<DimensionVector>().notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("student_assessment_responses_user_idx").on(table.orgId, table.userId, table.submittedAt),
  ],
);

/**
 * Explainable branch-fit recommendation snapshots. Pinned to `algorithm_version`
 * and `content_release_id` so results are 100% reproducible.
 */
export const studentRecommendations = studentSchema.table(
  "recommendations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assessmentResponseId: uuid("assessment_response_id")
      .notNull()
      .references(() => assessmentResponses.id, { onDelete: "cascade" }),
    contentReleaseId: uuid("content_release_id").references(() => contentReleases.id, {
      onDelete: "set null",
    }),
    algorithmVersion: varchar("algorithm_version", { length: 32 }).notNull(),
    dimensionScores: jsonb("dimension_scores").$type<DimensionVector>().notNull(),
    rankedBranches: jsonb("ranked_branches").$type<RankedBranchRecommendation[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("student_recommendations_user_idx").on(table.orgId, table.userId, table.createdAt),
  ],
);

export type AssessmentResponse = typeof assessmentResponses.$inferSelect;
export type StudentRecommendation = typeof studentRecommendations.$inferSelect;
