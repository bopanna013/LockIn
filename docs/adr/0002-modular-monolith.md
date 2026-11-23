# ADR 0002 — Modular monolith with enforced boundaries

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

Microservices would add operational cost a LAN deployment and small team can't justify, but a single tangled codebase would become unmaintainable.

## Decision

One deployable web app (plus a background worker from Phase 1) built from internal packages:

- `packages/domain` — pure business logic, one folder per module. No framework/DB imports.
- `packages/db` — schemas, migrations, repository implementations.
- `packages/ui` — presentational design system only.
- `packages/i18n` — locale registry and formatting.
- `apps/web` — routes, server actions and composition; calls domain services.

Boundaries are enforced by `.dependency-cruiser.cjs` in CI (`pnpm deps:check`).

## Consequences

- Modules can be extracted into services later if ever needed.
- Business rules are unit-testable without a browser or database.
