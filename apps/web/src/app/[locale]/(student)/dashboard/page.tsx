import { getLatestStudentRecommendation, getStudentProfile, getStudentRoadmap } from "@lockin/db";
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
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { appDb, getCurrentSession } from "@/lib/session";
import { deleteAccountAction } from "@/server/auth-actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
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

  const profile =
    session.user.accountStatus === "active"
      ? await getStudentProfile(appDb(), {
          userId: session.user.id,
          orgId: session.orgId,
        })
      : null;

  const latestRec =
    session.user.accountStatus === "active"
      ? await getLatestStudentRecommendation(appDb(), {
          userId: session.user.id,
          orgId: session.orgId,
        })
      : null;

  const roadmapAggregate =
    session.user.accountStatus === "active"
      ? await getStudentRoadmap(appDb(), {
          userId: session.user.id,
          orgId: session.orgId,
        })
      : null;

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-primary text-xs font-semibold tracking-wider uppercase">
              Student Workspace
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Welcome, {session.user.fullName}
            </h1>
            <p className="text-muted-foreground text-sm">
              {session.user.email} · Status:{" "}
              <span className="font-semibold uppercase">{session.user.accountStatus}</span>
              {session.user.isMinor ? " · Minor (<18, DPDP Guardian Approved)" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/roadmap">
                {roadmapAggregate
                  ? `4-Yr Roadmap (${roadmapAggregate.progress.overallPercent}%)`
                  : "Build 4-Yr Roadmap"}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/discover">
                {latestRec ? "Retake Fit Assessment" : "Find My Branch Fit"}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/onboarding">
                {profile ? "Edit Academic Profile" : "Complete Onboarding"}
              </Link>
            </Button>
          </div>
        </div>

        {latestRec && (
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader>
              <CardTitle>
                Top Branch Recommendations (
                {profile?.selectedBranchSlug
                  ? `Locked in: ${profile.selectedBranchSlug}`
                  : "Not locked in yet"}
                )
              </CardTitle>
              <CardDescription>
                Based on your discovery assessment (Algorithm {latestRec.algorithmVersion}).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {latestRec.rankedBranches.slice(0, 3).map((b) => (
                <div key={b.branchSlug} className="bg-card rounded-lg border p-3 text-sm">
                  <div className="text-primary flex items-center justify-between text-xs font-bold">
                    <span>
                      #{b.rank} {b.branchCode}
                    </span>
                    <span>{b.fitScore}% Fit</span>
                  </div>
                  <p className="mt-1 font-semibold">{b.branchTitle}</p>
                  <p className="text-muted-foreground mt-1 text-xs">{b.explanation}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {session.user.accountStatus === "restricted" ? (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle>Account Restricted</CardTitle>
              <CardDescription>
                Your parent or guardian revoked consent. Personal profile, assessment, and roadmap
                features are disabled until a guardian re-approves.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : profile ? (
          <Card>
            <CardHeader>
              <CardTitle>Your Academic Profile</CardTitle>
              <CardDescription>
                Isolated by Row-Level Security under your personal organization (
                <code>{session.orgId}</code>).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Current Stage:</span>{" "}
                <strong>{profile.educationStage}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Board:</span>{" "}
                <strong>{profile.academicBoard}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Target Exams:</span>{" "}
                <strong>{profile.targetExams.join(", ") || "None specified"}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Preferred States:</span>{" "}
                <strong>{profile.preferredStates.join(", ") || "All-India"}</strong>
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Interests:</span>{" "}
                <strong>{profile.interests.join(", ") || "Not added yet"}</strong>
              </div>
              {profile.careerGoalSummary && (
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">Career Goal:</span>{" "}
                  <p className="text-foreground mt-1">{profile.careerGoalSummary}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Complete your 1-minute onboarding</CardTitle>
              <CardDescription>
                Tell us your current class/year, board (CBSE/ICSE/State), and target entrance exams
                so LOCKIN can tailor your engineering branch recommendations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/onboarding">Start academic onboarding</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* DPDP Act 2023 Self-Service Privacy & Data Portability */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Privacy, Data Portability & Right to Erasure (DPDP Act 2023)
            </CardTitle>
            <CardDescription>
              Download a complete machine-readable JSON copy of all personal data in your workspace
              or permanently erase your account. Educational catalog content in{" "}
              <code>content.*</code> is never affected.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <Button asChild variant="outline" size="sm">
              <a href="/api/privacy/export" download>
                Download My Personal Data (JSON)
              </a>
            </Button>

            <form action={deleteAccountAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="locale" value={locale} />
              <input
                name="confirmText"
                type="text"
                required
                pattern="DELETE"
                placeholder='Type "DELETE" to confirm'
                className="bg-background h-9 rounded-md border px-2.5 text-xs"
              />
              <Button type="submit" variant="destructive" size="sm">
                Permanently Delete Account
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
