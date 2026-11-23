"use server";

import { checkRateLimit, selectStudentBranch, submitDiscoveryAssessment } from "@lockin/db";
import { DISCOVERY_QUESTIONS } from "@lockin/domain/recommendation";
import { isDomainError } from "@lockin/domain/shared";
import type { LocaleCode } from "@lockin/i18n";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appDb, getCurrentSession } from "@/lib/session";

export interface DiscoveryActionState {
  error?: string;
  success?: string;
}

export async function submitDiscoveryAssessmentAction(
  _prev: DiscoveryActionState,
  formData: FormData,
): Promise<DiscoveryActionState> {
  const session = await getCurrentSession();
  const locale = ((formData.get("locale") as string) || "en").trim() as LocaleCode;
  if (!session) {
    redirect(`/${locale}/sign-in`);
  }

  const answers: Record<string, number> = {};
  for (const q of DISCOVERY_QUESTIONS) {
    const raw = Number(formData.get(q.id));
    if (!Number.isInteger(raw) || raw < 1 || raw > 5) {
      return { error: "Please answer every question on the 1–5 scale." };
    }
    answers[q.id] = raw;
  }

  const db = appDb();
  const limit = await checkRateLimit(db, `assessment:${session.user.id}`, 10, 600);
  if (!limit.allowed) {
    return { error: "Too many assessment submissions. Please wait a few minutes." };
  }

  try {
    await submitDiscoveryAssessment(db, {
      userId: session.user.id,
      orgId: session.orgId,
      locale,
      answers,
    });
    revalidatePath(`/${locale}/discover`);
    revalidatePath(`/${locale}/dashboard`);
    return {
      success: "Assessment scored! Scroll down to explore your ranked engineering branch fit.",
    };
  } catch (error) {
    if (isDomainError(error)) {
      return { error: error.message };
    }
    throw error;
  }
}

export async function selectBranchAction(formData: FormData): Promise<void> {
  const session = await getCurrentSession();
  const locale = ((formData.get("locale") as string) || "en").trim();
  const branchSlug = ((formData.get("branchSlug") as string) || "").trim();
  if (!session) {
    redirect(`/${locale}/sign-in`);
  }
  if (!branchSlug) {
    redirect(`/${locale}/discover`);
  }

  await selectStudentBranch(appDb(), {
    userId: session.user.id,
    orgId: session.orgId,
    branchSlug,
  });

  revalidatePath(`/${locale}/discover`);
  revalidatePath(`/${locale}/dashboard`);
  redirect(`/${locale}/dashboard`);
}
