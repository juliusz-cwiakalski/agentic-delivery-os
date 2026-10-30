/**
 * Root dependency-cruiser configuration — ADR-0003 DEC-2 enforcement.
 *
 * Adapted from marksync-for-confluence/.dependency-cruiser.cjs (MIT License,
 * source path: marksync-for-confluence/.dependency-cruiser.cjs) for the resolver
 * options block. Rule names, scopes, and allowed sets come from ADR-0003 DEC-2
 * (and are mirrored verbatim in chg-GH-170-test-plan.md §4.1).
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
const RELATIVE_IMPORTERS = ["core", "adapters", "cli", "mcp", "opencode", "testkit"];

module.exports = {
  forbidden: [
    // --- DEC-2 package matrix: one rule per importer row (testkit edges owned below).
    {
      name: "matrix-core-importer",
      severity: "error",
      comment: "ADR-0003 DEC-2 package matrix: core must not import adapters, cli, mcp, or opencode.",
      from: { path: "^packages/core/" },
      to: { path: "^packages/(adapters|cli|mcp|opencode)/" },
    },
    {
      name: "matrix-adapters-importer",
      severity: "error",
      comment:
        "ADR-0003 DEC-2 package matrix: adapters must not import cli, mcp, or opencode (alias and relative forms resolve here).",
      from: { path: "^packages/adapters/" },
      to: { path: "^packages/(cli|mcp|opencode)/" },
    },
    {
      name: "matrix-cli-importer",
      severity: "error",
      comment: "ADR-0003 DEC-2 package matrix: cli must not import mcp or opencode.",
      from: { path: "^packages/cli/" },
      to: { path: "^packages/(mcp|opencode)/" },
    },
    {
      name: "matrix-mcp-importer",
      severity: "error",
      comment: "ADR-0003 DEC-2 package matrix: mcp must not import cli or opencode.",
      from: { path: "^packages/mcp/" },
      to: { path: "^packages/(cli|opencode)/" },
    },
    {
      name: "matrix-opencode-importer",
      severity: "error",
      comment: "ADR-0003 DEC-2 package matrix: opencode must not import cli or mcp.",
      from: { path: "^packages/opencode/" },
      to: { path: "^packages/(cli|mcp)/" },
    },

    // --- DEC-2 core subpath permissions for the adapters importer.
    // Package-name specifiers resolve through each manifest's `exports` to its
    // built `dist` target in production, so the to-path covers both resolution
    // forms: source (`src`) in-tree and built (`dist`) for package-name imports.
    {
      name: "subpath-adapters-core-state",
      severity: "error",
      comment: "ADR-0003 DEC-2 subpath table: adapters may not import core ./state.",
      from: { path: "^packages/adapters/" },
      to: { path: "^packages/core/(src|dist)/state/" },
    },
    {
      name: "subpath-adapters-core-branding",
      severity: "error",
      comment: "ADR-0003 DEC-2 subpath table: adapters may not import core ./branding.",
      from: { path: "^packages/adapters/" },
      to: { path: "^packages/core/(src|dist)/branding/" },
    },
    {
      name: "subpath-undeclared",
      severity: "error",
      comment:
        "ADR-0003 DEC-2 subpath preamble: adapters do not declare the core package root `.` (whole-package undeclared import).",
      from: { path: "^packages/adapters/" },
      to: { path: "^packages/core/(src|dist)/index\\.(ts|js)$" },
    },
    {
      name: "subpath-undeclared",
      severity: "error",
      comment:
        "ADR-0003 DEC-2 subpath preamble: testkit declares only core `.` and ./contracts; any other core subpath is undeclared (subpath-level).",
      from: { path: "^packages/testkit/" },
      to: { path: "^packages/core/(src|dist)/(state|branding)/" },
    },

    // --- DEC-2 Additional rules bullet 7: no deep package imports.
    {
      name: "no-deep-package-import",
      severity: "error",
      comment:
        "ADR-0003 DEC-2: deep imports into another package's src/ or dist/ are forbidden; declared name + declared subpath only.",
      from: { path: "^packages/" },
      to: { couldNotResolve: true, path: "^@delivery-os/[^/]+/(src|dist)/" },
    },
    // --- DEC-2 subpath preamble: a package-name import must resolve. In a
    // pre-build workspace (no `dist` yet) an undeclared @delivery-os/* specifier
    // is unresolvable; failing it by name keeps the rule live before the build.
    {
      name: "workspace-import-must-resolve",
      severity: "error",
      comment:
        "ADR-0003 DEC-2 subpath preamble: every @delivery-os/* import must resolve to a declared workspace package and subpath; an unresolvable specifier fails by name.",
      from: {},
      to: { couldNotResolve: true, path: "^@delivery-os/" },
    },
    // --- DEC-2 Additional rules bullet 7: no relative path escaping the package root.
    ...RELATIVE_IMPORTERS.map((importer) => ({
      name: "no-relative-cross-package-import",
      severity: "error",
      comment:
        "ADR-0003 DEC-2: no package may import another package through a relative path that escapes its own root.",
      from: { path: `^packages/${importer}/` },
      to: {
        path: "^packages/",
        pathNot: `^packages/${importer}/`,
        dependencyTypes: ["local"],
        dependencyTypesNot: ["aliased"],
      },
    })),

    // --- DEC-2 core tier matrix (form-independent: alias and relative both resolve here).
    {
      name: "tier-domain-only-contracts",
      severity: "error",
      comment: "ADR-0003 DEC-2: domain may import ./contracts only.",
      from: { path: "^packages/core/src/domain/" },
      to: { path: "^packages/core/src/(app|config|branding|state)/" },
    },
    {
      name: "tier-config-only-contracts",
      severity: "error",
      comment: "ADR-0003 DEC-2: config may import ./contracts only.",
      from: { path: "^packages/core/src/config/" },
      to: { path: "^packages/core/src/(domain|app|branding|state)/" },
    },
    {
      name: "tier-branding-only-contracts",
      severity: "error",
      comment: "ADR-0003 DEC-2: branding may import ./contracts only.",
      from: { path: "^packages/core/src/branding/" },
      to: { path: "^packages/core/src/(domain|app|config|state)/" },
    },
    {
      name: "tier-app-allowed-set",
      severity: "error",
      comment:
        "ADR-0003 DEC-2: app may import domain, config, and ./contracts; branding and state are forbidden at scaffold (A-T7).",
      from: { path: "^packages/core/src/app/" },
      to: { path: "^packages/core/src/(branding|state)/" },
    },
    {
      name: "tier-state-allowed-set",
      severity: "error",
      comment: "ADR-0003 DEC-2: state may import ./contracts only.",
      from: { path: "^packages/core/src/state/" },
      to: { path: "^packages/core/src/(domain|app|config|branding)/" },
    },

    // --- DEC-2 dev-edge table.
    {
      name: "testkit-no-production-import",
      severity: "error",
      comment:
        "ADR-0003 DEC-2 dev-edge row 1: packages/*/src must not import testkit; package test dirs use devDependencies.",
      from: { path: "^packages/(core|adapters|cli|mcp|opencode)/src/" },
      to: { path: "^packages/testkit/" },
    },
    {
      name: "testkit-no-surface-import",
      severity: "error",
      comment:
        "ADR-0003 DEC-2 dev-edge row 4: testkit may import core and adapters, never cli, mcp, or opencode.",
      from: { path: "^packages/testkit/" },
      to: { path: "^packages/(cli|mcp|opencode)/" },
    },

    // --- GH-172 result-contract boundaries: one serialization entry point and
    // a CLI-only exit projection. Both ship with failing fixtures + clean controls.
    {
      name: "surface-serializer-entry-only",
      severity: "error",
      comment:
        "GH-172: only the CLI surface entry may import the serialization module; command modules must not write streams.",
      from: {
        path: "^packages/cli/src/",
        pathNot: "^packages/cli/src/index\\.ts$",
      },
      to: { path: "^packages/cli/(src|dist)/output/serialize\\." },
    },
    {
      name: "surface-projection-cli-only",
      severity: "error",
      comment:
        "GH-172: the exit-code projection may not be imported from core, adapters, mcp, or opencode; the standalone CLI owns it.",
      from: { path: "^packages/(core|adapters|mcp|opencode)/" },
      to: { path: "^packages/cli/(src|dist)/projection\\." },
    },

    // --- DEC-2 Additional rules bullet 6: runtime-API confinement.
    // Allowlist (ADR verbatim): the `core ./state` driver code, the adapter I/O
    // subpaths, the CLI build, and the OpenCode host integration. Nothing else.
    // The adapter I/O subpaths are ADR DEC-6's I/O modules
    // (repo|file|host|session|legacy); provider/registry subpaths are not I/O.
    {
      name: "runtime-apis-confinement",
      severity: "error",
      comment:
        "ADR-0003 DEC-2 allowlist: runtime APIs are permitted only in the `core ./state` driver code, the adapter I/O subpaths, the CLI build, and the OpenCode host integration.",
      from: {
        path: "^packages/",
        pathNot: [
          "^packages/core/src/state/",
          "^packages/adapters/src/(repo|file|host|session|legacy)/",
          "^packages/cli/",
          "^packages/opencode/",
        ],
      },
      to: { dependencyTypes: ["core"] },
    },
  ],

  options: {
    // `dist` is not followed, but it is intentionally NOT excluded: production
    // package-name imports resolve through `exports` to `dist`, and an excluded
    // target is dropped from the cruise (inert package-name rules). Excluding it
    // from the cruise would only hide exactly the edges DEC-2 must police.
    doNotFollow: { path: "node_modules|(^|/)dist/" },
    exclude: { path: "(^|/)node_modules/|(^|/)coverage/" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      extensions: [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".json"],
      mainFields: ["module", "main"],
    },
    tsPreCompilationDeps: true,
    combinedDependencies: false,
    moduleSystems: ["es6", "cjs"],
  },
};
