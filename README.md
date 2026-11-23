# LOCKIN

Engineering branch discovery and four-year B.E./B.Tech roadmap platform for Indian students.

> **Status:** Phase 0 (Foundations). See [docs/adr](docs/adr) for architecture decisions.

## Prerequisites

- Node.js **26 LTS** (`.node-version`), pnpm **12**
- Docker Desktop (WSL2 backend), running
- Git

## First-time setup

```powershell
pnpm install
Copy-Item .env.example .env        # then replace every CHANGE_ME value
pnpm db:up                         # Postgres, MinIO, Mailpit on 127.0.0.1
pnpm db:bootstrap                  # create least-privilege roles (once)
pnpm db:migrate                    # apply migrations
pnpm db:seed                       # reference data (locales)
pnpm dev                           # http://localhost:3000
```

| Service       | URL                              |
| ------------- | -------------------------------- |
| App           | http://localhost:3000            |
| Health check  | http://localhost:3000/api/health |
| Mailpit inbox | http://localhost:8025            |
| MinIO console | http://localhost:9001            |

## Everyday commands

| Command                        | What it does                                               |
| ------------------------------ | ---------------------------------------------------------- |
| `pnpm dev`                     | Run the web app with hot reload                            |
| `pnpm lint` / `pnpm typecheck` | Static checks                                              |
| `pnpm test`                    | Unit tests                                                 |
| `pnpm test:integration`        | DB tests in a throwaway Postgres container (needs Docker)  |
| `pnpm deps:check`              | Enforce architectural boundaries                           |
| `pnpm format`                  | Format all files                                           |
| `pnpm db:generate`             | Create a migration after changing `packages/db/src/schema` |
| `pnpm db:studio`               | Browse the database                                        |

## Repository layout

```
apps/web            Next.js app (public site, student app, admin CMS)
packages/domain     Pure business logic (no framework / DB imports)
packages/db         Schemas (content | student | system), migrations, seeds
packages/i18n       Locale registry, fallback, Indian formatting
packages/ui         Design system
packages/config     Shared TypeScript presets
infra/compose       Docker Compose files
docs/adr            Architecture Decision Records
```

## Core rule

Educational **content** and individual **student data** live in separate Postgres schemas accessed by separate database roles. The CMS role physically cannot read student data. See [ADR 0003](docs/adr/0003-content-student-data-separation.md).
