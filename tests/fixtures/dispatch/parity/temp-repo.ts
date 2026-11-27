/**
 * A temporary local git landscape for the real-git push arm (GH-416 TC-LGIT-001).
 *
 * Unlike the delivered closeout and pilot helpers, this fixture is built for the
 * lane-push seam: it declares the change branch, a bare remote per position the
 * push-remote precedence can occupy, and a second clone for the moved-remote
 * arm. Every remote is a local filesystem path, so the suite can never reach a
 * network, and every git call is made with a fixed identity, a fixed date, and
 * an isolated configuration, so the landscape is deterministic.
 *
 * The fixture also owns the one ambient detail the seam cannot inject: the child
 * process it spawns inherits the test process environment, so
 * `isolateGitConfiguration` neutralizes the user and system configuration for
 * the duration of a suite. Without it a host-level `protocol.file.allow` or
 * `remote.pushDefault` would change what the act does.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The deterministic identity and instants every fixture commit carries. */
const FIXTURE_DATE = "2026-11-27T00:00:00.000Z";

export type GitEnvironmentIsolation = {
  readonly restore: () => void;
};

/**
 * A checkout-shaped directory whose configuration is written directly: the
 * injected-runner arms need a declared push remote without a real repository, so
 * the seam's one configuration read answers from a file instead of the host
 * checkout's own remotes.
 */
export type ConfiguredCheckout = {
  readonly directory: string;
  readonly configPath: string;
  readonly dispose: () => void;
};

/**
 * Build the configuration-only checkout: one `[remote "<name>"]` section per
 * declared remote (pointing at a local fixture path) plus any raw section text a
 * caller needs.
 */
export const createConfiguredCheckout = (input: {
  readonly label: string;
  readonly remotes?: readonly string[];
  readonly extraConfig?: readonly string[];
}): ConfiguredCheckout => {
  const directory = mkdtempSync(join(tmpdir(), `gh416-${input.label}-`));
  const gitDirectory = join(directory, ".git");
  mkdirSync(gitDirectory, { recursive: true });
  writeFileSync(join(gitDirectory, "HEAD"), "ref: refs/heads/main\n");
  const sections = (input.remotes ?? ["origin"]).map(
    (name) => `[remote "${name}"]\n\turl = ${join(directory, "remotes", `${name}.git`)}\n`,
  );
  const configPath = join(gitDirectory, "config");
  writeFileSync(configPath, [...sections, ...(input.extraConfig ?? [])].join(""));
  return {
    directory,
    configPath,
    dispose: () => rmSync(directory, { recursive: true, force: true }),
  };
};

export type GitFixture = {
  readonly root: string;
  readonly checkout: string;
  readonly branch: string;
  /** The checkout's full-hex head. */
  readonly head: () => string;
  /** Run git in the checkout and return the trimmed stdout. */
  readonly run: (args: readonly string[]) => string;
  /** Run git in any directory under the fixture (a clone) with the fixture identity. */
  readonly runIn: (directory: string, args: readonly string[]) => string;
  /** Create a bare remote under the fixture root and return its absolute path. */
  readonly createBareRemote: (name: string) => string;
  /** Declare a remote in the checkout's configuration, pointing at a local path. */
  readonly addRemote: (name: string, path: string) => void;
  /** Set one configuration key in the checkout (the precedence positions). */
  readonly setConfig: (key: string, value: string) => void;
  /** Every ref the bare remote holds, sorted. */
  readonly remoteRefs: (name: string) => readonly string[];
  /** The bare remote's head for one ref, or `undefined` when it holds none. */
  readonly remoteHead: (name: string, ref: string) => string | undefined;
  /** Every configured remote URL, in `git remote -v` order. */
  readonly remoteUrls: () => readonly string[];
  /** A second clone of one bare remote (the moved-remote arm). */
  readonly cloneOf: (name: string, label: string) => string;
  /** Commit one new file in another checkout (the moved-remote arm), fixture identity. */
  readonly commitIn: (directory: string, name: string) => void;
  /** Create a linked worktree on a new branch off the checkout's head. */
  readonly addWorktree: (label: string, branch: string) => string;
  readonly dispose: () => void;
};

const gitArgumentsOf = (args: readonly string[]): readonly string[] => [...args];

/**
 * Neutralize the user and system git configuration for one suite, so neither a
 * host `remote.pushDefault` nor a host `protocol.file.allow` decides the arm's
 * outcome. The values are restored and the empty configuration removed when the
 * returned handle is disposed.
 */
export const isolateGitConfiguration = (): GitEnvironmentIsolation => {
  const directory = mkdtempSync(join(tmpdir(), "gh416-gitenv-"));
  const empty = join(directory, "empty-gitconfig");
  writeFileSync(empty, "");
  const previous = {
    global: process.env.GIT_CONFIG_GLOBAL,
    system: process.env.GIT_CONFIG_SYSTEM,
    noSystem: process.env.GIT_CONFIG_NOSYSTEM,
  };
  process.env.GIT_CONFIG_GLOBAL = empty;
  process.env.GIT_CONFIG_SYSTEM = empty;
  process.env.GIT_CONFIG_NOSYSTEM = "1";
  return {
    restore: () => {
      const restoreKey = (key: keyof typeof previous, value: string | undefined): void => {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      };
      restoreKey("GIT_CONFIG_GLOBAL", previous.global);
      restoreKey("GIT_CONFIG_SYSTEM", previous.system);
      restoreKey("GIT_CONFIG_NOSYSTEM", previous.noSystem);
      rmSync(directory, { recursive: true, force: true });
    },
  };
};

/** Create one bare remote and a checkout carrying the change branch. */
export const createGitFixture = (input: {
  readonly label: string;
  readonly branch: string;
  readonly commits?: number;
}): GitFixture => {
  const root = mkdtempSync(join(tmpdir(), `gh416-${input.label}-`));
  const checkout = join(root, "checkout");
  const environment = {
    ...process.env,
    GIT_AUTHOR_DATE: FIXTURE_DATE,
    GIT_COMMITTER_DATE: FIXTURE_DATE,
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.invalid",
    GIT_TERMINAL_PROMPT: "0",
  };
  const runIn = (cwd: string, args: readonly string[]): string =>
    execFileSync("git", gitArgumentsOf(args), {
      cwd,
      encoding: "utf8",
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const run = (args: readonly string[]): string => runIn(checkout, args);

  runIn(root, ["init", "--quiet", "--bare", "--initial-branch=main", "remote.git"]);
  runIn(root, ["init", "--quiet", "--initial-branch=main", "checkout"]);
  const commitIn = (directory: string, name: string): void => {
    writeFileSync(join(directory, name), `${name}\n`);
    runIn(directory, ["add", name]);
    runIn(directory, ["commit", "--quiet", "-m", name]);
  };
  commitIn(checkout, "baseline.txt");
  run(["checkout", "--quiet", "-b", input.branch]);
  for (let index = 1; index <= (input.commits ?? 2); index += 1) {
    commitIn(checkout, `evidence-${index}.txt`);
  }

  const bareOf = (name: string): string => join(root, `${name}.git`);

  return {
    root,
    checkout,
    branch: input.branch,
    head: () => run(["rev-parse", "HEAD"]),
    run,
    runIn,
    createBareRemote: (name) => {
      const path = bareOf(name);
      runIn(root, ["init", "--quiet", "--bare", "--initial-branch=main", `${name}.git`]);
      return path;
    },
    addRemote: (name, path) => {
      run(["remote", "add", name, path]);
    },
    setConfig: (key, value) => {
      run(["config", key, value]);
    },
    remoteRefs: (name) => {
      const listing = runIn(bareOf(name), ["for-each-ref", "--format=%(refname)", "refs/heads"]);
      return listing.length === 0 ? [] : listing.split("\n");
    },
    remoteHead: (name, ref) => {
      try {
        return runIn(bareOf(name), ["rev-parse", "--verify", ref]);
      } catch {
        return undefined;
      }
    },
    remoteUrls: () =>
      run(["remote", "-v"])
        .split("\n")
        .map((line) => line.split(/\s+/u)[1] ?? "")
        .filter((url) => url.length > 0),
    cloneOf: (name, label) => {
      const directory = join(root, label);
      runIn(root, ["clone", "--quiet", bareOf(name), label]);
      runIn(directory, ["checkout", "--quiet", "-b", input.branch, `origin/${input.branch}`]);
      return directory;
    },
    commitIn,
    addWorktree: (label, branch) => {
      const directory = join(root, label);
      run(["worktree", "add", "--quiet", "-b", branch, directory]);
      return directory;
    },
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
};
