import { DEFAULT_LOCALE, fallbackChain, type LocaleCode } from "@lockin/i18n";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "./client";
import {
  branches,
  branchTranslations,
  contentReleases,
  entranceExams,
  entranceExamTranslations,
  roadmapTemplates,
  type Branch,
  type BranchFitWeights,
  type BranchTranslation,
  type ContentRelease,
  type ContentWorkflowStatus,
  type RoadmapTemplateMilestone,
} from "./schema";
import { requirePermission } from "@lockin/domain/organization";
import { NotFoundError, type Actor } from "@lockin/domain/shared";

export interface LocalizedBranchSummary {
  id: string;
  slug: string;
  code: string;
  category: string;
  status: ContentWorkflowStatus;
  displayOrder: number;
  durationYears: number;
  totalSemesters: number;
  entrySalaryMinInr: number;
  entrySalaryMaxInr: number;
  midCareerSalaryMaxInr: number;
  fitWeights: BranchFitWeights;
  entranceExamSlugs: string[];
  locale: LocaleCode;
  isFallbackTranslation: boolean;
  title: string;
  shortSummary: string;
  overview: string;
  whoItSuits: string;
  coreSubjects: string[];
  keySkills: string[];
  careerRoles: string[];
  topRecruitersIndia: string[];
  higherStudiesPaths: string[];
}

export interface LocalizedEntranceExam {
  id: string;
  slug: string;
  shortName: string;
  level: string;
  conductingBody: string;
  typicalMonth: string;
  officialUrl: string;
  fullName: string;
  summary: string;
  eligibilitySummary: string;
}

export interface LocalizedBranchDetail extends LocalizedBranchSummary {
  entranceExams: LocalizedEntranceExam[];
  roadmapMilestones: RoadmapTemplateMilestone[];
  activeReleaseVersion: number | null;
}

function pickTranslation<T extends { locale: string }>(
  rows: T[],
  requestedLocale: LocaleCode,
): { row: T; isFallback: boolean } | null {
  for (const candidate of fallbackChain(requestedLocale)) {
    const found = rows.find((r) => r.locale === candidate);
    if (found) {
      return { row: found, isFallback: candidate !== requestedLocale };
    }
  }
  return rows[0] ? { row: rows[0], isFallback: true } : null;
}

/**
 * List published branches for public students/visitors, with automatic fallback to English
 * if a translation in `locale` does not exist yet.
 */
export async function listPublishedBranches(
  db: Database,
  locale: LocaleCode = DEFAULT_LOCALE,
  options: { category?: string; search?: string; includeDrafts?: boolean } = {},
): Promise<LocalizedBranchSummary[]> {
  const branchRows = await db
    .select()
    .from(branches)
    .where(options.includeDrafts ? undefined : eq(branches.status, "published"))
    .orderBy(asc(branches.displayOrder), asc(branches.code));

  if (branchRows.length === 0) return [];

  const translationRows = await db
    .select()
    .from(branchTranslations)
    .where(
      and(
        inArray(
          branchTranslations.branchId,
          branchRows.map((b) => b.id),
        ),
        inArray(branchTranslations.locale, fallbackChain(locale)),
      ),
    );

  const byBranchId = new Map<string, BranchTranslation[]>();
  for (const tr of translationRows) {
    const list = byBranchId.get(tr.branchId) ?? [];
    list.push(tr);
    byBranchId.set(tr.branchId, list);
  }

  const summaries: LocalizedBranchSummary[] = [];
  for (const branch of branchRows) {
    if (options.category && branch.category !== options.category) continue;
    const picked = pickTranslation(byBranchId.get(branch.id) ?? [], locale);
    if (!picked) continue;

    const item: LocalizedBranchSummary = {
      id: branch.id,
      slug: branch.slug,
      code: branch.code,
      category: branch.category,
      status: branch.status,
      displayOrder: branch.displayOrder,
      durationYears: branch.durationYears,
      totalSemesters: branch.totalSemesters,
      entrySalaryMinInr: branch.entrySalaryMinInr,
      entrySalaryMaxInr: branch.entrySalaryMaxInr,
      midCareerSalaryMaxInr: branch.midCareerSalaryMaxInr,
      fitWeights: branch.fitWeights,
      entranceExamSlugs: branch.entranceExamSlugs,
      locale: picked.row.locale as LocaleCode,
      isFallbackTranslation: picked.isFallback,
      title: picked.row.title,
      shortSummary: picked.row.shortSummary,
      overview: picked.row.overview,
      whoItSuits: picked.row.whoItSuits,
      coreSubjects: picked.row.coreSubjects,
      keySkills: picked.row.keySkills,
      careerRoles: picked.row.careerRoles,
      topRecruitersIndia: picked.row.topRecruitersIndia,
      higherStudiesPaths: picked.row.higherStudiesPaths,
    };

    if (options.search) {
      const q = options.search.trim().toLowerCase();
      const haystack = [
        item.title,
        item.code,
        item.category,
        item.shortSummary,
        ...item.coreSubjects,
        ...item.careerRoles,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) continue;
    }

    summaries.push(item);
  }

  return summaries;
}

/**
 * Get full branch detail by slug, including associated Indian entrance exams and
 * the 8-semester B.E./B.Tech roadmap template preview.
 */
export async function getPublishedBranchBySlug(
  db: Database,
  slug: string,
  locale: LocaleCode = DEFAULT_LOCALE,
): Promise<LocalizedBranchDetail | null> {
  const [branch] = await db
    .select()
    .from(branches)
    .where(and(eq(branches.slug, slug), eq(branches.status, "published")))
    .limit(1);

  if (!branch) return null;

  const trRows = await db
    .select()
    .from(branchTranslations)
    .where(
      and(
        eq(branchTranslations.branchId, branch.id),
        inArray(branchTranslations.locale, fallbackChain(locale)),
      ),
    );

  const picked = pickTranslation(trRows, locale);
  if (!picked) return null;

  const examList = await listPublishedEntranceExams(db, locale);
  const matchingExams = examList.filter((e) => branch.entranceExamSlugs.includes(e.slug));

  const templateRows = await db
    .select()
    .from(roadmapTemplates)
    .where(
      and(
        eq(roadmapTemplates.branchId, branch.id),
        inArray(roadmapTemplates.locale, fallbackChain(locale)),
      ),
    );
  const pickedTemplate = pickTranslation(templateRows, locale);

  const [activeRelease] = await db
    .select()
    .from(contentReleases)
    .where(eq(contentReleases.isActive, true))
    .orderBy(desc(contentReleases.versionNumber))
    .limit(1);

  return {
    id: branch.id,
    slug: branch.slug,
    code: branch.code,
    category: branch.category,
    status: branch.status,
    displayOrder: branch.displayOrder,
    durationYears: branch.durationYears,
    totalSemesters: branch.totalSemesters,
    entrySalaryMinInr: branch.entrySalaryMinInr,
    entrySalaryMaxInr: branch.entrySalaryMaxInr,
    midCareerSalaryMaxInr: branch.midCareerSalaryMaxInr,
    fitWeights: branch.fitWeights,
    entranceExamSlugs: branch.entranceExamSlugs,
    locale: picked.row.locale as LocaleCode,
    isFallbackTranslation: picked.isFallback,
    title: picked.row.title,
    shortSummary: picked.row.shortSummary,
    overview: picked.row.overview,
    whoItSuits: picked.row.whoItSuits,
    coreSubjects: picked.row.coreSubjects,
    keySkills: picked.row.keySkills,
    careerRoles: picked.row.careerRoles,
    topRecruitersIndia: picked.row.topRecruitersIndia,
    higherStudiesPaths: picked.row.higherStudiesPaths,
    entranceExams: matchingExams,
    roadmapMilestones: pickedTemplate?.row.milestones ?? [],
    activeReleaseVersion: activeRelease?.versionNumber ?? null,
  };
}

export async function listPublishedEntranceExams(
  db: Database,
  locale: LocaleCode = DEFAULT_LOCALE,
): Promise<LocalizedEntranceExam[]> {
  const examRows = await db
    .select()
    .from(entranceExams)
    .where(eq(entranceExams.status, "published"))
    .orderBy(asc(entranceExams.slug));

  if (examRows.length === 0) return [];

  const trRows = await db
    .select()
    .from(entranceExamTranslations)
    .where(inArray(entranceExamTranslations.locale, fallbackChain(locale)));

  const byExam = new Map<string, (typeof trRows)[number][]>();
  for (const tr of trRows) {
    const arr = byExam.get(tr.examId) ?? [];
    arr.push(tr);
    byExam.set(tr.examId, arr);
  }

  const results: LocalizedEntranceExam[] = [];
  for (const exam of examRows) {
    const picked = pickTranslation(byExam.get(exam.id) ?? [], locale);
    if (!picked) continue;
    results.push({
      id: exam.id,
      slug: exam.slug,
      shortName: exam.shortName,
      level: exam.level,
      conductingBody: exam.conductingBody,
      typicalMonth: exam.typicalMonth,
      officialUrl: exam.officialUrl,
      fullName: picked.row.fullName,
      summary: picked.row.summary,
      eligibilitySummary: picked.row.eligibilitySummary,
    });
  }
  return results;
}

export interface CmsUpsertBranchInput {
  slug: string;
  code: string;
  category: string;
  displayOrder?: number;
  entrySalaryMinInr: number;
  entrySalaryMaxInr: number;
  midCareerSalaryMaxInr: number;
  fitWeights?: BranchFitWeights;
  entranceExamSlugs: string[];
  status: ContentWorkflowStatus;
  locale: LocaleCode;
  title: string;
  shortSummary: string;
  overview: string;
  whoItSuits: string;
  coreSubjects: string[];
  keySkills: string[];
  careerRoles: string[];
  topRecruitersIndia: string[];
  higherStudiesPaths: string[];
}

/**
 * CMS write operation (executed over the `lockin_cms` connection).
 * Requires `cms:edit_content` permission on `actor`.
 */
export async function cmsUpsertBranch(
  cmsDb: Database,
  actor: Actor,
  input: CmsUpsertBranchInput,
): Promise<Branch> {
  requirePermission(actor, "cms:edit_content");

  const defaultWeights: BranchFitWeights = input.fitWeights ?? {
    programmingAndAlgorithms: 50,
    electronicsAndHardware: 50,
    physicsAndMechanics: 50,
    chemistryAndMaterials: 50,
    biologyAndLifeSciences: 50,
    mathematicsAndModeling: 50,
    designAndInfrastructure: 50,
  };

  return cmsDb.transaction(async (tx) => {
    const [branchRow] = await tx
      .insert(branches)
      .values({
        slug: input.slug.trim().toLowerCase(),
        code: input.code.trim().toUpperCase(),
        category: input.category.trim(),
        displayOrder: input.displayOrder ?? 100,
        entrySalaryMinInr: input.entrySalaryMinInr,
        entrySalaryMaxInr: input.entrySalaryMaxInr,
        midCareerSalaryMaxInr: input.midCareerSalaryMaxInr,
        fitWeights: defaultWeights,
        entranceExamSlugs: input.entranceExamSlugs,
        status: input.status,
      })
      .onConflictDoUpdate({
        target: branches.slug,
        set: {
          code: sql`excluded.code`,
          category: sql`excluded.category`,
          displayOrder: sql`excluded.display_order`,
          entrySalaryMinInr: sql`excluded.entry_salary_min_inr`,
          entrySalaryMaxInr: sql`excluded.entry_salary_max_inr`,
          midCareerSalaryMaxInr: sql`excluded.mid_career_salary_max_inr`,
          entranceExamSlugs: sql`excluded.entrance_exam_slugs`,
          status: sql`excluded.status`,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    if (!branchRow) {
      throw new NotFoundError("Failed to upsert branch.");
    }

    await tx
      .insert(branchTranslations)
      .values({
        branchId: branchRow.id,
        locale: input.locale,
        title: input.title.trim(),
        shortSummary: input.shortSummary.trim(),
        overview: input.overview.trim(),
        whoItSuits: input.whoItSuits.trim(),
        coreSubjects: input.coreSubjects,
        keySkills: input.keySkills,
        careerRoles: input.careerRoles,
        topRecruitersIndia: input.topRecruitersIndia,
        higherStudiesPaths: input.higherStudiesPaths,
        status: input.status,
      })
      .onConflictDoUpdate({
        target: [branchTranslations.branchId, branchTranslations.locale],
        set: {
          title: sql`excluded.title`,
          shortSummary: sql`excluded.short_summary`,
          overview: sql`excluded.overview`,
          whoItSuits: sql`excluded.who_it_suits`,
          coreSubjects: sql`excluded.core_subjects`,
          keySkills: sql`excluded.key_skills`,
          careerRoles: sql`excluded.career_roles`,
          topRecruitersIndia: sql`excluded.top_recruiters_india`,
          higherStudiesPaths: sql`excluded.higher_studies_paths`,
          status: sql`excluded.status`,
          updatedAt: sql`now()`,
        },
      });

    return branchRow;
  });
}

/**
 * Publish a new immutable content release snapshot in `content.content_releases`.
 * Requires `cms:publish_content` permission.
 */
export async function cmsPublishContentRelease(
  cmsDb: Database,
  actor: Actor,
  params: { label: string; notes?: string; publishedByEmail: string },
): Promise<ContentRelease> {
  requirePermission(actor, "cms:publish_content");

  return cmsDb.transaction(async (tx) => {
    const [latest] = await tx
      .select({ versionNumber: contentReleases.versionNumber })
      .from(contentReleases)
      .orderBy(desc(contentReleases.versionNumber))
      .limit(1);

    const nextVersion = (latest?.versionNumber ?? 0) + 1;

    await tx.update(contentReleases).set({ isActive: false });

    const [created] = await tx
      .insert(contentReleases)
      .values({
        versionNumber: nextVersion,
        label: params.label.trim(),
        notes: params.notes?.trim() || null,
        publishedByEmail: params.publishedByEmail,
        isActive: true,
      })
      .returning();

    return created!;
  });
}

export async function listContentReleases(db: Database): Promise<ContentRelease[]> {
  return db.select().from(contentReleases).orderBy(desc(contentReleases.versionNumber));
}
