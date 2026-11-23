"use server";

import { cmsPublishContentRelease, cmsUpsertBranch } from "@lockin/db";
import { CONTENT_WORKFLOW_STATUSES, type ContentWorkflowStatus } from "@lockin/db/schema";
import { isDomainError, type Actor } from "@lockin/domain/shared";
import { LOCALE_CODES, type LocaleCode } from "@lockin/i18n";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cmsDb, getCurrentSession } from "@/lib/session";

export interface CmsActionState {
  error?: string;
  success?: string;
}

function sessionToActor(session: Awaited<ReturnType<typeof getCurrentSession>>): Actor {
  if (!session) return { type: "anonymous" };
  return {
    type: "user",
    userId: session.user.id,
    orgId: session.orgId,
    globalRoles: session.user.globalRoles,
  };
}

const upsertBranchSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Slug must contain lowercase letters, numbers, and hyphens only."),
  code: z.string().trim().min(2).max(16),
  category: z.string().trim().min(2).max(48),
  entrySalaryMinInr: z.coerce.number().int().positive(),
  entrySalaryMaxInr: z.coerce.number().int().positive(),
  midCareerSalaryMaxInr: z.coerce.number().int().positive(),
  status: z.enum(CONTENT_WORKFLOW_STATUSES),
  locale: z.enum(LOCALE_CODES),
  title: z.string().trim().min(3).max(160),
  shortSummary: z.string().trim().min(10),
  overview: z.string().trim().min(10),
  whoItSuits: z.string().trim().min(10),
  coreSubjects: z.string().default(""),
  keySkills: z.string().default(""),
  careerRoles: z.string().default(""),
  topRecruitersIndia: z.string().default(""),
  higherStudiesPaths: z.string().default(""),
  entranceExamSlugs: z.string().default("jee-main, kcet, comedk"),
});

function splitCommaList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function cmsUpsertBranchAction(
  _prev: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const session = await getCurrentSession();
  const actor = sessionToActor(session);

  const parsed = upsertBranchSchema.safeParse({
    slug: formData.get("slug"),
    code: formData.get("code"),
    category: formData.get("category"),
    entrySalaryMinInr: formData.get("entrySalaryMinInr"),
    entrySalaryMaxInr: formData.get("entrySalaryMaxInr"),
    midCareerSalaryMaxInr: formData.get("midCareerSalaryMaxInr"),
    status: formData.get("status") ?? "draft",
    locale: formData.get("locale") ?? "en",
    title: formData.get("title"),
    shortSummary: formData.get("shortSummary"),
    overview: formData.get("overview"),
    whoItSuits: formData.get("whoItSuits"),
    coreSubjects: formData.get("coreSubjects") ?? "",
    keySkills: formData.get("keySkills") ?? "",
    careerRoles: formData.get("careerRoles") ?? "",
    topRecruitersIndia: formData.get("topRecruitersIndia") ?? "",
    higherStudiesPaths: formData.get("higherStudiesPaths") ?? "",
    entranceExamSlugs: formData.get("entranceExamSlugs") ?? "jee-main, kcet, comedk",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · "),
    };
  }

  try {
    const saved = await cmsUpsertBranch(cmsDb(), actor, {
      slug: parsed.data.slug,
      code: parsed.data.code,
      category: parsed.data.category,
      entrySalaryMinInr: parsed.data.entrySalaryMinInr,
      entrySalaryMaxInr: parsed.data.entrySalaryMaxInr,
      midCareerSalaryMaxInr: parsed.data.midCareerSalaryMaxInr,
      entranceExamSlugs: splitCommaList(parsed.data.entranceExamSlugs),
      status: parsed.data.status as ContentWorkflowStatus,
      locale: parsed.data.locale as LocaleCode,
      title: parsed.data.title,
      shortSummary: parsed.data.shortSummary,
      overview: parsed.data.overview,
      whoItSuits: parsed.data.whoItSuits,
      coreSubjects: splitCommaList(parsed.data.coreSubjects),
      keySkills: splitCommaList(parsed.data.keySkills),
      careerRoles: splitCommaList(parsed.data.careerRoles),
      topRecruitersIndia: splitCommaList(parsed.data.topRecruitersIndia),
      higherStudiesPaths: splitCommaList(parsed.data.higherStudiesPaths),
    });

    revalidatePath("/en/branches");
    revalidatePath(`/en/branches/${saved.slug}`);
    revalidatePath("/en/admin/content");
    return {
      success: `Saved branch "${parsed.data.title}" (${saved.code}) with status [${saved.status}].`,
    };
  } catch (error) {
    if (isDomainError(error)) {
      return { error: error.message };
    }
    throw error;
  }
}

export async function cmsPublishReleaseAction(
  _prev: CmsActionState,
  formData: FormData,
): Promise<CmsActionState> {
  const session = await getCurrentSession();
  const actor = sessionToActor(session);
  const label = ((formData.get("label") as string) || "").trim();
  const notes = ((formData.get("notes") as string) || "").trim();

  if (label.length < 3) {
    return { error: "Please enter a descriptive release label (at least 3 characters)." };
  }

  try {
    const release = await cmsPublishContentRelease(cmsDb(), actor, {
      label,
      notes,
      publishedByEmail: session?.user.email ?? "editor@lockin.home.arpa",
    });
    revalidatePath("/en/branches");
    revalidatePath("/en/admin/content");
    return {
      success: `Published immutable Content Release v${release.versionNumber} (${release.label}).`,
    };
  } catch (error) {
    if (isDomainError(error)) {
      return { error: error.message };
    }
    throw error;
  }
}
