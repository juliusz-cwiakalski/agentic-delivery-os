/**
 * The fixture-backed pilot repository (spec F-10, Appendix D).
 *
 * A real temporary git repository with a committed baseline, a delivery
 * branch, a seeded change folder (spec, plan, pm-notes), and a real local bare
 * mirror. Every git invocation uses a fixed identity and fixed author/committer
 * dates through a sanitized environment, so commit bytes and SHAs are
 * deterministic across replays.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

export const PILOT_REF = "GH-310";
export const PILOT_BASE = "main-tools";
export const PILOT_BRANCH = "feat/GH-310/pilot";
export const PILOT_OWNER = "owner";
export const PILOT_REPO = "repo-alpha";
export const PILOT_REPOSITORY = `${PILOT_OWNER}/${PILOT_REPO}`;
export const PILOT_ORIGIN = `https://github.com/${PILOT_REPOSITORY}.git`;
export const PILOT_CHANGE_FOLDER = "doc/changes/2026-11/2026-11-07--GH-310--pilot-delivery";
export const PILOT_FIXED_DATE = "2026-11-07T00:00:00Z";

export const PILOT_BASELINE_FILES: Readonly<Record<string, string>> = {
  "README.md": "# pilot repository\n",
  "package.json": '{\n  "name": "pilot-fixture",\n  "private": true\n}\n',
  ".gitignore": ".ai/local/\ntmp/\n",
  "src/feature.ts": "export const feature = 1;\n",
};

/** The sanitized, fixed-date git environment shared by every pilot spawn. */
export const pilotGitEnvironment = (homeDirectory: string): Readonly<Record<string, string>> => {
  const path = process.env.PATH ?? "/usr/bin:/bin";
  return {
    PATH: path,
    HOME: homeDirectory,
    TZ: "UTC",
    LC_ALL: "C",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_AUTHOR_NAME: "Pilot Author",
    GIT_AUTHOR_EMAIL: "pilot@example.invalid",
    GIT_COMMITTER_NAME: "Pilot Committer",
    GIT_COMMITTER_EMAIL: "pilot@example.invalid",
    GIT_AUTHOR_DATE: PILOT_FIXED_DATE,
    GIT_COMMITTER_DATE: PILOT_FIXED_DATE,
    GIT_TERMINAL_PROMPT: "0",
  };
};

export type PilotCommandResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number;
};

export type PilotRepo = {
  readonly root: string;
  readonly remoteRoot: string;
  readonly environment: Readonly<Record<string, string>>;
  readonly run: (args: readonly string[]) => PilotCommandResult;
  readonly write: (relative: string, content: string) => void;
  readonly remove: (relative: string) => void;
  readonly read: (relative: string) => string;
  readonly exists: (relative: string) => boolean;
  readonly isFile: (relative: string) => boolean;
  readonly statusPorcelain: () => string;
  readonly head: () => string;
  readonly branchHead: (branch: string) => string | undefined;
  readonly currentBranch: () => string;
  readonly commitCount: () => number;
  readonly logSubjects: () => readonly string[];
  readonly listBranches: () => readonly string[];
  readonly changeFolderFiles: () => readonly string[];
  readonly cleanup: () => void;
};

const runGit = (
  cwd: string,
  environment: Readonly<Record<string, string>>,
  args: readonly string[],
): PilotCommandResult => {
  try {
    const stdout = execFileSync("git", [...args], {
      cwd,
      env: { ...environment },
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
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

const mustRun = (
  cwd: string,
  environment: Readonly<Record<string, string>>,
  args: readonly string[],
): string => {
  const result = runGit(cwd, environment, args);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
};

export type PilotRepoOptions = {
  /** Repository-parent root; defaults to the repo-local `tmp/tmpdir` tree. */
  readonly baseDirectory?: string;
  readonly changeFolderFiles?: Readonly<Record<string, string>>;
};

/** Create the seed repository, its bare mirror, and the delivery branch. */
export const createPilotRepo = (options: PilotRepoOptions = {}): PilotRepo => {
  const baseDirectory = options.baseDirectory ?? join(process.cwd(), "tmp", "tmpdir");
  mkdirSync(baseDirectory, { recursive: true });
  const root = mkdtempSync(join(baseDirectory, "pilot-repo-"));
  const remoteDirectory = mkdtempSync(join(baseDirectory, "pilot-remote-"));
  const remoteRoot = join(remoteDirectory, "remote.git");
  const environment = pilotGitEnvironment(baseDirectory);

  const run = (args: readonly string[]): PilotCommandResult => runGit(root, environment, args);

  const write = (relative: string, content: string): void => {
    const path = join(root, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  };

  mustRun(root, environment, ["init", "-q", "--initial-branch", PILOT_BASE]);
  mustRun(root, environment, ["config", "user.name", "Pilot Author"]);
  mustRun(root, environment, ["config", "user.email", "pilot@example.invalid"]);
  mustRun(root, environment, ["config", "commit.gpgsign", "false"]);
  mustRun(root, environment, ["config", "core.hooksPath", "/dev/null"]);

  for (const [relative, content] of Object.entries(PILOT_BASELINE_FILES)) write(relative, content);
  mustRun(root, environment, ["add", "-A"]);
  mustRun(root, environment, [
    "commit",
    "--no-verify",
    "--no-gpg-sign",
    "-m",
    "chore: pilot baseline",
  ]);
  mustRun(root, environment, ["branch", PILOT_BRANCH]);
  mustRun(root, environment, ["remote", "add", "origin", PILOT_ORIGIN]);

  mustRun(root, environment, ["init", "--bare", "-q", remoteRoot]);
  mustRun(root, environment, ["remote", "add", "mirror", remoteRoot]);
  mustRun(root, environment, ["push", "-q", "mirror", PILOT_BASE]);

  mustRun(root, environment, ["checkout", "-q", PILOT_BRANCH]);
  for (const [relative, content] of Object.entries(options.changeFolderFiles ?? {})) {
    write(relative, content);
  }

  return {
    root,
    remoteRoot,
    environment,
    run,
    write,
    remove: (relative) => {
      const path = join(root, relative);
      if (existsSync(path)) rmSync(path, { force: true });
    },
    read: (relative) => readFileSync(join(root, relative), "utf8"),
    exists: (relative) => existsSync(join(root, relative)),
    isFile: (relative) => {
      try {
        return statSync(join(root, relative)).isFile();
      } catch {
        return false;
      }
    },
    statusPorcelain: () => run(["status", "--porcelain=v1"]).stdout.trim(),
    head: () => mustRun(root, environment, ["rev-parse", "HEAD"]),
    branchHead: (branch) => {
      const result = run(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]);
      return result.status === 0 ? result.stdout.trim() : undefined;
    },
    currentBranch: () => mustRun(root, environment, ["rev-parse", "--abbrev-ref", "HEAD"]),
    commitCount: () =>
      Number.parseInt(mustRun(root, environment, ["rev-list", "--count", "HEAD"]), 10),
    logSubjects: () =>
      mustRun(root, environment, ["log", "--format=%s"])
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    listBranches: () =>
      mustRun(root, environment, ["for-each-ref", "--format=%(refname:short)", "refs/heads"])
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .sort(),
    changeFolderFiles: () =>
      mustRun(root, environment, ["ls-files", PILOT_CHANGE_FOLDER])
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .sort(),
    cleanup: () => {
      rmSync(root, { recursive: true, force: true });
      rmSync(remoteDirectory, { recursive: true, force: true });
    },
  };
};
