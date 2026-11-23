import { getStudentProfile, getStudentRoadmap, listPublishedBranches } from "@lockin/db";
import type { LocaleCode } from "@lockin/i18n";
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
import { AddCustomMilestoneForm } from "@/components/roadmap/add-milestone-form";
import { routing } from "@/i18n/routing";
import { appDb, getCurrentSession } from "@/lib/session";
import {
  generateRoadmapAction,
  syncRoadmapReleaseAction,
  updateRoadmapItemAction,
} from "@/server/roadmap-actions";

export const dynamic = "force-dynamic";

export default async function RoadmapPlannerPage({
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
  if (session.user.accountStatus === "pending_guardian") {
    redirect(`/${locale}/guardian-consent`);
  }

  const db = appDb();
  const context = { userId: session.user.id, orgId: session.orgId };
  const branches = await listPublishedBranches(db, locale as LocaleCode);
  const profile =
    session.user.accountStatus === "active" ? await getStudentProfile(db, context) : null;
  const aggregate =
    session.user.accountStatus === "active" ? await getStudentRoadmap(db, context) : null;

  const defaultBranchSlug =
    aggregate?.roadmap.branchSlug ??
    profile?.selectedBranchSlug ??
    branches[0]?.slug ??
    "computer-science-engineering";

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-primary text-xs font-semibold tracking-wider uppercase">
              4-Year B.E. / B.Tech Career Roadmap Planner
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              {aggregate ? aggregate.roadmap.title : "Generate Your 8-Semester Engineering Roadmap"}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
              {aggregate
                ? `Pinned to Content Release v${aggregate.roadmap.templateReleaseVersion} · Isolated in your private RLS workspace.`
                : "Select your target engineering branch below to generate a personalized 8-semester roadmap."}
            </p>
          </div>

          <form action={generateRoadmapAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="locale" value={locale} />
            <select
              name="branchSlug"
              defaultValue={defaultBranchSlug}
              className="bg-background h-10 rounded-md border px-3 text-sm"
            >
              {branches.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.code} — {b.title}
                </option>
              ))}
            </select>
            <Button type="submit" variant={aggregate ? "outline" : "default"}>
              {aggregate ? "Switch / Reset Branch Roadmap" : "Generate 4-Year Roadmap"}
            </Button>
          </form>
        </div>

        {/* Non-destructive template update banner */}
        {aggregate?.hasTemplateUpdateAvailable && (
          <Card className="border-primary bg-primary/5">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base">
                    New Content Release Available (v{aggregate.latestActiveReleaseVersion})
                  </CardTitle>
                  <CardDescription>
                    LOCKIN editors published an updated curriculum release. Your roadmap stays
                    pinned to v{aggregate.roadmap.templateReleaseVersion} until you choose to merge
                    any new template milestones (your completed milestones and custom goals are
                    preserved).
                  </CardDescription>
                </div>
                <form action={syncRoadmapReleaseAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <Button type="submit" size="sm">
                    Sync New Milestones (Non-Destructive)
                  </Button>
                </form>
              </div>
            </CardHeader>
          </Card>
        )}

        {aggregate && (
          <>
            {/* Overall & Year-by-Year Progress Summary */}
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>
                    Overall Four-Year Progress: {aggregate.progress.overallPercent}% (
                    {aggregate.progress.completedItems} of {aggregate.progress.totalItems}{" "}
                    milestones completed)
                  </CardTitle>
                  <span className="text-muted-foreground text-xs">
                    {aggregate.progress.inProgressItems} currently in progress
                  </span>
                </div>
                <div className="bg-muted mt-2 h-3 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${aggregate.progress.overallPercent}%` }}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                  {aggregate.progress.bySemester.map((sem) => (
                    <div
                      key={sem.semester}
                      className="bg-muted/40 rounded-lg border p-2.5 text-center"
                    >
                      <p className="text-primary text-xs font-semibold">Sem {sem.semester}</p>
                      <p className="text-muted-foreground text-[11px]">Year {sem.year}</p>
                      <p className="mt-1 text-base font-bold">{sem.completionPercent}%</p>
                      <p className="text-muted-foreground text-[11px]">
                        {sem.completedItems}/{sem.totalItems}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Semester-by-Semester Milestones */}
            <div className="space-y-8">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((semester) => {
                const semItems = aggregate.items.filter((i) => i.semester === semester);
                return (
                  <section key={semester} className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h2 className="text-xl font-bold">
                        Year {Math.ceil(semester / 2)} · Semester {semester}
                      </h2>
                      <span className="text-muted-foreground text-xs">
                        {semItems.filter((i) => i.status === "completed").length} of{" "}
                        {semItems.length} completed
                      </span>
                    </div>

                    <div className="grid gap-4">
                      {semItems.map((item) => (
                        <Card
                          key={item.id}
                          className={
                            item.status === "completed"
                              ? "border-primary/40 bg-primary/5"
                              : undefined
                          }
                        >
                          <CardHeader>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="bg-primary/10 text-primary rounded px-2 py-0.5 font-bold uppercase">
                                  {item.category}
                                </span>
                                {item.isCustom && (
                                  <span className="rounded border px-2 py-0.5 font-medium">
                                    Custom Goal
                                  </span>
                                )}
                              </div>
                              <span className="text-muted-foreground font-semibold uppercase">
                                Status: {item.status.replace("_", " ")}
                              </span>
                            </div>
                            <CardTitle className="mt-1 text-base">{item.title}</CardTitle>
                            <CardDescription>{item.description}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <form
                              action={updateRoadmapItemAction}
                              className="grid gap-3 border-t pt-3 sm:grid-cols-4"
                            >
                              <input type="hidden" name="locale" value={locale} />
                              <input type="hidden" name="itemId" value={item.id} />

                              <select
                                name="status"
                                defaultValue={item.status}
                                className="bg-background h-9 rounded-md border px-2.5 text-xs font-medium"
                              >
                                <option value="todo">To Do</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed ✓</option>
                              </select>

                              <input
                                name="evidenceUrl"
                                type="url"
                                defaultValue={item.evidenceUrl ?? ""}
                                placeholder="Evidence URL (GitHub repo, certificate link)…"
                                className="bg-background h-9 rounded-md border px-2.5 text-xs"
                              />

                              <input
                                name="reflectionNotes"
                                type="text"
                                defaultValue={item.reflectionNotes ?? ""}
                                placeholder="Reflection / key takeaway…"
                                className="bg-background h-9 rounded-md border px-2.5 text-xs"
                              />

                              <Button type="submit" size="sm" variant="secondary">
                                Save Progress
                              </Button>
                            </form>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            <AddCustomMilestoneForm locale={locale} />
          </>
        )}
      </div>
    </Container>
  );
}
