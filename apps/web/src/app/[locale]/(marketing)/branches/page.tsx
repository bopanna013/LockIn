import {
  getPublishedBranchBySlug,
  listPublishedBranches,
  listPublishedEntranceExams,
} from "@lockin/db";
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

export default async function BranchesExplorerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; q?: string; compare?: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const sp = await searchParams;
  const db = appDb();
  const allBranches = await listPublishedBranches(db, locale as LocaleCode);
  const filteredBranches = await listPublishedBranches(db, locale as LocaleCode, {
    category: sp.category || undefined,
    search: sp.q || undefined,
  });
  const exams = await listPublishedEntranceExams(db, locale as LocaleCode);

  const categories = Array.from(new Set(allBranches.map((b) => b.category)));
  const compareSlugs = (sp.compare ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  const comparedBranches = await Promise.all(
    compareSlugs.map((slug) => getPublishedBranchBySlug(db, slug, locale as LocaleCode)),
  );
  const validCompared = comparedBranches.filter((b): b is NonNullable<typeof b> => b !== null);

  return (
    <Container className="py-12 sm:py-16">
      <div className="flex flex-col gap-10">
        <div>
          <p className="text-primary text-xs font-semibold tracking-wider uppercase">
            India B.E. / B.Tech Catalog
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            Explore Engineering Branches
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Compare curricula, core subjects, Indian placement salary bands, top recruiters, GATE /
            higher-studies paths, and 8-semester roadmaps.
          </p>
        </div>

        {/* Filter bar */}
        <form method="get" className="bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-4">
          <input
            type="search"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search branch, subject, career (e.g. VLSI, Robotics, SDE)…"
            className="bg-background h-10 rounded-md border px-3 text-sm sm:col-span-2"
          />
          <select
            name="category"
            defaultValue={sp.category ?? ""}
            className="bg-background h-10 rounded-md border px-3 text-sm"
          >
            <option value="">All disciplines ({allBranches.length})</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              Filter
            </Button>
            {(sp.q || sp.category || sp.compare) && (
              <Button asChild variant="outline">
                <Link href="/branches">Reset</Link>
              </Button>
            )}
          </div>
        </form>

        {/* Side-by-side comparison tray */}
        {validCompared.length > 0 && (
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader>
              <CardTitle>Branch Comparison ({validCompared.length} selected)</CardTitle>
              <CardDescription>
                Side-by-side comparison of entry-level & mid-career Indian compensation, core
                subjects, and recruiters.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {validCompared.map((b) => (
                  <div key={b.id} className="bg-card rounded-lg border p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="bg-primary/10 text-primary rounded px-2 py-0.5 text-xs font-bold">
                        {b.code}
                      </span>
                      <span className="text-muted-foreground text-xs">{b.category}</span>
                    </div>
                    <h3 className="mt-2 font-semibold">{b.title}</h3>
                    <dl className="mt-3 space-y-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Entry Package (India):</dt>
                        <dd className="font-semibold">
                          {formatInr(b.entrySalaryMinInr, locale as LocaleCode)} –{" "}
                          {formatInr(b.entrySalaryMaxInr, locale as LocaleCode)} / yr
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Mid-Career Potential:</dt>
                        <dd className="font-semibold">
                          Up to {formatInr(b.midCareerSalaryMaxInr, locale as LocaleCode)} / yr
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Key Subjects:</dt>
                        <dd>{b.coreSubjects.slice(0, 4).join(", ")}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Top Recruiters:</dt>
                        <dd>{b.topRecruitersIndia.slice(0, 4).join(", ")}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Branch cards grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {filteredBranches.map((branch) => {
            const isCompared = compareSlugs.includes(branch.slug);
            const nextCompare = isCompared
              ? compareSlugs.filter((s) => s !== branch.slug)
              : [...compareSlugs.slice(0, 2), branch.slug];
            const compareHref = `/branches?compare=${encodeURIComponent(nextCompare.join(","))}`;

            return (
              <Card key={branch.id} className="flex flex-col justify-between">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <span className="bg-primary/10 text-primary rounded-md px-2.5 py-1 text-xs font-bold">
                      {branch.code}
                    </span>
                    <span className="text-muted-foreground text-xs">{branch.category}</span>
                  </div>
                  <CardTitle className="mt-2 text-xl">{branch.title}</CardTitle>
                  <CardDescription>{branch.shortSummary}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 text-sm">
                  <div className="bg-muted/60 grid grid-cols-2 gap-2 rounded-lg p-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Entry CTC (India):</span>
                      <p className="text-foreground font-semibold">
                        {formatInr(branch.entrySalaryMinInr, locale as LocaleCode)} –{" "}
                        {formatInr(branch.entrySalaryMaxInr, locale as LocaleCode)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>
                      <p className="text-foreground font-semibold">
                        {branch.durationYears} Years ({branch.totalSemesters} Semesters)
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-muted-foreground text-xs font-medium">Career Roles:</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {branch.careerRoles.map((role) => (
                        <span
                          key={role}
                          className="bg-background rounded-full border px-2.5 py-0.5 text-xs"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2 pt-2">
                    <Button asChild className="flex-1">
                      <Link href={`/branches/${branch.slug}`}>View Curriculum & 4-Yr Roadmap</Link>
                    </Button>
                    <Button asChild variant={isCompared ? "secondary" : "outline"} size="sm">
                      <Link href={compareHref}>{isCompared ? "Comparing ✓" : "+ Compare"}</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Indian Entrance Exams reference */}
        <section aria-labelledby="exams-heading" className="border-t pt-10">
          <h2 id="exams-heading" className="text-2xl font-bold tracking-tight">
            Major Indian Engineering Entrance Exams
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Key national, state (Karnataka), and university exams for B.E./B.Tech admission.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {exams.map((exam) => (
              <Card key={exam.id}>
                <CardHeader>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-primary font-bold">{exam.shortName}</span>
                    <span className="text-muted-foreground">{exam.level}</span>
                  </div>
                  <CardTitle className="text-base">{exam.fullName}</CardTitle>
                  <CardDescription>{exam.summary}</CardDescription>
                </CardHeader>
                <CardContent className="text-muted-foreground space-y-1.5 text-xs">
                  <p>
                    <strong>Conducting Body:</strong> {exam.conductingBody}
                  </p>
                  <p>
                    <strong>Typical Window:</strong> {exam.typicalMonth}
                  </p>
                  <p>
                    <strong>Eligibility:</strong> {exam.eligibilitySummary}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </Container>
  );
}
