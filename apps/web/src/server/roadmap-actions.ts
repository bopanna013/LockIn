"use server";

import {
  addCustomRoadmapItem,
  generateStudentRoadmap,
  syncRoadmapWithLatestRelease,
  updateRoadmapItemProgress,
} from "@lockin/db";
import {
  ROADMAP_ITEM_CATEGORIES,
  ROADMAP_ITEM_STATUSES,
  type RoadmapItemCategory,
  type RoadmapItemStatus,
} from "@lockin/domain/roadmap";
import { isDomainError } from "@lockin/domain/shared";
import type { LocaleCode } from "@lockin/i18n";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { appDb, getCurrentSession } from "@/lib/session";

export interface RoadmapActionState {
  error?: string;
  success?: string;
}

export async function generateRoadmapAction(formData: FormData): Promise<void> {
  const session = await getCurrentSession();
  const locale = ((formData.get("locale") as string) || "en").trim() as LocaleCode;
  const branchSlug = ((formData.get("branchSlug") as string) || "").trim();
  if (!session) {
    redirect(`/${locale}/sign-in`);
  }
  if (!branchSlug) {
    redirect(`/${locale}/branches`);
  }

  await generateStudentRoadmap(appDb(), {
    userId: session.user.id,
    orgId: session.orgId,
    branchSlug,
    locale,
  });

  revalidatePath(`/${locale}/roadmap`);
  revalidatePath(`/${locale}/dashboard`);
  redirect(`/${locale}/roadmap`);
}

export async function updateRoadmapItemAction(formData: FormData): Promise<void> {
  const session = await getCurrentSession();
  const locale = ((formData.get("locale") as string) || "en").trim();
  if (!session) {
    redirect(`/${locale}/sign-in`);
  }

  const itemId = ((formData.get("itemId") as string) || "").trim();
  const status = ((formData.get("status") as string) || "todo").trim() as RoadmapItemStatus;
  const evidenceUrl = ((formData.get("evidenceUrl") as string) || "").trim() || null;
  const reflectionNotes = ((formData.get("reflectionNotes") as string) || "").trim() || null;

  if (!ROADMAP_ITEM_STATUSES.includes(status)) return;

  await updateRoadmapItemProgress(appDb(), {
    userId: session.user.id,
    orgId: session.orgId,
    itemId,
    status,
    evidenceUrl,
    reflectionNotes,
  });

  revalidatePath(`/${locale}/roadmap`);
  revalidatePath(`/${locale}/dashboard`);
}

const customItemSchema = z.object({
  semester: z.coerce.number().int().min(1).max(8),
  category: z.enum(ROADMAP_ITEM_CATEGORIES),
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(180),
  description: z.string().trim().min(5, "Description must be at least 5 characters.").max(1000),
  locale: z.string().default("en"),
});

export async function addCustomRoadmapItemAction(
  _prev: RoadmapActionState,
  formData: FormData,
): Promise<RoadmapActionState> {
  const session = await getCurrentSession();
  const locale = ((formData.get("locale") as string) || "en").trim();
  if (!session) {
    redirect(`/${locale}/sign-in`);
  }

  const parsed = customItemSchema.safeParse({
    semester: formData.get("semester"),
    category: formData.get("category"),
    title: formData.get("title"),
    description: formData.get("description"),
    locale,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(" · ") };
  }

  try {
    await addCustomRoadmapItem(appDb(), {
      userId: session.user.id,
      orgId: session.orgId,
      semester: parsed.data.semester,
      category: parsed.data.category as RoadmapItemCategory,
      title: parsed.data.title,
      description: parsed.data.description,
    });
    revalidatePath(`/${locale}/roadmap`);
    revalidatePath(`/${locale}/dashboard`);
    return {
      success: `Added custom milestone "${parsed.data.title}" to Semester ${parsed.data.semester}.`,
    };
  } catch (error) {
    if (isDomainError(error)) {
      return { error: error.message };
    }
    throw error;
  }
}

export async function syncRoadmapReleaseAction(formData: FormData): Promise<void> {
  const session = await getCurrentSession();
  const locale = ((formData.get("locale") as string) || "en").trim() as LocaleCode;
  if (!session) {
    redirect(`/${locale}/sign-in`);
  }

  await syncRoadmapWithLatestRelease(appDb(), {
    userId: session.user.id,
    orgId: session.orgId,
    locale,
  });

  revalidatePath(`/${locale}/roadmap`);
  revalidatePath(`/${locale}/dashboard`);
}
