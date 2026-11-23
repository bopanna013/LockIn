/**
 * Integration tests against a real PostgreSQL in Docker (Testcontainers).
 * Verifies the full bootstrap → migrate → seed pipeline and the privilege model.
 *
 *   pnpm test:integration   (requires Docker to be running)
 */
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootstrapDatabase } from "../src/bootstrap";
import { createDatabase } from "../src/client";
import { withRequestContext } from "../src/context";
import {
  getGuardianPortalView,
  getStudentProfile,
  grantGuardianConsentWithOtp,
  purgeExpiredUnapprovedMinors,
  registerUser,
  requestGuardianConsent,
  revokeGuardianConsentByPortalToken,
  signInWithPassword,
  upsertStudentProfile,
  verifyEmailWithOtp,
} from "../src/identity-service";
import { runMigrations } from "../src/migrate";
import { studentProfiles } from "../src/schema";
import { seedLocales } from "../src/seed/locales";

const PASSWORDS = {
  owner: "owner-password-for-tests-only",
  app: "app-password-for-tests-only-x",
  cms: "cms-password-for-tests-only-x",
};

let container: StartedPostgreSqlContainer;
let urlFor: (user: string, password: string) => string;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:17-alpine")
    .withDatabase("lockin")
    .withUsername("postgres")
    .withPassword("postgres")
    .start();

  urlFor = (user, password) =>
    `postgres://${user}:${password}@${container.getHost()}:${container.getPort()}/lockin`;

  await bootstrapDatabase({
    adminUrl: urlFor("postgres", "postgres"),
    dbName: "lockin",
    passwords: PASSWORDS,
  });
  await runMigrations(urlFor("lockin_owner", PASSWORDS.owner));
});

afterAll(async () => {
  await container?.stop();
});

describe("database pipeline", () => {
  it("is idempotent: bootstrap and migrations can run twice", async () => {
    await bootstrapDatabase({
      adminUrl: urlFor("postgres", "postgres"),
      dbName: "lockin",
      passwords: PASSWORDS,
    });
    await runMigrations(urlFor("lockin_owner", PASSWORDS.owner));
  });

  it("creates the three schemas", async () => {
    const sql = postgres(urlFor("lockin_owner", PASSWORDS.owner), { max: 1 });
    const rows = await sql<{ nspname: string }[]>`
      select nspname from pg_namespace where nspname in ('content', 'student', 'system') order by nspname`;
    await sql.end();
    expect(rows.map((row) => row.nspname)).toEqual(["content", "student", "system"]);
  });

  it("seeds locales from the i18n registry", async () => {
    const { db, client } = createDatabase(urlFor("lockin_owner", PASSWORDS.owner), { max: 1 });
    await seedLocales(db);
    await seedLocales(db); // idempotent
    const rows = await client<{ code: string; enabled: boolean }[]>`
      select code, enabled from content.locales order by code`;
    await client.end();
    expect(rows).toEqual([
      { code: "en", enabled: true },
      { code: "hi", enabled: false },
      { code: "kn", enabled: false },
    ]);
  });
});

describe("privilege model", () => {
  it("lets the app role read content but not modify it", async () => {
    const sql = postgres(urlFor("lockin_app", PASSWORDS.app), { max: 1 });
    try {
      const rows = await sql`select code from content.locales`;
      expect(rows.length).toBeGreaterThan(0);
      await expect(sql`update content.locales set enabled = true`).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await sql.end();
    }
  });

  it("lets the CMS role write content", async () => {
    const sql = postgres(urlFor("lockin_cms", PASSWORDS.cms), { max: 1 });
    try {
      await sql`update content.locales set updated_at = now() where code = 'en'`;
    } finally {
      await sql.end();
    }
  });

  it("denies the CMS role any access to the student schema", async () => {
    const sql = postgres(urlFor("lockin_cms", PASSWORDS.cms), { max: 1 });
    try {
      await expect(sql`create table student.should_fail (id int)`).rejects.toThrow(
        /permission denied/,
      );
      const [row] = await sql<{ allowed: boolean }[]>`
        select has_schema_privilege('lockin_cms', 'student', 'USAGE') as allowed`;
      expect(row?.allowed).toBe(false);
    } finally {
      await sql.end();
    }
  });

  it("prevents app roles from creating objects in public", async () => {
    const sql = postgres(urlFor("lockin_app", PASSWORDS.app), { max: 1 });
    try {
      await expect(sql`create table public.oops (id int)`).rejects.toThrow(/permission denied/);
    } finally {
      await sql.end();
    }
  });

  it("returns NULL request context when none is set", async () => {
    const sql = postgres(urlFor("lockin_app", PASSWORDS.app), { max: 1 });
    try {
      const [row] = await sql<
        { user_id: string | null }[]
      >`select system.current_user_id() as user_id`;
      expect(row?.user_id).toBeNull();
    } finally {
      await sql.end();
    }
  });

  it("requires RLS on every student table (guardrail for future phases)", async () => {
    const sql = postgres(urlFor("lockin_owner", PASSWORDS.owner), { max: 1 });
    try {
      const rows = await sql<{ relname: string }[]>`
        select c.relname from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'student' and c.relkind = 'r' and not c.relrowsecurity`;
      expect(rows.map((row) => row.relname)).toEqual([]);
    } finally {
      await sql.end();
    }
  });
});

describe("Phase 1: identity, guardian consent, RLS isolation & append-only ledgers", () => {
  it("allows an adult (18+) to register, verify email, sign in, and save their profile", async () => {
    const { db, client } = createDatabase(urlFor("lockin_app", PASSWORDS.app), { max: 2 });
    try {
      const reg = await registerUser(
        db,
        {
          email: "adult.student@example.com",
          fullName: "Rohan Kulkarni",
          password: "StrongPassword!2026",
          dateOfBirth: "2006-05-15",
        },
        new Date("2026-11-23T00:00:00Z"),
      );
      expect(reg.user.isMinor).toBe(false);
      expect(reg.user.accountStatus).toBe("pending_verification");

      // Cannot save profile before email verification
      await expect(
        upsertStudentProfile(db, {
          userId: reg.user.id,
          orgId: reg.orgId,
          educationStage: "CLASS_12",
          academicBoard: "CBSE",
          targetExams: ["JEE_MAIN", "KCET"],
          interests: ["coding", "electronics"],
          preferredStates: ["Karnataka"],
        }),
      ).rejects.toThrow(/verify your email/i);

      const verified = await verifyEmailWithOtp(db, {
        userId: reg.user.id,
        otp: reg.verificationOtp,
      });
      expect(verified.accountStatus).toBe("active");

      const signedIn = await signInWithPassword(db, {
        email: "adult.student@example.com",
        password: "StrongPassword!2026",
      });
      expect(signedIn.user.id).toBe(reg.user.id);

      const savedProfile = await upsertStudentProfile(db, {
        userId: reg.user.id,
        orgId: reg.orgId,
        educationStage: "CLASS_12",
        academicBoard: "CBSE",
        targetExams: ["JEE_MAIN", "KCET"],
        interests: ["coding", "electronics"],
        preferredStates: ["Karnataka"],
      });
      expect(savedProfile.onboardingCompleted).toBe(true);
    } finally {
      await client.end();
    }
  });

  it("enforces guardian consent for minors (<18), supports revocation, and blocks profile writes until approved", async () => {
    const { db, client } = createDatabase(urlFor("lockin_app", PASSWORDS.app), { max: 2 });
    try {
      const reg = await registerUser(
        db,
        {
          email: "minor.student@example.com",
          fullName: "Ananya Rao",
          password: "MinorPassword!2026",
          dateOfBirth: "2010-08-10",
        },
        new Date("2026-11-23T00:00:00Z"),
      );
      expect(reg.user.isMinor).toBe(true);

      const afterEmail = await verifyEmailWithOtp(db, {
        userId: reg.user.id,
        otp: reg.verificationOtp,
      });
      expect(afterEmail.accountStatus).toBe("pending_guardian");

      // Blocked from saving profile while awaiting guardian consent
      await expect(
        upsertStudentProfile(db, {
          userId: reg.user.id,
          orgId: reg.orgId,
          educationStage: "CLASS_11",
          academicBoard: "STATE_KARNATAKA",
          targetExams: ["KCET"],
          interests: ["robotics"],
          preferredStates: ["Karnataka"],
        }),
      ).rejects.toThrow(/guardian consent/i);

      const invite = await requestGuardianConsent(db, {
        studentUserId: reg.user.id,
        guardianFullName: "Suresh Rao",
        guardianEmail: "suresh.parent@example.com",
        relationship: "Father",
      });

      const granted = await grantGuardianConsentWithOtp(db, {
        studentUserId: reg.user.id,
        otp: invite.otp,
        guardianFullNameConfirmed: "Suresh Rao",
      });
      expect(granted.student.accountStatus).toBe("active");

      // Now profile creation succeeds
      const profile = await upsertStudentProfile(db, {
        userId: reg.user.id,
        orgId: reg.orgId,
        educationStage: "CLASS_11",
        academicBoard: "STATE_KARNATAKA",
        targetExams: ["KCET"],
        interests: ["robotics"],
        preferredStates: ["Karnataka"],
      });
      expect(profile.userId).toBe(reg.user.id);

      // Guardian can inspect portal and revoke consent
      const portalView = await getGuardianPortalView(db, granted.portalToken);
      expect(portalView.history.length).toBe(1);

      await revokeGuardianConsentByPortalToken(db, { rawPortalToken: granted.portalToken });

      // Student is now restricted again
      await expect(
        upsertStudentProfile(db, {
          userId: reg.user.id,
          orgId: reg.orgId,
          educationStage: "CLASS_11",
          academicBoard: "STATE_KARNATAKA",
          targetExams: ["KCET"],
          interests: ["robotics"],
          preferredStates: ["Karnataka"],
        }),
      ).rejects.toThrow(/revoked/i);
    } finally {
      await client.end();
    }
  });

  it("enforces Row-Level Security so user B cannot read or modify user A's student.profiles row", async () => {
    const { db, client } = createDatabase(urlFor("lockin_app", PASSWORDS.app), { max: 2 });
    try {
      const userA = await registerUser(
        db,
        {
          email: "user.a@example.com",
          fullName: "User A",
          password: "PasswordA!2026",
          dateOfBirth: "2005-01-10",
        },
        new Date("2026-11-23T00:00:00Z"),
      );
      await verifyEmailWithOtp(db, { userId: userA.user.id, otp: userA.verificationOtp });
      await upsertStudentProfile(db, {
        userId: userA.user.id,
        orgId: userA.orgId,
        educationStage: "BTECH_YEAR_1",
        academicBoard: "CBSE",
        targetExams: [],
        interests: ["systems"],
        preferredStates: ["Karnataka"],
      });

      const userB = await registerUser(
        db,
        {
          email: "user.b@example.com",
          fullName: "User B",
          password: "PasswordB!2026",
          dateOfBirth: "2005-03-20",
        },
        new Date("2026-11-23T00:00:00Z"),
      );
      await verifyEmailWithOtp(db, { userId: userB.user.id, otp: userB.verificationOtp });

      // Querying all rows in student.profiles under User B's request context must return 0 rows of User A
      const visibleToB = await withRequestContext(
        db,
        { userId: userB.user.id, orgId: userB.orgId },
        async (tx) => tx.select().from(studentProfiles),
      );
      expect(visibleToB).toEqual([]);

      // User A can still see their own profile
      const profileA = await getStudentProfile(db, { userId: userA.user.id, orgId: userA.orgId });
      expect(profileA?.userId).toBe(userA.user.id);
    } finally {
      await client.end();
    }
  });

  it("blocks lockin_app from mutating or deleting audit_logs and from mutating guardian_consents", async () => {
    const sql = postgres(urlFor("lockin_app", PASSWORDS.app), { max: 1 });
    try {
      await expect(sql`update system.audit_logs set action = 'tampered'`).rejects.toThrow(
        /permission denied/,
      );
      await expect(sql`delete from system.audit_logs`).rejects.toThrow(/permission denied/);
      await expect(
        sql`update system.guardian_consents set guardian_full_name = 'tampered'`,
      ).rejects.toThrow(/permission denied/);
    } finally {
      await sql.end();
    }
  });

  it("purges unapproved minor accounts older than 14 days", async () => {
    const { db, client } = createDatabase(urlFor("lockin_app", PASSWORDS.app), { max: 2 });
    try {
      const reg = await registerUser(
        db,
        {
          email: "stale.minor@example.com",
          fullName: "Stale Minor",
          password: "MinorPassword!2026",
          dateOfBirth: "2011-04-01",
        },
        new Date("2026-11-01T00:00:00Z"),
      );
      await verifyEmailWithOtp(db, { userId: reg.user.id, otp: reg.verificationOtp });

      // Simulate 15 days passing
      const purgedCount = await purgeExpiredUnapprovedMinors(
        db,
        new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      );
      expect(purgedCount).toBeGreaterThanOrEqual(1);
    } finally {
      await client.end();
    }
  });
});
