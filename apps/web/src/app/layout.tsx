import type { ReactNode } from "react";

/**
 * The real root layout (with <html>) lives in app/[locale]/layout.tsx so the
 * `lang` attribute always matches the active language. Non-localized routes
 * such as /api/* do not render HTML.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
