import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { systemSchema } from "./schemas";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const USER_ACCOUNT_STATUSES = [
  "pending_verification",
  "pending_guardian",
  "active",
  "restricted",
  "suspended",
] as const;
export type UserAccountStatus = (typeof USER_ACCOUNT_STATUSES)[number];

export const GLOBAL_ROLES = ["admin", "editor", "translator"] as const;
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

export const ORGANIZATION_TYPES = ["personal", "institution"] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const ORG_ROLES = ["owner", "org_admin", "counselor", "student"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/**
 * Platform users. Minors (< 18) remain in `pending_guardian` status until a
 * verifiable guardian consent record is appended to `guardian_consents`.
 */
export const users = systemSchema.table(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    dateOfBirth: date("date_of_birth", { mode: "string" }).notNull(),
    isMinor: boolean("is_minor").notNull().default(false),
    accountStatus: varchar("account_status", { length: 32 })
      .$type<UserAccountStatus>()
      .notNull()
      .default("pending_verification"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    globalRoles: jsonb("global_roles").$type<GlobalRole[]>().notNull().default([]),
    preferredLocale: varchar("preferred_locale", { length: 8 }).notNull().default("en"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_email_lower_idx").on(table.email),
    index("users_account_status_idx").on(table.accountStatus),
  ],
);

/**
 * Organizations. Every user gets a `personal` organization on sign-up (Option B tenancy),
 * so every `student.*` table is scoped by `(org_id, user_id)` from day one.
 */
export const organizations = systemSchema.table(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 96 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    type: varchar("type", { length: 24 }).$type<OrganizationType>().notNull().default("personal"),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("organizations_slug_idx").on(table.slug),
    index("organizations_owner_idx").on(table.ownerUserId),
  ],
);

/**
 * Organization memberships.
 */
export const orgMemberships = systemSchema.table(
  "org_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 24 }).$type<OrgRole>().notNull().default("owner"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("org_memberships_org_user_idx").on(table.orgId, table.userId),
    index("org_memberships_user_idx").on(table.userId),
  ],
);

/**
 * Active sessions. The raw session token is stored only in an HttpOnly cookie;
 * only its SHA-256 hash (`token_hash`) is persisted in the database.
 */
export const sessions = systemSchema.table(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activeOrgId: uuid("active_org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    csrfToken: varchar("csrf_token", { length: 64 }).notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: varchar("user_agent", { length: 512 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
    index("sessions_expires_idx").on(table.expiresAt),
  ],
);

export const VERIFICATION_PURPOSES = [
  "email_verify",
  "password_reset",
  "guardian_consent",
  "guardian_portal",
] as const;
export type VerificationPurpose = (typeof VERIFICATION_PURPOSES)[number];

/**
 * Single-use verification challenges (email verification, password reset, guardian OTP).
 * Both the link token and the 6-digit OTP are stored as SHA-256 hashes.
 */
export const verifications = systemSchema.table(
  "verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: varchar("purpose", { length: 32 }).$type<VerificationPurpose>().notNull(),
    targetEmail: varchar("target_email", { length: 255 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    otpHash: varchar("otp_hash", { length: 64 }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("verifications_token_hash_idx").on(table.tokenHash),
    index("verifications_user_purpose_idx").on(table.userId, table.purpose),
  ],
);

export const GUARDIAN_CONSENT_ACTIONS = ["granted", "revoked", "self_reconsented_at_18"] as const;
export type GuardianConsentAction = (typeof GUARDIAN_CONSENT_ACTIONS)[number];

/**
 * Append-only ledger of guardian consent events (India DPDP Act 2023 Section 9).
 * Rows in this table are never updated or deleted during normal operation.
 */
export const guardianConsents = systemSchema.table(
  "guardian_consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentUserId: uuid("student_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    guardianFullName: varchar("guardian_full_name", { length: 160 }).notNull(),
    guardianEmail: varchar("guardian_email", { length: 255 }).notNull(),
    relationship: varchar("relationship", { length: 64 }).notNull(),
    action: varchar("action", { length: 32 }).$type<GuardianConsentAction>().notNull(),
    verificationMethod: varchar("verification_method", { length: 32 }).notNull(),
    noticeVersion: varchar("notice_version", { length: 32 }).notNull(),
    noticeLocale: varchar("notice_locale", { length: 8 }).notNull().default("en"),
    portalTokenHash: varchar("portal_token_hash", { length: 64 }).notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: varchar("user_agent", { length: 512 }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("guardian_consents_student_idx").on(table.studentUserId, table.recordedAt),
    index("guardian_consents_portal_token_idx").on(table.portalTokenHash),
  ],
);

/**
 * Append-only audit log for security- and privacy-sensitive events.
 */
export const auditLogs = systemSchema.table(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorType: varchar("actor_type", { length: 24 }).notNull(),
    action: varchar("action", { length: 96 }).notNull(),
    targetType: varchar("target_type", { length: 64 }).notNull(),
    targetId: varchar("target_id", { length: 128 }).notNull(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }),
    ipAddress: varchar("ip_address", { length: 64 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_actor_idx").on(table.actorUserId, table.occurredAt),
    index("audit_logs_target_idx").on(table.targetType, table.targetId),
    index("audit_logs_action_idx").on(table.action, table.occurredAt),
  ],
);

/**
 * Lightweight DB-backed rate limiter buckets (works across processes without Redis).
 */
export const rateLimitBuckets = systemSchema.table("rate_limit_buckets", {
  key: varchar("key", { length: 160 }).primaryKey(),
  count: integer("count").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type OrgMembership = typeof orgMemberships.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Verification = typeof verifications.$inferSelect;
export type GuardianConsent = typeof guardianConsents.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
