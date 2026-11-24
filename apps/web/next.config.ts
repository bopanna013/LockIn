import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { buildSecurityHeaders } from "./src/lib/security-headers";

// Load the monorepo root .env using Node 26's built-in process.loadEnvFile()
const rootEnvPath = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnvPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(rootEnvPath);
}

const isDev = process.env.NODE_ENV !== "production";
const isHttps = (process.env.APP_URL ?? "").startsWith("https://");

const nextConfig: NextConfig = {
  // Self-contained server bundle for the production Docker image (Linux).
  // Opt-in because on Windows it needs symlink privileges (Developer Mode).
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  poweredByHeader: false,
  reactStrictMode: true,
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@lockin/ui", "@lockin/i18n", "@lockin/domain", "@lockin/db"],
  // Node-only libraries that must not be bundled.
  serverExternalPackages: ["pino", "postgres"],
  async headers() {
    return [{ source: "/:path*", headers: buildSecurityHeaders({ isDev, isHttps }) }];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
