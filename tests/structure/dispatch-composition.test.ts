/**
 * TC-MERGE-004 (phase 4) — the production dispatch composition exposes only the
 * declared dispatch ports: no merge executor, merge port, or merge invocation is
 * present, and a source-level merge import fails the structural check.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";
import { declareQueueEntry } from "../../packages/core/src/app/queue";
import type {
  HarnessSpawnRunner,
  HarnessSpawnRunnerResult,
} from "../../packages/core/src/contracts/index";
import {
  createNodeStateEdge,
  createStateStore,
  STATE_SCHEMA_VERSION,
} from "../../packages/core/src/state/index";
import { createProductionComposer } from "../../packages/cli/src/production";
import { normalizeRepositoryRemote } from "../../packages/core/src/domain/dispatch-identity";
import { readRepositoryFacts, nodeRepositoryIo } from "../../packages/adapters/src/repo/index";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";

const ROOT = process.cwd();

describe("TC-MERGE-004 the production composition has no reachable merge port", () => {
  test("the composition type declares no merge member", () => {
    const source = readFileSync(join(ROOT, "packages/cli/src/edge.ts"), "utf8");
    const start = source.indexOf("export type DispatchComposition = {");
    expect(start).toBeGreaterThan(0);
    const end = source.indexOf("};", start);
    const block = source.slice(start, end);
    expect(block.length).toBeGreaterThan(0);
    expect(block.toLowerCase().includes("merge")).toBe(false);
    for (const expected of [
      "harnesses",
      "descriptor",
      "readTruth",
      "claimLease",
      "releaseLease",
      "evidenceClass",
    ]) {
      expect(block).toContain(expected);
    }
  });

  test("the runtime declares only the run surface and fires no merge", async () => {
    const scenario = createCommandScenario({ evidence: COMPLETED_EVIDENCE });
    try {
      expect(Object.keys(scenario.runtime)).toEqual(["run"]);
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(0);
      expect(scenario.calls.merge).toBe(0);
      expect(Object.keys(run.envelope?.data ?? {})).not.toContain("merge");
    } finally {
      scenario.dispose();
    }
  });

  test("a source-level merge import added to the composition would be caught by the boundary rule", () => {
    const config = readFileSync(join(ROOT, ".dependency-cruiser.cjs"), "utf8");
    const rule = config.slice(config.indexOf('name: "dispatch-merge-absence"'));
    expect(rule).toContain("cli/src/commands/merge");
    expect(rule).toContain("domain/merge-");
  });
});

describe("the production composer builds a real harness session port", () => {
  test("a production-composed dispatch spawns through the delivered port", async () => {
    const base = join(ROOT, "tmp", "tmpdir");
    mkdirSync(base, { recursive: true });
    const home = mkdtempSync(join(base, "gh239-production-"));
    try {
      const brandResult = resolveBrandIdentity({ workingName: "delivery-os" });
      expect(brandResult.ok).toBe(true);
      if (!brandResult.ok) return;
      const brand = brandResult.value;
      const stateDirectory = join(home, brand.stateDirectoryName);
      const store = createStateStore(
        {
          level: "local",
          workspaceId: "default",
          fenceNamespace: "cli",
          schemaVersion: STATE_SCHEMA_VERSION,
          stateDirectory,
        },
        { driver: "jsonl", edge: createNodeStateEdge() },
      );
      const repositoryFacts = readRepositoryFacts({ cwd: ROOT, io: nodeRepositoryIo() });
      const repository = normalizeRepositoryRemote(repositoryFacts.originUrl);
      expect(repository).toBeDefined();
      if (repository === undefined) return;
      const seeded = declareQueueEntry(store, {
        ref: "GH-301",
        repository,
        repositoryRoot: ROOT,
        recordedAt: new Date().toISOString(),
        fenceToken: "seed-fence",
      });
      expect(seeded.ok).toBe(true);

      const invocations: string[] = [];
      const runner: HarnessSpawnRunner = async (file, args): Promise<HarnessSpawnRunnerResult> => {
        invocations.push(`${file} ${args.join(" ")}`);
        return {
          stdout: JSON.stringify({
            session: { id: "ses-production-1" },
            result: { completion: "complete" },
          }),
          stderr: "",
          status: 0,
          timedOut: false,
        };
      };

      const program = createProductionComposer({
        environment: {
          HOME: home,
          HARNESS_MODEL: "synthetic/model-large",
          HARNESS_SMALL_MODEL: "synthetic/model-small",
        },
        cwd: ROOT,
        homeDirectory: home,
        workingName: "delivery-os",
        harnessSpawnRunner: runner,
      })(brand);

      const definition = program.commands.dispatch;
      expect(definition).toBeDefined();
      if (definition === undefined) return;
      const outcome = (await definition.handler({
        command: "dispatch",
        flags: {},
        argv: ["GH-301"],
        positionals: ["GH-301"],
        brand,
      })) as {
        readonly data?: { readonly result?: string };
        readonly error?: { readonly code?: string };
      };

      expect(invocations).toHaveLength(1);
      expect(invocations[0]?.startsWith("opencode ")).toBe(true);
      expect(outcome.error).toBeUndefined();
      expect(outcome.data?.result).toBeDefined();
      expect(outcome.data?.result).not.toBe("harness.capability.gap");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
