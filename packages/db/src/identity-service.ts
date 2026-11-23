import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import type { Database } from "./client";
import { withRequestContext } from "./context";
import {
  auditLogs,
  guardianConsents,
  organizations,
  orgMemberships,
  rateLimitBuckets,
  sessions,
  studentProfiles,
  users,
  verifications,
  type AcademicBoard,
  type EducationStage,
  type GuardianConsent,
  type StudentProfile,
  type User,
} from "./schema";
import {
  assertStudentDataAccessAllowed,
  calculateAgeYears,
  isMinorByDob,
  MAX_ALLOWED_AGE_YEARS,
  MIN_ALLOWED_AGE_YEARS,
  nextStatusAfterEmailVerification,
} from "@lockin/domain/consent";
import {
  generateOpaqueToken,
  generateSixDigitOtp,
  hashPassword,
  safeEqualHex,
  sha256Hex,
  verifyPassword,
} from "@lockin/domain/identity";
import { buildPersonalOrgSlug } from "@lockin/domain/organization";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
} from "@lockin/domain/shared";

export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
export const OTP_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const GUARDIAN_CONSENT_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours
export const UNAPPROVED_MINOR_PURGE_DAYS = 14;
export const PRIVACY_NOTICE_VERSION = "2026-11-v1";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Atomic Postgres rate limiter. Blocks brute-force login and OTP guessing across processes.
 */
export async function checkRateLimit(
  db: Database,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowCutoff = new Date(now.getTime() - windowSeconds * 1000);

  const [row] = await db
    .insert(rateLimitBuckets)
    .values({ key, count: 1, windowStartedAt: now })
    .onConflictDoUpdate({
      target: rateLimitBuckets.key,
      set: {
        count: sql`CASE WHEN ${rateLimitBuckets.windowStartedAt} < ${windowCutoff.toISOString()}::timestamptz THEN 1 ELSE ${rateLimitBuckets.count} + 1 END`,
        windowStartedAt: sql`CASE WHEN ${rateLimitBuckets.windowStartedAt} < ${windowCutoff.toISOString()}::timestamptz THEN ${now.toISOString()}::timestamptz ELSE ${rateLimitBuckets.windowStartedAt} END`,
      },
    })
    .returning();

  const count = row?.count ?? 1;
  const started = row?.windowStartedAt ?? now;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: new Date(started.getTime() + windowSeconds * 1000),
  };
}

export interface RegisterUserInput {
  email: string;
  fullName: string;
  password: string;
  dateOfBirth: string;
  preferredLocale?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RegisterUserOutput {
  user: User;
  orgId: string;
  sessionToken: string;
  csrfToken: string;
  verificationOtp: string;
  verificationToken: string;
}

/**
 * Register a user, create their personal organization, issue an email verification OTP,
 * and open an authenticated session so they can complete verification & guardian approval.
 */
export async function registerUser(
  db: Database,
  input: RegisterUserInput,
  referenceDate: Date = new Date(),
): Promise<RegisterUserOutput> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const age = calculateAgeYears(input.dateOfBirth, referenceDate);

  if (age < MIN_ALLOWED_AGE_YEARS || age > MAX_ALLOWED_AGE_YEARS) {
    throw new ValidationError("Invalid date of birth.", {
      dateOfBirth: [
        `Age must be between ${MIN_ALLOWED_AGE_YEARS} and ${MAX_ALLOWED_AGE_YEARS} years.`,
      ],
    });
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing) {
    throw new ConflictError("An account with this email address already exists.");
  }

  const passwordHash = await hashPassword(input.password);
  const isMinor = isMinorByDob(input.dateOfBirth, referenceDate);
  const verificationOtp = generateSixDigitOtp();
  const verificationToken = generateOpaqueToken(32);
  const sessionToken = generateOpaqueToken(32);
  const csrfToken = generateOpaqueToken(24);

  return db.transaction(async (tx) => {
    const [createdUser] = await tx
      .insert(users)
      .values({
        email: normalizedEmail,
        fullName,
        passwordHash,
        dateOfBirth: input.dateOfBirth,
        isMinor,
        accountStatus: "pending_verification",
        preferredLocale: input.preferredLocale ?? "en",
      })
      .returning();

    if (!createdUser) {
      throw new Error("Failed to insert user");
    }

    const orgSlug = buildPersonalOrgSlug(fullName, createdUser.id);
    const [createdOrg] = await tx
      .insert(organizations)
      .values({
        slug: orgSlug,
        name: `${fullName}'s Workspace`,
        type: "personal",
        ownerUserId: createdUser.id,
      })
      .returning();

    if (!createdOrg) {
      throw new Error("Failed to insert personal organization");
    }

    await tx.insert(orgMemberships).values({
      orgId: createdOrg.id,
      userId: createdUser.id,
      role: "owner",
    });

    await tx.insert(verifications).values({
      userId: createdUser.id,
      purpose: "email_verify",
      targetEmail: normalizedEmail,
      tokenHash: sha256Hex(verificationToken),
      otpHash: sha256Hex(verificationOtp),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    await tx.insert(sessions).values({
      userId: createdUser.id,
      activeOrgId: createdOrg.id,
      tokenHash: sha256Hex(sessionToken),
      csrfToken,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });

    await tx.insert(auditLogs).values({
      actorUserId: createdUser.id,
      actorType: "user",
      action: "identity.user_registered",
      targetType: "user",
      targetId: createdUser.id,
      orgId: createdOrg.id,
      ipAddress: input.ipAddress ?? null,
      metadata: { isMinor, accountStatus: createdUser.accountStatus },
    });

    return {
      user: createdUser,
      orgId: createdOrg.id,
      sessionToken,
      csrfToken,
      verificationOtp,
      verificationToken,
    };
  });
}

/**
 * Verify a user's email address with their 6-digit OTP and advance their account status:
 * - Adults (18+) -> `active`
 * - Minors (<18) -> `pending_guardian`
 */
export async function verifyEmailWithOtp(
  db: Database,
  params: { userId: string; otp: string; ipAddress?: string },
): Promise<User> {
  const cleanOtp = params.otp.trim();
  const [challenge] = await db
    .select()
    .from(verifications)
    .where(
      and(
        eq(verifications.userId, params.userId),
        eq(verifications.purpose, "email_verify"),
        isNull(verifications.consumedAt),
        gt(verifications.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(verifications.createdAt))
    .limit(1);

  if (!challenge) {
    throw new ValidationError(
      "Verification code has expired or is invalid. Please request a new code.",
    );
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    throw new ForbiddenError(
      "Too many incorrect attempts. Please request a new verification code.",
    );
  }

  const matches = safeEqualHex(challenge.otpHash, sha256Hex(cleanOtp));
  if (!matches) {
    await db
      .update(verifications)
      .set({ attempts: challenge.attempts + 1 })
      .where(eq(verifications.id, challenge.id));
    throw new ValidationError("Incorrect verification code.", {
      otp: ["The 6-digit code you entered does not match."],
    });
  }

  return db.transaction(async (tx) => {
    const [currentUser] = await tx.select().from(users).where(eq(users.id, params.userId)).limit(1);

    if (!currentUser) {
      throw new NotFoundError("User not found.");
    }

    const nextStatus =
      currentUser.accountStatus === "pending_verification"
        ? nextStatusAfterEmailVerification(currentUser.isMinor)
        : currentUser.accountStatus;

    await tx
      .update(verifications)
      .set({ consumedAt: new Date() })
      .where(eq(verifications.id, challenge.id));

    const [updatedUser] = await tx
      .update(users)
      .set({
        emailVerifiedAt: currentUser.emailVerifiedAt ?? new Date(),
        accountStatus: nextStatus,
      })
      .where(eq(users.id, currentUser.id))
      .returning();

    await tx.insert(auditLogs).values({
      actorUserId: currentUser.id,
      actorType: "user",
      action: "identity.email_verified",
      targetType: "user",
      targetId: currentUser.id,
      ipAddress: params.ipAddress ?? null,
      metadata: { nextStatus },
    });

    return updatedUser!;
  });
}

export interface SignInOutput {
  user: User;
  orgId: string;
  sessionToken: string;
  csrfToken: string;
}

export async function signInWithPassword(
  db: Database,
  params: { email: string; password: string; ipAddress?: string; userAgent?: string },
): Promise<SignInOutput> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);

  if (!user || !(await verifyPassword(params.password, user.passwordHash))) {
    throw new UnauthenticatedError("Invalid email address or password.");
  }

  if (user.accountStatus === "suspended") {
    throw new ForbiddenError("This account has been suspended.");
  }

  const [membership] = await db
    .select()
    .from(orgMemberships)
    .where(eq(orgMemberships.userId, user.id))
    .limit(1);

  if (!membership) {
    throw new Error("User has no organization membership");
  }

  const sessionToken = generateOpaqueToken(32);
  const csrfToken = generateOpaqueToken(24);

  await db.insert(sessions).values({
    userId: user.id,
    activeOrgId: membership.orgId,
    tokenHash: sha256Hex(sessionToken),
    csrfToken,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });

  await db.insert(auditLogs).values({
    actorUserId: user.id,
    actorType: "user",
    action: "identity.signed_in",
    targetType: "user",
    targetId: user.id,
    orgId: membership.orgId,
    ipAddress: params.ipAddress ?? null,
  });

  return { user, orgId: membership.orgId, sessionToken, csrfToken };
}

export interface ActiveSession {
  sessionId: string;
  csrfToken: string;
  orgId: string;
  user: User;
}

export async function getSessionByToken(
  db: Database,
  rawSessionToken: string,
): Promise<ActiveSession | null> {
  if (!rawSessionToken) return null;
  const tokenHash = sha256Hex(rawSessionToken);

  const [row] = await db
    .select({
      sessionId: sessions.id,
      csrfToken: sessions.csrfToken,
      orgId: sessions.activeOrgId,
      expiresAt: sessions.expiresAt,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row) return null;
  return {
    sessionId: row.sessionId,
    csrfToken: row.csrfToken,
    orgId: row.orgId,
    user: row.user,
  };
}

export async function signOutByToken(db: Database, rawSessionToken: string): Promise<void> {
  if (!rawSessionToken) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256Hex(rawSessionToken)));
}

export interface RequestGuardianConsentInput {
  studentUserId: string;
  guardianFullName: string;
  guardianEmail: string;
  relationship: string;
  ipAddress?: string;
}

export interface RequestGuardianConsentOutput {
  otp: string;
  approvalToken: string;
  guardianEmail: string;
  guardianFullName: string;
}

/**
 * Issue a guardian consent challenge (6-digit OTP + link token) for an under-18 student.
 */
export async function requestGuardianConsent(
  db: Database,
  input: RequestGuardianConsentInput,
): Promise<RequestGuardianConsentOutput> {
  const [student] = await db.select().from(users).where(eq(users.id, input.studentUserId)).limit(1);

  if (!student) {
    throw new NotFoundError("Student account not found.");
  }
  if (!student.isMinor) {
    throw new ValidationError("Guardian consent is only required for students under 18.");
  }

  const guardianEmail = input.guardianEmail.trim().toLowerCase();
  if (guardianEmail === student.email) {
    throw new ValidationError(
      "Guardian email must be different from the student's email address.",
      {
        guardianEmail: ["Please enter a parent or legal guardian's email address."],
      },
    );
  }

  const otp = generateSixDigitOtp();
  const approvalToken = generateOpaqueToken(32);
  const guardianFullName = input.guardianFullName.trim();
  const relationship = input.relationship.trim();

  await db.insert(verifications).values({
    userId: student.id,
    purpose: "guardian_consent",
    targetEmail: guardianEmail,
    tokenHash: sha256Hex(approvalToken),
    otpHash: sha256Hex(otp),
    metadata: { guardianFullName, relationship },
    expiresAt: new Date(Date.now() + GUARDIAN_CONSENT_TTL_MS),
  });

  await db.insert(auditLogs).values({
    actorUserId: student.id,
    actorType: "user",
    action: "consent.guardian_invite_sent",
    targetType: "user",
    targetId: student.id,
    ipAddress: input.ipAddress ?? null,
    metadata: { guardianEmail, relationship },
  });

  return { otp, approvalToken, guardianEmail, guardianFullName };
}

export interface GrantGuardianConsentInput {
  studentUserId: string;
  otp: string;
  guardianFullNameConfirmed: string;
  noticeLocale?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface GrantGuardianConsentOutput {
  consent: GuardianConsent;
  portalToken: string;
  student: User;
}

/**
 * Verify the guardian's 6-digit OTP, append an immutable consent record to
 * `system.guardian_consents`, activate the minor's account, and return a
 * guardian portal token so the parent can view/export/revoke later.
 */
export async function grantGuardianConsentWithOtp(
  db: Database,
  input: GrantGuardianConsentInput,
): Promise<GrantGuardianConsentOutput> {
  const cleanOtp = input.otp.trim();
  const confirmedName = input.guardianFullNameConfirmed.trim();
  if (confirmedName.length < 2) {
    throw new ValidationError(
      "Please type the parent or guardian's full name to confirm consent.",
      {
        guardianFullNameConfirmed: ["Full name is required."],
      },
    );
  }

  const [challenge] = await db
    .select()
    .from(verifications)
    .where(
      and(
        eq(verifications.userId, input.studentUserId),
        eq(verifications.purpose, "guardian_consent"),
        isNull(verifications.consumedAt),
        gt(verifications.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(verifications.createdAt))
    .limit(1);

  if (!challenge) {
    throw new ValidationError(
      "Guardian consent code has expired or was not found. Please send a new code.",
    );
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    throw new ForbiddenError(
      "Too many incorrect OTP attempts. Please request a fresh guardian code.",
    );
  }

  if (!safeEqualHex(challenge.otpHash, sha256Hex(cleanOtp))) {
    await db
      .update(verifications)
      .set({ attempts: challenge.attempts + 1 })
      .where(eq(verifications.id, challenge.id));
    throw new ValidationError("Incorrect 6-digit guardian code.", {
      otp: ["The code does not match the one sent to the guardian's email."],
    });
  }

  const portalToken = generateOpaqueToken(32);
  const meta = challenge.metadata as { relationship?: string };

  return db.transaction(async (tx) => {
    await tx
      .update(verifications)
      .set({ consumedAt: new Date() })
      .where(eq(verifications.id, challenge.id));

    const [consent] = await tx
      .insert(guardianConsents)
      .values({
        studentUserId: input.studentUserId,
        guardianFullName: confirmedName,
        guardianEmail: challenge.targetEmail,
        relationship: meta.relationship ?? "Parent / Legal Guardian",
        action: "granted",
        verificationMethod: "email_otp",
        noticeVersion: PRIVACY_NOTICE_VERSION,
        noticeLocale: input.noticeLocale ?? "en",
        portalTokenHash: sha256Hex(portalToken),
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      })
      .returning();

    const [updatedStudent] = await tx
      .update(users)
      .set({ accountStatus: "active" })
      .where(eq(users.id, input.studentUserId))
      .returning();

    await tx.insert(auditLogs).values({
      actorUserId: input.studentUserId,
      actorType: "guardian",
      action: "consent.guardian_granted",
      targetType: "user",
      targetId: input.studentUserId,
      ipAddress: input.ipAddress ?? null,
      metadata: {
        consentId: consent!.id,
        guardianEmail: challenge.targetEmail,
        noticeVersion: PRIVACY_NOTICE_VERSION,
      },
    });

    return {
      consent: consent!,
      portalToken,
      student: updatedStudent!,
    };
  });
}

/**
 * Look up a student's consent ledger and account summary using the guardian's portal token.
 */
export async function getGuardianPortalView(db: Database, rawPortalToken: string) {
  const tokenHash = sha256Hex(rawPortalToken.trim());
  const [grantRow] = await db
    .select()
    .from(guardianConsents)
    .where(eq(guardianConsents.portalTokenHash, tokenHash))
    .orderBy(desc(guardianConsents.recordedAt))
    .limit(1);

  if (!grantRow) {
    throw new NotFoundError("Invalid or expired guardian portal link.");
  }

  const [student] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      dateOfBirth: users.dateOfBirth,
      accountStatus: users.accountStatus,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, grantRow.studentUserId))
    .limit(1);

  if (!student) {
    throw new NotFoundError("Student account no longer exists.");
  }

  const history = await db
    .select()
    .from(guardianConsents)
    .where(eq(guardianConsents.studentUserId, student.id))
    .orderBy(desc(guardianConsents.recordedAt));

  return { student, guardian: grantRow, history };
}

/**
 * Guardian revokes consent: appends a `revoked` ledger entry, restricts the student
 * account, and invalidates all active student sessions.
 */
export async function revokeGuardianConsentByPortalToken(
  db: Database,
  params: { rawPortalToken: string; ipAddress?: string; userAgent?: string },
): Promise<GuardianConsent> {
  const view = await getGuardianPortalView(db, params.rawPortalToken);

  return db.transaction(async (tx) => {
    const [revokedEntry] = await tx
      .insert(guardianConsents)
      .values({
        studentUserId: view.student.id,
        guardianFullName: view.guardian.guardianFullName,
        guardianEmail: view.guardian.guardianEmail,
        relationship: view.guardian.relationship,
        action: "revoked",
        verificationMethod: "guardian_portal_token",
        noticeVersion: PRIVACY_NOTICE_VERSION,
        noticeLocale: view.guardian.noticeLocale,
        portalTokenHash: view.guardian.portalTokenHash,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      })
      .returning();

    await tx
      .update(users)
      .set({ accountStatus: "restricted" })
      .where(eq(users.id, view.student.id));

    await tx.delete(sessions).where(eq(sessions.userId, view.student.id));

    await tx.insert(auditLogs).values({
      actorUserId: view.student.id,
      actorType: "guardian",
      action: "consent.guardian_revoked",
      targetType: "user",
      targetId: view.student.id,
      ipAddress: params.ipAddress ?? null,
      metadata: { guardianEmail: view.guardian.guardianEmail },
    });

    return revokedEntry!;
  });
}

/**
 * Purge unapproved minor accounts older than 14 days (DPDP data minimization rule).
 */
export async function purgeExpiredUnapprovedMinors(
  db: Database,
  referenceDate: Date = new Date(),
): Promise<number> {
  const cutoff = new Date(
    referenceDate.getTime() - UNAPPROVED_MINOR_PURGE_DAYS * 24 * 60 * 60 * 1000,
  );

  const stale = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.isMinor, true),
        eq(users.accountStatus, "pending_guardian"),
        lt(users.createdAt, cutoff),
      ),
    );

  if (stale.length === 0) return 0;

  let purged = 0;
  for (const row of stale) {
    await db.transaction(async (tx) => {
      await tx.insert(auditLogs).values({
        actorUserId: null,
        actorType: "system",
        action: "consent.unapproved_minor_purged",
        targetType: "user",
        targetId: row.id,
        metadata: { retentionDays: UNAPPROVED_MINOR_PURGE_DAYS },
      });
      await tx.delete(users).where(eq(users.id, row.id));
      purged += 1;
    });
  }
  return purged;
}

export interface UpsertStudentProfileInput {
  userId: string;
  orgId: string;
  educationStage: EducationStage;
  academicBoard: AcademicBoard;
  currentSemester?: number | null;
  targetExams: string[];
  interests: string[];
  preferredStates: string[];
  careerGoalSummary?: string | null;
}

/**
 * Create or update a student's profile inside an RLS-scoped transaction.
 * Enforces `assertStudentDataAccessAllowed` so unverified users and minors without
 * guardian consent are blocked at the domain level as well as by RLS.
 */
export async function upsertStudentProfile(
  db: Database,
  input: UpsertStudentProfileInput,
): Promise<StudentProfile> {
  const [user] = await db
    .select({ accountStatus: users.accountStatus })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError("User not found.");
  }

  assertStudentDataAccessAllowed(user.accountStatus);

  return withRequestContext(db, { userId: input.userId, orgId: input.orgId }, async (tx) => {
    const [profile] = await tx
      .insert(studentProfiles)
      .values({
        orgId: input.orgId,
        userId: input.userId,
        educationStage: input.educationStage,
        academicBoard: input.academicBoard,
        currentSemester: input.currentSemester ?? null,
        targetExams: input.targetExams,
        interests: input.interests,
        preferredStates: input.preferredStates,
        careerGoalSummary: input.careerGoalSummary ?? null,
        onboardingCompleted: true,
      })
      .onConflictDoUpdate({
        target: [studentProfiles.orgId, studentProfiles.userId],
        set: {
          educationStage: sql`excluded.education_stage`,
          academicBoard: sql`excluded.academic_board`,
          currentSemester: sql`excluded.current_semester`,
          targetExams: sql`excluded.target_exams`,
          interests: sql`excluded.interests`,
          preferredStates: sql`excluded.preferred_states`,
          careerGoalSummary: sql`excluded.career_goal_summary`,
          onboardingCompleted: true,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    return profile!;
  });
}

/**
 * Fetch a student's own profile inside an RLS-scoped transaction.
 */
export async function getStudentProfile(
  db: Database,
  context: { userId: string; orgId: string },
): Promise<StudentProfile | null> {
  return withRequestContext(db, context, async (tx) => {
    const [profile] = await tx
      .select()
      .from(studentProfiles)
      .where(
        and(eq(studentProfiles.userId, context.userId), eq(studentProfiles.orgId, context.orgId)),
      )
      .limit(1);
    return profile ?? null;
  });
}
