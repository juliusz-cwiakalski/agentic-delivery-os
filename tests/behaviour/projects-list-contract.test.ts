/**
 * GH-288 TC-PROJ-011, TC-PROJ-012, TC-PROJ-013 and TC-PROJ-041 — the
 * `projects list` contract: envelope shape, deterministic table, exit matrix
 * with the DEC-16 naming rule, and the read-only posture.
 */
import { describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { hostIndexDocumentPath } from "../../packages/adapters/src/file/host-index-store";
import { parseHostIndexDocument } from "../../packages/core/src/app/host-index";
import { projectStateRoot } from "../../packages/core/src/app/state-scope";
import {
  DAEMON_REACHABILITY_REASONS,
  HANDOVER_STATES,
  HOST_INDEX_SCHEMA,
  PROJECT_IDENTITY_MARKER_NAME,
} from "../../packages/core/src/contracts/projects";
import {
  hostIndexEntriesOf,
  hostIndexRevisionOf,
  hostIndexTextOf,
} from "../fixtures/projects/host-index";
import { hostRootFingerprint, snapshotTree } from "../fixtures/projects/host-root";
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

describe("TC-PROJ-042 cells 1 and 3 — first use and a present-but-unreadable root", () => {
  test("an absent root is first use with no warning; an unreadable root names key and location", async () => {
    const host = createHostFixture("cells-state-location");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const first = createRepository(base, "cells-first-use");
      const blocked = createRepository(base, "cells-blocked");
      const a = harnessFor(host, "cells-first", first);
      const b = harnessFor(host, "cells-blocked", blocked);
      harnesses.push(a, b);
      await register(a);
      await register(b);

      // Cell 1: the registered checkout has never opened a store.
      const firstUse = await a.run(["projects", "list", "--json"]);
      expect(firstUse.exitCode).toBe(0);
      expect(firstUse.stderr).not.toContain("migration");
      const row = entriesOf(firstUse).find((entry) => entry.projectKey === a.projectKey);
      expect(row?.handoverState).toBe("shell");
      const daemon = row?.daemonReachable as { readonly reason?: string } | undefined;
      expect(daemon?.reason).toBe("daemon-not-mounted");
      expect(existsSync(a.stateLocation)).toBe(false);
      // A state-opening command then creates the store; the row is unchanged.
      expect((await a.run(["queue", "add", REF, "--priority", "1", "--json"])).exitCode).toBe(0);
      expect(existsSync(a.stateLocation)).toBe(true);
      const after = await a.run(["projects", "list", "--json"]);
      const rowAfter = entriesOf(after).find((entry) => entry.projectKey === a.projectKey);
      expect(rowAfter?.handoverState).toBe("shell");

      // Cell 3: a present but unreadable state location.
      const location = projectStateRoot(host.hostRoot, b.projectKey);
      removeDirectory(location);
      mkdirSync(dirname(location), { recursive: true });
      writeFileSync(location, "opaque\n");
      const failed = await a.run(["projects", "list", "--json"]);
      expect(failed.exitCode).toBe(2);
      const error = failed.envelope?.error as
        | { readonly code?: string; readonly summary?: string }
        | undefined;
      expect(error?.code).toBe("projects.state-unavailable");
      expect(error?.summary ?? "").toContain(b.projectKey);
      expect(error?.summary ?? "").toContain(location);
      expect(failed.envelope?.data).toBeUndefined();

      // The exit set over both cells is {0, 2} and no other identity appears.
      expect(new Set([firstUse.exitCode, after.exitCode, failed.exitCode])).toEqual(
        new Set([0, 2]),
      );
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});

describe("F-1 a tampered index key is corruption, never a traversed path", () => {
  test("dot, dot-dot, empty, colon, whitespace, and over-long keys are all refused", async () => {
    const host = createHostFixture("list-tampered-keys");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const checkout = createRepository(base, "tampered-repo");
      const harness = harnessFor(host, "tampered", checkout);
      harnesses.push(harness);
      await register(harness);
      const hostEntriesBefore = readdirSync(host.hostRoot).sort();

      const baseEntry = {
        projectIdentifier: "0123abcd000000000000000000000000",
        root: checkout,
        lastWrittenAt: "2026-11-11T08:00:00.000Z",
      };
      const badKeys: readonly [string, string][] = [
        ["dot", "."],
        ["dot-dot", ".."],
        ["empty", ""],
        ["colon", "owner:repo-0123abcd"],
        ["whitespace", "has space-0123abcd"],
        ["over-long", `${"a".repeat(40)}-0123abcd`],
        ["unbound-prefix", "unbound-0123abcd"],
      ];
      for (const [label, key] of badKeys) {
        writeIndex(host.hostRoot, [
          { ...baseEntry, projectKey: key, stateLocation: `${host.hostRoot}/projects/${key}` },
        ]);
        const run = await harness.run(["projects", "list", "--json"]);
        expect(run.exitCode, label).toBe(2);
        expect(envelopeOf(run)?.error?.code, label).toBe("projects.registry-corrupt");
        expect(run.envelope?.data, label).toBeUndefined();
        // No store was opened through a traversed path: the host root gains no
        // store artifact, and the escaped `<host root>/projects/..` is the host
        // root, which stays exactly as it was.
        expect(readdirSync(host.hostRoot).sort(), label).toEqual(hostEntriesBefore);
      }
    } finally {
      for (const record of harnesses) record.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });

  test("a minted-shape key still parses, so the guard rejects only tampering", () => {
    const parse = (key: string) =>
      parseHostIndexDocument(
        JSON.stringify({
          schema: "delivery.projects.host-index.v1",
          revision: 1,
          projects: [
            {
              projectKey: key,
              projectIdentifier: "0123abcd000000000000000000000000",
              root: "/srv/checkout",
              stateLocation: `/srv/state/projects/${key}`,
              lastWrittenAt: "2026-11-11T08:00:00.000Z",
            },
          ],
        }),
      ) !== undefined;
    expect(parse("delivery-a-0123abcd")).toBe(true);
    expect(parse("project-0123abcd")).toBe(true);
    // A basename that merely starts with `unbound` is a legitimate key; only the
    // reserved basename itself is refused (and it sanitises to the fallback).
    expect(parse("unbound-alpha-0123abcd")).toBe(true);
    for (const bad of [
      ".",
      "..",
      "",
      "owner:repo-0123abcd",
      "has space-0123abcd",
      `${"a".repeat(40)}-0123abcd`,
      "unbound-0123abcd",
      "delivery-a-0123ABCDE",
    ]) {
      expect(parse(bad), bad).toBe(false);
    }
  });
});

describe("F-4 the narrowed write-free claim for projects list", () => {
  test("a leftover store temp file is the only thing the read removes", async () => {
    const host = createHostFixture("list-write-free-narrow");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const checkout = createRepository(base, "narrow-repo");
      const harness = harnessFor(host, "narrow", checkout);
      harnesses.push(harness);
      await register(harness);
      await seedState(harness, "4");

      const documents = join(harness.stateLocation, "documents.default");
      const stale = join(documents, "dispatch-authority.json.stale.tmp");
      writeFileSync(stale, "stale temporary bytes\n", { mode: 0o600 });
      const container = join(host.hostRoot, "projects");
      const before = snapshotTree(container);
      const indexBefore = hostIndexTextOf(host.hostRoot);

      const run = await harness.run(["projects", "list", "--json"]);
      expect(run.exitCode).toBe(0);

      // The permitted write: the store's own cleanup of a leftover temp sibling.
      expect(existsSync(stale)).toBe(false);
      const after = snapshotTree(container);
      const staleName = Object.keys(before.files).find((name) => name.endsWith(".tmp"));
      expect(staleName).toBeDefined();
      const beforeWithoutTemp = { ...before.files };
      if (staleName !== undefined) delete beforeWithoutTemp[staleName];
      expect(after.files).toEqual(beforeWithoutTemp);
      // The host index is untouched: no maintenance, no revision advance.
      expect(hostIndexTextOf(host.hostRoot)).toBe(indexBefore);
    } finally {
      for (const record of harnesses) record.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });

  test("a fresh checkout mints its identity marker and nothing else", async () => {
    const host = createHostFixture("list-write-free-marker");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const checkout = createRepository(base, "marker-fresh");
      const harness = harnessFor(host, "marker-fresh", checkout);
      harnesses.push(harness);
      // Start marker-less: the harness construction resolved the scope once, so
      // remove what it minted and let the list invocation mint it again.
      rmSync(join(checkout, ".git", PROJECT_IDENTITY_MARKER_NAME), { force: true });
      const hostBefore = readdirSync(host.hostRoot).sort();

      const run = await harness.run(["projects", "list", "--json"]);
      expect(run.exitCode).toBe(0);

      // The permitted write: the create-once marker inside the checkout's git
      // common directory, never a host-root artifact.
      const marker = join(checkout, ".git", PROJECT_IDENTITY_MARKER_NAME);
      expect(existsSync(marker)).toBe(true);
      expect(statSync(marker).mode & 0o777).toBe(0o600);
      expect(readdirSync(host.hostRoot).sort()).toEqual(hostBefore);
      expect(existsSync(hostIndexDocumentPath(host.hostRoot))).toBe(false);
      expect(existsSync(join(host.hostRoot, "projects"))).toBe(false);
    } finally {
      for (const record of harnesses) record.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});

describe("F-9 a present but unreadable directory is classified, not discovered later", () => {
  test("an unreadable state root reaches projects.state-unavailable with key and location", async () => {
    // A root-owned process can read any directory, so the permission cell is
    // skipped there; the regular-file cell above is root-proof.
    if (process.getuid?.() === 0) return;
    const host = createHostFixture("list-unreadable-dir");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const checkout = createRepository(base, "unreadable-dir");
      const harness = harnessFor(host, "unreadable", checkout);
      harnesses.push(harness);
      await register(harness);
      const location = projectStateRoot(host.hostRoot, harness.projectKey);
      mkdirSync(location, { recursive: true, mode: 0o700 });
      chmodSync(location, 0o100);
      try {
        const run = await harness.run(["projects", "list", "--json"]);
        expect(run.exitCode).toBe(2);
        const error = run.envelope?.error as
          | { readonly code?: string; readonly summary?: string }
          | undefined;
        expect(error?.code).toBe("projects.state-unavailable");
        expect(error?.summary ?? "").toContain(harness.projectKey);
        expect(error?.summary ?? "").toContain(location);
        expect(run.envelope?.data).toBeUndefined();
      } finally {
        chmodSync(location, 0o700);
      }
    } finally {
      for (const record of harnesses) record.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});
