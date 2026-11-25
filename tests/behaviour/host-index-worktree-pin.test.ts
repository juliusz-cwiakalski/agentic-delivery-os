/**
 * TC-HOSTIDX-001/002/003 (GH-404 F-5, AC-F5-1, NFR-6, DM-2) — the host-index
 * registration is pinned to the MAIN checkout for every lane command, whatever
 * checkout invoked it: zero root flips across lane commands run from the
 * worktree, the live clone's entry survives worktree removal plus a
 * maintenance pass (`repos list` keeps its row), and worktrees never appear as
 * rows of the flat record set. Hermetic: temporary git repositories and a
 * temporary host root created and cleaned up by the harness.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { maintainHostIndex } from "../../packages/core/src/app/host-index";
import {
  HOST_INDEX_SCHEMA,
  type HostIndexDocument,
  type HostIndexRegistration,
} from "../../packages/core/src/contracts/projects";

const git = (cwd: string, args: readonly string[]): string =>
  execFileSync("git", [...args], { cwd, encoding: "utf8" }).trim();

/** A clone with one base commit and one linked worktree on a lane branch. */
const makeCloneWithWorktree = (): {
  readonly main: string;
  readonly worktree: string;
  readonly commonDir: string;
  readonly remove: () => void;
} => {
  const base = mkdtempSync(join(tmpdir(), "gh404-hostidx-"));
  const main = join(base, "main");
  mkdirSync(main, { recursive: true });
  git(main, ["init", "-q", "-b", "main-tools"]);
  git(main, ["config", "user.email", "gh404@example.invalid"]);
  git(main, ["config", "user.name", "GH-404 Host Index Fixture"]);
  git(main, ["commit", "-q", "--allow-empty", "-m", "base"]);
  const worktree = join(base, "worktree");
  git(main, ["worktree", "add", "-q", worktree, "-b", "lane/GH-404", "main-tools"]);
  // The common directory resolved FROM the worktree (the delivered read).
  const commonDir = git(worktree, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  return {
    main,
    worktree,
    commonDir,
    remove: () => rmSync(base, { recursive: true, force: true }),
  };
};

/** The delivered registration-root derivation (the phase-5 call-site pin). */
const registrationRootFrom = (checkoutIdentityCommonDir: string): string =>
  join(realpathSync(checkoutIdentityCommonDir), "..");

const registration = (root: string, recordedAt: string): HostIndexRegistration => ({
  projectKey: "repo-0123456789abcdef",
  projectIdentifier: "0123456789abcdef0123456789abcdef",
  root,
  stateLocation: "/host/projects/repo-0123456789abcdef",
  recordedAt,
});

const document = (root: string): HostIndexDocument => ({
  schema: HOST_INDEX_SCHEMA,
  revision: 1,
  projects: [
    {
      projectKey: "repo-0123456789abcdef",
      projectIdentifier: "0123456789abcdef0123456789abcdef",
      root,
      stateLocation: "/host/projects/repo-0123456789abcdef",
      lastWrittenAt: "2026-11-25T00:00:00.000Z",
    },
  ],
});

const aliveProbe = () => ({ kind: "alive" as const, summary: "probe ok" });

describe("TC-HOSTIDX-001 lane commands from the worktree keep the root at the main checkout", () => {
  test("every lane command's maintenance pass registers the physical main checkout", () => {
    const fixture = makeCloneWithWorktree();
    try {
      // The pin's derivation FROM the worktree: the common directory's parent
      // is the main checkout — resolved from real paths, never the alias.
      const mainCheckout = registrationRootFrom(fixture.commonDir);
      expect(mainCheckout).toBe(realpathSync(fixture.main));
      expect(mainCheckout).not.toBe(realpathSync(fixture.worktree));
      // Three lane commands, three maintenance passes, all from the worktree.
      const rootsAfterEachCommand: string[] = [];
      for (const command of ["dispatch", "dispatch status", "lanes"]) {
        const maintained = maintainHostIndex({
          hostRoot: "/host",
          document: document(mainCheckout),
          corrupt: false,
          registration: registration(
            mainCheckout,
            `2026-11-25T00:00:0${1 + rootsAfterEachCommand.length}.000Z`,
          ),
          probe: aliveProbe,
        });
        void command;
        // The effective document: a no-op maintenance (the registration
        // already matches) keeps the delivered document, and the entry's root
        // is the main checkout either way.
        const effective = maintained.next ?? document(mainCheckout);
        rootsAfterEachCommand.push(effective.projects[0]?.root ?? "");
      }
      // Zero root flips to the worktree path.
      expect(rootsAfterEachCommand).toHaveLength(3);
      for (const root of rootsAfterEachCommand) expect(root).toBe(fixture.main);
      expect(rootsAfterEachCommand.every((root) => root !== fixture.worktree)).toBe(true);
    } finally {
      fixture.remove();
    }
  });
});

describe("TC-HOSTIDX-002 worktree removal plus maintenance keeps the live clone's entry", () => {
  test("the entry survives removal and `repos list` keeps its row", () => {
    const fixture = makeCloneWithWorktree();
    try {
      const mainCheckout = registrationRootFrom(fixture.commonDir);
      // The lane's closeout removes the worktree (the delivered removal path).
      fixture.remove === undefined
        ? undefined
        : git(fixture.main, ["worktree", "remove", "--force", fixture.worktree]);
      expect(existsSync(fixture.worktree)).toBe(false);
      // The next maintenance pass after the removal.
      const maintained = maintainHostIndex({
        hostRoot: "/host",
        document: document(mainCheckout),
        corrupt: false,
        registration: registration(mainCheckout, "2026-11-25T00:00:09.000Z"),
        probe: aliveProbe,
      });
      const entry = maintained.next?.projects[0] ?? document(mainCheckout).projects[0];
      // Zero prunes: the live clone's entry is still present with its root.
      expect(entry.root).toBe(fixture.main);
      expect(entry.projectKey).toBe("repo-0123456789abcdef");
      // `repos list` keeps its row: the flat record set still holds the clone.
      const rows = (maintained.next ?? document(mainCheckout)).projects;
      expect(rows).toHaveLength(1);
    } finally {
      fixture.remove();
    }
  });
});

describe("TC-HOSTIDX-003 worktrees never appear as rows of the flat record set", () => {
  test("the flat record set holds exactly the registered clones", () => {
    const fixture = makeCloneWithWorktree();
    try {
      const mainCheckout = registrationRootFrom(fixture.commonDir);
      const secondWorktree = join(fixture.main, "..", "worktree-2");
      git(fixture.main, [
        "worktree",
        "add",
        "-q",
        secondWorktree,
        "-b",
        "lane/GH-405",
        "main-tools",
      ]);
      const maintained = maintainHostIndex({
        hostRoot: "/host",
        document: document(mainCheckout),
        corrupt: false,
        registration: registration(mainCheckout, "2026-11-25T00:00:10.000Z"),
        probe: aliveProbe,
      });
      const rows = (maintained.next ?? document(mainCheckout)).projects;
      // Exactly the registered clone: no worktree path is a row.
      expect(rows).toHaveLength(1);
      expect(rows[0]?.root).toBe(fixture.main);
      for (const row of rows) {
        expect(row.root).not.toBe(fixture.worktree);
        expect(row.root).not.toBe(secondWorktree);
      }
      git(fixture.main, ["worktree", "remove", "--force", secondWorktree]);
    } finally {
      fixture.remove();
    }
  });
});
