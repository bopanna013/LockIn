import { getPublishedBranchBySlug } from "@lockin/db";
import { formatInr, type LocaleCode } from "@lockin/i18n";
import { Button } from "@lockin/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lockin/ui/components/card";
import { Container } from "@lockin/ui/components/container";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { appDb } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const branch = await getPublishedBranchBySlug(appDb(), slug, locale as LocaleCode);
  if (!branch) notFound();

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div>
          <Link href="/branches" className="text-primary text-sm font-medium hover:underline">
            ← Back to all B.E. / B.Tech branches
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="bg-primary/10 text-primary rounded-md px-3 py-1 text-xs font-bold">
              {branch.code}
            </span>
            <span className="text-muted-foreground text-xs">{branch.category}</span>
            {branch.activeReleaseVersion && (
              <span className="text-muted-foreground text-xs">
                · Content Release v{branch.activeReleaseVersion}
              </span>
            )}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{branch.title}</h1>
          <p className="text-muted-foreground mt-3 text-lg">{branch.overview}</p>
        </div>

        {/* Key metrics */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Entry-Level Package (India)</CardDescription>
              <CardTitle>
                {formatInr(branch.entrySalaryMinInr, locale as LocaleCode)} –{" "}
                {formatInr(branch.entrySalaryMaxInr, locale as LocaleCode)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Mid-Career Potential (5–8 yrs)</CardDescription>
              <CardTitle>
                Up to {formatInr(branch.midCareerSalaryMaxInr, locale as LocaleCode)} / yr
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Programme Structure</CardDescription>
              <CardTitle>
                {branch.durationYears} Years · {branch.totalSemesters} Semesters
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Who it suits */}
        <Card>
          <CardHeader>
            <CardTitle>Who this branch suits</CardTitle>
            <CardDescription>{branch.whoItSuits}</CardDescription>
          </CardHeader>
        </Card>

        {/* Core subjects & skills */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Core B.E. / B.Tech Subjects</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-1.5 text-sm">
                {branch.coreSubjects.map((sub) => (
                  <li key={sub}>{sub}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>High-Value Skills & Tools</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-1.5 text-sm">
                {branch.keySkills.map((skill) => (
                  <li key={skill}>{skill}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Careers, Recruiters & Higher Studies */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Target Career Roles</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {branch.careerRoles.map((role) => (
                  <li key={role}>• {role}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Recruiters in India</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {branch.topRecruitersIndia.map((rec) => (
                  <span key={rec} className="bg-muted/50 rounded-md border px-2.5 py-1 text-xs">
                    {rec}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">GATE & Higher Studies</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm">
                {branch.higherStudiesPaths.map((path) => (
                  <li key={path}>• {path}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* 8-Semester Roadmap Template Preview */}
        <section aria-labelledby="roadmap-preview-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="roadmap-preview-heading" className="text-2xl font-bold tracking-tight">
                Standard 4-Year (8-Semester) Career Roadmap
              </h2>
              <p className="text-muted-foreground text-sm">
                Semester-by-semester blueprint for {branch.title}. Sign in to customize and track
                this roadmap in your private workspace.
              </p>
            </div>
            <Button asChild>
              <Link href="/sign-up">Lock in this branch roadmap</Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {branch.roadmapMilestones.map((m) => (
              <Card key={m.code}>
                <CardHeader>
                  <div className="flex items-center justify-between text-xs">
                    <span className="bg-primary/10 text-primary rounded px-2 py-0.5 font-bold">
                      Semester {m.semester} (Year {Math.ceil(m.semester / 2)})
                    </span>
                    <span className="text-muted-foreground uppercase">{m.category}</span>
                  </div>
                  <CardTitle className="mt-1 text-base">{m.title}</CardTitle>
                  <CardDescription>{m.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </Container>
  );
}
