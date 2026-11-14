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
import { mkdirSync, statSync, writeFileSync } from "node:fs";
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
