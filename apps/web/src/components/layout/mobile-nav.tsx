"use client";

import { Button } from "@lockin/ui/components/button";
import { Container } from "@lockin/ui/components/container";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { usePathname } from "@/i18n/navigation";

interface MobileNavProps {
  labels: { items: string[]; signIn: string; getStarted: string; comingSoon: string };
}

export function MobileNav({ labels }: MobileNavProps) {
  // Remember which page the menu was opened on; navigating elsewhere closes it
  // automatically without a state-syncing effect.
  const pathname = usePathname();
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (value: boolean) => setOpenedOn(value ? pathname : null);
  const panelId = useId();
  const t = useTranslations("a11y");

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpenedOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? t("closeMenu") : t("openMenu")}
        onClick={() => setOpen(!open)}
      >
        {open ? <X aria-hidden /> : <Menu aria-hidden />}
      </Button>

      {open && (
        <div id={panelId} className="bg-background absolute inset-x-0 top-16 border-b shadow-lg">
          <Container className="flex flex-col gap-1 py-4">
            <nav aria-label="Mobile">
              <ul className="flex flex-col">
                {labels.items.map((label) => (
                  <li key={label}>
                    <span
                      aria-disabled
                      className="text-muted-foreground/70 block rounded-md px-3 py-3 text-base"
                    >
                      {label} <span className="text-xs">· {labels.comingSoon}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="mt-2 grid grid-cols-2 gap-2 border-t pt-4">
              <Button variant="outline" disabled>
                {labels.signIn}
              </Button>
              <Button disabled>{labels.getStarted}</Button>
            </div>
          </Container>
        </div>
      )}
    </div>
  );
}
