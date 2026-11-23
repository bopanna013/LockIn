# ADR 0003 — Separating educational content from student data

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

Educational content (branches, careers, roadmap templates) is shared and editor-managed. Student data (profiles, assessments, roadmaps, progress) is private personal data, including data about minors under India's DPDP Act 2023.

## Decision

1. **Three Postgres schemas:** `content`, `student`, `system`.
2. **Four roles**, created by `pnpm db:bootstrap`, granted in migration `0001`:

   | Role           | content            | student    | system |
   | -------------- | ------------------ | ---------- | ------ |
   | `lockin_owner` | owner (migrations) | owner      | owner  |
   | `lockin_app`   | SELECT             | CRUD (RLS) | CRUD   |
   | `lockin_cms`   | CRUD               | **none**   | none   |
   | superuser      | bootstrap only     |            |        |

3. **Row-Level Security** on every `student.*` table, keyed on `system.current_user_id()` / `system.current_org_id()`, set per transaction by `withRequestContext()`. An integration test fails if any student table lacks RLS.
4. Student records reference content by **stable slug + release id**. Content edits never silently mutate a student's roadmap.
5. Code-level rule: `domain/catalog` and `domain/cms` may not import student modules (dependency-cruiser).

## Consequences

- A bug in the CMS cannot read or leak student data — the database refuses.
- A missed authorization check in app code is backstopped by RLS.
- Student data can be exported/deleted independently of content.
