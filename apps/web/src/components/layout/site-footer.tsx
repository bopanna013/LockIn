import { Container } from "@lockin/ui/components/container";
import { getTranslations } from "next-intl/server";
import { Logo } from "./logo";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t">
      <Container className="flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="text-muted-foreground text-sm">{t("tagline")}</p>
        </div>
        <div className="text-muted-foreground flex flex-col gap-2 text-sm sm:items-end">
          <nav aria-label="Legal" className="flex gap-4">
            <span aria-disabled>{t("privacy")}</span>
            <span aria-disabled>{t("terms")}</span>
          </nav>
          <p>{t("rights", { year })}</p>
        </div>
      </Container>
    </footer>
  );
}
