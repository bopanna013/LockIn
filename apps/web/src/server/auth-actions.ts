"use server";

import {
  ACADEMIC_BOARDS,
  EDUCATION_STAGES,
  type AcademicBoard,
  type EducationStage,
} from "@lockin/db/schema";
import {
  checkRateLimit,
  deleteStudentAccountAndData,
  grantGuardianConsentWithOtp,
  registerUser,
  requestGuardianConsent,
  revokeGuardianConsentByPortalToken,
  signInWithPassword,
  signOutByToken,
  upsertStudentProfile,
  verifyEmailWithOtp,
} from "@lockin/db";
import { isDomainError } from "@lockin/domain/shared";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { serverEnv } from "@/env";
import {
  buildGuardianConsentEmail,
  buildGuardianPortalReceiptEmail,
  buildVerificationEmail,
  sendEmail,
} from "@/lib/mailer";
import {
  appDb,
  clearSessionCookie,
  getCurrentSession,
  SESSION_COOKIE_NAME,
  setSessionCookie,
} from "@/lib/session";

export interface ActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: string;
  portalUrl?: string;
}

async function clientMeta() {
  const h = await headers();
  const ipAddress =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "127.0.0.1";
  const userAgent = h.get("user-agent") ?? "unknown";
  return { ipAddress, userAgent };
}

function handleActionError(error: unknown): ActionState {
  if (isDomainError(error)) {
    return {
      error: error.message,
      ...("fieldErrors" in error
        ? { fieldErrors: error.fieldErrors as Record<string, string[]> }
        : {}),
    };
  }
  throw error;
}

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name.").max(120),
  email: z.string().trim().email("Please enter a valid email address."),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters.")
    .max(128, "Password is too long."),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter your date of birth (YYYY-MM-DD)."),
  locale: z.string().default("en"),
});

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    dateOfBirth: formData.get("dateOfBirth"),
    locale: formData.get("locale") ?? "en",
  });

  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const db = appDb();
  const meta = await clientMeta();
  const limit = await checkRateLimit(db, `signup:${meta.ipAddress}`, 10, 600);
  if (!limit.allowed) {
    return { error: "Too many sign-up attempts. Please wait a few minutes and try again." };
  }

  const destination = `/${parsed.data.locale}/verify-email`;
  try {
    const result = await registerUser(db, {
      email: parsed.data.email,
      fullName: parsed.data.fullName,
      password: parsed.data.password,
      dateOfBirth: parsed.data.dateOfBirth,
      preferredLocale: parsed.data.locale,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await setSessionCookie(result.sessionToken);

    const mail = buildVerificationEmail({
      fullName: result.user.fullName,
      otp: result.verificationOtp,
    });
    await sendEmail({ ...mail, to: result.user.email });
  } catch (error) {
    return handleActionError(error);
  }

  redirect(destination);
}

const signInSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  password: z.string().min(1, "Please enter your password."),
  locale: z.string().default("en"),
});

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    locale: formData.get("locale") ?? "en",
  });

  if (!parsed.success) {
    return {
      error: "Please enter your email and password.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const db = appDb();
  const meta = await clientMeta();
  const limit = await checkRateLimit(
    db,
    `signin:${meta.ipAddress}:${parsed.data.email.toLowerCase()}`,
    8,
    300,
  );
  if (!limit.allowed) {
    return { error: "Too many sign-in attempts. Please wait 5 minutes before trying again." };
  }

  let destination = `/${parsed.data.locale}/dashboard`;
  try {
    const result = await signInWithPassword(db, {
      email: parsed.data.email,
      password: parsed.data.password,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    await setSessionCookie(result.sessionToken);

    if (result.user.accountStatus === "pending_verification") {
      destination = `/${parsed.data.locale}/verify-email`;
    } else if (result.user.accountStatus === "pending_guardian") {
      destination = `/${parsed.data.locale}/guardian-consent`;
    }
  } catch (error) {
    return handleActionError(error);
  }

  redirect(destination);
}

export async function signOutAction(formData: FormData): Promise<void> {
  const locale = (formData.get("locale") as string) || "en";
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (rawToken && serverEnv().DATABASE_URL) {
    await signOutByToken(appDb(), rawToken);
  }
  await clearSessionCookie();
  redirect(`/${locale}/sign-in`);
}

export async function verifyEmailAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getCurrentSession();
  const locale = ((formData.get("locale") as string) || "en").trim();
  if (!session) {
    redirect(`/${locale}/sign-in`);
  }

  const otp = ((formData.get("otp") as string) || "").trim();
  if (!/^\d{6}$/.test(otp)) {
    return { error: "Please enter the 6-digit numeric verification code." };
  }

  const db = appDb();
  const meta = await clientMeta();
  let destination = `/${locale}/onboarding`;
  try {
    const updated = await verifyEmailWithOtp(db, {
      userId: session.user.id,
      otp,
      ipAddress: meta.ipAddress,
    });
    if (updated.accountStatus === "pending_guardian") {
      destination = `/${locale}/guardian-consent`;
    }
  } catch (error) {
    return handleActionError(error);
  }

  redirect(destination);
}

const guardianInviteSchema = z.object({
  guardianFullName: z.string().trim().min(2, "Please enter your parent or guardian's full name."),
  guardianEmail: z.string().trim().email("Please enter a valid guardian email address."),
  relationship: z.string().trim().min(2, "Please select or enter the relationship."),
  locale: z.string().default("en"),
});

export async function sendGuardianInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getCurrentSession();
  const locale = ((formData.get("locale") as string) || "en").trim();
  if (!session) {
    redirect(`/${locale}/sign-in`);
  }

  const parsed = guardianInviteSchema.safeParse({
    guardianFullName: formData.get("guardianFullName"),
    guardianEmail: formData.get("guardianEmail"),
    relationship: formData.get("relationship"),
    locale,
  });

  if (!parsed.success) {
    return {
      error: "Please check the guardian details below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const db = appDb();
  const meta = await clientMeta();
  const limit = await checkRateLimit(db, `guardian_invite:${session.user.id}`, 5, 600);
  if (!limit.allowed) {
    return { error: "Too many guardian invite requests. Please wait 10 minutes." };
  }

  try {
    const invite = await requestGuardianConsent(db, {
      studentUserId: session.user.id,
      guardianFullName: parsed.data.guardianFullName,
      guardianEmail: parsed.data.guardianEmail,
      relationship: parsed.data.relationship,
      ipAddress: meta.ipAddress,
    });

    const lanApprovalUrl = `${serverEnv().APP_URL}/${locale}/guardian-consent`;
    const mail = buildGuardianConsentEmail({
      guardianFullName: invite.guardianFullName,
      studentFullName: session.user.fullName,
      otp: invite.otp,
      lanApprovalUrl,
    });
    await sendEmail({ ...mail, to: invite.guardianEmail });

    return {
      success: `A 6-digit approval code has been emailed to ${invite.guardianEmail}. Check Mailpit (http://localhost:8025 in local dev) or your guardian's inbox.`,
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function confirmGuardianConsentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getCurrentSession();
  const locale = ((formData.get("locale") as string) || "en").trim();
  if (!session) {
    redirect(`/${locale}/sign-in`);
  }

  const otp = ((formData.get("otp") as string) || "").trim();
  const guardianFullNameConfirmed = (
    (formData.get("guardianFullNameConfirmed") as string) || ""
  ).trim();
  const declarationAccepted = formData.get("declarationAccepted") === "on";

  if (!declarationAccepted) {
    return {
      error:
        "The parent or legal guardian must tick the DPDP Act 2023 consent declaration before approving.",
    };
  }
  if (!/^\d{6}$/.test(otp)) {
    return { error: "Please enter the 6-digit guardian approval code." };
  }

  const db = appDb();
  const meta = await clientMeta();
  const destination = `/${locale}/onboarding`;
  try {
    const granted = await grantGuardianConsentWithOtp(db, {
      studentUserId: session.user.id,
      otp,
      guardianFullNameConfirmed,
      noticeLocale: locale,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const portalUrl = `${serverEnv().APP_URL}/${locale}/guardian/${granted.portalToken}`;
    const receipt = buildGuardianPortalReceiptEmail({
      guardianFullName: granted.consent.guardianFullName,
      studentFullName: session.user.fullName,
      portalUrl,
    });
    await sendEmail({ ...receipt, to: granted.consent.guardianEmail });
  } catch (error) {
    return handleActionError(error);
  }

  redirect(destination);
}

export async function revokeGuardianConsentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const portalToken = ((formData.get("portalToken") as string) || "").trim();
  if (!portalToken) {
    return { error: "Missing guardian portal token." };
  }

  const db = appDb();
  const meta = await clientMeta();
  try {
    await revokeGuardianConsentByPortalToken(db, {
      rawPortalToken: portalToken,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return {
      success:
        "Guardian consent has been revoked. The student's account is now restricted and all active sessions have been signed out.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}

const profileSchema = z.object({
  educationStage: z.enum(EDUCATION_STAGES),
  academicBoard: z.enum(ACADEMIC_BOARDS),
  currentSemester: z.coerce.number().int().min(1).max(8).optional().nullable(),
  targetExams: z.string().default(""),
  interests: z.string().default(""),
  preferredStates: z.string().default(""),
  careerGoalSummary: z.string().max(1000).optional(),
  locale: z.string().default("en"),
});

export async function saveStudentProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getCurrentSession();
  const locale = ((formData.get("locale") as string) || "en").trim();
  if (!session) {
    redirect(`/${locale}/sign-in`);
  }

  const rawSemester = formData.get("currentSemester");
  const parsed = profileSchema.safeParse({
    educationStage: formData.get("educationStage"),
    academicBoard: formData.get("academicBoard"),
    currentSemester: rawSemester ? Number(rawSemester) : null,
    targetExams: formData.get("targetExams") ?? "",
    interests: formData.get("interests") ?? "",
    preferredStates: formData.get("preferredStates") ?? "",
    careerGoalSummary: formData.get("careerGoalSummary") ?? "",
    locale,
  });

  if (!parsed.success) {
    return {
      error: "Please check your profile inputs.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const splitList = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const db = appDb();
  try {
    await upsertStudentProfile(db, {
      userId: session.user.id,
      orgId: session.orgId,
      educationStage: parsed.data.educationStage as EducationStage,
      academicBoard: parsed.data.academicBoard as AcademicBoard,
      currentSemester: parsed.data.currentSemester ?? null,
      targetExams: splitList(parsed.data.targetExams),
      interests: splitList(parsed.data.interests),
      preferredStates: splitList(parsed.data.preferredStates),
      careerGoalSummary: parsed.data.careerGoalSummary?.trim() || null,
    });
  } catch (error) {
    return handleActionError(error);
  }

  redirect(`/${locale}/dashboard`);
}

export async function deleteAccountAction(formData: FormData): Promise<void> {
  const session = await getCurrentSession();
  const locale = ((formData.get("locale") as string) || "en").trim();
  if (!session) {
    redirect(`/${locale}/sign-in`);
  }

  const confirmText = ((formData.get("confirmText") as string) || "").trim();
  if (confirmText !== "DELETE") {
    redirect(`/${locale}/dashboard`);
  }

  const meta = await clientMeta();
  await deleteStudentAccountAndData(appDb(), {
    userId: session.user.id,
    orgId: session.orgId,
    ipAddress: meta.ipAddress,
  });
  await clearSessionCookie();
  redirect(`/${locale}/sign-up`);
}
