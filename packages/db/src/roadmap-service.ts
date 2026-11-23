import { assertStudentDataAccessAllowed } from "@lockin/domain/consent";
import {
  computeRoadmapProgress,
  diffNewTemplateMilestones,
  type OverallRoadmapProgress,
  type RoadmapItemCategory,
  type RoadmapItemStatus,
} from "@lockin/domain/roadmap";
import { NotFoundError, ValidationError } from "@lockin/domain/shared";
import { DEFAULT_LOCALE, type LocaleCode } from "@lockin/i18n";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getPublishedBranchBySlug } from "./catalog-service";
import type { Database } from "./client";
import { withRequestContext } from "./context";
import {
  contentReleases,
  studentProfiles,
  studentRoadmapItems,
  studentRoadmaps,
  users,
  type StudentRoadmap,
  type StudentRoadmapItem,
} from "./schema";

export interface StudentRoadmapAggregate {
  roadmap: StudentRoadmap;
  items: StudentRoadmapItem[];
  progress: OverallRoadmapProgress;
  latestActiveReleaseVersion: number;
  hasTemplateUpdateAvailable: boolean;
}

/**
 * Generate (or reset to a new branch) a student's 4-year / 8-semester B.E./B.Tech roadmap
 * from the published branch template, pinned to the active `content.content_releases` version.
 */
export async function generateStudentRoadmap(
  db: Database,
  params: {
    userId: string;
    orgId: string;
    branchSlug: string;
    locale?: LocaleCode;
  },
): Promise<StudentRoadmapAggregate> {
  const [user] = await db
    .select({ accountStatus: users.accountStatus })
    .from(users)
    .where(eq(users.id, params.userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError("User not found.");
  }

  assertStudentDataAccessAllowed(user.accountStatus);

  const locale = params.locale ?? DEFAULT_LOCALE;
  const branch = await getPublishedBranchBySlug(db, params.branchSlug, locale);
  if (!branch) {
    throw new NotFoundError(`Published engineering branch "${params.branchSlug}" not found.`);
  }

  const [activeRelease] = await db
    .select()
    .from(contentReleases)
    .where(eq(contentReleases.isActive, true))
    .orderBy(desc(contentReleases.versionNumber))
    .limit(1);

  const releaseVersion = activeRelease?.versionNumber ?? 1;

  return withRequestContext(db, { userId: params.userId, orgId: params.orgId }, async (tx) => {
    await tx
      .insert(studentProfiles)
      .values({
        orgId: params.orgId,
        userId: params.userId,
        educationStage: "CLASS_12",
        academicBoard: "CBSE",
        selectedBranchSlug: branch.slug,
        onboardingCompleted: true,
      })
      .onConflictDoUpdate({
        target: [studentProfiles.orgId, studentProfiles.userId],
        set: {
          selectedBranchSlug: sql`excluded.selected_branch_slug`,
          updatedAt: sql`now()`,
        },
      });

    const [existing] = await tx
      .select()
      .from(studentRoadmaps)
      .where(
        and(eq(studentRoadmaps.orgId, params.orgId), eq(studentRoadmaps.userId, params.userId)),
      )
      .limit(1);

    let roadmapRow: StudentRoadmap;
    if (existing) {
      await tx.delete(studentRoadmapItems).where(eq(studentRoadmapItems.roadmapId, existing.id));
      const [updated] = await tx
        .update(studentRoadmaps)
        .set({
          branchSlug: branch.slug,
          templateReleaseId: activeRelease?.id ?? null,
          templateReleaseVersion: releaseVersion,
          title: `${branch.title} — 4-Year Career Roadmap`,
        })
        .where(eq(studentRoadmaps.id, existing.id))
        .returning();
      roadmapRow = updated!;
    } else {
      const [created] = await tx
        .insert(studentRoadmaps)
        .values({
          orgId: params.orgId,
          userId: params.userId,
          branchSlug: branch.slug,
          templateReleaseId: activeRelease?.id ?? null,
          templateReleaseVersion: releaseVersion,
          title: `${branch.title} — 4-Year Career Roadmap`,
        })
        .returning();
      roadmapRow = created!;
    }

    const itemsToInsert = branch.roadmapMilestones.map((m, idx) => ({
      roadmapId: roadmapRow.id,
      orgId: params.orgId,
      userId: params.userId,
      semester: m.semester,
      category: m.category,
      templateCode: m.code,
      isCustom: false,
      title: m.title,
      description: m.description,
      status: "todo" as const,
      sortOrder: (idx + 1) * 10,
    }));

    const insertedItems =
      itemsToInsert.length > 0
        ? await tx.insert(studentRoadmapItems).values(itemsToInsert).returning()
        : [];

    return {
      roadmap: roadmapRow,
      items: insertedItems,
      progress: computeRoadmapProgress(insertedItems),
      latestActiveReleaseVersion: releaseVersion,
      hasTemplateUpdateAvailable: false,
    };
  });
}

/**
 * Fetch the student's active roadmap, items, progress metrics, and whether a newer
 * content release has been published since the roadmap was created.
 */
export async function getStudentRoadmap(
  db: Database,
  context: { userId: string; orgId: string },
): Promise<StudentRoadmapAggregate | null> {
  const [activeRelease] = await db
    .select({ versionNumber: contentReleases.versionNumber })
    .from(contentReleases)
    .where(eq(contentReleases.isActive, true))
    .orderBy(desc(contentReleases.versionNumber))
    .limit(1);

  const latestActiveReleaseVersion = activeRelease?.versionNumber ?? 1;

  return withRequestContext(db, context, async (tx) => {
    const [roadmap] = await tx
      .select()
      .from(studentRoadmaps)
      .where(
        and(eq(studentRoadmaps.orgId, context.orgId), eq(studentRoadmaps.userId, context.userId)),
      )
      .limit(1);

    if (!roadmap) return null;

    const items = await tx
      .select()
      .from(studentRoadmapItems)
      .where(eq(studentRoadmapItems.roadmapId, roadmap.id))
      .orderBy(asc(studentRoadmapItems.semester), asc(studentRoadmapItems.sortOrder));

    return {
      roadmap,
      items,
      progress: computeRoadmapProgress(items),
      latestActiveReleaseVersion,
      hasTemplateUpdateAvailable: latestActiveReleaseVersion > roadmap.templateReleaseVersion,
    };
  });
}

/**
 * Add a custom student milestone or goal to a specific semester (1..8).
 */
export async function addCustomRoadmapItem(
  db: Database,
  params: {
    userId: string;
    orgId: string;
    semester: number;
    category: RoadmapItemCategory;
    title: string;
    description: string;
  },
): Promise<StudentRoadmapItem> {
  if (params.semester < 1 || params.semester > 8) {
    throw new ValidationError("Semester must be between 1 and 8.");
  }

  const [user] = await db
    .select({ accountStatus: users.accountStatus })
    .from(users)
    .where(eq(users.id, params.userId))
    .limit(1);

  if (!user) throw new NotFoundError("User not found.");
  assertStudentDataAccessAllowed(user.accountStatus);

  return withRequestContext(db, { userId: params.userId, orgId: params.orgId }, async (tx) => {
    const [roadmap] = await tx
      .select()
      .from(studentRoadmaps)
      .where(
        and(eq(studentRoadmaps.orgId, params.orgId), eq(studentRoadmaps.userId, params.userId)),
      )
      .limit(1);

    if (!roadmap) {
      throw new NotFoundError("Please generate a branch roadmap first.");
    }

    const [created] = await tx
      .insert(studentRoadmapItems)
      .values({
        roadmapId: roadmap.id,
        orgId: params.orgId,
        userId: params.userId,
        semester: params.semester,
        category: params.category,
        templateCode: null,
        isCustom: true,
        title: params.title.trim(),
        description: params.description.trim(),
        status: "todo",
        sortOrder: 999,
      })
      .returning();

    return created!;
  });
}

/**
 * Update a milestone's completion status, evidence link, or semester reflection notes.
 */
export async function updateRoadmapItemProgress(
  db: Database,
  params: {
    userId: string;
    orgId: string;
    itemId: string;
    status: RoadmapItemStatus;
    evidenceUrl?: string | null;
    reflectionNotes?: string | null;
  },
): Promise<StudentRoadmapItem> {
  const [user] = await db
    .select({ accountStatus: users.accountStatus })
    .from(users)
    .where(eq(users.id, params.userId))
    .limit(1);

  if (!user) throw new NotFoundError("User not found.");
  assertStudentDataAccessAllowed(user.accountStatus);

  return withRequestContext(db, { userId: params.userId, orgId: params.orgId }, async (tx) => {
    const [updated] = await tx
      .update(studentRoadmapItems)
      .set({
        status: params.status,
        evidenceUrl: params.evidenceUrl?.trim() || null,
        reflectionNotes: params.reflectionNotes?.trim() || null,
        completedAt: params.status === "completed" ? new Date() : null,
      })
      .where(
        and(
          eq(studentRoadmapItems.id, params.itemId),
          eq(studentRoadmapItems.userId, params.userId),
          eq(studentRoadmapItems.orgId, params.orgId),
        ),
      )
      .returning();

    if (!updated) {
      throw new NotFoundError("Roadmap milestone not found.");
    }
    return updated;
  });
}

/**
 * Non-destructively upgrade a student's roadmap to the latest published content release.
 * Keeps all existing completion statuses, reflections, and custom goals intact, and
 * appends any newly introduced template milestones.
 */
export async function syncRoadmapWithLatestRelease(
  db: Database,
  params: { userId: string; orgId: string; locale?: LocaleCode },
): Promise<{ addedMilestonesCount: number; newReleaseVersion: number }> {
  const [user] = await db
    .select({ accountStatus: users.accountStatus })
    .from(users)
    .where(eq(users.id, params.userId))
    .limit(1);

  if (!user) throw new NotFoundError("User not found.");
  assertStudentDataAccessAllowed(user.accountStatus);

  const [activeRelease] = await db
    .select()
    .from(contentReleases)
    .where(eq(contentReleases.isActive, true))
    .orderBy(desc(contentReleases.versionNumber))
    .limit(1);

  const currentAggregate = await getStudentRoadmap(db, {
    userId: params.userId,
    orgId: params.orgId,
  });

  if (!currentAggregate) {
    throw new NotFoundError("No active roadmap found.");
  }

  const branch = await getPublishedBranchBySlug(
    db,
    currentAggregate.roadmap.branchSlug,
    params.locale ?? DEFAULT_LOCALE,
  );

  if (!branch) {
    throw new NotFoundError("Branch template not found.");
  }

  const existingCodes = new Set(
    currentAggregate.items
      .map((item) => item.templateCode)
      .filter((code): code is string => Boolean(code)),
  );

  const newMilestones = diffNewTemplateMilestones(existingCodes, branch.roadmapMilestones);
  const newReleaseVersion =
    activeRelease?.versionNumber ?? currentAggregate.roadmap.templateReleaseVersion;

  await withRequestContext(db, { userId: params.userId, orgId: params.orgId }, async (tx) => {
    if (newMilestones.length > 0) {
      await tx.insert(studentRoadmapItems).values(
        newMilestones.map((m) => ({
          roadmapId: currentAggregate.roadmap.id,
          orgId: params.orgId,
          userId: params.userId,
          semester: m.semester,
          category: m.category,
          templateCode: m.code,
          isCustom: false,
          title: m.title,
          description: m.description,
          status: "todo" as const,
          sortOrder: 500,
        })),
      );
    }

    await tx
      .update(studentRoadmaps)
      .set({
        templateReleaseId: activeRelease?.id ?? null,
        templateReleaseVersion: newReleaseVersion,
      })
      .where(eq(studentRoadmaps.id, currentAggregate.roadmap.id));
  });

  return { addedMilestonesCount: newMilestones.length, newReleaseVersion };
}
