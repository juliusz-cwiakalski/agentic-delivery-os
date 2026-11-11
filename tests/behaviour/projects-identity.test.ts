/**
 * GH-288 TC-PROJ-003 and TC-PROJ-004 — checkout identity stability.
 *
 * The identity input is the delivered git-metadata resolution, so every cell
 * runs over real repositories, real clones, and real linked worktrees. The key
 * and the state location are read from the delivered policy; no test computes
 * either value itself.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import {
  PROJECT_IDENTITY_MARKER_NAME,
  PROJECT_KEY_PATTERN,
} from "../../packages/core/src/contracts/projects";
import {
  copyMarker,
  markerModeOf,
  markerStatOf,
  markerTextOf,
  writeRawMarker,
} from "../fixtures/projects/markers";
import {
  createHostFixture,
  type HostFixture,
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
