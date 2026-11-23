import { Button } from "@lockin/ui/components/button";
import { Container } from "@lockin/ui/components/container";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <Container className="flex flex-col items-center py-24 text-center">
      <p className="text-primary text-sm font-semibold">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground mt-4">{t("body")}</p>
      <Button asChild className="mt-8">
        <Link href="/">{t("back")}</Link>
      </Button>
    </Container>
  );
}
