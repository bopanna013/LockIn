import { Container } from "@lockin/ui/components/container";
import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { GuardianConsentForms } from "@/components/auth/auth-forms";
import { routing } from "@/i18n/routing";
import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function GuardianConsentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
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
  if (session.user.accountStatus === "active") {
    redirect(`/${locale}/onboarding`);
  }

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto mb-8 max-w-3xl text-center">
        <p className="text-primary text-xs font-semibold tracking-wider uppercase">
          DPDP Act 2023 (Section 9) Safeguard
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Parent or Legal Guardian Approval Required
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {session.user.fullName}&apos;s account is currently in restricted{" "}
          <code>pending_guardian</code> status. No personal assessment or roadmap data can be saved
          until a parent or guardian approves below.
        </p>
      </div>
      <GuardianConsentForms locale={locale} studentFullName={session.user.fullName} />
    </Container>
  );
}
