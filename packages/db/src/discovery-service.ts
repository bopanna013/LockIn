import { assertStudentDataAccessAllowed } from "@lockin/domain/consent";
import {
  computeDimensionScores,
  rankBranchesForStudent,
  type BranchCandidate,
} from "@lockin/domain/recommendation";
import { NotFoundError } from "@lockin/domain/shared";
import { DEFAULT_LOCALE, type LocaleCode } from "@lockin/i18n";
import { and, desc, eq, sql } from "drizzle-orm";
import { listPublishedBranches } from "./catalog-service";
import type { Database } from "./client";
import { withRequestContext } from "./context";
import {
  assessmentResponses,
  contentReleases,
  studentProfiles,
  studentRecommendations,
  users,
  type StudentRecommendation,
} from "./schema";

export interface SubmitDiscoveryAssessmentInput {
  userId: string;
  orgId: string;
  locale?: LocaleCode;
  answers: Readonly<Record<string, number>>;
}

/**
 * Evaluate and persist a student's discovery assessment and ranked branch recommendations
 * inside an RLS-scoped transaction. Blocked unless the user's account status is `active`.
 */
export async function submitDiscoveryAssessment(
  db: Database,
  input: SubmitDiscoveryAssessmentInput,
): Promise<StudentRecommendation> {
  const [user] = await db
    .select({ accountStatus: users.accountStatus })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError("User not found.");
  }

  assertStudentDataAccessAllowed(user.accountStatus);

  const locale = input.locale ?? DEFAULT_LOCALE;
  const publishedBranches = await listPublishedBranches(db, locale);
  const candidates: BranchCandidate[] = publishedBranches.map((b) => ({
    slug: b.slug,
    code: b.code,
    title: b.title,
    category: b.category,
    fitWeights: b.fitWeights,
  }));

  const [activeRelease] = await db
    .select({ id: contentReleases.id })
    .from(contentReleases)
    .where(eq(contentReleases.isActive, true))
    .orderBy(desc(contentReleases.versionNumber))
    .limit(1);

  const dimensionScores = computeDimensionScores(input.answers);
  const evaluation = rankBranchesForStudent(dimensionScores, candidates);

  return withRequestContext(db, { userId: input.userId, orgId: input.orgId }, async (tx) => {
    const [responseRow] = await tx
      .insert(assessmentResponses)
      .values({
        orgId: input.orgId,
        userId: input.userId,
        answers: { ...input.answers },
        dimensionScores: evaluation.dimensionScores,
      })
      .returning();

    const [recommendationRow] = await tx
      .insert(studentRecommendations)
      .values({
        orgId: input.orgId,
        userId: input.userId,
        assessmentResponseId: responseRow!.id,
        contentReleaseId: activeRelease?.id ?? null,
        algorithmVersion: evaluation.algorithmVersion,
        dimensionScores: evaluation.dimensionScores,
        rankedBranches: evaluation.rankedBranches,
      })
      .returning();

    return recommendationRow!;
  });
}

/**
 * Retrieve the student's most recent recommendation snapshot inside an RLS-scoped transaction.
 */
export async function getLatestStudentRecommendation(
  db: Database,
  context: { userId: string; orgId: string },
): Promise<StudentRecommendation | null> {
  return withRequestContext(db, context, async (tx) => {
    const [row] = await tx
      .select()
      .from(studentRecommendations)
      .where(
        and(
          eq(studentRecommendations.userId, context.userId),
          eq(studentRecommendations.orgId, context.orgId),
        ),
      )
      .orderBy(desc(studentRecommendations.createdAt))
      .limit(1);
    return row ?? null;
  });
}

/**
 * Save the student's chosen engineering branch on their RLS-protected student profile.
 */
export async function selectStudentBranch(
  db: Database,
  params: { userId: string; orgId: string; branchSlug: string },
): Promise<void> {
  const [user] = await db
    .select({ accountStatus: users.accountStatus })
    .from(users)
    .where(eq(users.id, params.userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError("User not found.");
  }

  assertStudentDataAccessAllowed(user.accountStatus);

  await withRequestContext(db, { userId: params.userId, orgId: params.orgId }, async (tx) => {
    await tx
      .insert(studentProfiles)
      .values({
        orgId: params.orgId,
        userId: params.userId,
        educationStage: "CLASS_12",
        academicBoard: "CBSE",
        selectedBranchSlug: params.branchSlug,
        onboardingCompleted: true,
      })
      .onConflictDoUpdate({
        target: [studentProfiles.orgId, studentProfiles.userId],
        set: {
          selectedBranchSlug: sql`excluded.selected_branch_slug`,
          updatedAt: sql`now()`,
        },
      });
  });
}
