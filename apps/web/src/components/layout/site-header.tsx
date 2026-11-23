import { Button } from "@lockin/ui/components/button";
import { Container } from "@lockin/ui/components/container";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getCurrentSession } from "@/lib/session";
import { signOutAction } from "@/server/auth-actions";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";

/** Primary navigation. Items are disabled until their phase ships. */
export const NAV_ITEMS = [
  { key: "explore", href: "/branches", enabled: true },
  { key: "discover", href: "/discover", enabled: true },
  { key: "roadmap", href: "/roadmap", enabled: false },
] as const;

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const locale = await getLocale();
  const session = await getCurrentSession();

  return (
    <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 border-b backdrop-blur">
      <Container className="flex h-16 items-center gap-4">
        <Link
          href="/"
          className="focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
          <Logo />
        </Link>

        <nav aria-label="Primary" className="ml-6 hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                {item.enabled ? (
                  <Link
                    href={item.href}
                    className="hover:bg-muted rounded-md px-3 py-2 text-sm font-medium transition-colors"
                  >
                    {t(item.key)}
                  </Link>
                ) : (
                  <span
                    aria-disabled
                    title={t("comingSoon")}
                    className="text-muted-foreground/70 cursor-not-allowed rounded-md px-3 py-2 text-sm font-medium"
                  >
                    {t(item.key)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
          {session ? (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <form action={signOutAction} className="hidden sm:inline-flex">
                <input type="hidden" name="locale" value={locale} />
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href="/sign-in">{t("signIn")}</Link>
              </Button>
              <Button asChild className="hidden sm:inline-flex">
                <Link href="/sign-up">{t("getStarted")}</Link>
              </Button>
            </>
          )}
          <MobileNav
            labels={{
              items: NAV_ITEMS.map((item) => t(item.key)),
              signIn: t("signIn"),
              getStarted: t("getStarted"),
              comingSoon: t("comingSoon"),
            }}
          />
        </div>
      </Container>
    </header>
  );
}
