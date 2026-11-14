/**
 * GH-309 TC-GRPREN-003..006 — the `projects list --flat` deprecation alias and
 * the moved flat failure identities.
 *
 * C-2 binds the alias's SUCCESS payload: `projects list --flat --json` returns
 * the delivered `projects.v1` payload byte-for-byte on a fixed fixture, checked
 * against the committed normalized golden with absence negatives. The failure
 * path is governed by the moved identities (spec v1.1, DoD-8): every `--flat`
 * failure classifies under `repos.*`, never the retired `projects.*` flat
 * identities. `--flat --project` is refused at exit 1 under the shared
 * `input.value.rejected` identity (OQ-2).
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { hostIndexDocumentPath } from "../../packages/adapters/src/file/host-index-store";
import { projectStateRoot } from "../../packages/core/src/app/state-scope";
import { HOST_INDEX_SCHEMA } from "../../packages/core/src/contracts/projects";
import {
  createProductionProjectsHarness,
  type ProductionProjectsHarness,
  type ProductionRun,
} from "../fixtures/projects/production";
import { createHostFixture, type HostFixture } from "../fixtures/projects/state-scope";
import { createRepository, removeDirectory } from "../fixtures/projects/temp-repos";

const ROOT = process.cwd();
const GOLDEN = "tests/golden/fixtures/projects-flat-alias.json";

type Envelope = {
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string; readonly summary?: string };
};

const envelopeOf = (run: ProductionRun): Envelope | undefined =>
  run.envelope as Envelope | undefined;

const dataOf = (run: ProductionRun): Record<string, unknown> => {
  const data = envelopeOf(run)?.data;
  if (data === undefined) throw new Error(`no data envelope: ${run.stdout}${run.stderr}`);
  return data;
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

const writeIndex = (
  hostRoot: string,
  projects: readonly Record<string, unknown>[],
  revision = 7,
): void => {
  mkdirSync(hostRoot, { recursive: true });
  writeFileSync(
    hostIndexDocumentPath(hostRoot),
    `${JSON.stringify({ schema: HOST_INDEX_SCHEMA, revision, projects }, null, 2)}\n`,
  );
};

type AliasFixture = {
  readonly host: HostFixture;
  readonly harness: ProductionProjectsHarness;
  readonly alpha: string;
  readonly beta: string;
  readonly dispose: () => void;
};

/** A host fixed at test-authoring time: two fixed keys, fixed roots, one revision. */
const createAliasFixture = (label: string): AliasFixture => {
  const host = createHostFixture(label);
  const base = `${host.hostRoot}-repos`;
  const alpha = createRepository(base, "alpha");
  const beta = createRepository(base, "beta");
  const controller = createRepository(base, "controller");
  writeIndex(host.hostRoot, [
    {
      projectKey: "alpha-repo-1a2b3c4d",
      projectIdentifier: "a".repeat(32),
      root: alpha,
      stateLocation: projectStateRoot(host.hostRoot, "alpha-repo-1a2b3c4d"),
      lastWrittenAt: "2026-11-14T10:00:00.000Z",
    },
    {
      projectKey: "beta-repo-5e6f7a8b",
      projectIdentifier: "b".repeat(32),
      root: beta,
      stateLocation: projectStateRoot(host.hostRoot, "beta-repo-5e6f7a8b"),
      lastWrittenAt: "2026-11-14T10:00:00.000Z",
    },
  ]);
  const harness = harnessFor(host, `${label}-controller`, controller);
  return {
    host,
    harness,
    alpha,
    beta,
    dispose: () => {
      harness.dispose();
      removeDirectory(base);
      host.dispose();
    },
  };
};

const normalizeAliasData = (
  data: Record<string, unknown>,
  host: HostFixture,
  roots: Readonly<Record<string, string>>,
): Record<string, unknown> => {
  const replace = (value: unknown): unknown => {
    if (typeof value === "string") {
      let next = value;
      // Repo roots live beside the host root, so they are replaced before the
      // host root itself would claim their prefix.
      for (const [token, path] of Object.entries(roots)) next = next.replaceAll(path, token);
      return next.replaceAll(host.hostRoot, "<host-root>");
    }
    if (Array.isArray(value)) return value.map(replace);
    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
          key,
          replace(entry),
        ]),
      );
    }
    return value;
  };
  return replace(data) as Record<string, unknown>;
};

describe("TC-GRPREN-003 the alias returns the delivered projects.v1 payload unchanged", () => {
  test("the normalized payload equals the committed golden with absence negatives", async () => {
    const fixture = createAliasFixture("flat-alias-golden");
    try {
      const run = await fixture.harness.run(["projects", "list", "--flat", "--json"]);
      expect(run.exitCode, run.stderr).toBe(0);
      const data = dataOf(run);
      const normalized = normalizeAliasData(data, fixture.host, {
        "<repo-root-alpha>": fixture.alpha,
        "<repo-root-beta>": fixture.beta,
      });
      const golden = JSON.parse(readFileSync(join(ROOT, GOLDEN), "utf8")) as Record<
        string,
        unknown
      >;
      expect(normalized).toEqual(golden);

      // Absence negatives: the alias is the flat payload, not a group record set.
      const serialized = JSON.stringify(data);
      expect(serialized).not.toContain("groupKey");
      expect(serialized).not.toContain("repoKey");
      expect(data.groups).toBeUndefined();
      expect(data.repos).toBeUndefined();
      expect(Object.keys(data).sort()).toEqual(["hostIndexRevision", "projects"]);
      const projects = data.projects as readonly Record<string, unknown>[];
      expect(projects.map((entry) => entry.projectKey)).toEqual([
        "alpha-repo-1a2b3c4d",
        "beta-repo-5e6f7a8b",
      ]);
      for (const entry of projects) {
        expect(Object.keys(entry).sort()).toEqual([
          "daemonReachable",
          "handoverState",
          "projectKey",
          "root",
          "stateLocation",
        ]);
      }
    } finally {
      fixture.dispose();
    }
  });

  test("the alias text table keeps the delivered shape, sorted by project key", async () => {
    const fixture = createAliasFixture("flat-alias-text");
    try {
      const run = await fixture.harness.run(["projects", "list", "--flat"]);
      expect(run.exitCode, run.stderr).toBe(0);
      const lines = run.stdout.trimEnd().split("\n");
      expect(lines[0]).toBe("KEY  ROOT  STATE  DAEMON  HANDOVER");
      const rows = lines.slice(1);
      expect(rows).toHaveLength(2);
      const keys = rows.map((row) => row.split(/\s{2,}/)[0] ?? "");
      expect(keys).toEqual(["alpha-repo-1a2b3c4d", "beta-repo-5e6f7a8b"]);
    } finally {
      fixture.dispose();
    }
  });
});

describe("TC-GRPREN-005 --flat and --project are mutually exclusive at exit 1", () => {
  test("the combination is refused under input.value.rejected and never coerced", async () => {
    const host = createHostFixture("flat-alias-exclusive");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const checkout = createRepository(base, "exclusive-repo");
      const harness = harnessFor(host, "exclusive", checkout);
      harnesses.push(harness);
      const run = await harness.run([
        "projects",
        "list",
        "--flat",
        "--project",
        "platform",
        "--json",
      ]);
      expect(run.exitCode).toBe(1);
      expect(errorCodeOf(run)).toBe("input.value.rejected");
      expect(envelopeOf(run)?.data).toBeUndefined();
      expect(run.stdout + run.stderr).toContain("mutually exclusive");

      // Each synopsis form alone still answers through its own path.
      const flat = await harness.run(["projects", "list", "--flat", "--json"]);
      expect(flat.exitCode, flat.stderr).toBe(0);
      expect(dataOf(flat).projects).toBeDefined();
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});

describe("TC-GRPREN-006 alias failures carry the moved repos.* identities", () => {
  test("identity, corrupt registry, and unavailable state classify under repos.* at unchanged exits", async () => {
    const host = createHostFixture("flat-alias-failures");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      // Identity: the invoking checkout's git metadata is unusable.
      const broken = join(base, "broken-gitdir");
      mkdirSync(broken, { recursive: true });
      writeFileSync(join(broken, ".git"), "gitdir:   \n");
      const brokenHarness = harnessFor(host, "flat-broken", broken);
      harnesses.push(brokenHarness);
      const identity = await brokenHarness.run(["projects", "list", "--flat", "--json"]);
      expect(identity.exitCode).toBe(1);
      expect(errorCodeOf(identity)).toBe("repos.identity-unreadable");

      // Registry: a present but unparsable host index.
      const checkout = createRepository(base, "alias-repo");
      const harness = harnessFor(host, "flat-healthy", checkout);
      harnesses.push(harness);
      await register(harness);
      writeFileSync(hostIndexDocumentPath(host.hostRoot), "{ not json\n");
      const registry = await harness.run(["projects", "list", "--flat", "--json"]);
      expect(registry.exitCode).toBe(2);
      expect(errorCodeOf(registry)).toBe("repos.registry-corrupt");
      expect(envelopeOf(registry)?.data).toBeUndefined();

      // State: a present-but-unreadable state location.
      writeIndex(host.hostRoot, [
        {
          projectKey: harness.projectKey,
          projectIdentifier: "c".repeat(32),
          root: checkout,
          stateLocation: projectStateRoot(host.hostRoot, harness.projectKey),
          lastWrittenAt: "2026-11-14T10:00:00.000Z",
        },
      ]);
      const blockedLocation = projectStateRoot(host.hostRoot, harness.projectKey);
      removeDirectory(blockedLocation);
      mkdirSync(dirname(blockedLocation), { recursive: true });
      writeFileSync(blockedLocation, "not a directory\n");
      const state = await harness.run(["projects", "list", "--flat", "--json"]);
      expect(state.exitCode).toBe(2);
      expect(errorCodeOf(state)).toBe("repos.state-unavailable");

      // The retired projects.* flat identities never fire on the alias.
      for (const run of [identity, registry, state]) {
        expect((errorCodeOf(run) ?? "").startsWith("projects.")).toBe(false);
      }
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});
