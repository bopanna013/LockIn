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
