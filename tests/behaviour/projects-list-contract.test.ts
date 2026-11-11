/**
 * GH-288 TC-PROJ-011, TC-PROJ-012, TC-PROJ-013 and TC-PROJ-041 — the
 * `projects list` contract: envelope shape, deterministic table, exit matrix
 * with the DEC-16 naming rule, and the read-only posture.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { hostIndexDocumentPath } from "../../packages/adapters/src/file/host-index-store";
import { projectStateRoot } from "../../packages/core/src/app/state-scope";
import {
  DAEMON_REACHABILITY_REASONS,
  HANDOVER_STATES,
  HOST_INDEX_SCHEMA,
} from "../../packages/core/src/contracts/projects";
import {
  hostIndexEntriesOf,
  hostIndexRevisionOf,
  hostIndexTextOf,
} from "../fixtures/projects/host-index";
import { hostRootFingerprint } from "../fixtures/projects/host-root";
import { writeRawMarker } from "../fixtures/projects/markers";
import {
  createProductionProjectsHarness,
  type ProductionProjectsHarness,
  type ProductionRun,
} from "../fixtures/projects/production";
import {
  APPROVED_BASE,
  brandOf,
  createHostFixture,
  nonCheckoutDirectory,
} from "../fixtures/projects/state-scope";
import { createRepository, removeDirectory } from "../fixtures/projects/temp-repos";

const REF = "GH-241";

type Envelope = {
  readonly ok?: boolean;
  readonly command?: string;
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

const entriesOf = (run: ProductionRun): readonly Record<string, unknown>[] => {
  const projects = dataOf(run).projects;
  if (!Array.isArray(projects)) throw new Error("data.projects is not an array");
  return projects as readonly Record<string, unknown>[];
};

const register = async (harness: ProductionProjectsHarness): Promise<void> => {
  const run = await harness.run(["queue", "list", "--json"]);
  if (run.exitCode !== 0) throw new Error(`registration failed: ${run.stderr}${run.stdout}`);
};

const seedState = async (harness: ProductionProjectsHarness, priority: string): Promise<void> => {
  const run = await harness.run(["queue", "add", REF, "--priority", priority, "--json"]);
  if (run.exitCode !== 0) throw new Error(`queue add failed: ${run.stderr}`);
};

const harnessFor = (host: ReturnType<typeof createHostFixture>, label: string, checkout: string) =>
  createProductionProjectsHarness({
    label,
    host,
    workingDirectory: checkout,
    originUrl: `https://github.com/owner/${label}.git`,
  });

const writeIndex = (hostRoot: string, projects: readonly Record<string, unknown>[]): void => {
  mkdirSync(hostRoot, { recursive: true });
  writeFileSync(
    hostIndexDocumentPath(hostRoot),
    `${JSON.stringify({ schema: HOST_INDEX_SCHEMA, revision: 7, projects }, null, 2)}\n`,
  );
};

describe("TC-PROJ-011 envelope shape", () => {
  test("exactly five entry fields, no new top-level key, ordered by key", async () => {
    const host = createHostFixture("list-shape");
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

      const run = await a.run(["projects", "list", "--json"]);
      expect(run.exitCode).toBe(0);
      const envelope = envelopeOf(run) ?? {};
      // No new top-level key: the delivered success envelope, unchanged.
      expect(Object.keys(envelope).sort()).toEqual(
        ["data", "exitCode", "runId", "schemaVersion", "timing"].sort(),
      );
      const data = dataOf(run);
      expect(Object.keys(data).sort()).toEqual(["hostIndexRevision", "projects"]);
      const entries = entriesOf(run);
      expect(entries).toHaveLength(2);
      for (const entry of entries) {
        expect(Object.keys(entry).sort()).toEqual([
          "daemonReachable",
          "handoverState",
          "projectKey",
          "root",
          "stateLocation",
        ]);
        const daemon = entry.daemonReachable as Record<string, unknown>;
        expect(Object.keys(daemon).every((key) => ["reachable", "reason"].includes(key))).toBe(
          true,
        );
        if (daemon.reachable === true) expect(daemon.reason).toBeUndefined();
        if (daemon.reachable === false) {
          expect(DAEMON_REACHABILITY_REASONS).toContain(daemon.reason);
        }
        expect(HANDOVER_STATES).toContain(entry.handoverState);
      }
      const keys = entries.map((entry) => entry.projectKey as string);
      expect(keys).toEqual([...keys].sort());
      expect(typeof data.hostIndexRevision).toBe("number");
      expect(Number.isInteger(data.hostIndexRevision)).toBe(true);
      expect(data.hostIndexRevision).toBeGreaterThanOrEqual(0);

      // Reversing the index's own entry order cannot change the output order.
      const recorded = hostIndexEntriesOf(host.hostRoot);
      writeIndex(host.hostRoot, [...recorded].reverse());
      const reordered = await a.run(["projects", "list", "--json"]);
      expect(reordered.exitCode).toBe(0);
      expect(entriesOf(reordered).map((entry) => entry.projectKey)).toEqual(keys);
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});

describe("TC-PROJ-012 deterministic table and a read-only list", () => {
  test("two text runs are byte-identical, the header is exact, and nothing is written", async () => {
    const host = createHostFixture("list-table");
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
      await seedState(a, "3");

      const fingerprint = hostRootFingerprint(host.hostRoot);
      const revision = hostIndexRevisionOf(host.hostRoot);
      const first = await a.run(["projects", "list"]);
      const second = await a.run(["projects", "list"]);
      expect(first.exitCode).toBe(0);
      expect(second.exitCode).toBe(0);
      expect(first.stdout).toBe(second.stdout);

      const lines = first.stdout.trimEnd().split("\n");
      expect(lines[0]?.split(/\s{2,}/)).toEqual(["KEY", "ROOT", "STATE", "DAEMON", "HANDOVER"]);
      const rows = lines.slice(1);
      expect(rows).toHaveLength(2);
      const rowKeys = rows.map((row) => row.split(/\s{2,}/)[0] ?? "");
      expect(rowKeys).toEqual([...rowKeys].sort());
      for (const row of rows) {
        const cells = row.split(/\s{2,}/);
        expect(cells).toHaveLength(5);
        expect(DAEMON_REACHABILITY_REASONS).toContain(cells[3]);
      }

      expect(hostRootFingerprint(host.hostRoot)).toBe(fingerprint);
      expect(hostIndexRevisionOf(host.hostRoot)).toBe(revision);

      const firstJson = await a.run(["projects", "list", "--json"]);
      const secondJson = await a.run(["projects", "list", "--json"]);
      expect(dataOf(firstJson)).toEqual(dataOf(secondJson));
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});

describe("TC-PROJ-013 exit matrix, DEC-16 naming, and the three identities", () => {
  test("0/1/2 exactly, the provoking refusal named, and no other project disclosed", async () => {
    const host = createHostFixture("list-exits");
    const base = `${host.hostRoot}-repos`;
    const outside = nonCheckoutDirectory("list-exits");
    const harnesses: ProductionProjectsHarness[] = [];
    const observedExits = new Set<number>();
    try {
      const alpha = createRepository(base, "alpha-repo");
      const beta = createRepository(base, "beta-repo");
      const gamma = createRepository(base, "gamma-repo");
      const a = harnessFor(host, "alpha", alpha);
      const b = harnessFor(host, "beta", beta);
      const g = harnessFor(host, "gamma", gamma);
      harnesses.push(a, b, g);
      for (const harness of [a, b, g]) await register(harness);
      const keys = { a: a.projectKey, b: b.projectKey, g: g.projectKey };

      // Step 1: healthy host.
      const healthy = await a.run(["projects", "list", "--json"]);
      expect(healthy.exitCode).toBe(0);
      observedExits.add(healthy.exitCode);

      // Step 2: unknown or absent verb, refused at exit 1 without an index read.
      const indexMtime = statSync(hostIndexDocumentPath(host.hostRoot)).mtimeMs;
      const noVerb = await a.run(["projects", "--json"]);
      const unknownVerb = await a.run(["projects", "frobnicate", "--json"]);
      expect(noVerb.exitCode).toBe(1);
      expect(unknownVerb.exitCode).toBe(1);
      expect(envelopeOf(unknownVerb)?.error?.code).toBe("fallback.invocation");
      expect(unknownVerb.stderr).toContain("frobnicate");
      expect(statSync(hostIndexDocumentPath(host.hostRoot)).mtimeMs).toBe(indexMtime);
      observedExits.add(1);

      // Step 3: git metadata present but unusable (an empty `gitdir:` value).
      const emptyGitdir = join(base, "empty-gitdir");
      mkdirSync(emptyGitdir, { recursive: true });
      writeFileSync(join(emptyGitdir, ".git"), "gitdir:   \n");
      const emptyHarness = harnessFor(host, "empty-gitdir", emptyGitdir);
      harnesses.push(emptyHarness);
      const emptyRun = await emptyHarness.run(["projects", "list", "--json"]);
      expect(emptyRun.exitCode).toBe(1);
      expect(envelopeOf(emptyRun)?.error?.code).toBe("projects.identity-unreadable");
      expect(emptyRun.stdout + emptyRun.stderr).toContain(emptyGitdir);
      expect(emptyRun.stdout + emptyRun.stderr).toContain(".git");
      observedExits.add(1);

      // Step 4: four marker shapes, each provoked with bytes.
      const markerShapes: readonly [string, (commonDir: string) => void][] = [
        ["invalid-json", (commonDir) => writeRawMarker(commonDir, "{ not json")],
        [
          "missing-field",
          (commonDir) => {
            const parsed = JSON.parse(
              readFileSync(join(commonDir, "project-identity.json"), "utf8"),
            ) as Record<string, unknown>;
            delete parsed.projectIdentifier;
            writeRawMarker(commonDir, JSON.stringify(parsed));
          },
        ],
        [
          "inconsistent",
          (commonDir) => {
            const parsed = JSON.parse(
              readFileSync(join(commonDir, "project-identity.json"), "utf8"),
            ) as Record<string, unknown>;
            parsed.projectKey = "another-project-deadbeef";
            writeRawMarker(commonDir, JSON.stringify(parsed));
          },
        ],
      ];
      const markerCaptures: string[] = [];
      for (const [label, corrupt] of markerShapes) {
        const checkout = createRepository(base, `marker-${label}`);
        const harness = harnessFor(host, `marker-${label}`, checkout);
        harnesses.push(harness);
        await register(harness);
        corrupt(join(checkout, ".git"));
        const run = await harness.run(["projects", "list", "--json"]);
        expect(run.exitCode, label).toBe(1);
        expect(envelopeOf(run)?.error?.code, label).toBe("projects.identity-unreadable");
        expect(run.stdout + run.stderr, label).toContain(checkout);
        const capture = run.stdout + run.stderr;
        markerCaptures.push(capture);
        if (label === "inconsistent") {
          expect(capture).toContain("another-project-deadbeef");
          expect(capture).toContain("identifier");
        }
        if (label === "missing-field") expect(capture).toContain("(key ");
      }

      // Step 5: the anti-collapse controls are the declared unbound scope.
      const nonGitdirFile = join(base, "non-gitdir-file");
      mkdirSync(nonGitdirFile, { recursive: true });
      writeFileSync(join(nonGitdirFile, ".git"), "this is not a gitdir pointer\n");
      const nonGitdirHarness = harnessFor(host, "non-gitdir", nonGitdirFile);
      harnesses.push(nonGitdirHarness);
      const nonGitdirRun = await nonGitdirHarness.run(["projects", "list", "--json"]);
      expect(nonGitdirRun.exitCode).toBe(0);
      expect(envelopeOf(nonGitdirRun)?.error).toBeUndefined();
      // Warnings travel the error stream once each, in every mode.
      const warningLines = nonGitdirRun.stderr
        .split("\n")
        .filter((line) => line.includes("unbound"));
      expect(warningLines).toHaveLength(1);

      const noGitHarness = createProductionProjectsHarness({
        label: "no-git",
        host,
        workingDirectory: outside,
        originUrl: "https://github.com/owner/no-git.git",
      });
      harnesses.push(noGitHarness);
      const noGitRun = await noGitHarness.run(["projects", "list", "--json"]);
      expect(noGitRun.exitCode).toBe(0);
      observedExits.add(0);

      // Step 6: a present-but-unreadable state location is a state failure.
      const blockedLocation = projectStateRoot(host.hostRoot, keys.g);
      removeDirectory(blockedLocation);
      mkdirSync(dirname(blockedLocation), { recursive: true });
      writeFileSync(blockedLocation, "not a directory\n");
      const blocked = await a.run(["projects", "list", "--json"]);
      expect(blocked.exitCode).toBe(2);
      expect(envelopeOf(blocked)?.error?.code).toBe("projects.state-unavailable");
      expect(blocked.stdout + blocked.stderr).toContain(keys.g);
      expect(blocked.stdout + blocked.stderr).toContain(blockedLocation);
      expect(envelopeOf(blocked)?.data).toBeUndefined();
      expect(existsSync(blockedLocation)).toBe(true);
      observedExits.add(2);

      // Step 7: no other project's root or state location is disclosed.
      const captures = [
        emptyRun.stdout,
        emptyRun.stderr,
        ...markerCaptures,
        blocked.stdout,
        blocked.stderr,
      ].join("\n");
      for (const key of [keys.a, keys.b]) {
        expect(captures).not.toContain(projectStateRoot(host.hostRoot, key));
      }
      expect(captures).not.toContain(alpha);
      expect(captures).not.toContain(beta);

      // Step 8: the family produces exactly {0, 1, 2}.
      expect([...observedExits].sort()).toEqual([0, 1, 2]);
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      removeDirectory(outside);
      host.dispose();
    }
  });
});

describe("TC-PROJ-041 projects list writes nothing", () => {
  test("byte, mode and mtime snapshots are identical across four listings", async () => {
    const host = createHostFixture("list-readonly");
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
      await seedState(a, "9");

      const before = hostRootFingerprint(host.hostRoot);
      const revision = hostIndexRevisionOf(host.hostRoot);
      for (const argv of [
        ["projects", "list", "--json"],
        ["projects", "list"],
        ["projects", "list", "--json"],
        ["projects", "list"],
      ] as const) {
        const run = await a.run([...argv]);
        expect(run.exitCode).toBe(0);
      }
      expect(hostRootFingerprint(host.hostRoot)).toBe(before);
      expect(hostIndexRevisionOf(host.hostRoot)).toBe(revision);
      expect(hostIndexEntriesOf(host.hostRoot)).toHaveLength(2);
      // No state root created, removed, or pruned: the populated one survives and
      // the never-written one is still absent.
      expect(existsSync(projectStateRoot(host.hostRoot, a.projectKey))).toBe(true);
      expect(existsSync(projectStateRoot(host.hostRoot, b.projectKey))).toBe(false);

      // Lifecycle cell (b): after store-opening invocations the host root holds
      // exactly the index and the project container.
      const hostEntries = new Set(readdirSync(host.hostRoot).sort());
      expect([...hostEntries]).toEqual(["host-index.json", "projects"]);
      // No store artifact sits directly under the host root.
      for (const forbidden of [
        "ledger.default.jsonl",
        "header.default.json",
        "index.default.sqlite",
        "fence.default.lock",
        "documents.default",
        "quarantine.default",
        "chain-key.default.json",
        "chain-key.retro.default.json",
        "retro-evidence.default.jsonl",
        "retro-evidence.lock",
      ]) {
        expect(hostEntries.has(forbidden)).toBe(false);
      }
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });

  test("cell (a) and cell (c): a never-invoked host root stays absent", async () => {
    const host = createHostFixture("list-first-run");
    const base = `${host.hostRoot}-repos`;
    const outside = nonCheckoutDirectory("list-first-run");
    const absentRoot = join(APPROVED_BASE, "gh288-absent-host-root");
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      // A host root that does not exist yet.
      const brand = brandOf();
      const harness = createProductionProjectsHarness({
        label: "list-absent-host",
        host: {
          brand,
          hostRoot: absentRoot,
          home: host.home,
          environment: {},
          dispose: () => undefined,
        },
        workingDirectory: outside,
        originUrl: "https://github.com/owner/absent.git",
      });
      harnesses.push(harness);
      expect(existsSync(absentRoot)).toBe(false);
      const run = await harness.run(["projects", "list", "--json"]);
      expect(run.exitCode).toBe(0);
      expect(dataOf(run).projects).toEqual([]);
      expect(dataOf(run).hostIndexRevision).toBe(0);
      expect(envelopeOf(run)?.error).toBeUndefined();
      expect(existsSync(absentRoot)).toBe(false);

      // Cell (c): listing from inside a checkout creates neither index nor projects/.
      const checkout = createRepository(base, "list-only-repo");
      const listOnly = harnessFor(host, "list-only", checkout);
      harnesses.push(listOnly);
      const listOnlyRun = await listOnly.run(["projects", "list", "--json"]);
      expect(listOnlyRun.exitCode).toBe(0);
      expect(existsSync(hostIndexDocumentPath(host.hostRoot))).toBe(false);
      expect(existsSync(join(host.hostRoot, "projects"))).toBe(false);
      expect(hostIndexTextOf(host.hostRoot)).toBeUndefined();
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      removeDirectory(outside);
      removeDirectory(absentRoot);
      host.dispose();
    }
  });
});
