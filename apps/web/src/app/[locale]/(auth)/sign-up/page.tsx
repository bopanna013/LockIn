import { Container } from "@lockin/ui/components/container";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { SignUpForm } from "@/components/auth/auth-forms";
import { routing } from "@/i18n/routing";

export default async function SignUpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <Container className="py-12 sm:py-16">
      <SignUpForm locale={locale} />
    </Container>
  );
}
