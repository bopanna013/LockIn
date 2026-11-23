/**
 * Architectural boundary rules. `pnpm deps:check` fails CI on any violation.
 * See docs/adr/0002-modular-monolith.md and 0003-content-student-data-separation.md.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-is-pure",
      comment: "Domain logic must not depend on frameworks, the database, UI or apps.",
      severity: "error",
      from: { path: "^packages/domain/" },
      to: {
        path: [
          "^apps/",
          "^packages/(db|ui)/",
          "node_modules/(next|react|react-dom|drizzle-orm|postgres|pino)/",
        ],
      },
    },
    {
      name: "content-never-depends-on-student-modules",
      comment: "Educational content modules must not know about individual student data.",
      severity: "error",
      from: { path: "^packages/domain/src/(catalog|cms)/" },
      to: {
        path: "^packages/domain/src/(profile|assessment|recommendation|roadmap|progress|consent|privacy)/",
      },
    },
    {
      name: "content-schema-never-references-student-schema",
      comment: "content.* tables must not reference student.* tables.",
      severity: "error",
      from: { path: "^packages/db/src/schema/content" },
      to: { path: "^packages/db/src/schema/student" },
    },
    {
      name: "packages-never-import-apps",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "ui-is-presentational",
      comment: "The design system must stay free of data access and business logic.",
      severity: "error",
      from: { path: "^packages/ui/" },
      to: { path: "^packages/(db|domain)/" },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(\\.next|dist|coverage|migrations)/" },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    tsConfig: { fileName: "apps/web/tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".mjs", ".json"],
    },
  },
};
