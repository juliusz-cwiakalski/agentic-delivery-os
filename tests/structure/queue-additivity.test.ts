/**
 * TC-QLC-085 (GH-292, AC-NFR-6, NFR-7, NG-8) — the additive boundary is
 * mechanical: zero new packages, workspace subpaths, provider adapters, and
 * state schema versions; exactly two new queue error rows and one new queue
 * record kind, each by exact two-sided equality against the delivered
 * fixtures; the queue command module's export surface is exactly the
 * delivered set plus the two declared runtime members; and no root
 * dependency changed.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as queueCommands from "../../packages/cli/src/commands/queue";
import { ERROR_TABLE } from "../../packages/core/src/contracts/error-table";
import {
  QUEUE_DEPENDENCY_KEY_PREFIX,
  QUEUE_DEPENDENCY_RECORD_KIND,
  QUEUE_DEPENDENCY_SCHEMA,
  QUEUE_ENTRY_KEY_PREFIX,
  QUEUE_ENTRY_RECORD_KIND,
  QUEUE_ENTRY_SCHEMA,
  QUEUE_ERROR_CODES,
  QUEUE_GRAPH_SCHEMA,
  QUEUE_INCIDENT_KEY_PREFIX,
  QUEUE_INCIDENT_RECORD_KIND,
  QUEUE_INCIDENT_SCHEMA,
  QUEUE_LEASE_KEY_PREFIX,
  QUEUE_LEASE_RECORD_KIND,
  QUEUE_LEASE_SCHEMA,
  QUEUE_PARK_KEY_PREFIX,
  QUEUE_PARK_RECORD_KIND,
  QUEUE_PARK_SCHEMA,
  QUEUE_RECONCILE_STALE_STATES,
  QUEUE_RECORD_DECLARATIONS,
  QUEUE_REMOVAL_KEY_PREFIX,
  QUEUE_REMOVAL_REASONS,
  QUEUE_REMOVAL_RECORD_KIND,
  QUEUE_REMOVAL_SCHEMA,
} from "../../packages/core/src/contracts/queue";
import { STATE_SCHEMA_VERSION } from "../../packages/core/src/contracts/state";

const ROOT = process.cwd();

type ErrorTableEntry = { readonly domainKind: string; readonly code: string };

const queueRows = (): readonly string[] =>
  (ERROR_TABLE as readonly ErrorTableEntry[])
    .filter((entry) => entry.domainKind === "queue")
    .map((entry) => entry.code);

const workspaceGlobs = (): readonly string[] =>
  readFileSync(join(ROOT, "pnpm-workspace.yaml"), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim().replaceAll('"', ""));

type CapturedRecordKind = {
  readonly kind: string;
  readonly payloadSchema: string;
  readonly keyPrefix: string;
  readonly identityField: string;
};

const fixtureRows = (): readonly CapturedRecordKind[] => {
  const parsed = JSON.parse(
    readFileSync(join(ROOT, "tests/fixtures/queue/state/kinds/record-kinds.json"), "utf8"),
  ) as { records: readonly CapturedRecordKind[] };
  return parsed.records;
};

describe("TC-QLC-085 the additive boundary holds", () => {
  test("zero new packages and zero new workspace globs", () => {
    expect(workspaceGlobs()).toEqual(["packages/*"]);
    expect(readdirSync(join(ROOT, "packages")).sort()).toEqual([
      "adapters",
      "cli",
      "core",
      "mcp",
      "opencode",
      "testkit",
    ]);
    const root = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      name: string;
      packageManager: string;
      devDependencies: Record<string, string>;
    };
    expect(root.name).toBe("delivery-os");
    expect(root.packageManager).toBe("pnpm@10.18.3");
    expect(Object.keys(root.devDependencies).sort()).toEqual([
      "@arethetypeswrong/cli",
      "@biomejs/biome",
      "@changesets/cli",
      "@commitlint/cli",
      "@commitlint/config-conventional",
      "@delivery-os/adapters",
      "@delivery-os/cli",
      "@delivery-os/core",
      "@delivery-os/mcp",
      "@delivery-os/opencode",
      "@delivery-os/testkit",
      "@types/bun",
      "dependency-cruiser",
      "husky",
      "publint",
      "typescript",
      "yaml",
    ]);
  });

  test("zero new provider adapter subpaths", () => {
    expect(readdirSync(join(ROOT, "packages/adapters/src")).sort()).toEqual([
      "azure",
      "ci",
      "credentials",
      "daemon",
      "file",
      "git",
      "github",
      "gitlab",
      "harness",
      "host",
      "inference",
      "io",
      "jira",
      "legacy",
      "provider-quota",
      "registry",
      "repo",
      "session",
    ]);
  });

  test("the state schema version is unchanged and the record kinds grew exactly 5 -> 6", () => {
    expect(STATE_SCHEMA_VERSION).toBe("delivery.state.v1");
    expect(QUEUE_RECORD_DECLARATIONS.map((declaration) => declaration.kind)).toEqual([
      "queue.entry",
      "queue.dependency",
      "queue.lease",
      "queue.park",
      "queue.incident",
      "queue.removal",
    ]);
    for (const declaration of QUEUE_RECORD_DECLARATIONS) {
      expect(declaration.payloadSchema.startsWith("delivery.queue.")).toBe(true);
      expect(declaration.payloadSchema.endsWith(".v1")).toBe(true);
    }
    expect(QUEUE_REMOVAL_RECORD_KIND).toBe("queue.removal");
    expect(QUEUE_REMOVAL_SCHEMA).toBe("delivery.queue.removal.v1");
    expect(QUEUE_REMOVAL_KEY_PREFIX).toBe("queue.removals:");
  });

  test("the record-kind fixture equals the live declarations in both directions", () => {
    const live = QUEUE_RECORD_DECLARATIONS.map((declaration) => ({
      kind: declaration.kind,
      payloadSchema: declaration.payloadSchema,
      keyPrefix: declaration.keyPrefix,
      identityField: declaration.identityField,
    }));
    const captured = fixtureRows();
    expect(captured).toHaveLength(6);
    expect(captured).toEqual(live);
  });

  test("the queue error rows grew exactly 5 -> 7 in declared order, fixture equal both ways", () => {
    const declared = [
      "queue.dependency-cycle",
      "queue.lease-conflict",
      "queue.park-condition-stuck",
      "queue.entry.unobserved",
      "queue.precondition.unmet",
      "queue.reason-missing",
      "queue.single-flight",
    ];
    expect(queueRows()).toEqual(declared);
    expect([...QUEUE_ERROR_CODES]).toEqual(declared);
    const references = JSON.parse(
      readFileSync(join(ROOT, "tests/fixtures/queue/errors/references.json"), "utf8"),
    ) as { queueRows: readonly string[] };
    expect([...references.queueRows]).toEqual(declared);
  });

  test("the state-additivity baseline carries exactly the queue contract constants with live values", () => {
    const baseline = JSON.parse(
      readFileSync(join(ROOT, "tests/fixtures/events/state-additivity-baseline.json"), "utf8"),
    ) as { constants: Record<string, string> };
    const queueKeys = Object.keys(baseline.constants)
      .filter((key) => key.startsWith("queue.ts:"))
      .sort();
    expect(queueKeys).toEqual([
      "queue.ts:QUEUE_DEPENDENCY_KEY_PREFIX",
      "queue.ts:QUEUE_DEPENDENCY_RECORD_KIND",
      "queue.ts:QUEUE_DEPENDENCY_SCHEMA",
      "queue.ts:QUEUE_ENTRY_KEY_PREFIX",
      "queue.ts:QUEUE_ENTRY_RECORD_KIND",
      "queue.ts:QUEUE_ENTRY_SCHEMA",
      "queue.ts:QUEUE_GRAPH_SCHEMA",
      "queue.ts:QUEUE_INCIDENT_KEY_PREFIX",
      "queue.ts:QUEUE_INCIDENT_RECORD_KIND",
      "queue.ts:QUEUE_INCIDENT_SCHEMA",
      "queue.ts:QUEUE_LEASE_KEY_PREFIX",
      "queue.ts:QUEUE_LEASE_RECORD_KIND",
      "queue.ts:QUEUE_LEASE_SCHEMA",
      "queue.ts:QUEUE_PARK_KEY_PREFIX",
      "queue.ts:QUEUE_PARK_RECORD_KIND",
      "queue.ts:QUEUE_PARK_SCHEMA",
      "queue.ts:QUEUE_REMOVAL_KEY_PREFIX",
      "queue.ts:QUEUE_REMOVAL_RECORD_KIND",
      "queue.ts:QUEUE_REMOVAL_SCHEMA",
    ]);
    const live: Record<string, string> = {
      QUEUE_DEPENDENCY_KEY_PREFIX,
      QUEUE_DEPENDENCY_RECORD_KIND,
      QUEUE_DEPENDENCY_SCHEMA,
      QUEUE_ENTRY_KEY_PREFIX,
      QUEUE_ENTRY_RECORD_KIND,
      QUEUE_ENTRY_SCHEMA,
      QUEUE_GRAPH_SCHEMA,
      QUEUE_INCIDENT_KEY_PREFIX,
      QUEUE_INCIDENT_RECORD_KIND,
      QUEUE_INCIDENT_SCHEMA,
      QUEUE_LEASE_KEY_PREFIX,
      QUEUE_LEASE_RECORD_KIND,
      QUEUE_LEASE_SCHEMA,
      QUEUE_PARK_KEY_PREFIX,
      QUEUE_PARK_RECORD_KIND,
      QUEUE_PARK_SCHEMA,
      QUEUE_REMOVAL_KEY_PREFIX,
      QUEUE_REMOVAL_RECORD_KIND,
      QUEUE_REMOVAL_SCHEMA,
    };
    for (const key of queueKeys) {
      expect(baseline.constants[key]).toBe(live[key.slice("queue.ts:".length)] ?? "");
    }
  });

  test("the queue command module export surface is exactly the delivered set plus the two declared runtime members", () => {
    expect(Object.keys(queueCommands).sort()).toEqual([
      "QUEUE_CLAIM_RESULT_VALUES",
      "QUEUE_DEPENDENCY_MUTATION_RESULT_VALUES",
      "QUEUE_MAX_NEXT",
      "QUEUE_MAX_REFERENCE_CHARS",
      "QUEUE_MUTATION_RESULT_VALUES",
      "QUEUE_RECONCILE_RESULT_VALUES",
      "QUEUE_RELEASE_RESULT_VALUES",
      "QUEUE_REMOVAL_RESULT_VALUES",
      "createQueueCommandDefinition",
      "createQueueReadyCommandDefinition",
      "toQueuePlanData",
      "toQueueReadData",
    ]);
  });

  test("the declared closed vocabularies are unchanged and no dependency was added", () => {
    expect([...QUEUE_REMOVAL_REASONS]).toEqual(["landed", "abandoned", "superseded", "reconciled"]);
    expect([...QUEUE_RECONCILE_STALE_STATES]).toEqual(["done", "canceled"]);
    expect(QUEUE_GRAPH_SCHEMA).toBe("delivery.queue.graph.v1");
  });
});
