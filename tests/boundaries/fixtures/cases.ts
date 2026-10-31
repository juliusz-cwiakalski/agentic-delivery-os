/**
 * Fixture case definitions for TC-SCAFFOLD-008..015.
 *
 * Every case materialises in a temp workspace (see `harness.ts`); the probe is
 * injected only after the clean cruise. Case ids are the registry keys.
 */
import type { PackageName } from "./harness";

export type Expectation = "violation" | "clean";

export type RuleCase = {
  id: string;
  tc: string;
  rule: string;
  expect: Expectation;
  packages: PackageName[];
  probe: string;
  source: string;
  extraFiles?: Record<string, string>;
  wholePackage?: boolean;
};

const dep = (
  id: string,
  tc: string,
  rule: string,
  packages: PackageName[],
  probe: string,
  source: string,
  extra: Partial<RuleCase> = {},
): RuleCase => ({ id, tc, rule, expect: "violation", packages, probe, source, ...extra });

const clean = (
  id: string,
  tc: string,
  packages: PackageName[],
  probe: string,
  source: string,
  extra: Partial<RuleCase> = {},
): RuleCase => ({ id, tc, rule: "", expect: "clean", packages, probe, source, ...extra });

export const RULE_CASES: RuleCase[] = [
  // --- TC-008 package matrix (7 forbidden + 5 allowed-cell controls)
  dep(
    "matrix-cli-mcp",
    "TC-SCAFFOLD-008",
    "matrix-cli-importer",
    ["cli", "mcp"],
    "packages/cli/src/probe.ts",
    'import "@delivery-os/mcp";\n',
  ),
  dep(
    "matrix-mcp-opencode",
    "TC-SCAFFOLD-008",
    "matrix-mcp-importer",
    ["mcp", "opencode"],
    "packages/mcp/src/probe.ts",
    'import "@delivery-os/opencode";\n',
  ),
  dep(
    "matrix-core-adapters",
    "TC-SCAFFOLD-008",
    "matrix-core-importer",
    ["core", "adapters"],
    "packages/core/src/probe.ts",
    'import "@delivery-os/adapters/registry";\n',
  ),
  dep(
    "matrix-core-config-adapters",
    "TC-SCAFFOLD-008",
    "matrix-core-importer",
    ["core", "adapters"],
    "packages/core/src/config/probe.ts",
    'import "@delivery-os/adapters/file";\n',
  ),
  dep(
    "matrix-opencode-cli",
    "TC-SCAFFOLD-008",
    "matrix-opencode-importer",
    ["opencode", "cli"],
    "packages/opencode/src/probe.ts",
    'import "@delivery-os/cli";\n',
  ),
  dep(
    "matrix-adapters-cli-alias",
    "TC-SCAFFOLD-008",
    "matrix-adapters-importer",
    ["adapters", "cli"],
    "packages/adapters/src/probe.ts",
    'import "@delivery-os/cli";\n',
  ),
  dep(
    "matrix-adapters-opencode-alias",
    "TC-SCAFFOLD-008",
    "matrix-adapters-importer",
    ["adapters", "opencode"],
    "packages/adapters/src/probe.ts",
    'import "@delivery-os/opencode";\n',
  ),
  dep(
    "matrix-adapters-mcp-relative",
    "TC-SCAFFOLD-008",
    "matrix-adapters-importer",
    ["adapters", "mcp"],
    "packages/adapters/src/probe.ts",
    'import "../../mcp/src/index.ts";\n',
  ),

  clean(
    "matrix-control-adapters-core-contracts",
    "TC-SCAFFOLD-008",
    ["adapters", "core"],
    "packages/adapters/src/probe.ts",
    'import "@delivery-os/core/contracts";\n',
  ),
  clean(
    "matrix-control-cli-adapters",
    "TC-SCAFFOLD-008",
    ["cli", "adapters"],
    "packages/cli/src/probe.ts",
    'import "@delivery-os/adapters/registry";\n',
  ),
  clean(
    "matrix-control-mcp-adapters",
    "TC-SCAFFOLD-008",
    ["mcp", "adapters"],
    "packages/mcp/src/probe.ts",
    'import "@delivery-os/adapters/registry";\n',
  ),
  clean(
    "matrix-control-opencode-adapters",
    "TC-SCAFFOLD-008",
    ["opencode", "adapters"],
    "packages/opencode/src/probe.ts",
    'import "@delivery-os/adapters/registry";\n',
  ),
  clean(
    "matrix-control-testkit-adapters",
    "TC-SCAFFOLD-008",
    ["testkit", "adapters"],
    "packages/testkit/src/probe.ts",
    'import "@delivery-os/adapters/registry";\n',
  ),

  // --- TC-009 core subpath permissions (4 forbidden forms + controls)
  dep(
    "subpath-adapters-core-state",
    "TC-SCAFFOLD-009",
    "subpath-adapters-core-state",
    ["adapters", "core"],
    "packages/adapters/src/probe.ts",
    'import "@delivery-os/core/state";\n',
  ),
  dep(
    "subpath-adapters-core-branding",
    "TC-SCAFFOLD-009",
    "subpath-adapters-core-branding",
    ["adapters", "core"],
    "packages/adapters/src/probe.ts",
    'import "@delivery-os/core/branding";\n',
  ),
  dep(
    "subpath-adapters-core-root",
    "TC-SCAFFOLD-009",
    "subpath-undeclared",
    ["adapters", "core"],
    "packages/adapters/src/probe.ts",
    'import "@delivery-os/core";\n',
    { wholePackage: true },
  ),
  dep(
    "subpath-testkit-core-state",
    "TC-SCAFFOLD-009",
    "subpath-undeclared",
    ["testkit", "core"],
    "packages/testkit/src/probe.ts",
    'import "@delivery-os/core/state";\n',
  ),

  clean(
    "subpath-control-adapters-contracts",
    "TC-SCAFFOLD-009",
    ["adapters", "core"],
    "packages/adapters/src/probe.ts",
    'import "@delivery-os/core/contracts";\n',
  ),
  clean(
    "subpath-control-cli-core",
    "TC-SCAFFOLD-009",
    ["cli", "core"],
    "packages/cli/src/probe.ts",
    'import "@delivery-os/core";\nimport "@delivery-os/core/contracts";\nimport "@delivery-os/core/state";\nimport "@delivery-os/core/branding";\n',
  ),
  clean(
    "subpath-control-mcp-core",
    "TC-SCAFFOLD-009",
    ["mcp", "core"],
    "packages/mcp/src/probe.ts",
    'import "@delivery-os/core";\nimport "@delivery-os/core/contracts";\nimport "@delivery-os/core/state";\nimport "@delivery-os/core/branding";\n',
  ),
  clean(
    "subpath-control-opencode-core",
    "TC-SCAFFOLD-009",
    ["opencode", "core"],
    "packages/opencode/src/probe.ts",
    'import "@delivery-os/core";\nimport "@delivery-os/core/contracts";\nimport "@delivery-os/core/state";\nimport "@delivery-os/core/branding";\n',
  ),
  clean(
    "subpath-control-testkit-core",
    "TC-SCAFFOLD-009",
    ["testkit", "core"],
    "packages/testkit/src/probe.ts",
    'import "@delivery-os/core";\nimport "@delivery-os/core/contracts";\n',
  ),

  // --- TC-010 deep and relative cross-package imports
  dep(
    "deep-import",
    "TC-SCAFFOLD-010",
    "no-deep-package-import",
    ["cli", "core"],
    "packages/cli/src/probe.ts",
    'import "@delivery-os/core/src/domain/x";\n',
  ),
  // A missing export in a pre-build workspace is unresolvable; the rule fails
  // it by name instead of letting the package-name edge silently pass.
  dep(
    "workspace-import-unresolved",
    "TC-SCAFFOLD-009",
    "workspace-import-must-resolve",
    ["cli", "core"],
    "packages/cli/src/probe.ts",
    'import "@delivery-os/core/nonexistent";\n',
  ),
  dep(
    "relative-escape-core",
    "TC-SCAFFOLD-010",
    "no-relative-cross-package-import",
    ["cli", "core"],
    "packages/cli/src/probe.ts",
    'import "../../core/src/domain/index.ts";\n',
  ),
  dep(
    "relative-escape-adapters",
    "TC-SCAFFOLD-010",
    "no-relative-cross-package-import",
    ["opencode", "adapters"],
    "packages/opencode/src/probe.ts",
    'import "../../adapters/src/registry/index.ts";\n',
  ),

  // --- TC-011 core tier violations, alias form
  dep(
    "tier-domain-app",
    "TC-SCAFFOLD-011",
    "tier-domain-only-contracts",
    ["core"],
    "packages/core/src/domain/probe.ts",
    'import "#app/index";\n',
  ),
  dep(
    "tier-domain-state",
    "TC-SCAFFOLD-011",
    "tier-domain-only-contracts",
    ["core"],
    "packages/core/src/domain/probe.ts",
    'import "#state/index";\n',
  ),
  dep(
    "tier-config-domain",
    "TC-SCAFFOLD-011",
    "tier-config-only-contracts",
    ["core"],
    "packages/core/src/config/probe.ts",
    'import "#domain/index";\n',
  ),
  dep(
    "tier-config-branding",
    "TC-SCAFFOLD-011",
    "tier-config-only-contracts",
    ["core"],
    "packages/core/src/config/probe.ts",
    'import "#branding/index";\n',
  ),
  dep(
    "tier-branding-app",
    "TC-SCAFFOLD-011",
    "tier-branding-only-contracts",
    ["core"],
    "packages/core/src/branding/probe.ts",
    'import "#app/index";\n',
  ),
  dep(
    "tier-app-branding",
    "TC-SCAFFOLD-011",
    "tier-app-allowed-set",
    ["core"],
    "packages/core/src/app/probe.ts",
    'import "#branding/index";\n',
  ),
  dep(
    "tier-app-state",
    "TC-SCAFFOLD-011",
    "tier-app-allowed-set",
    ["core"],
    "packages/core/src/app/probe.ts",
    'import "#state/index";\n',
  ),
  dep(
    "tier-state-domain",
    "TC-SCAFFOLD-011",
    "tier-state-allowed-set",
    ["core"],
    "packages/core/src/state/probe.ts",
    'import "#domain/index";\n',
  ),

  clean(
    "tier-control-domain-contracts",
    "TC-SCAFFOLD-011",
    ["core"],
    "packages/core/src/domain/probe.ts",
    'import "#contracts";\n',
  ),
  clean(
    "tier-control-app-domain",
    "TC-SCAFFOLD-011",
    ["core"],
    "packages/core/src/app/probe.ts",
    'import "#domain/index";\n',
  ),

  // --- TC-012 core tier violations, relative form (same rule names)
  dep(
    "tier-relative-domain-app",
    "TC-SCAFFOLD-012",
    "tier-domain-only-contracts",
    ["core"],
    "packages/core/src/domain/probe.ts",
    'import "../app/index.ts";\n',
  ),
  dep(
    "tier-relative-domain-state",
    "TC-SCAFFOLD-012",
    "tier-domain-only-contracts",
    ["core"],
    "packages/core/src/domain/probe.ts",
    'import "../state/index.ts";\n',
  ),
  dep(
    "tier-relative-config-domain",
    "TC-SCAFFOLD-012",
    "tier-config-only-contracts",
    ["core"],
    "packages/core/src/config/probe.ts",
    'import "../domain/index.ts";\n',
  ),
  dep(
    "tier-relative-branding-app",
    "TC-SCAFFOLD-012",
    "tier-branding-only-contracts",
    ["core"],
    "packages/core/src/branding/probe.ts",
    'import "../app/index.ts";\n',
  ),
  dep(
    "tier-relative-app-branding",
    "TC-SCAFFOLD-012",
    "tier-app-allowed-set",
    ["core"],
    "packages/core/src/app/probe.ts",
    'import "../branding/index.ts";\n',
  ),
  dep(
    "tier-relative-app-state",
    "TC-SCAFFOLD-012",
    "tier-app-allowed-set",
    ["core"],
    "packages/core/src/app/probe.ts",
    'import "../state/index.ts";\n',
  ),
  dep(
    "tier-relative-state-domain",
    "TC-SCAFFOLD-012",
    "tier-state-allowed-set",
    ["core"],
    "packages/core/src/state/probe.ts",
    'import "../domain/index.ts";\n',
  ),

  // --- TC-013 testkit dev edges (8 forbidden + 2 passing controls)
  dep(
    "testkit-prod-core",
    "TC-SCAFFOLD-013",
    "testkit-no-production-import",
    ["core", "testkit"],
    "packages/core/src/probe.ts",
    'import "@delivery-os/testkit";\n',
  ),
  dep(
    "testkit-prod-adapters",
    "TC-SCAFFOLD-013",
    "testkit-no-production-import",
    ["adapters", "testkit"],
    "packages/adapters/src/probe.ts",
    'import "@delivery-os/testkit";\n',
  ),
  dep(
    "testkit-prod-cli",
    "TC-SCAFFOLD-013",
    "testkit-no-production-import",
    ["cli", "testkit"],
    "packages/cli/src/probe.ts",
    'import "@delivery-os/testkit";\n',
  ),
  dep(
    "testkit-prod-mcp",
    "TC-SCAFFOLD-013",
    "testkit-no-production-import",
    ["mcp", "testkit"],
    "packages/mcp/src/probe.ts",
    'import "@delivery-os/testkit";\n',
  ),
  dep(
    "testkit-prod-opencode",
    "TC-SCAFFOLD-013",
    "testkit-no-production-import",
    ["opencode", "testkit"],
    "packages/opencode/src/probe.ts",
    'import "@delivery-os/testkit";\n',
  ),
  dep(
    "testkit-surface-cli",
    "TC-SCAFFOLD-013",
    "testkit-no-surface-import",
    ["testkit", "cli"],
    "packages/testkit/src/probe.ts",
    'import "@delivery-os/cli";\n',
  ),
  dep(
    "testkit-surface-mcp",
    "TC-SCAFFOLD-013",
    "testkit-no-surface-import",
    ["testkit", "mcp"],
    "packages/testkit/src/probe.ts",
    'import "@delivery-os/mcp";\n',
  ),
  dep(
    "testkit-surface-opencode",
    "TC-SCAFFOLD-013",
    "testkit-no-surface-import",
    ["testkit", "opencode"],
    "packages/testkit/src/probe.ts",
    'import "@delivery-os/opencode";\n',
  ),

  clean(
    "testkit-control-package-test",
    "TC-SCAFFOLD-013",
    ["core", "testkit"],
    "packages/core/test/probe.test.ts",
    'import "@delivery-os/testkit";\n',
  ),
  clean(
    "testkit-control-root-e2e",
    "TC-SCAFFOLD-013",
    ["testkit"],
    "e2e/m0.test.ts",
    'import "@delivery-os/testkit";\n',
    {
      extraFiles: { "bdd/m0.test.ts": 'import "@delivery-os/testkit";\n' },
    },
  ),

  // --- TC-014 runtime-API confinement (3 forbidden + 2 controls)
  dep(
    "runtime-node-fs-domain",
    "TC-SCAFFOLD-014",
    "runtime-apis-confinement",
    ["core"],
    "packages/core/src/domain/probe.ts",
    'import fs from "node:fs";\nexport const value = fs;\n',
  ),
  dep(
    "runtime-bun-config",
    "TC-SCAFFOLD-014",
    "runtime-apis-confinement",
    ["core"],
    "packages/core/src/config/probe.ts",
    'import { test } from "bun:test";\nexport const value = test;\n',
  ),
  dep(
    "runtime-node-sqlite-app",
    "TC-SCAFFOLD-014",
    "runtime-apis-confinement",
    ["core"],
    "packages/core/src/app/probe.ts",
    'import { DatabaseSync } from "node:sqlite";\nexport const value = DatabaseSync;\n',
  ),
  // Provider/registry subpaths are not ADR I/O subpaths: runtime APIs stay banned.
  dep(
    "runtime-node-fs-adapter-registry",
    "TC-SCAFFOLD-014",
    "runtime-apis-confinement",
    ["adapters"],
    "packages/adapters/src/registry/probe.ts",
    'import fs from "node:fs";\nexport const value = fs;\n',
  ),
  dep(
    "runtime-node-fs-adapter-io",
    "TC-SCAFFOLD-014",
    "runtime-apis-confinement",
    ["adapters"],
    "packages/adapters/src/io/probe.ts",
    'import fs from "node:fs";\nexport const value = fs;\n',
  ),

  dep(
    "runtime-node-fs-state-facade",
    "TC-STATE-022",
    "runtime-apis-confinement",
    ["core"],
    "packages/core/src/state/probe.ts",
    'import fs from "node:fs";\nexport const value = fs;\n',
  ),
  clean(
    "runtime-control-state-driver",
    "TC-STATE-022",
    ["core"],
    "packages/core/src/state/driver/probe.ts",
    'import fs from "node:fs";\nexport const value = fs;\n',
  ),
  clean(
    "runtime-control-adapter-io",
    "TC-SCAFFOLD-014",
    ["adapters"],
    "packages/adapters/src/file/probe.ts",
    'import fs from "node:fs";\nexport const value = fs;\n',
  ),
  clean(
    "runtime-control-adapter-credentials",
    "TC-SCAFFOLD-014",
    ["adapters"],
    "packages/adapters/src/credentials/probe.ts",
    'import fs from "node:fs";\nexport const value = fs;\n',
  ),

  // --- GH-172 serialization entry point and CLI-only projection
  dep(
    "surface-serializer-command-import",
    "TC-BOUNDARY-002",
    "surface-serializer-entry-only",
    ["cli"],
    "packages/cli/src/commands/probe.ts",
    'import "../output/serialize.ts";\n',
    {
      extraFiles: {
        "packages/cli/src/output/serialize.ts": 'export const serialize = (): string => "";\n',
      },
    },
  ),
  clean(
    "surface-serializer-entry-clean",
    "TC-BOUNDARY-002",
    ["cli"],
    "packages/cli/src/index.ts",
    'import "./output/serialize.ts";\n',
    {
      extraFiles: {
        "packages/cli/src/output/serialize.ts": 'export const serialize = (): string => "";\n',
      },
    },
  ),
  dep(
    "surface-projection-mcp-import",
    "TC-EXIT-003",
    "surface-projection-cli-only",
    ["mcp", "cli"],
    "packages/mcp/src/probe.ts",
    'import "../../cli/src/projection.ts";\n',
    {
      extraFiles: {
        "packages/cli/src/projection.ts": "export const projectExitCode = (): number => 0;\n",
      },
    },
  ),
  dep(
    "surface-projection-opencode-import",
    "TC-EXIT-003",
    "surface-projection-cli-only",
    ["opencode", "cli"],
    "packages/opencode/src/probe.ts",
    'import "../../cli/src/projection.ts";\n',
    {
      extraFiles: {
        "packages/cli/src/projection.ts": "export const projectExitCode = (): number => 0;\n",
      },
    },
  ),
  dep(
    "surface-projection-adapters-import",
    "TC-EXIT-003",
    "surface-projection-cli-only",
    ["adapters", "cli"],
    "packages/adapters/src/probe.ts",
    'import "../../cli/src/projection.ts";\n',
    {
      extraFiles: {
        "packages/cli/src/projection.ts": "export const projectExitCode = (): number => 0;\n",
      },
    },
  ),
  clean(
    "surface-projection-command-clean",
    "TC-EXIT-003",
    ["cli"],
    "packages/cli/src/commands/probe.ts",
    'import "../projection.ts";\n',
    {
      extraFiles: {
        "packages/cli/src/projection.ts": "export const projectExitCode = (): number => 0;\n",
      },
    },
  ),
];

export type AmbientCase = {
  id: string;
  tc: string;
  rule: string;
  expect: Expectation;
  probe: string;
  source: string;
};

const ambient = (
  id: string,
  rule: string,
  probe: string,
  source: string,
  expect: Expectation = "violation",
): AmbientCase => ({ id, tc: "TC-SCAFFOLD-015", rule, expect, probe, source });

const GLOBALS: Record<string, string> = {
  process: "export const value = process;\n",
  bun: "export const value = Bun;\n",
  deno: "export const value = Deno;\n",
  "set-timeout": "export const value = setTimeout;\n",
  "set-interval": "export const value = setInterval;\n",
  "date-now": "export const value = Date.now();\n",
  "math-random": "export const value = Math.random();\n",
  fetch: "export const value = fetch;\n",
};

const NEUTRAL_TIERS = ["domain", "app", "config", "branding"] as const;

export const AMBIENT_CASES: AmbientCase[] = [
  ambient(
    "ambient-branding-process-env",
    "ambient-env-branding",
    "packages/core/src/branding/probe.ts",
    "export const value = process.env.EXAMPLE;\n",
  ),
  ambient(
    "ambient-branding-bun-env",
    "ambient-env-branding",
    "packages/core/src/branding/probe.ts",
    "export const value = Bun.env.EXAMPLE;\n",
  ),
  ambient(
    "ambient-contracts-process-env",
    "ambient-globals-neutral-tiers",
    "packages/core/src/contracts/result.ts",
    "export const value = process.env.EXAMPLE;\n",
  ),
  ambient(
    "ambient-index-process-env",
    "ambient-globals-neutral-tiers",
    "packages/core/src/index.ts",
    "export const value = process.env.EXAMPLE;\n",
  ),
  ambient(
    "ambient-index-fetch",
    "ambient-globals-neutral-tiers",
    "packages/core/src/index.ts",
    "export const value = fetch;\n",
  ),
  ...Object.entries(GLOBALS).flatMap(([globalName, source]) =>
    NEUTRAL_TIERS.map((tier) =>
      ambient(
        `ambient-sweep-${tier}-${globalName}`,
        "ambient-globals-neutral-tiers",
        `packages/core/src/${tier}/probe.ts`,
        source,
      ),
    ),
  ),
  ambient(
    "ambient-control-cli-surface",
    "",
    "packages/cli/src/probe.ts",
    "export const a = process.env.EXAMPLE;\nexport const b = fetch;\nexport const c = Date.now();\n",
    "clean",
  ),
  ambient(
    "ambient-control-core-state",
    "",
    "packages/core/src/state/probe.ts",
    "export const a = process.env.EXAMPLE;\nexport const b = fetch;\nexport const c = Date.now();\n",
    "clean",
  ),
];

export const ALL_RULE_CASES = RULE_CASES;
export const DEPCRUISE_VIOLATION_CASES = RULE_CASES.filter((entry) => entry.expect === "violation");
export const AMBIENT_VIOLATION_CASES = AMBIENT_CASES.filter(
  (entry) => entry.expect === "violation",
);
