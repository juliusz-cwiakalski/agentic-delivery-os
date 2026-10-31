/**
 * TC-STATUS-020 — repository binding from `origin` and bounded HEAD facts,
 * with credential stripping, unavailable forms, linked worktrees, and truthful
 * downstream propagation.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  nodeRepositoryIo,
  parseGitHubRemote,
  readRepositoryFacts,
} from "../../packages/adapters/src/repo/index";
import { aggregateStatus } from "../../packages/core/src/domain/index";
import { baseFacts, repository, sectionById, unavailableBinding } from "../fixtures/status/harness";

const ROOT = process.cwd();
const SHA = "abcdef0123456789abcdef0123456789abcdef01";

const write = (path: string, text: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

const makeRepo = (
  options: {
    readonly config?: string;
    readonly head?: string;
    readonly refs?: Readonly<Record<string, string>>;
    readonly packed?: string;
  } = {},
): string => {
  const root = mkdtempSync(join(tmpdir(), "status-repo-"));
  write(
    join(root, ".git/config"),
    options.config ??
      '[remote "origin"]\n\turl = git@github.com:owner-placeholder/project-placeholder.git\n',
  );
  write(join(root, ".git/HEAD"), options.head ?? "ref: refs/heads/feat/GH-175/status-v1\n");
  for (const [ref, sha] of Object.entries(
    options.refs ?? { "refs/heads/feat/GH-175/status-v1": SHA },
  )) {
    write(join(root, ".git", ref), `${sha}\n`);
  }
  if (options.packed !== undefined) write(join(root, ".git/packed-refs"), options.packed);
  return root;
};

const makeWorktree = (): { readonly root: string; readonly main: string } => {
  const main = makeRepo({
    config:
      '[remote "origin"]\n\turl = https://github.com/owner-placeholder/project-placeholder.git\n',
    head: "ref: refs/heads/main-tools\n",
    refs: {
      "refs/heads/main-tools": SHA,
      "refs/heads/feat/GH-175/worktree": "1111111111111111111111111111111111111111",
    },
  });
  const root = mkdtempSync(join(tmpdir(), "status-worktree-"));
  const gitDir = join(main, ".git/worktrees/linked");
  write(join(root, ".git"), `gitdir: ${gitDir}\n`);
  write(join(gitDir, "commondir"), "../..\n");
  write(join(gitDir, "HEAD"), "ref: refs/heads/feat/GH-175/worktree\n");
  return { root, main };
};

describe("TC-STATUS-020 repository binding", () => {
  test("HTTPS and SSH forms resolve to the GitHub owner/name binding", () => {
    const binding = { ok: true, host: "github.com", owner: "owner", name: "name" };
    expect(parseGitHubRemote("https://github.com/owner/name.git")).toMatchObject(binding);
    expect(parseGitHubRemote("https://github.com/owner/name")).toMatchObject(binding);
    expect(parseGitHubRemote("git@github.com:owner/name.git")).toMatchObject(binding);
    expect(parseGitHubRemote("ssh://git@github.com/owner/name.git")).toMatchObject(binding);
  });

  test("userinfo is stripped and never appears in the result", () => {
    const credentialUrl = `${"https"}://${"user:token"}@github.com/owner/name.git`;
    const parsed = parseGitHubRemote(credentialUrl);
    expect(parsed.ok).toBe(true);
    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toContain("user");
    expect(serialized).not.toContain("token");
    expect(serialized).not.toContain(credentialUrl);
  });

  test("absent, unparseable, and non-GitHub remotes are unavailable", () => {
    expect(parseGitHubRemote(undefined)).toEqual({
      ok: false,
      reason: "addressing-unresolved",
    });
    expect(parseGitHubRemote("not a url")).toEqual({
      ok: false,
      reason: "addressing-unresolved",
    });
    expect(parseGitHubRemote("https://gitlab.com/owner/name.git")).toEqual({
      ok: false,
      reason: "remote-unsupported",
    });
  });

  test("readRepositoryFacts reads origin and HEAD without a child process", () => {
    const root = makeRepo();
    try {
      const facts = readRepositoryFacts({ cwd: root, io: nodeRepositoryIo() });
      expect(facts.root).toBe(root);
      expect(facts.originUrl).toBe("git@github.com:owner-placeholder/project-placeholder.git");
      expect(facts.head).toEqual({
        branch: "feat/GH-175/status-v1",
        sha: SHA,
        detached: false,
      });
      const source = readFileSync(join(ROOT, "packages/adapters/src/repo/index.ts"), "utf8");
      expect(source).not.toContain("node:child_process");
      expect(source).not.toContain("child_process");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("HEAD may be detached and packed refs still resolve", () => {
    const detached = makeRepo({ head: `${SHA}\n` });
    try {
      const facts = readRepositoryFacts({ cwd: detached, io: nodeRepositoryIo() });
      expect(facts.head).toEqual({ sha: SHA, detached: true });
    } finally {
      rmSync(detached, { recursive: true, force: true });
    }
    const packed = makeRepo({
      head: "ref: refs/heads/packed\n",
      refs: {},
      packed: `${SHA} refs/heads/packed\n`,
    });
    try {
      const facts = readRepositoryFacts({ cwd: packed, io: nodeRepositoryIo() });
      expect(facts.head).toEqual({ branch: "packed", sha: SHA, detached: false });
    } finally {
      rmSync(packed, { recursive: true, force: true });
    }
  });

  test("a linked worktree resolves gitdir plus commondir", () => {
    const worktree = makeWorktree();
    try {
      const facts = readRepositoryFacts({ cwd: worktree.root, io: nodeRepositoryIo() });
      expect(facts.root).toBe(worktree.root);
      expect(facts.originUrl).toBe("https://github.com/owner-placeholder/project-placeholder.git");
      expect(facts.head).toEqual({
        branch: "feat/GH-175/worktree",
        sha: "1111111111111111111111111111111111111111",
        detached: false,
      });
    } finally {
      rmSync(worktree.root, { recursive: true, force: true });
      rmSync(worktree.main, { recursive: true, force: true });
    }
  });

  test("a non-git directory yields no binding", () => {
    const io = {
      exists: () => false,
      isFile: () => false,
      readText: () => "",
    };
    const facts = readRepositoryFacts({ cwd: "/nonexistent/worktree", io });
    expect(facts.root).toBeUndefined();
    expect(facts.head).toEqual({ detached: true });
  });

  test("an unavailable binding propagates truthfully downstream", () => {
    const digest = aggregateStatus(
      baseFacts({ repository: repository({ binding: unavailableBinding() }) }),
    );
    expect(sectionById(digest.sections, "tracker").state).toBe("unavailable");
    expect(sectionById(digest.sections, "ci").state).toBe("unavailable");
    expect(sectionById(digest.sections, "changes-and-prs").state).toBe("degraded");
  });
});
