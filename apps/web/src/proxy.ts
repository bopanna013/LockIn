import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/**
 * Next.js 16 request proxy (formerly middleware).
 * Phase 0: locale negotiation and redirects (/ → /en).
 * Phase 1 adds the authentication and guardian-consent gates here.
 */
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals, and files with an extension (assets).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
