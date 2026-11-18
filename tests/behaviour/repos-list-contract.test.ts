/**
 * GH-309 TC-GRPREN-001..002 — the `repos list` contract and the moved flat
 * error identities.
 *
 * The flat record set is observed through its delivered name: `repos.v1` with
 * `data.repos[]` carrying exactly the renamed fields, the deterministic table
 * sorted by repo key, the `unbound` rule preserved, and every flat failure
 * classified under `repos.*` with the delivered exit meanings.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { hostIndexDocumentPath } from "../../packages/adapters/src/file/host-index-store";
import { projectStateRoot } from "../../packages/core/src/app/state-scope";
import {
  DAEMON_REACHABILITY_REASONS,
  HANDOVER_STATES,
  HOST_INDEX_SCHEMA,
  REPOS_ENTRY_FIELDS,
  REPOS_LIST_DATA_FIELDS,
} from "../../packages/core/src/contracts/projects";
import { DISPATCH_HANDOVER_CONDITIONS } from "../../packages/core/src/contracts/dispatch";
import { snapshotDifferences, snapshotTree } from "../fixtures/projects/host-root";
import { seedProjectAttempts } from "../fixtures/projects/production";
import { setOriginRemote, writeDispatchIdentityBinding } from "../fixtures/projects/temp-repos";
import { buildAttempts, eligibleSpecs } from "../fixtures/dispatch/evidence-windows";
import { hostIndexEntriesOf } from "../fixtures/projects/host-index";
import {
  createProductionProjectsHarness,
  type ProductionProjectsHarness,
  type ProductionRun,
} from "../fixtures/projects/production";
import {
  createHostFixture,
  type HostFixture,
  nonCheckoutDirectory,
} from "../fixtures/projects/state-scope";
import { createRepository, removeDirectory } from "../fixtures/projects/temp-repos";

type Envelope = {
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string; readonly summary?: string };
  readonly warnings?: readonly string[];
};

const envelopeOf = (run: ProductionRun): Envelope | undefined =>
  run.envelope as Envelope | undefined;

const dataOf = (run: ProductionRun): Record<string, unknown> => {
  const data = envelopeOf(run)?.data;
  if (data === undefined) throw new Error(`no data envelope: ${run.stdout}${run.stderr}`);
  return data;
};

const reposOf = (run: ProductionRun): readonly Record<string, unknown>[] => {
  const repos = dataOf(run).repos;
  if (!Array.isArray(repos)) throw new Error("data.repos is not an array");
  return repos as readonly Record<string, unknown>[];
};

const errorCodeOf = (run: ProductionRun): string | undefined => envelopeOf(run)?.error?.code;

const harnessFor = (host: HostFixture, label: string, checkout: string) =>
  createProductionProjectsHarness({
    label,
    host,
    workingDirectory: checkout,
    originUrl: `https://github.com/owner/${label}.git`,
  });

const register = async (harness: ProductionProjectsHarness): Promise<void> => {
  const run = await harness.run(["queue", "list", "--json"]);
  if (run.exitCode !== 0) throw new Error(`registration failed: ${run.stderr}${run.stdout}`);
};

describe("TC-GRPREN-001 repos list returns repos.v1 with exact renamed fields", () => {
  test("five entry fields, no projectKey, sorted table, and the delivered data shape", async () => {
    const host = createHostFixture("repos-list-shape");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const alpha = createRepository(base, "alpha-repo");
      const beta = createRepository(base, "beta-repo");
      const a = harnessFor(host, "alpha", alpha);
      const b = harnessFor(host, "beta", beta);
      harnesses.push(a, b);
      await register(a);
      await register(b);

      const run = await a.run(["repos", "list", "--json"]);
      expect(run.exitCode, run.stderr).toBe(0);
      const envelope = envelopeOf(run) ?? {};
      expect(Object.keys(envelope).sort()).toEqual(
        ["data", "exitCode", "runId", "schemaVersion", "timing"].sort(),
      );
      expect(Object.hasOwn(envelope, "ok")).toBe(false);
      expect(Object.hasOwn(envelope, "command")).toBe(false);
      const data = dataOf(run);
      expect(Object.keys(data).sort()).toEqual([...REPOS_LIST_DATA_FIELDS].sort());
      expect(data.projects).toBeUndefined();
      expect(Array.isArray(data.repos)).toBe(true);

      const entries = reposOf(run);
      expect(entries).toHaveLength(2);
      for (const entry of entries) {
        expect(Object.keys(entry).sort()).toEqual([...REPOS_ENTRY_FIELDS].sort());
        expect(entry.projectKey).toBeUndefined();
        const daemon = entry.daemonReachable as Record<string, unknown>;
        if (daemon.reachable === false) {
          expect(DAEMON_REACHABILITY_REASONS).toContain(daemon.reason);
        }
        expect(HANDOVER_STATES).toContain(entry.handoverState);
      }
      const keys = entries.map((entry) => entry.repoKey as string);
      expect(keys).toEqual([...keys].sort());
      expect(typeof data.hostIndexRevision).toBe("number");

      // Reversing the index's own entry order cannot change the output order.
      const recorded = hostIndexEntriesOf(host.hostRoot);
      mkdirSync(host.hostRoot, { recursive: true });
      writeFileSync(
        hostIndexDocumentPath(host.hostRoot),
        `${JSON.stringify({ schema: HOST_INDEX_SCHEMA, revision: 7, projects: [...recorded].reverse() }, null, 2)}\n`,
      );
      const reordered = await a.run(["repos", "list", "--json"]);
      expect(reordered.exitCode, reordered.stderr).toBe(0);
      expect(reposOf(reordered).map((entry) => entry.repoKey)).toEqual(keys);
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });

  test("the text table is sorted by repo key and byte-identical across runs", async () => {
    const host = createHostFixture("repos-list-table");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const alpha = createRepository(base, "alpha-repo");
      const beta = createRepository(base, "beta-repo");
      const a = harnessFor(host, "alpha", alpha);
      const b = harnessFor(host, "beta", beta);
      harnesses.push(a, b);
      await register(a);
      await register(b);

      const first = await a.run(["repos", "list"]);
      const second = await a.run(["repos", "list"]);
      expect(first.exitCode, first.stderr).toBe(0);
      expect(first.stdout).toBe(second.stdout);
      const lines = first.stdout.trimEnd().split("\n");
      expect(lines[0]).toBe("KEY  ROOT  STATE  DAEMON  HANDOVER");
      const rows = lines.slice(1);
      expect(rows).toHaveLength(2);
      const keys = rows.map((row) => row.split(/\s{2,}/)[0] ?? "");
      expect(keys).toEqual([...keys].sort());
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });

  test("an invocation outside every work tree keeps the unbound rule: one warning, no row", async () => {
    const host = createHostFixture("repos-list-unbound");
    const outside = nonCheckoutDirectory("repos-list-unbound");
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const outsideHarness = createProductionProjectsHarness({
        label: "repos-list-unbound-outside",
        host,
        workingDirectory: outside,
        originUrl: "https://github.com/owner/repos-list-unbound.git",
      });
      harnesses.push(outsideHarness);
      const run = await outsideHarness.run(["repos", "list", "--json"]);
      expect(run.exitCode, run.stderr).toBe(0);
      expect(envelopeOf(run)?.error).toBeUndefined();
      expect(reposOf(run)).toEqual([]);
      const warningLines = run.stderr.split("\n").filter((line) => line.includes("unbound"));
      expect(warningLines).toHaveLength(1);
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(outside);
      host.dispose();
    }
  });
});

describe("TC-ENGINE-020 the row carries the two additive fields in the declared order", () => {
  test("seven ordered fields, the declared block, and an untouched first-use row", async () => {
    const host = createHostFixture("repos-gate-shape");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const ready = createRepository(base, "ready-repo");
      const unused = createRepository(base, "unused-repo");
      // The ready cell declares its identity through the persisted binding.
      writeDispatchIdentityBinding(ready, "github.com/owner/ready");
      const readyHarness = harnessFor(host, "ready", ready);
      const unusedHarness = harnessFor(host, "unused", unused);
      harnesses.push(readyHarness, unusedHarness);
      await register(readyHarness);
      await register(unusedHarness);

      const readyState = projectStateRoot(host.hostRoot, readyHarness.projectKey);
      mkdirSync(readyState, { recursive: true, mode: 0o700 });
      seedProjectAttempts(
        host.hostRoot,
        readyHarness.projectKey,
        buildAttempts(eligibleSpecs({ repository: "github.com/owner/ready" })),
      );

      const before = snapshotTree(host.hostRoot);
      const bindingPath = join(ready, ".git", "dispatch-identity.json");
      const bindingBefore = readFileSync(bindingPath, "utf8");

      const run = await readyHarness.run(["repos", "list", "--json"]);
      expect(run.exitCode, run.stderr).toBe(0);
      const entries = reposOf(run);
      for (const entry of entries) {
        // Ordered, not sorted: an appended field may not reorder a delivered one.
        expect(Object.keys(entry)).toEqual([
          "repoKey",
          "root",
          "stateLocation",
          "daemonReachable",
          "handoverState",
          "reversible",
          "handoverGate",
        ]);
      }
      expect([...REPOS_ENTRY_FIELDS]).toEqual([
        "repoKey",
        "root",
        "stateLocation",
        "daemonReachable",
        "handoverState",
        "reversible",
        "handoverGate",
      ]);

      const readyRow = entries.find((entry) => entry.repoKey === readyHarness.projectKey);
      const unusedRow = entries.find((entry) => entry.repoKey === unusedHarness.projectKey);
      if (readyRow === undefined || unusedRow === undefined) throw new Error("missing row");
      const readyGate = readyRow.handoverGate as Record<string, unknown>;
      expect(Object.keys(readyGate)).toEqual([
        "verdict",
        "conditions",
        "countedDeliveries",
        "cleanDispatches",
      ]);
      expect(["eligible", "ineligible", "unverifiable"]).toContain(readyGate.verdict);
      const conditions = readyGate.conditions as readonly Record<string, unknown>[];
      expect(conditions.map((entry) => entry.condition)).toEqual([...DISPATCH_HANDOVER_CONDITIONS]);
      for (const entry of conditions) {
        expect(Object.keys(entry)).toEqual(["condition", "status"]);
        expect(["met", "open"]).toContain(entry.status);
      }
      expect(typeof readyGate.countedDeliveries).toBe("number");
      expect(typeof readyGate.cleanDispatches).toBe("number");
      expect(readyGate.countedDeliveries).toBe(20);
      expect(readyGate.cleanDispatches).toBe(15);
      expect(readyRow.reversible).toBe(false);

      // The first-use row: the empty-window evaluation, no store, no write.
      const unusedGate = unusedRow.handoverGate as Record<string, unknown>;
      expect(unusedRow.stateLocation).toBe(
        projectStateRoot(host.hostRoot, unusedHarness.projectKey),
      );
      expect(existsSync(unusedRow.stateLocation as string)).toBe(false);
      expect(unusedGate.verdict).toBe("ineligible");
      expect(unusedGate.countedDeliveries).toBe(0);
      expect(unusedGate.cleanDispatches).toBe(0);
      expect(unusedRow.reversible).toBe(false);
      const unusedConditions = unusedGate.conditions as readonly Record<string, unknown>[];
      expect(
        Object.fromEntries(unusedConditions.map((entry) => [entry.condition, entry.status])),
      ).toEqual({ truth: "met", coverage: "open", floor: "open", corroboration: "met" });

      // Non-persisting and side-effect free: the binding and the tree are intact.
      expect(readFileSync(bindingPath, "utf8")).toBe(bindingBefore);
      expect(snapshotDifferences(before, snapshotTree(host.hostRoot))).toEqual([]);

      // The text table keeps exactly five columns.
      const text = await readyHarness.run(["repos", "list"]);
      const lines = text.stdout.trimEnd().split("\n");
      expect(lines[0]).toBe("KEY  ROOT  STATE  DAEMON  HANDOVER");
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });

  test("the declared production scope is folded, and no scope key exists", async () => {
    const host = createHostFixture("repos-gate-scope");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const checkout = createRepository(base, "scope-repo");
      setOriginRemote(checkout, "https://github.com/owner/scope.git");
      const harness = harnessFor(host, "scope", checkout);
      harnesses.push(harness);
      await register(harness);
      mkdirSync(projectStateRoot(host.hostRoot, harness.projectKey), {
        recursive: true,
        mode: 0o700,
      });
      const repository = "github.com/owner/scope";
      seedProjectAttempts(
        host.hostRoot,
        harness.projectKey,
        buildAttempts(eligibleSpecs({ repository })),
      );
      const first = await harness.run(["repos", "list", "--json"]);
      const before = reposOf(first).find((entry) => entry.repoKey === harness.projectKey);
      if (before === undefined) throw new Error("no row");
      const beforeGate = before.handoverGate as Record<string, unknown>;

      seedProjectAttempts(host.hostRoot, harness.projectKey, [
        ...buildAttempts([
          {
            token: "pr-open",
            id: "controlled-1",
            day: 20,
            repository,
            evidenceClass: "controlled-proof",
          },
        ]),
      ]);
      const afterControlled = await harness.run(["repos", "list", "--json"]);
      const controlled = reposOf(afterControlled).find(
        (entry) => entry.repoKey === harness.projectKey,
      );
      expect(controlled?.handoverGate).toEqual(beforeGate);

      seedProjectAttempts(
        host.hostRoot,
        harness.projectKey,
        buildAttempts([{ token: "pr-open", id: "pilot-1", day: 21, repository }]),
      );
      const afterPilot = await harness.run(["repos", "list", "--json"]);
      const pilot = reposOf(afterPilot).find((entry) => entry.repoKey === harness.projectKey);
      const pilotGate = pilot?.handoverGate as Record<string, unknown>;
      expect(pilotGate.countedDeliveries).toBe(21);
      expect(pilotGate.cleanDispatches).toBe(16);

      const serialized = JSON.stringify(pilot);
      for (const key of ["scope", "evidenceScope", "evidenceClass"]) {
        expect(serialized).not.toContain(`"${key}"`);
      }
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});

describe("TC-GRPREN-002 the flat surface's failures carry the moved repos.* identities", () => {
  test("identity, corrupt registry, and unavailable state keep their exit meanings", async () => {
    const host = createHostFixture("repos-list-failures");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      // Identity: the invoking checkout's git metadata is unusable.
      const broken = join(base, "broken-gitdir");
      mkdirSync(broken, { recursive: true });
      writeFileSync(join(broken, ".git"), "gitdir:   \n");
      const brokenHarness = harnessFor(host, "broken", broken);
      harnesses.push(brokenHarness);
      const identity = await brokenHarness.run(["repos", "list", "--json"]);
      expect(identity.exitCode).toBe(1);
      expect(errorCodeOf(identity)).toBe("repos.identity-unreadable");

      // Registry: a present but unparsable host index.
      const alpha = createRepository(base, "alpha-repo");
      const healthy = harnessFor(host, "healthy", alpha);
      harnesses.push(healthy);
      await register(healthy);
      const recorded = hostIndexEntriesOf(host.hostRoot);
      mkdirSync(host.hostRoot, { recursive: true });
      writeFileSync(hostIndexDocumentPath(host.hostRoot), "{ not json\n");
      const indexMtime = statSync(hostIndexDocumentPath(host.hostRoot)).mtimeMs;
      const registry = await healthy.run(["repos", "list", "--json"]);
      expect(registry.exitCode).toBe(2);
      expect(errorCodeOf(registry)).toBe("repos.registry-corrupt");
      expect(envelopeOf(registry)?.data).toBeUndefined();
      expect(statSync(hostIndexDocumentPath(host.hostRoot)).mtimeMs).toBe(indexMtime);

      // State: a present-but-unreadable state location.
      writeFileSync(
        hostIndexDocumentPath(host.hostRoot),
        `${JSON.stringify({ schema: HOST_INDEX_SCHEMA, revision: 4, projects: recorded }, null, 2)}\n`,
      );
      const blockedLocation = projectStateRoot(host.hostRoot, healthy.projectKey);
      removeDirectory(blockedLocation);
      mkdirSync(dirname(blockedLocation), { recursive: true });
      writeFileSync(blockedLocation, "not a directory\n");
      const state = await healthy.run(["repos", "list", "--json"]);
      expect(state.exitCode).toBe(2);
      expect(errorCodeOf(state)).toBe("repos.state-unavailable");

      // The retired projects.* flat identities never fire on this surface.
      for (const run of [identity, registry, state]) {
        const code = errorCodeOf(run) ?? "";
        expect(code.startsWith("projects.")).toBe(false);
      }
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });

  test("a missing or unknown verb is the shared invocation refusal at exit 1", async () => {
    const host = createHostFixture("repos-list-refusals");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const checkout = createRepository(base, "refusal-repo");
      const harness = harnessFor(host, "refusal", checkout);
      harnesses.push(harness);
      const missing = await harness.run(["repos", "--json"]);
      const unknown = await harness.run(["repos", "frobnicate", "--json"]);
      for (const run of [missing, unknown]) {
        expect(run.exitCode).toBe(1);
        expect(errorCodeOf(run)).toBe("fallback.invocation");
      }
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});
