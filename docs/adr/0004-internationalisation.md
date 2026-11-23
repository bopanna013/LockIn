# ADR 0004 — Internationalisation from day one

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

English ships first; Kannada and Hindi follow (Phase 7) and more languages may come later.

## Decision

- `packages/i18n/src/locales.ts` is the single locale registry (`en` enabled, `kn`/`hi` registered but disabled).
- Routes are always locale-prefixed (`/en/...`). Routing is derived from the registry.
- All UI strings live in `apps/web/messages/<locale>.json`; keys are type-checked.
- Missing translations fall back to English (UI messages and content).
- Content tables get companion `*_translations` tables referencing `content.locales` (from Phase 2).
- Fonts: Noto Sans family per script, self-hosted (no external font CDN on a LAN).

## Consequences

Adding a language = registry entry + message file + translated content. No code changes.
