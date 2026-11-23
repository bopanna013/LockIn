import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, buildSecurityHeaders } from "./security-headers";

describe("security headers", () => {
  it("never allows eval or websockets in production", () => {
    const csp = buildContentSecurityPolicy({ isDev: false, isHttps: true });
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("ws:");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("does not force HTTPS upgrades when served over plain HTTP", () => {
    expect(buildContentSecurityPolicy({ isDev: false, isHttps: false })).not.toContain(
      "upgrade-insecure-requests",
    );
  });

  it("allows dev tooling only in development", () => {
    const csp = buildContentSecurityPolicy({ isDev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("blocks framing and plugins", () => {
    const csp = buildContentSecurityPolicy({ isDev: false });
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("includes the baseline hardening headers", () => {
    const keys = buildSecurityHeaders({ isDev: false }).map((header) => header.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
      ]),
    );
  });
});
