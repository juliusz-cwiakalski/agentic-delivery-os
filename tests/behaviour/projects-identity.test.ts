/**
 * GH-288 TC-PROJ-003 and TC-PROJ-004 — checkout identity stability.
 *
 * The identity input is the delivered git-metadata resolution, so every cell
 * runs over real repositories, real clones, and real linked worktrees. The key
 * and the state location are read from the delivered policy; no test computes
 * either value itself.
 */
import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { readQueueEntries } from "../../packages/core/src/app/queue";
import {
  PROJECT_IDENTITY_MARKER_NAME,
  PROJECT_KEY_PATTERN,
} from "../../packages/core/src/contracts/projects";
import {
  hostIndexEntryOf,
  hostIndexRevisionOf,
  hostIndexTextOf,
} from "../fixtures/projects/host-index";
import {
  copyMarker,
  markerModeOf,
  markerStatOf,
  markerTextOf,
  writeRawMarker,
} from "../fixtures/projects/markers";
import {
  createProductionProjectsHarness,
  type ProductionProjectsHarness,
} from "../fixtures/projects/production";
import {
  createHostFixture,
  type HostFixture,
  nonCheckoutDirectory,
  projectScopeFor,
} from "../fixtures/projects/state-scope";
import {
  addWorktree,
  cloneRepository,
  createBareOrigin,
  createRepository,
  nestedDirectory,
  removeDirectory,
  seedOrigin,
} from "../fixtures/projects/temp-repos";

const KEY_AND_LOCATION = (scope: ReturnType<typeof projectScopeFor>): string =>
  JSON.stringify([
    scope.scope.kind === "project" ? scope.scope.projectKey : null,
    scope.scope.stateLocation,
  ]);

const keyOf = (scope: ReturnType<typeof projectScopeFor>): string => {
  if (scope.scope.kind !== "project") throw new Error("a fixture checkout must resolve a project");
  return scope.scope.projectKey;
};

const locationOf = (scope: ReturnType<typeof projectScopeFor>): string => scope.scope.stateLocation;

const rootOf = (scope: ReturnType<typeof projectScopeFor>): string => {
  if (scope.scope.kind !== "project") throw new Error("a fixture checkout must resolve a project");
  return scope.scope.checkoutRoot;
};

const markerCountIn = (gitDirectory: string): number => {
  try {
    return readdirSync(gitDirectory).filter((name) => name === PROJECT_IDENTITY_MARKER_NAME).length;
  } catch {
    return 0;
  }
};

describe("TC-PROJ-003 identity matrix", () => {
  test("nested, linked worktree, rename, move, and a nested repository", () => {
    const host: HostFixture = createHostFixture("identity-matrix");
    const base = join(host.hostRoot, "..", `${host.hostRoot.split("/").at(-1)}-repos`);
    const parentA = `${base}/a`;
    const parentB = `${base}/b`;
    try {
      const repository = createRepository(parentA, "matrix-repo");
      const nested = nestedDirectory(repository, "packages", "core", "src", "deep");
      const worktree = addWorktree(repository, parentA, "matrix-worktree");
      const inner = createRepository(join(repository, "vendor"), "inner");

      const atRoot = projectScopeFor({ cwd: repository, hostRoot: host.hostRoot, home: host.home });
      const atNested = projectScopeFor({ cwd: nested, hostRoot: host.hostRoot, home: host.home });
      const atWorktree = projectScopeFor({
        cwd: worktree,
        hostRoot: host.hostRoot,
        home: host.home,
      });
      const atInner = projectScopeFor({ cwd: inner, hostRoot: host.hostRoot, home: host.home });

      // Cells 1-3 agree on the key and the state location.
      expect(KEY_AND_LOCATION(atNested)).toBe(KEY_AND_LOCATION(atRoot));
      expect(KEY_AND_LOCATION(atWorktree)).toBe(KEY_AND_LOCATION(atRoot));
      // The nested directory reports the nearest enclosing root.
      expect(rootOf(atNested)).toBe(repository);
      // The linked worktree reports the invoking worktree's own path.
      expect(rootOf(atWorktree)).toBe(worktree);

      // Cell 6: a nested repository is its own project.
      expect(keyOf(atInner)).not.toBe(keyOf(atRoot));
      expect(locationOf(atInner)).not.toBe(locationOf(atRoot));

      // Cell 4: a rename in place keeps the key and moves only the reported root.
      const renamed = `${parentA}/matrix-repo-renamed`;
      renameSync(repository, renamed);
      const atRenamed = projectScopeFor({ cwd: renamed, hostRoot: host.hostRoot, home: host.home });
      expect(KEY_AND_LOCATION(atRenamed)).toBe(KEY_AND_LOCATION(atRoot));
      expect(rootOf(atRenamed)).toBe(renamed);

      // Cell 5: a move to another parent keeps the key and moves only the root.
      mkdirSync(parentB, { recursive: true });
      renameSync(renamed, join(parentB, "matrix-repo-renamed"));
      const moved = join(parentB, "matrix-repo-renamed");
      const atMoved = projectScopeFor({ cwd: moved, hostRoot: host.hostRoot, home: host.home });
      expect(KEY_AND_LOCATION(atMoved)).toBe(KEY_AND_LOCATION(atRoot));
      expect(rootOf(atMoved)).toBe(moved);

      // One marker per common directory, travelling with the checkout.
      expect(markerCountIn(join(moved, ".git"))).toBe(1);
      expect(markerCountIn(join(moved, "vendor", "inner", ".git"))).toBe(1);
    } finally {
      removeDirectory(base);
      host.dispose();
    }
  });
});

describe("TC-PROJ-004 clones, worktrees, and marker discipline", () => {
  test("two clones are two projects, one clone's worktrees are one project", () => {
    const host = createHostFixture("identity-clones");
    const base = `${host.hostRoot}-repos`;
    try {
      const origin = createBareOrigin(base, "origin.git");
      seedOrigin(base, origin);
      const cloneA = cloneRepository(origin, join(base, "a"), "clone-a");
      const cloneB = cloneRepository(origin, join(base, "b"), "clone-b");
      const worktreeA1 = addWorktree(cloneA, join(base, "a"), "clone-a-wt1");
      const worktreeA2 = addWorktree(cloneA, join(base, "a"), "clone-a-wt2");
      const worktreeB1 = addWorktree(cloneB, join(base, "b"), "clone-b-wt1");

      const a = projectScopeFor({ cwd: cloneA, hostRoot: host.hostRoot, home: host.home });
      const a1 = projectScopeFor({ cwd: worktreeA1, hostRoot: host.hostRoot, home: host.home });
      const a2 = projectScopeFor({ cwd: worktreeA2, hostRoot: host.hostRoot, home: host.home });
      const b = projectScopeFor({ cwd: cloneB, hostRoot: host.hostRoot, home: host.home });
      const b1 = projectScopeFor({ cwd: worktreeB1, hostRoot: host.hostRoot, home: host.home });

      expect(keyOf(a)).toMatch(PROJECT_KEY_PATTERN);
      expect(keyOf(a)).not.toBe(keyOf(b));
      expect(locationOf(a)).not.toBe(locationOf(b));
      expect(KEY_AND_LOCATION(a1)).toBe(KEY_AND_LOCATION(a));
      expect(KEY_AND_LOCATION(a2)).toBe(KEY_AND_LOCATION(a));
      expect(KEY_AND_LOCATION(b1)).toBe(KEY_AND_LOCATION(b));

      // The marker lives in the common directory, is 0600, and is never rewritten.
      const common = join(cloneA, ".git");
      const markerPathMode = markerModeOf(common);
      expect(markerPathMode).toBe(0o600);
      const before = markerStatOf(common);
      const beforeText = markerTextOf(common);
      expect(beforeText).toBeDefined();
      const parsed = JSON.parse(beforeText ?? "{}") as {
        readonly projectKey?: string;
        readonly projectIdentifier?: string;
      };
      expect(parsed.projectKey).toBe(keyOf(a));
      expect(typeof parsed.projectIdentifier).toBe("string");
      expect((parsed.projectIdentifier ?? "").length).toBeGreaterThan(0);

      for (let index = 0; index < 4; index += 1) {
        projectScopeFor({ cwd: cloneA, hostRoot: host.hostRoot, home: host.home });
      }
      expect(markerStatOf(common)).toEqual(before);
      expect(markerTextOf(common)).toBe(beforeText);

      // No hardcoded product or binary literal in the marker bytes.
      const text = beforeText ?? "";
      for (const seed of ["ados", "ADOS_", "~/.ados"]) expect(text).not.toContain(seed);
    } finally {
      removeDirectory(base);
      host.dispose();
    }
  });

  test("a copied marker is read as identity and a corrupt one is refused", () => {
    const host = createHostFixture("identity-marker-copy");
    const base = `${host.hostRoot}-repos`;
    try {
      const first = createRepository(base, "first-repo");
      const second = createRepository(base, "second-repo");
      const firstScope = projectScopeFor({ cwd: first, hostRoot: host.hostRoot, home: host.home });
      copyMarker(join(first, ".git"), join(second, ".git"));
      const copied = projectScopeFor({ cwd: second, hostRoot: host.hostRoot, home: host.home });
      // A copied marker is accepted as the recorded identity: the key travels
      // with the marker until maintenance's DEC-18 guard refuses to share it.
      expect(keyOf(copied)).toBe(keyOf(firstScope));

      writeRawMarker(join(second, ".git"), "{ not json");
      expect(() =>
        projectScopeFor({ cwd: second, hostRoot: host.hostRoot, home: host.home }),
      ).toThrow(/identity-unreadable/u);
    } finally {
      removeDirectory(base);
      host.dispose();
    }
  });

  test("two concurrent first uses land exactly one marker and one key", async () => {
    const host = createHostFixture("identity-race");
    const base = `${host.hostRoot}-repos`;
    try {
      const origin = createBareOrigin(base, "race-origin.git");
      seedOrigin(base, origin);
      const fresh = cloneRepository(origin, base, "clone-race");
      const script = [
        'import { projectScopeFor } from "./tests/fixtures/projects/state-scope";',
        "const scope = projectScopeFor({",
        "  cwd: process.env.GH288_CWD,",
        "  hostRoot: process.env.GH288_HOST,",
        "  home: process.env.HOME,",
        "});",
        "console.log(JSON.stringify(scope));",
      ].join("\n");
      const spawnOne = () =>
        Bun.spawn(["bun", "-e", script], {
          cwd: process.cwd(),
          env: { ...process.env, GH288_CWD: fresh, GH288_HOST: host.hostRoot, HOME: host.home },
          stdout: "pipe",
          stderr: "pipe",
        });
      const first = spawnOne();
      const second = spawnOne();
      const [firstExit, secondExit] = await Promise.all([first.exited, second.exited]);
      const firstOut = await new Response(first.stdout).text();
      const secondOut = await new Response(second.stdout).text();
      expect({ firstExit, secondExit }).toEqual({ firstExit: 0, secondExit: 0 });
      const firstKey = (JSON.parse(firstOut.trim()) as { scope: { projectKey: string } }).scope
        .projectKey;
      const secondKey = (JSON.parse(secondOut.trim()) as { scope: { projectKey: string } }).scope
        .projectKey;
      expect(firstKey).toBe(secondKey);
      expect(markerCountIn(join(fresh, ".git"))).toBe(1);
      const leftovers = readdirSync(join(fresh, ".git")).filter((name) =>
        name.includes(`${PROJECT_IDENTITY_MARKER_NAME}.`),
      );
      expect(leftovers).toEqual([]);
    } finally {
      removeDirectory(base);
      host.dispose();
    }
  });
});

const REF_040 = "GH-241";

const PM_NOTES_040 = `---
change_id: ${REF_040}
title: "same-basename fixture"
milestone: "M2: Workstation"
story_code: M2-S11
delivery_mode: interactive
phases:
  clarify_scope: { started: "2026-11-11T08:00:00Z", completed: "2026-11-11T08:10:00Z" }
  specification: { started: "2026-11-11T08:11:00Z", completed: "2026-11-11T08:20:00Z" }
  test_planning: { started: "2026-11-11T08:21:00Z", completed: "2026-11-11T08:30:00Z" }
  delivery_planning: { started: "2026-11-11T08:31:00Z", completed: "2026-11-11T08:40:00Z" }
  dor_check: { started: "2026-11-11T08:41:00Z", completed: "2026-11-11T08:50:00Z" }
  delivery: { started: null, completed: null, reopened: null, commits: [] }
  system_spec_update: { started: null, completed: null }
  review_fix: { started: null, completed: null }
  quality_gates: { started: null, completed: null }
  dod_check: { started: null, completed: null }
  pr_creation: { started: null, completed: null, url: null }
decisions: []
open_questions: []
blockers: []
notes: []
`;

const seedPmNotes040 = (checkout: string): void => {
  const folder = join(checkout, "doc", "changes", "2026-11", `2026-11-11--${REF_040}--same-ref`);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, `chg-${REF_040}-pm-notes.yaml`), PM_NOTES_040);
};

const harness040 = (host: HostFixture, label: string, checkout: string) =>
  createProductionProjectsHarness({
    label,
    host,
    workingDirectory: checkout,
    originUrl: `https://github.com/owner/${label}.git`,
  });

const register040 = async (harness: ProductionProjectsHarness): Promise<void> => {
  const run = await harness.run(["queue", "list", "--json"]);
  if (run.exitCode !== 0) throw new Error(`registration failed: ${run.stderr}`);
};

const projectKeyOfHarness = (harness: ProductionProjectsHarness): string => harness.projectKey;

describe("TC-PROJ-005 the declared unbound scope outside any work tree", () => {
  test("exit unchanged, one warning, no registration, no project root, no path-derived key", async () => {
    const host = createHostFixture("unbound-scope");
    const base = `${host.hostRoot}-repos`;
    const outside = nonCheckoutDirectory("unbound-scope");
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const alpha = createRepository(base, "unbound-alpha");
      const beta = createRepository(base, "unbound-beta");
      const a = harness040(host, "unbound-alpha", alpha);
      const b = harness040(host, "unbound-beta", beta);
      harnesses.push(a, b);
      await register040(a);
      await register040(b);

      const indexBefore = hostIndexTextOf(host.hostRoot);
      const revisionBefore = hostIndexRevisionOf(host.hostRoot);
      const projectsDirectory = join(host.hostRoot, "projects");
      const listProjects = (): readonly string[] =>
        existsSync(projectsDirectory) ? readdirSync(projectsDirectory).sort() : [];
      const projectsBefore = listProjects();

      const outsideHarness = createProductionProjectsHarness({
        label: "unbound-outside",
        host,
        workingDirectory: outside,
        originUrl: "https://github.com/owner/outside.git",
      });
      harnesses.push(outsideHarness);

      // The scope is the declared `unbound` root beside the project container,
      // and it carries no project key at all.
      expect(outsideHarness.stateLocation).toBe(join(host.hostRoot, "unbound"));
      expect(outsideHarness.stateLocation.startsWith(join(host.hostRoot, "projects"))).toBe(false);

      const unbound = await outsideHarness.run(["status", "--json"]);
      expect(unbound.exitCode).toBe(0);
      const warningLines = unbound.stderr.split("\n").filter((line) => line.includes("unbound"));
      expect(warningLines).toHaveLength(1);
      expect(unbound.stderr).toContain("not repository-scoped");
      expect(unbound.envelope?.data as Record<string, unknown>).not.toHaveProperty("projectKey");

      // The index is byte- and revision-identical and no project root appeared.
      expect(hostIndexTextOf(host.hostRoot)).toBe(indexBefore);
      expect(hostIndexRevisionOf(host.hostRoot)).toBe(revisionBefore);
      expect(listProjects()).toEqual(projectsBefore);
      expect(
        readdirSync(host.hostRoot).filter((name) => name === PROJECT_IDENTITY_MARKER_NAME),
      ).toEqual([]);
      expect(readdirSync(outside).filter((name) => name === PROJECT_IDENTITY_MARKER_NAME)).toEqual(
        [],
      );

      // Using the unbound scope writes to `<host>/unbound`, never into a project.
      const queued = await outsideHarness.run(["queue", "add", REF_040, "--json"]);
      expect(queued.exitCode).toBe(0);
      expect(readdirSync(join(host.hostRoot, "unbound"))).toContain("ledger.default.jsonl");
      expect(hostIndexTextOf(host.hostRoot)).toBe(indexBefore);
      expect(listProjects()).toEqual(projectsBefore);

      // Step 4: the same command inside a registered checkout keeps the exit code.
      const inside = await a.run(["status", "--json"]);
      expect(inside.exitCode).toBe(unbound.exitCode);

      // `projects list` does not report the unbound scope as a project row.
      const listed = await outsideHarness.run(["projects", "list", "--json"]);
      expect(listed.exitCode).toBe(0);
      const listedData = listed.envelope?.data as
        | { readonly projects?: readonly Record<string, unknown>[] }
        | undefined;
      const rows = listedData?.projects ?? [];
      expect(rows).toHaveLength(2);
      for (const row of rows) expect(row.projectKey).not.toBe("unbound");
      // No value derived from the outside directory's name appears in the
      // overview, and the unbound scope exposes no project key.
      const basename = outside.split("/").at(-1) ?? "";
      expect(listed.stdout + listed.stderr).not.toContain(basename);
      expect(unbound.stderr + unbound.stdout).not.toContain("projectKey");
      const unboundScope = projectScopeFor({
        cwd: outside,
        hostRoot: host.hostRoot,
        home: host.home,
      });
      expect(unboundScope.scope.kind).toBe("unbound");
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      removeDirectory(outside);
      host.dispose();
    }
  });
});

describe("TC-PROJ-040 same-basename checkouts and the DEC-18 collision guard", () => {
  test("same basename, distinct keys and roots, immutability, fallback, and the collision refusal", async () => {
    const host = createHostFixture("same-basename");
    const work = join(`${host.hostRoot}-repos`, "work");
    const other = join(`${host.hostRoot}-repos`, "other");
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const first = createRepository(work, "frontend");
      const second = createRepository(other, "frontend");
      seedPmNotes040(first);
      seedPmNotes040(second);

      // Step 1: shape and distinctness.
      const a = harness040(host, "frontend-a", first);
      const b = harness040(host, "frontend-b", second);
      harnesses.push(a, b);
      const keyA = projectKeyOfHarness(a);
      const keyB = projectKeyOfHarness(b);
      for (const key of [keyA, keyB]) {
        expect(key).toMatch(PROJECT_KEY_PATTERN);
        expect(key).not.toContain("/");
        expect(key).not.toBe(".");
        expect(key).not.toBe("..");
      }
      expect(keyA).not.toBe(keyB);
      expect(a.stateLocation).not.toBe(b.stateLocation);
      expect(a.stateLocation).toBe(`${host.hostRoot}/projects/${keyA}`);
      expect(b.stateLocation).toBe(`${host.hostRoot}/projects/${keyB}`);
      await register040(a);
      await register040(b);

      // Step 2: state disjointness for the same ref.
      for (const harness of [a, b]) {
        expect((await harness.run(["queue", "add", REF_040, "--json"])).exitCode).toBe(0);
        expect(
          (await harness.run(["phase", "complete", REF_040, "delivery", "--no-commit", "--json"]))
            .exitCode,
        ).toBe(0);
      }
      const recordsA = readQueueEntries(a.store);
      const recordsB = readQueueEntries(b.store);
      expect(recordsA.ok && recordsA.records.map((record) => record.ref)).toEqual([REF_040]);
      expect(recordsB.ok && recordsB.records.map((record) => record.ref)).toEqual([REF_040]);
      expect(readFileSync(join(a.stateLocation, "ledger.default.jsonl"), "utf8")).not.toBe(
        readFileSync(join(b.stateLocation, "ledger.default.jsonl"), "utf8"),
      );

      // Step 3: renaming to a different basename keeps the key and the root.
      const renamed = `${work}/frontend-renamed`;
      renameSync(first, renamed);
      const renamedScope = projectScopeFor({
        cwd: renamed,
        hostRoot: host.hostRoot,
        home: host.home,
      });
      expect(
        renamedScope.scope.kind === "project" ? renamedScope.scope.projectKey : undefined,
      ).toBe(keyA);
      expect(renamedScope.scope.stateLocation).toBe(a.stateLocation);

      // Step 5: a basename that sanitises to nothing falls back to `project`.
      const separators = createRepository(join(`${host.hostRoot}-repos`, "fallback"), "---");
      const fallbackHarness = harness040(host, "fallback", separators);
      harnesses.push(fallbackHarness);
      expect(projectKeyOfHarness(fallbackHarness)).toMatch(/^project-[0-9a-f]{8}$/);

      // Step 6: `unbound` is refused as a basename.
      const unboundName = createRepository(
        join(`${host.hostRoot}-repos`, "unbound-name"),
        "unbound",
      );
      const unboundHarness = harness040(host, "unbound-name", unboundName);
      harnesses.push(unboundHarness);
      expect(projectKeyOfHarness(unboundHarness).startsWith("unbound-")).toBe(false);

      // Step 4: the collision guard. A byte-for-byte copied marker carries B's
      // own identifier, so the key's discriminator matches it and DEC-18 cannot
      // fire; the reachable provocation is a marker that keeps B's key and
      // basename but records a *different* identifier with the same first eight
      // hex characters. That marker validates and presents a key B already holds.
      const colliding = createRepository(join(`${host.hostRoot}-repos`, "collision"), "collider");
      const c = harness040(host, "collider", colliding);
      harnesses.push(c);
      register040(c);
      const bMarker = JSON.parse(
        readFileSync(join(second, ".git", PROJECT_IDENTITY_MARKER_NAME), "utf8"),
      ) as {
        readonly projectKey: string;
        readonly projectIdentifier: string;
        readonly basename: string;
      };
      const collidingIdentifier = `${bMarker.projectIdentifier.slice(0, 8)}${"0".repeat(24)}`;
      expect(collidingIdentifier).not.toBe(bMarker.projectIdentifier);
      writeRawMarker(
        join(colliding, ".git"),
        JSON.stringify({
          schema: "delivery.projects.identity.v1",
          projectKey: bMarker.projectKey,
          projectIdentifier: collidingIdentifier,
          basename: bMarker.basename,
        }),
      );
      const cHarness = harness040(host, "collider", colliding);
      harnesses.push(cHarness);

      const indexBefore = hostIndexTextOf(host.hostRoot);
      const revisionBefore = hostIndexRevisionOf(host.hostRoot);
      const bRootBefore = readdirSync(b.stateLocation).sort();

      const collided = await cHarness.run(["queue", "list", "--json"]);
      expect(collided.exitCode).toBe(2);
      const error = collided.envelope?.error as {
        readonly code?: string;
        readonly summary?: string;
      };
      expect(error.code).toBe("projects.state-unavailable");
      expect(error.summary ?? "").toContain(colliding);
      expect(error.summary ?? "").toContain(keyB);
      expect(error.summary ?? "").toContain(bMarker.projectIdentifier);
      expect(collided.stderr).toContain(keyB);
      expect(collided.stderr).toContain(second);
      expect(collided.stderr).toContain(colliding);

      // The existing entry stays byte-identical and no revision advances.
      expect(hostIndexTextOf(host.hostRoot)).toBe(indexBefore);
      expect(hostIndexRevisionOf(host.hostRoot)).toBe(revisionBefore);
      expect(hostIndexEntryOf(host.hostRoot, keyB)?.root).toBe(second);
      expect(readdirSync(b.stateLocation).sort()).toEqual(bRootBefore);
      expect(cHarness.stateLocation).toBe(b.stateLocation);
      // C never wrote into its own root either: the refusal preceded the store.
      expect(existsSync(join(c.stateLocation, "ledger.default.jsonl"))).toBe(false);
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(`${host.hostRoot}-repos`);
      host.dispose();
    }
  });
});
