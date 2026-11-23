# @lockin/domain

Pure business logic for LOCKIN, one folder per module (see the architecture plan):

| Folder                                       | Module                    | Added in  |
| -------------------------------------------- | ------------------------- | --------- |
| `shared/`                                    | Errors, `Result`, `Actor` | Phase 0   |
| `identity/`, `organization/`, `consent/`     | M2, M3, M4                | Phase 1   |
| `catalog/`, `cms/`                           | M5, M6                    | Phase 2   |
| `profile/`, `assessment/`, `recommendation/` | M7, M8, M9                | Phase 3   |
| `roadmap/`                                   | M10                       | Phase 4   |
| `progress/`, `notifications/`, `privacy/`    | M11, M13, M14             | Phase 5–6 |

## Rules (enforced by `.dependency-cruiser.cjs`)

- No imports from `next`, `react`, `@lockin/db`, `@lockin/ui` or any app.
- Content modules (`catalog`, `cms`) must never import student modules.
- Data access happens through repository **interfaces** defined here and implemented in `@lockin/db`.
