# ADR 0001 — Technology stack

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

LOCKIN is a production-grade, multi-user web app for Indian engineering aspirants, self-hosted on a local network, maintained by a small team.

## Decision

| Concern    | Choice                                                                             |
| ---------- | ---------------------------------------------------------------------------------- |
| Runtime    | Node.js 26 LTS (supported until April 2029)                                        |
| Language   | TypeScript 6 (strict). TS 7 (native) postponed until typescript-eslint supports it |
| Web        | Next.js 16 App Router, React 19                                                    |
| Styling    | Tailwind CSS v4 + shadcn/ui-style components on Radix                              |
| i18n       | next-intl 4, registry in `@lockin/i18n`                                            |
| Database   | PostgreSQL 17, Drizzle ORM, SQL migrations in git                                  |
| Validation | Zod 4                                                                              |
| Monorepo   | pnpm 12 workspaces + Turborepo                                                     |
| Tests      | Vitest (unit), Testcontainers (DB integration), Playwright (E2E, from Phase 1)     |

## Consequences

- One language end to end; shared types and schemas.
- All components can be self-hosted (no cloud lock-in).
- pnpm's `allowBuilds` allow-list blocks install scripts from unknown packages (supply-chain hardening).
