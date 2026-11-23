import { listContentReleases, listPublishedBranches } from "@lockin/db";
import { hasPermission } from "@lockin/domain/organization";
import { formatInr, type LocaleCode } from "@lockin/i18n";
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
import { CmsBranchEditorForm, CmsPublishReleaseForm } from "@/components/cms/cms-forms";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { appDb, getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminContentCmsPage({
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

  const actor = {
    type: "user" as const,
    userId: session.user.id,
    orgId: session.orgId,
    globalRoles: session.user.globalRoles,
  };
  const canEdit = hasPermission(actor, "cms:read_drafts");

  const db = appDb();
  const branches = await listPublishedBranches(db, locale as LocaleCode, { includeDrafts: true });
  const releases = await listContentReleases(db);

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div>
          <p className="text-primary text-xs font-semibold tracking-wider uppercase">
            LOCKIN Editorial CMS (`content` schema)
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Engineering Content & Release Management
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Non-technical editorial studio. Uses the isolated <code>lockin_cms</code> database role,
            which has zero access to <code>student.*</code> tables.
          </p>
        </div>

        {!canEdit ? (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle>Editor or Admin Role Required</CardTitle>
              <CardDescription>
                Your account ({session.user.email}) currently has roles:{" "}
                <code>[{session.user.globalRoles.join(", ") || "student"}]</code>. Only users with{" "}
                <code>editor</code>, <code>translator</code>, or <code>admin</code> global roles can
                modify educational content.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <CmsBranchEditorForm />
            </div>
            <div className="flex flex-col gap-6">
              <CmsPublishReleaseForm />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Release History</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y text-xs">
                    {releases.map((rel) => (
                      <li key={rel.id} className="py-2">
                        <div className="flex items-center justify-between font-semibold">
                          <span>v{rel.versionNumber}</span>
                          {rel.isActive && (
                            <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-foreground mt-0.5">{rel.label}</p>
                        <p className="text-muted-foreground">
                          {new Date(rel.publishedAt).toLocaleDateString("en-IN")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>All Branches in Catalog ({branches.length})</CardTitle>
            <CardDescription>Includes published branches and drafts.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y text-sm">
              {branches.map((b) => (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <span className="bg-primary/10 text-primary mr-2 rounded px-2 py-0.5 text-xs font-bold">
                      {b.code}
                    </span>
                    <Link href={`/branches/${b.slug}`} className="font-medium hover:underline">
                      {b.title}
                    </Link>
                    <span className="text-muted-foreground ml-2 text-xs">({b.slug})</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span>
                      {formatInr(b.entrySalaryMinInr, locale as LocaleCode)} –{" "}
                      {formatInr(b.entrySalaryMaxInr, locale as LocaleCode)}
                    </span>
                    <span className="rounded border px-2 py-0.5 font-semibold uppercase">
                      {b.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
