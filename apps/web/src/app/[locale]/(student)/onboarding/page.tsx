import { getStudentProfile } from "@lockin/db";
import { Container } from "@lockin/ui/components/container";
import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { StudentOnboardingForm } from "@/components/auth/auth-forms";
import { routing } from "@/i18n/routing";
import { appDb, getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const session = await getCurrentSession();
  if (!session) {
    redirect(`/${locale}/sign-in`);
  }
  if (session.user.accountStatus === "pending_verification") {
    redirect(`/${locale}/verify-email`);
  }
  if (session.user.accountStatus === "pending_guardian") {
    redirect(`/${locale}/guardian-consent`);
  }
  if (session.user.accountStatus !== "active") {
    redirect(`/${locale}/dashboard`);
  }

  const existingProfile = await getStudentProfile(appDb(), {
    userId: session.user.id,
    orgId: session.orgId,
  });

  return (
    <Container className="py-12 sm:py-16">
      <StudentOnboardingForm locale={locale} existingProfile={existingProfile} />
    </Container>
  );
}
