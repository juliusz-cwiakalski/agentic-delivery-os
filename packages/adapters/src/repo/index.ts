/**
 * `@delivery-os/adapters/repo` — repository I/O adapter subpath.
 * Resolves a bounded git root (including linked-worktree `.git` files) and
 * never searches above the first root. Configuration discovery consumes only
 * the returned fact; this module never reads configuration files.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

export type RepositoryIo = {
  readonly exists: (path: string) => boolean;
  readonly isFile: (path: string) => boolean;
  readonly readText: (path: string) => string;
};

export type RepositoryRootInput = {
  readonly cwd: string;
  readonly explicitRoot?: string;
  readonly io: RepositoryIo;
};

export type RepositoryRootFacts = {
  readonly gitRoot?: string;
  readonly explicitRoot?: string;
};

const gitDirectoryFile = (path: string, io: RepositoryIo): boolean =>
  io.isFile(path) && io.readText(path).trimStart().startsWith("gitdir:");

/**
 * Walk from cwd to the first `.git` entry. A directory is a normal root; a
 * `.git` file is a linked worktree root. Never continues above that root.
 */
export const findGitRoot = (cwd: string, io: RepositoryIo): string | undefined => {
  let current = cwd;
  for (;;) {
    const candidate = join(current, ".git");
    if (io.exists(candidate)) {
      if (io.isFile(candidate)) {
        return gitDirectoryFile(candidate, io) ? current : undefined;
      }
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
};

export const resolveRepositoryRoot = (input: RepositoryRootInput): RepositoryRootFacts => {
  const gitRoot = findGitRoot(input.cwd, input.io);
  return {
    ...(gitRoot !== undefined ? { gitRoot } : {}),
    ...(input.explicitRoot !== undefined ? { explicitRoot: input.explicitRoot } : {}),
  };
};

/** The checkout HEAD facts (branch, full SHA, detached marker). */
export type RepositoryHeadFacts = {
  readonly branch?: string;
  readonly sha?: string;
  readonly detached: boolean;
};

/** The parsed GitHub `origin` binding; userinfo and credentials are discarded. */
export type GitHubRemoteBinding = {
  readonly host: "github.com";
  readonly owner: string;
  readonly name: string;
};

/** The bounded repository facts: root, origin URL, and HEAD. */
export type RepositoryFacts = {
  readonly root?: string;
  readonly originUrl?: string;
  readonly head: RepositoryHeadFacts;
};

export type GitHubRemoteParseResult =
  | {
      readonly ok: true;
      readonly host: "github.com";
      readonly owner: string;
      readonly name: string;
    }
  | {
      readonly ok: false;
      readonly reason: "addressing-unresolved" | "remote-unsupported";
    };

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, "");

const ownerAndName = (
  path: string,
): { readonly owner: string; readonly name: string } | undefined => {
  const parts = trimSlashes(path)
    .split("/")
    .filter((part) => part.length > 0);
  if (parts.length !== 2) return undefined;
  const owner = parts[0];
  const rawName = parts[1];
  if (owner === undefined || rawName === undefined) return undefined;
  const name = rawName.replace(/\.git$/, "");
  if (owner.length === 0 || name.length === 0) return undefined;
  return { owner, name };
};

/**
 * Parse a GitHub HTTPS or SSH remote URL.
 *
 * Only `github.com` is accepted; userinfo is parsed by `URL` and never copied
 * into the result. An unparseable/absent URL is `addressing-unresolved` and a
 * non-GitHub host is `remote-unsupported`.
 */
export const parseGitHubRemote = (remoteUrl: string | undefined): GitHubRemoteParseResult => {
  const trimmed = (remoteUrl ?? "").trim();
  if (trimmed.length === 0) return { ok: false, reason: "addressing-unresolved" };
  if (trimmed.includes("://")) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return { ok: false, reason: "addressing-unresolved" };
    }
    const host = parsed.hostname.toLowerCase();
    const parts = ownerAndName(parsed.pathname);
    if (parts === undefined) return { ok: false, reason: "addressing-unresolved" };
    if (host !== "github.com") return { ok: false, reason: "remote-unsupported" };
    return { ok: true, host: "github.com", ...parts };
  }
  const scp = /^(?:[^@/]+@)?([^:/]+):(.+)$/.exec(trimmed);
  if (scp === null) return { ok: false, reason: "addressing-unresolved" };
  const host = (scp[1] ?? "").toLowerCase();
  const parts = ownerAndName(scp[2] ?? "");
  if (parts === undefined) return { ok: false, reason: "addressing-unresolved" };
  if (host !== "github.com") return { ok: false, reason: "remote-unsupported" };
  return { ok: true, host: "github.com", ...parts };
};

const readIfExists = (path: string, io: RepositoryIo): string | undefined => {
  try {
    return io.exists(path) ? io.readText(path) : undefined;
  } catch {
    return undefined;
  }
};

const originUrlFrom = (configText: string | undefined): string | undefined => {
  if (configText === undefined) return undefined;
  let inOrigin = false;
  for (const line of configText.split("\n")) {
    const section = /^\s*\[remote\s+"([^"]+)"\]\s*$/.exec(line);
    if (section !== null) {
      inOrigin = section[1] === "origin";
      continue;
    }
    if (/^\s*\[/.test(line)) {
      inOrigin = false;
      continue;
    }
    if (!inOrigin) continue;
    const url = /^\s*url\s*=\s*(.+?)\s*$/.exec(line);
    if (url !== null) return url[1];
  }
  return undefined;
};

const resolveGitDir = (
  root: string,
  io: RepositoryIo,
): { readonly gitDir: string; readonly commonDir: string } | undefined => {
  const dotGit = join(root, ".git");
  if (io.isFile(dotGit)) {
    const text = readIfExists(dotGit, io);
    if (text === undefined) return undefined;
    const match = /^gitdir:\s*(.+)$/m.exec(text.trim());
    if (match === null) return undefined;
    const raw = (match[1] ?? "").trim();
    if (raw.length === 0) return undefined;
    const gitDir = isAbsolute(raw) ? raw : join(root, raw);
    const commonText = readIfExists(join(gitDir, "commondir"), io);
    const commonDir =
      commonText === undefined
        ? gitDir
        : isAbsolute(commonText.trim())
          ? commonText.trim()
          : join(gitDir, commonText.trim());
    return { gitDir, commonDir };
  }
  return { gitDir: dotGit, commonDir: dotGit };
};

const shaFromPackedRefs = (packed: string | undefined, ref: string): string | undefined => {
  if (packed === undefined) return undefined;
  for (const line of packed.split("\n")) {
    const match = /^([0-9a-f]{40,64})\s+(.+)$/.exec(line.trim());
    if (match !== null && match[2] === ref) return match[1];
  }
  return undefined;
};

const headFactsFrom = (
  headText: string | undefined,
  commonDir: string,
  io: RepositoryIo,
): RepositoryHeadFacts => {
  const text = (headText ?? "").trim();
  if (text.length === 0) return { detached: true };
  const symbolic = /^ref:\s*(refs\/heads\/(.+))$/.exec(text);
  if (symbolic !== null) {
    const ref = symbolic[1] ?? "";
    const branch = symbolic[2] ?? "";
    const refSha = readIfExists(join(commonDir, ref), io)?.trim();
    const sha =
      refSha !== undefined && /^[0-9a-f]{40,64}$/.test(refSha)
        ? refSha
        : shaFromPackedRefs(readIfExists(join(commonDir, "packed-refs"), io), ref);
    return {
      ...(branch.length === 0 ? {} : { branch }),
      ...(sha === undefined ? {} : { sha }),
      detached: false,
    };
  }
  if (/^[0-9a-f]{40,64}$/.test(text)) return { sha: text, detached: true };
  return { detached: true };
};

/**
 * Read the bounded repository facts from `.git` metadata only.
 *
 * Handles a normal `.git` directory and a linked worktree `.git` file
 * (`gitdir:` plus `commondir`), reads only `config`/`HEAD`/the target ref/
 * `packed-refs`, and never spawns a process or touches the network.
 */
export const readRepositoryFacts = (input: {
  readonly cwd: string;
  readonly io: RepositoryIo;
}): RepositoryFacts => {
  const root = findGitRoot(input.cwd, input.io);
  if (root === undefined) return { head: { detached: true } };
  const dirs = resolveGitDir(root, input.io);
  if (dirs === undefined) return { root, head: { detached: true } };
  const configText =
    readIfExists(join(dirs.commonDir, "config"), input.io) ??
    readIfExists(join(dirs.gitDir, "config"), input.io);
  const originUrl = originUrlFrom(configText);
  const headText =
    readIfExists(join(dirs.gitDir, "HEAD"), input.io) ??
    readIfExists(join(dirs.commonDir, "HEAD"), input.io);
  const head = headFactsFrom(headText, dirs.commonDir, input.io);
  return {
    root,
    ...(originUrl === undefined ? {} : { originUrl }),
    head,
  };
};

/** Production filesystem facts for the runtime edge and integration tests. */
export const nodeRepositoryIo = (): RepositoryIo => ({
  exists: (path) => existsSync(path),
  isFile: (path) => {
    try {
      return statSync(path).isFile();
    } catch {
      return false;
    }
  },
  readText: (path) => readFileSync(path, "utf8"),
});
