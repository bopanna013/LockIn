# ADR 0005 — Security baseline

- **Status:** Accepted
- **Date:** 2026-11-16

## Decision

- **Headers** (`apps/web/src/lib/security-headers.ts`): CSP, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP. HSTS is set by Caddy (TLS terminator).
- **Secrets** only in `.env` (git-ignored); validated with Zod at startup.
- **Database:** least-privilege roles, RLS, no writes to `public`, parameterized queries only.
- **Logging:** structured JSON (pino) with redaction of passwords, tokens, OTPs and cookies.
- **Supply chain:** lockfile committed, pnpm build-script allow-list, CI on every change.
- **Dev services** bind to `127.0.0.1` only.
- **Privacy:** no third-party scripts, trackers or font CDNs.

## Known gaps (scheduled)

| Gap                                                                | Phase |
| ------------------------------------------------------------------ | ----- |
| CSP uses `'unsafe-inline'` for scripts; move to per-request nonces | 6     |
| Rate limiting on auth/OTP endpoints                                | 1     |
| Session security, CSRF on mutations, 2FA                           | 1     |
| Upload scanning and size/type limits                               | 5     |
| OWASP ASVS L2 review, dependency scanning                          | 6     |
