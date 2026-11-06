/**
 * Dev-only temporary git repository builder (GH-227 test-plan §4.1, GAP-7).
 *
 * Behaviour suites need real tree state. Each repository is created under a
 * caller-supplied root (the repo-local temp dir in CI), initialised with a
 * sanitized git environment, fixed identity, disabled hooks and signing, and a
 * deterministic seed commit. The builder never touches the live workspace.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** One command result; a non-zero exit is returned as data. */
export type RepoCommandResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number;
};

/** The temporary repository handle. */
export type TempGitRepository = {
  readonly root: string;
  readonly environment: Readonly<Record<string, string>>;
  run(args: readonly string[]): RepoCommandResult;
  write(relative: string, content: string): void;
  remove(relative: string): void;
  read(relative: string): string;
  exists(relative: string): boolean;
  statusPorcelain(): string;
  head(): string;
  commitCount(): number;
  logSubjects(): readonly string[];
  stagedPaths(): readonly string[];
  cleanup(): void;
};

/** Construction input for the temp repository. */
export type TempGitRepositoryOptions = {
  readonly root?: string;
  readonly label?: string;
  readonly seedFiles?: Readonly<Record<string, string>>;
  readonly seedCommitMessage?: string;
  /** Injected host facts (PATH/HOME) from the calling test edge. */
  readonly environment?: Readonly<Record<string, string | undefined>>;
};

const BASE_ENVIRONMENT = (
  given: Readonly<Record<string, string | undefined>> = {},
): Record<string, string> => ({
  PATH: given.PATH ?? "/usr/bin:/bin",
  HOME: given.HOME ?? "/tmp",
  TZ: "UTC",
  LC_ALL: "C",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_AUTHOR_NAME: "Fixture Author",
  GIT_AUTHOR_EMAIL: "fixture@example.invalid",
  GIT_COMMITTER_NAME: "Fixture Committer",
  GIT_COMMITTER_EMAIL: "fixture@example.invalid",
  GIT_TERMINAL_PROMPT: "0",
});

const runGit = (
  cwd: string,
  environment: Readonly<Record<string, string>>,
  args: readonly string[],
): RepoCommandResult => {
  try {
    const stdout = execFileSync("git", [...args], {
      cwd,
      env: { ...environment },
      encoding: "utf8",
    });
    return { stdout, stderr: "", status: 0 };
  } catch (error) {
    const candidate = error as {
      readonly stdout?: string;
      readonly stderr?: string;
      readonly status?: number;
    };
    return {
      stdout: candidate.stdout ?? "",
      stderr: candidate.stderr ?? "",
      status: candidate.status ?? 1,
    };
  }
};

/** Create a sanitized temporary git repository. */
export const createTempGitRepository = (
  options: TempGitRepositoryOptions = {},
): TempGitRepository => {
  const root = mkdtempSync(join(options.root ?? tmpdir(), `commit-${options.label ?? "repo"}-`));
  const environment = BASE_ENVIRONMENT(options.environment);
  const git = (args: readonly string[]): RepoCommandResult => runGit(root, environment, args);
  git(["init", "--initial-branch=main"]);
  git(["config", "user.name", "Fixture Author"]);
  git(["config", "user.email", "fixture@example.invalid"]);
  git(["config", "commit.gpgsign", "false"]);
  git(["config", "core.hooksPath", "/dev/null"]);
  git(["config", "init.defaultBranch", "main"]);

  const write = (relative: string, content: string): void => {
    const path = join(root, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  };
  const remove = (relative: string): void => {
    const path = join(root, relative);
    if (existsSync(path)) unlinkSync(path);
  };
  const read = (relative: string): string => readFileSync(join(root, relative), "utf8");
  const exists = (relative: string): boolean => existsSync(join(root, relative));

  for (const [relative, content] of Object.entries(options.seedFiles ?? {}))
    write(relative, content);
  if (options.seedFiles !== undefined && Object.keys(options.seedFiles).length > 0) {
    git(["add", "-A"]);
    git([
      "commit",
      "--no-verify",
      "--no-gpg-sign",
      "-m",
      options.seedCommitMessage ?? "chore: seed",
    ]);
  } else if (options.seedFiles === undefined) {
    write("README.md", "# fixture\n");
    git(["add", "-A"]);
    git([
      "commit",
      "--no-verify",
      "--no-gpg-sign",
      "-m",
      options.seedCommitMessage ?? "chore: seed",
    ]);
  }

  return {
    root,
    environment,
    run: (args) => git(args),
    write,
    remove,
    read,
    exists,
    statusPorcelain: () => git(["status", "--porcelain"]).stdout,
    head: () => git(["rev-parse", "HEAD"]).stdout.trim(),
    commitCount: () => Number.parseInt(git(["rev-list", "--count", "HEAD"]).stdout.trim(), 10),
    logSubjects: () =>
      git(["log", "--format=%s"])
        .stdout.split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    stagedPaths: () =>
      git(["diff", "--cached", "--name-only"])
        .stdout.split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .sort(),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
};
