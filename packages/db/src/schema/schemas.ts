import { pgSchema } from "drizzle-orm/pg-core";

/**
 * The three Postgres schemas. Keeping them separate is the core rule of LOCKIN's
 * data architecture — see docs/adr/0003-content-student-data-separation.md.
 */

/** Shared educational content: versioned, editor-managed, never per-student. */
export const contentSchema = pgSchema("content");

/** Private per-student data. Every table here MUST have org_id + user_id and RLS enabled. */
export const studentSchema = pgSchema("student");

/** Platform data: users, organizations, sessions, consents, audit log, jobs. */
export const systemSchema = pgSchema("system");
