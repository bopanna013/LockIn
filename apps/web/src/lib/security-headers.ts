/**
 * HTTP security headers applied to every response by next.config.ts.
 *
 * HSTS is intentionally NOT set here: Caddy terminates TLS and owns that header
 * (see infra/caddy/Caddyfile), so it is never sent over plain-HTTP dev servers.
 *
 * CSP note: Next.js inlines small bootstrap scripts, so `script-src` currently needs
 * 'unsafe-inline'. Moving to per-request nonces is tracked for Phase 6 hardening
 * (docs/adr/0005-security-baseline.md).
 */
export interface SecurityHeaderOptions {
  isDev: boolean;
  /** True when served over HTTPS (Caddy). Enables upgrade-insecure-requests. */
  isHttps?: boolean;
}

export function buildContentSecurityPolicy({
  isDev,
  isHttps = false,
}: SecurityHeaderOptions): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...(isDev ? ["ws:", "wss:"] : [])],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
  };

  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!isDev && isHttps) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

export function buildSecurityHeaders(
  options: SecurityHeaderOptions,
): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  ];
}
