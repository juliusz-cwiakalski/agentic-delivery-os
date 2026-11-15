/**
 * TC-XHERM-001/002 (GH-310 NFR-3, AC-NFR3-1, C-7) — the cross-repository
 * acceptance path is hermetic: two real local temporary member repositories,
 * injected provider/review/landing facts, zero network, zero second remote, zero
 * credentials, no ambient home, no daemon, no composition from this checkout,
 * and deterministic repeats.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { findGitRoot, nodeRepositoryIo } from "../../packages/adapters/src/repo/index";
import { API_MEMBER, CHANGE_REF, WEB_MEMBER } from "../fixtures/cross-repository/constants";
import {
  declaredMember,
  greenMemberReads,
  type MemberGatesWorld,
  runMemberGates,
} from "../fixtures/cross-repository/facts";
import { createMemberQueueHarness } from "../fixtures/cross-repository/queue";
import { createTwoMemberWorld } from "../fixtures/cross-repository/two-members";
import { brandOf, realStateFingerprint } from "../fixtures/projects/state-scope";
import { git } from "../fixtures/projects/temp-repos";
import { createNoSpawnGuard } from "../fixtures/result/no-spawn-guard";
import { createNoNetworkGuard } from "../fixtures/verify-gates/cases/network-guard";

const ROOT = process.cwd();
const FIXTURE_DIR = join(ROOT, "tests/fixtures/cross-repository");

const fixtureSources = (): readonly { readonly file: string; readonly text: string }[] =>
  [
    "constants.ts",
    "facts.ts",
    "plan.ts",
    "queue.ts",
    "review.ts",
    "closeout.ts",
    "two-members.ts",
  ].map((name) => ({ file: name, text: readFileSync(join(FIXTURE_DIR, name), "utf8") }));

const world = (): MemberGatesWorld => ({
  members: [declaredMember(API_MEMBER), declaredMember(WEB_MEMBER)],
  reads: {
    [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER),
    [WEB_MEMBER.repoKey]: greenMemberReads(WEB_MEMBER),
  },
});

describe("TC-XHERM-001 two real local member repositories with injected facts", () => {
  test("each member is a real checkout with its own branch, head, and no remote", () => {
    const members = createTwoMemberWorld("hermetic-members");
    try {
      expect(members.members).toHaveLength(2);
      for (const member of members.members) {
        expect(git(member.root, ["rev-parse", "--git-dir"]).trim().length).toBeGreaterThan(0);
        expect(git(member.root, ["rev-parse", "HEAD"]).trim()).toBe(member.headSha);
        expect(git(member.root, ["rev-parse", "--abbrev-ref", "HEAD"]).trim()).toBe(member.branch);
        expect(git(member.root, ["remote"]).trim()).toBe("");
        expect(realpathSync(git(member.root, ["rev-parse", "--show-toplevel"]).trim())).toBe(
          realpathSync(member.root),
        );
      }
      expect(members.members[0]?.headSha).not.toBe(members.members[1]?.headSha);
    } finally {
      members.dispose();
    }
  });

  test("swapping only the injected facts changes the verdict, with no network or spawn", async () => {
    const spawnGuard = createNoSpawnGuard();
    const networkGuard = createNoNetworkGuard();
    try {
      spawnGuard.install();
      const green = await runMemberGates(world());
      const blocked = await runMemberGates({
        ...world(),
        reads: {
          [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER),
          [WEB_MEMBER.repoKey]: greenMemberReads(WEB_MEMBER, {
            checkRuns: { ok: true, value: { items: [], pageItemCount: 0 } },
          }),
        },
      });
      expect(green.exitCode).toBe(0);
      expect(blocked.exitCode).toBe(1);
      expect(green.stdout).not.toBe(blocked.stdout);
      expect(spawnGuard.violations).toEqual([]);
      expect(networkGuard.calls).toEqual([]);
    } finally {
      networkGuard.restore();
      spawnGuard.restore();
    }
  });

  test("the fixtures consult no environment, spawn, network client, or module mock", () => {
    for (const source of fixtureSources()) {
      expect(source.text, source.file).not.toContain("process.env");
      expect(source.text, source.file).not.toContain("Bun.env");
      expect(source.text, source.file).not.toContain("fetch(");
      expect(source.text, source.file).not.toContain("mock.module");
      expect(source.text, source.file).not.toMatch(/https?:\/\//u);
    }
  });
});

describe("TC-XHERM-002 fixture isolation and determinism", () => {
  test("the case base is outside every work tree and never this checkout", () => {
    const members = createTwoMemberWorld("hermetic-isolation");
    try {
      const io = nodeRepositoryIo();
      expect(findGitRoot(members.base, io)).toBeUndefined();
      expect(findGitRoot(members.hostRoot, io)).toBeUndefined();
      expect(members.base.startsWith(dirname(ROOT))).toBe(false);
      for (const member of members.members) {
        expect(realpathSync(member.root).startsWith(realpathSync(ROOT))).toBe(false);
      }
    } finally {
      members.dispose();
    }
  });

  test("the isolated home is never the operator's home or real state directory", () => {
    const brand = brandOf();
    const before = realStateFingerprint(brand);
    const members = createTwoMemberWorld("hermetic-home");
    try {
      expect(members.home).not.toBe(homedir());
      expect(members.home.startsWith(join(homedir(), brand.stateDirectoryName))).toBe(false);
      expect(members.hostRoot.startsWith(join(homedir(), brand.stateDirectoryName))).toBe(false);
      expect(realStateFingerprint(brand)).toBe(before);
    } finally {
      members.dispose();
    }
    expect(realStateFingerprint(brand)).toBe(before);
  });

  test("the composed queue CLI receives an explicit fixture project root", async () => {
    const worldMembers = createMemberQueueHarness("hermetic-composition");
    const add = await worldMembers.harness.run(["queue", "add", CHANGE_REF, "--json"]);
    expect(add.exitCode).toBe(0);
    expect(worldMembers.harness.composition.repositoryBinding?.repositoryRoot).toBe(
      "/work/repo-alpha",
    );
    expect(worldMembers.harness.composition.repositoryBinding?.repositoryRoot).not.toBe(ROOT);
    const data = (
      JSON.parse(add.stdout) as {
        readonly data: { readonly members: readonly { readonly repoKey: string }[] };
      }
    ).data;
    expect(data.members.map((member) => member.repoKey)).toEqual([
      API_MEMBER.repoKey,
      WEB_MEMBER.repoKey,
    ]);
  });

  test("one representative case is byte-identical across three runs", async () => {
    const first = await runMemberGates(world());
    const second = await runMemberGates(world());
    const third = await runMemberGates(world());
    expect(second.stdout).toBe(first.stdout);
    expect(third.stdout).toBe(first.stdout);
    expect(second.exitCode).toBe(first.exitCode);
    expect(third.exitCode).toBe(first.exitCode);
  });
});
