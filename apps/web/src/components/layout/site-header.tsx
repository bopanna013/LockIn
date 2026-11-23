import { Button } from "@lockin/ui/components/button";
import { Container } from "@lockin/ui/components/container";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";

/** Primary navigation. Items are disabled until their phase ships. */
export const NAV_ITEMS = [
  { key: "explore", href: "/branches", enabled: false },
  { key: "discover", href: "/discover", enabled: false },
  { key: "roadmap", href: "/roadmap", enabled: false },
] as const;

export async function SiteHeader() {
  const t = await getTranslations("nav");

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
                <span
                  aria-disabled
                  title={t("comingSoon")}
                  className="text-muted-foreground/70 cursor-not-allowed rounded-md px-3 py-2 text-sm font-medium"
                >
                  {t(item.key)}
                </span>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
          <Button
            variant="ghost"
            className="hidden sm:inline-flex"
            disabled
            title={t("comingSoon")}
          >
            {t("signIn")}
          </Button>
          <Button className="hidden sm:inline-flex" disabled title={t("comingSoon")}>
            {t("getStarted")}
          </Button>
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
