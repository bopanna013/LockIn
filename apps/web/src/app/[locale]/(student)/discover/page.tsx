import { getLatestStudentRecommendation, getStudentProfile } from "@lockin/db";
import { DIMENSION_LABELS, FIT_DIMENSIONS } from "@lockin/domain/recommendation";
import { Button } from "@lockin/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lockin/ui/components/card";
import { Container } from "@lockin/ui/components/container";
import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { DiscoveryQuestionnaireForm } from "@/components/discovery/discovery-form";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { appDb, getCurrentSession } from "@/lib/session";
import { selectBranchAction } from "@/server/discovery-actions";

export const dynamic = "force-dynamic";

export default async function DiscoverPage({ params }: { params: Promise<{ locale: string }> }) {
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

  const db = appDb();
  const context = { userId: session.user.id, orgId: session.orgId };
  const latestRec =
    session.user.accountStatus === "active"
      ? await getLatestStudentRecommendation(db, context)
      : null;
  const profile =
    session.user.accountStatus === "active" ? await getStudentProfile(db, context) : null;

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <div>
          <p className="text-primary text-xs font-semibold tracking-wider uppercase">
            Explainable Engineering Discovery
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            Find Your B.E. / B.Tech Branch Fit
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Answer 14 questions across 7 core engineering dimensions. Results are stored privately
            in your RLS-isolated workspace and pinned to algorithm version{" "}
            <code>{latestRec?.algorithmVersion ?? "2026.11-v1.0.0"}</code>.
          </p>
        </div>

        {latestRec && (
          <section aria-labelledby="results-heading" className="space-y-6">
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle id="results-heading">Your Ranked Engineering Branch Matches</CardTitle>
                  <span className="text-muted-foreground text-xs">
                    Algorithm {latestRec.algorithmVersion} · Computed{" "}
                    {new Date(latestRec.createdAt).toLocaleString("en-IN")}
                  </span>
                </div>
                <CardDescription>
                  Top matches based on your 7-dimension engineering profile. Click &ldquo;Lock in
                  branch&rdquo; on any recommendation to set it as your target B.E./B.Tech branch.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 7-Dimension bar summary */}
                <div className="bg-card grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
                  {FIT_DIMENSIONS.map((dim) => {
                    const score = latestRec.dimensionScores[dim] ?? 50;
                    return (
                      <div key={dim} className="space-y-1 text-xs">
                        <div className="flex justify-between font-medium">
                          <span>{DIMENSION_LABELS[dim]}</span>
                          <span>{score}%</span>
                        </div>
                        <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                          <div
                            className="bg-primary h-full rounded-full"
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Ranked branches list */}
                <div className="grid gap-4 md:grid-cols-2">
                  {latestRec.rankedBranches.slice(0, 6).map((item) => {
                    const isSelected = profile?.selectedBranchSlug === item.branchSlug;
                    return (
                      <Card
                        key={item.branchSlug}
                        className={isSelected ? "border-primary border-2" : ""}
                      >
                        <CardHeader>
                          <div className="flex items-center justify-between gap-2">
                            <span className="bg-primary/10 text-primary rounded px-2.5 py-0.5 text-xs font-bold">
                              #{item.rank} · {item.branchCode}
                            </span>
                            <span className="text-primary text-base font-extrabold">
                              {item.fitScore}% Fit
                            </span>
                          </div>
                          <CardTitle className="mt-1 text-lg">{item.branchTitle}</CardTitle>
                          <CardDescription className="text-foreground/90">
                            {item.explanation}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                          <div className="flex flex-wrap gap-1.5 text-xs">
                            {item.topMatchingDimensions.map((d) => (
                              <span
                                key={d.dimension}
                                className="bg-muted/60 rounded-full border px-2.5 py-0.5"
                              >
                                {d.label}: {d.studentScore}%
                              </span>
                            ))}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <form action={selectBranchAction} className="flex-1">
                              <input type="hidden" name="locale" value={locale} />
                              <input type="hidden" name="branchSlug" value={item.branchSlug} />
                              <Button
                                type="submit"
                                variant={isSelected ? "secondary" : "default"}
                                className="w-full"
                              >
                                {isSelected ? "Locked In ✓" : "Lock in this branch"}
                              </Button>
                            </form>
                            <Button asChild variant="outline" size="sm">
                              <Link
                                href={`/branches?compare=${encodeURIComponent(
                                  latestRec.rankedBranches
                                    .slice(0, 3)
                                    .map((b) => b.branchSlug)
                                    .join(","),
                                )}`}
                              >
                                Compare Top 3
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        <DiscoveryQuestionnaireForm locale={locale} />
      </div>
    </Container>
  );
}
