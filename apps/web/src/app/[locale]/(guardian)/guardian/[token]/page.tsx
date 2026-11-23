import { getGuardianPortalView } from "@lockin/db";
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
import { GuardianRevokeForm } from "@/components/auth/guardian-revoke-form";
import { routing } from "@/i18n/routing";
import { appDb } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function GuardianPortalPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  let view: Awaited<ReturnType<typeof getGuardianPortalView>>;
  try {
    view = await getGuardianPortalView(appDb(), token);
  } catch {
    notFound();
  }

  const isRestricted = view.student.accountStatus === "restricted";

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <p className="text-primary text-xs font-semibold tracking-wider uppercase">
            LOCKIN Guardian Portal (DPDP Act 2023)
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Data & Consent Summary for {view.student.fullName}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Guardian: <strong>{view.guardian.guardianFullName}</strong> (
            {view.guardian.relationship} · {view.guardian.guardianEmail})
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Student Account Summary</CardTitle>
            <CardDescription>
              Minimum identity details stored in <code>system.users</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Full Name:</span>{" "}
              <strong>{view.student.fullName}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Email:</span>{" "}
              <strong>{view.student.email}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Date of Birth:</span>{" "}
              <strong>{view.student.dateOfBirth}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Current Status:</span>{" "}
              <strong className="uppercase">{view.student.accountStatus}</strong>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Immutable Consent Ledger</CardTitle>
            <CardDescription>
              Every grant or revocation is permanently recorded in{" "}
              <code>system.guardian_consents</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {view.history.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <div>
                    <span className="font-semibold uppercase">{entry.action}</span> by{" "}
                    {entry.guardianFullName} ({entry.verificationMethod})
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Notice {entry.noticeVersion} ·{" "}
                    {new Date(entry.recordedAt).toLocaleString("en-IN")}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revoke Consent</CardTitle>
            <CardDescription>
              Revoking consent immediately transitions {view.student.fullName}&apos;s account to{" "}
              <code>restricted</code> status, terminates all active sessions, and blocks any new
              profile, assessment, or roadmap data from being stored.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GuardianRevokeForm portalToken={token} isCurrentlyRestricted={isRestricted} />
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
