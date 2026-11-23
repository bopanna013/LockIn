import { getStudentProfile } from "@lockin/db";
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
          <Button asChild variant="outline">
            <Link href="/onboarding">
              {profile ? "Edit Academic Profile" : "Complete Onboarding"}
            </Link>
          </Button>
        </div>

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
      </div>
    </Container>
  );
}
