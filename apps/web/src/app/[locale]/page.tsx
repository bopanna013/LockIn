import { Button } from "@lockin/ui/components/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@lockin/ui/components/card";
import { Container } from "@lockin/ui/components/container";
import { Compass, GitCompareArrows, ListChecks, Route, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const FEATURES = [
  { key: "discover", Icon: Compass },
  { key: "compare", Icon: GitCompareArrows },
  { key: "plan", Icon: Route },
  { key: "track", Icon: ListChecks },
] as const;

export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <HomeContent />;
}

async function HomeContent() {
  const t = await getTranslations("home");
  const nav = await getTranslations("nav");

  return (
    <>
      <section className="relative overflow-hidden border-b">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_50%_-10%,var(--color-primary)/15%,transparent)]"
        />
        <Container className="flex flex-col items-center py-16 text-center sm:py-24 lg:py-32">
          <p className="bg-card text-muted-foreground mb-4 rounded-full border px-3 py-1 text-xs font-medium sm:text-sm">
            {t("eyebrow")}
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-6 max-w-2xl text-base text-pretty sm:text-lg">
            {t("subtitle")}
          </p>
          <div className="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg">
              <Link href="/sign-up">{t("primaryCta")}</Link>
            </Button>
            <Button size="lg" variant="outline" disabled title={nav("comingSoon")}>
              {t("secondaryCta")}
            </Button>
          </div>
        </Container>
      </section>

      <section aria-labelledby="features-heading" className="py-16 sm:py-24">
        <Container>
          <h2 id="features-heading" className="text-center text-2xl font-semibold sm:text-3xl">
            {t("featuresTitle")}
          </h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ key, Icon }) => (
              <li key={key}>
                <Card className="h-full">
                  <CardHeader>
                    <span className="bg-primary/10 text-primary mb-2 inline-flex size-10 items-center justify-center rounded-lg">
                      <Icon aria-hidden className="size-5" />
                    </span>
                    <CardTitle>{t(`features.${key}.title`)}</CardTitle>
                    <CardDescription>{t(`features.${key}.body`)}</CardDescription>
                  </CardHeader>
                </Card>
              </li>
            ))}
          </ul>

          <p className="bg-muted/50 text-muted-foreground mx-auto mt-12 flex max-w-2xl items-start gap-3 rounded-lg border p-4 text-sm">
            <ShieldCheck aria-hidden className="text-success mt-0.5 size-5 shrink-0" />
            {t("privacyNote")}
          </p>
        </Container>
      </section>
    </>
  );
}
