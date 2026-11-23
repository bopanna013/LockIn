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
import {
  cmsPublishContentRelease,
  cmsUpsertBranch,
  getPublishedBranchBySlug,
  listPublishedBranches,
  listPublishedEntranceExams,
} from "../src/catalog-service";
import { createDatabase } from "../src/client";
import { withRequestContext } from "../src/context";
import {
  getLatestStudentRecommendation,
  selectStudentBranch,
  submitDiscoveryAssessment,
} from "../src/discovery-service";
import { deleteStudentAccountAndData, exportStudentPersonalData } from "../src/privacy-service";
import {
  addCustomRoadmapItem,
  generateStudentRoadmap,
  getStudentRoadmap,
  syncRoadmapWithLatestRelease,
  updateRoadmapItemProgress,
} from "../src/roadmap-service";
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
import { studentProfiles, studentRecommendations, studentRoadmaps } from "../src/schema";
import { seedCatalogContent } from "../src/seed/catalog";
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

describe("Phase 2: India B.E./B.Tech content catalog, locale fallback & CMS workflow", () => {
  it("seeds 10 branches, 5 exams, and 8-semester roadmap templates and reads them via lockin_app", async () => {
    const ownerConn = createDatabase(urlFor("lockin_owner", PASSWORDS.owner), { max: 1 });
    try {
      await seedLocales(ownerConn.db);
      const summary = await seedCatalogContent(ownerConn.db);
      expect(summary.branchesCount).toBe(10);
      expect(summary.examsCount).toBe(5);
    } finally {
      await ownerConn.client.end();
    }

    const appConn = createDatabase(urlFor("lockin_app", PASSWORDS.app), { max: 1 });
    try {
      const branches = await listPublishedBranches(appConn.db, "en");
      expect(branches.length).toBe(10);

      // Requesting Kannada ("kn") before translation falls back cleanly to English ("en")
      const knFallback = await listPublishedBranches(appConn.db, "kn");
      expect(knFallback.length).toBe(10);
      expect(knFallback[0]?.isFallbackTranslation).toBe(true);

      const cse = await getPublishedBranchBySlug(appConn.db, "computer-science-engineering", "en");
      expect(cse?.code).toBe("CSE");
      expect(cse?.roadmapMilestones.length).toBe(8);
      expect(cse?.entranceExams.map((e) => e.slug)).toContain("kcet");

      const exams = await listPublishedEntranceExams(appConn.db, "en");
      expect(exams.length).toBe(5);
    } finally {
      await appConn.client.end();
    }
  });

  it("allows an editor using lockin_cms to create drafts, publish branches, and cut a new content release", async () => {
    const cmsConn = createDatabase(urlFor("lockin_cms", PASSWORDS.cms), { max: 1 });
    const appConn = createDatabase(urlFor("lockin_app", PASSWORDS.app), { max: 1 });
    try {
      const editorActor = {
        type: "user" as const,
        userId: "00000000-0000-0000-0000-000000000001",
        orgId: "00000000-0000-0000-0000-000000000002",
        globalRoles: ["editor" as const],
      };

      await cmsUpsertBranch(cmsConn.db, editorActor, {
        slug: "mechatronics-engineering",
        code: "MTR",
        category: "Core & Manufacturing",
        entrySalaryMinInr: 480000,
        entrySalaryMaxInr: 1400000,
        midCareerSalaryMaxInr: 3100000,
        entranceExamSlugs: ["jee-main", "kcet", "comedk"],
        status: "draft",
        locale: "en",
        title: "Mechatronics Engineering",
        shortSummary:
          "Synergy of mechanical design, electronics, sensors, and intelligent control.",
        overview:
          "Mechatronics integrates mechanical systems with embedded electronics and robotics.",
        whoItSuits: "Students who enjoy building robots, drones, and automated physical systems.",
        coreSubjects: ["Robotics", "Control Systems", "PLC & Automation"],
        keySkills: ["ROS2", "Embedded C", "CAD"],
        careerRoles: ["Robotics Engineer", "Automation Engineer"],
        topRecruitersIndia: ["ABB", "Fanuc India", "Bosch"],
        higherStudiesPaths: ["M.Tech Robotics & Mechatronics"],
      });

      // Draft branch must NOT appear in public listPublishedBranches
      const publicBeforePublish = await listPublishedBranches(appConn.db, "en");
      expect(publicBeforePublish.some((b) => b.slug === "mechatronics-engineering")).toBe(false);

      // Editor promotes draft -> published and cuts release v2
      await cmsUpsertBranch(cmsConn.db, editorActor, {
        slug: "mechatronics-engineering",
        code: "MTR",
        category: "Core & Manufacturing",
        entrySalaryMinInr: 480000,
        entrySalaryMaxInr: 1400000,
        midCareerSalaryMaxInr: 3100000,
        entranceExamSlugs: ["jee-main", "kcet", "comedk"],
        status: "published",
        locale: "en",
        title: "Mechatronics Engineering",
        shortSummary:
          "Synergy of mechanical design, electronics, sensors, and intelligent control.",
        overview:
          "Mechatronics integrates mechanical systems with embedded electronics and robotics.",
        whoItSuits: "Students who enjoy building robots, drones, and automated physical systems.",
        coreSubjects: ["Robotics", "Control Systems", "PLC & Automation"],
        keySkills: ["ROS2", "Embedded C", "CAD"],
        careerRoles: ["Robotics Engineer", "Automation Engineer"],
        topRecruitersIndia: ["ABB", "Fanuc India", "Bosch"],
        higherStudiesPaths: ["M.Tech Robotics & Mechatronics"],
      });

      const release = await cmsPublishContentRelease(cmsConn.db, editorActor, {
        label: "2026.11 Add Mechatronics Branch",
        publishedByEmail: "editor@lockin.home.arpa",
      });
      expect(release.versionNumber).toBe(2);
      expect(release.isActive).toBe(true);

      const publicAfterPublish = await listPublishedBranches(appConn.db, "en");
      expect(publicAfterPublish.some((b) => b.slug === "mechatronics-engineering")).toBe(true);
    } finally {
      await cmsConn.client.end();
      await appConn.client.end();
    }
  });
});

describe("Phase 3: discovery assessment, explainable recommendations & RLS isolation", () => {
  it("evaluates an assessment, ranks branches with explanations, pins algorithm/release version, and isolates via RLS", async () => {
    const appConn = createDatabase(urlFor("lockin_app", PASSWORDS.app), { max: 2 });
    try {
      const student1 = await registerUser(
        appConn.db,
        {
          email: "discover.student1@example.com",
          fullName: "Karthik Hegde",
          password: "DiscoverPassword!2026",
          dateOfBirth: "2006-02-14",
        },
        new Date("2026-11-23T00:00:00Z"),
      );
      await verifyEmailWithOtp(appConn.db, {
        userId: student1.user.id,
        otp: student1.verificationOtp,
      });

      const rec = await submitDiscoveryAssessment(appConn.db, {
        userId: student1.user.id,
        orgId: student1.orgId,
        locale: "en",
        answers: {
          q_elec_1: 5,
          q_elec_2: 5,
          q_math_1: 5,
          q_math_2: 4,
          q_phys_1: 4,
          q_phys_2: 4,
          q_prog_1: 3,
          q_prog_2: 3,
          q_chem_1: 1,
          q_chem_2: 1,
          q_bio_1: 1,
          q_bio_2: 1,
          q_des_1: 2,
          q_des_2: 2,
        },
      });

      expect(rec.algorithmVersion).toBe("2026.11-v1.0.0");
      expect(rec.contentReleaseId).toBeTruthy();
      expect(rec.rankedBranches.length).toBeGreaterThanOrEqual(10);
      expect(rec.rankedBranches[0]?.branchCode).toBe("ECE");
      expect(rec.rankedBranches[0]?.explanation).toContain("Matched because");

      await selectStudentBranch(appConn.db, {
        userId: student1.user.id,
        orgId: student1.orgId,
        branchSlug: rec.rankedBranches[0]!.branchSlug,
      });

      const profile1 = await getStudentProfile(appConn.db, {
        userId: student1.user.id,
        orgId: student1.orgId,
      });
      expect(profile1?.selectedBranchSlug).toBe("electronics-communication-engineering");

      // Another user cannot see student1's recommendations due to RLS
      const student2 = await registerUser(
        appConn.db,
        {
          email: "discover.student2@example.com",
          fullName: "Meera Nair",
          password: "DiscoverPassword!2026",
          dateOfBirth: "2006-07-19",
        },
        new Date("2026-11-23T00:00:00Z"),
      );
      await verifyEmailWithOtp(appConn.db, {
        userId: student2.user.id,
        otp: student2.verificationOtp,
      });

      const visibleToStudent2 = await withRequestContext(
        appConn.db,
        { userId: student2.user.id, orgId: student2.orgId },
        async (tx) => tx.select().from(studentRecommendations),
      );
      expect(visibleToStudent2).toEqual([]);

      const latestForStudent1 = await getLatestStudentRecommendation(appConn.db, {
        userId: student1.user.id,
        orgId: student1.orgId,
      });
      expect(latestForStudent1?.id).toBe(rec.id);
    } finally {
      await appConn.client.end();
    }
  });
});

describe("Phase 4 & 5: 4-year B.E./B.Tech roadmap planner, progress tracking & release immutability", () => {
  it("generates an 8-semester roadmap, tracks completion & custom goals, isolates via RLS, and protects existing roadmaps from CMS edits", async () => {
    const appConn = createDatabase(urlFor("lockin_app", PASSWORDS.app), { max: 2 });
    const cmsConn = createDatabase(urlFor("lockin_cms", PASSWORDS.cms), { max: 1 });
    try {
      const student = await registerUser(
        appConn.db,
        {
          email: "roadmap.student@example.com",
          fullName: "Pranav Deshpande",
          password: "RoadmapPassword!2026",
          dateOfBirth: "2006-09-12",
        },
        new Date("2026-11-23T00:00:00Z"),
      );
      await verifyEmailWithOtp(appConn.db, {
        userId: student.user.id,
        otp: student.verificationOtp,
      });

      const generated = await generateStudentRoadmap(appConn.db, {
        userId: student.user.id,
        orgId: student.orgId,
        branchSlug: "computer-science-engineering",
      });

      expect(generated.items).toHaveLength(8);
      expect(generated.progress.overallPercent).toBe(0);
      const pinnedReleaseVersion = generated.roadmap.templateReleaseVersion;

      // Mark Semester 1 item completed with evidence link and reflection
      const sem1Item = generated.items.find((i) => i.semester === 1)!;
      await updateRoadmapItemProgress(appConn.db, {
        userId: student.user.id,
        orgId: student.orgId,
        itemId: sem1Item.id,
        status: "completed",
        evidenceUrl: "https://github.com/student/sem1-c-lab",
        reflectionNotes: "Completed all data structure pointers and matrix labs.",
      });

      // Add a custom goal to Semester 3
      const custom = await addCustomRoadmapItem(appConn.db, {
        userId: student.user.id,
        orgId: student.orgId,
        semester: 3,
        category: "certifications",
        title: "NPTEL Design & Analysis of Algorithms (IIT Madras)",
        description: "Complete 12-week proctored NPTEL Elite certification.",
      });
      expect(custom.isCustom).toBe(true);

      // CMS publishes a new content release — student's roadmap stays pinned and shows update available
      const editorActor = {
        type: "user" as const,
        userId: "00000000-0000-0000-0000-000000000001",
        orgId: "00000000-0000-0000-0000-000000000002",
        globalRoles: ["editor" as const],
      };
      await cmsPublishContentRelease(cmsConn.db, editorActor, {
        label: "2026.11 Curriculum Revision v3",
        publishedByEmail: "editor@lockin.home.arpa",
      });

      const beforeSync = await getStudentRoadmap(appConn.db, {
        userId: student.user.id,
        orgId: student.orgId,
      });
      expect(beforeSync?.roadmap.templateReleaseVersion).toBe(pinnedReleaseVersion);
      expect(beforeSync?.hasTemplateUpdateAvailable).toBe(true);
      expect(beforeSync?.items).toHaveLength(9);
      expect(beforeSync?.progress.completedItems).toBe(1);

      // Non-destructive sync updates release version while preserving completed items and custom goals
      const syncResult = await syncRoadmapWithLatestRelease(appConn.db, {
        userId: student.user.id,
        orgId: student.orgId,
      });
      expect(syncResult.newReleaseVersion).toBeGreaterThan(pinnedReleaseVersion);

      const afterSync = await getStudentRoadmap(appConn.db, {
        userId: student.user.id,
        orgId: student.orgId,
      });
      expect(afterSync?.hasTemplateUpdateAvailable).toBe(false);
      expect(afterSync?.progress.completedItems).toBe(1);
      expect(afterSync?.items.some((i) => i.isCustom)).toBe(true);

      // Verify RLS blocks another user from reading student.roadmaps
      const outsider = await registerUser(
        appConn.db,
        {
          email: "outsider.roadmap@example.com",
          fullName: "Outsider Student",
          password: "OutsiderPassword!2026",
          dateOfBirth: "2006-04-04",
        },
        new Date("2026-11-23T00:00:00Z"),
      );
      const visibleToOutsider = await withRequestContext(
        appConn.db,
        { userId: outsider.user.id, orgId: outsider.orgId },
        async (tx) => tx.select().from(studentRoadmaps),
      );
      expect(visibleToOutsider).toEqual([]);
    } finally {
      await appConn.client.end();
      await cmsConn.client.end();
    }
  });
});

describe("Phase 6: DPDP self-service personal data export & account erasure", () => {
  it("exports a student's complete personal data bundle and erases their account without touching shared content", async () => {
    const appConn = createDatabase(urlFor("lockin_app", PASSWORDS.app), { max: 2 });
    try {
      const student = await registerUser(
        appConn.db,
        {
          email: "privacy.student@example.com",
          fullName: "Nikhil Kamath",
          password: "PrivacyPassword!2026",
          dateOfBirth: "2006-01-20",
        },
        new Date("2026-11-23T00:00:00Z"),
      );
      await verifyEmailWithOtp(appConn.db, {
        userId: student.user.id,
        otp: student.verificationOtp,
      });
      await generateStudentRoadmap(appConn.db, {
        userId: student.user.id,
        orgId: student.orgId,
        branchSlug: "mechanical-engineering",
      });

      const bundle = await exportStudentPersonalData(appConn.db, {
        userId: student.user.id,
        orgId: student.orgId,
      });
      expect(bundle.user.email).toBe("privacy.student@example.com");
      expect(bundle.roadmaps).toHaveLength(1);
      expect(bundle.roadmaps[0]?.items.length).toBe(8);

      await deleteStudentAccountAndData(appConn.db, {
        userId: student.user.id,
        orgId: student.orgId,
      });

      await expect(
        exportStudentPersonalData(appConn.db, {
          userId: student.user.id,
          orgId: student.orgId,
        }),
      ).rejects.toThrow(/User not found/);

      // Shared content catalog remains 100% intact
      const branchesAfterDelete = await listPublishedBranches(appConn.db, "en");
      expect(branchesAfterDelete.length).toBeGreaterThanOrEqual(10);
    } finally {
      await appConn.client.end();
    }
  });
});
