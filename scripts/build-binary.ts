#!/usr/bin/env bun
/**
 * The additive artifact build entry (F-1, DM-7; `build:binary`).
 *
 * Captures the five build-identity fields from the root manifest and the local
 * repository, invokes the pinned compiler ONCE, and fails loudly when the
 * output is missing, empty, or not executable. It writes
 * `dist/<binary-name>` by default and `--out <dir>` redirects the artifact tier
 * to its scratch cache, so there is one build path and two declared output
 * destinations.
 *
 * The file names the declared primary identity exactly once — the one declared
 * build-side identity-literal site, registered with its own scan root — and
 * derives the artifact name from it. It is repo-internal: it is not a delivered
 * installer script, it appears in neither delivery array, and it never joins the
 * package build chain. It mutates no tracked file and needs no clean tree.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";

/** The declared primary identity: the one build-side working-name literal site. */
const PRIMARY_WORKING_NAME = "jaiship";

/** The repository root, resolved from this script's own location. */
const REPOSITORY_ROOT = resolve(import.meta.dir, "..");

/** The default artifact directory (already ignored by version control). */
const DEFAULT_OUT_DIRECTORY = resolve(REPOSITORY_ROOT, "dist");

/** The primary bin the artifact is compiled from. */
const PRIMARY_ENTRY = resolve(REPOSITORY_ROOT, "packages/cli/bin/jaiship.ts");

/** The compiler's define identifier; the identity module's presence guard reads it. */
const DEFINE_IDENTIFIER = "INJECTED_BUILD_IDENTITY";

/** The token a build with no git metadata reports (Appendix A). */
const NO_GIT_COMMIT = "unknown";

/** The declared channel value for this increment (DM-1). */
const DECLARED_CHANNEL = "dev";

/** The five captured identity fields (DM-1). */
export type CapturedBuildIdentity = {
  readonly version: string;
  readonly commit: string;
  readonly builtAt: string;
  readonly dirty: boolean;
  readonly channel: string;
};

/** One captured artifact build. */
export type ArtifactBuild = {
  readonly path: string;
  readonly size: number;
  readonly target: string;
  readonly identity: CapturedBuildIdentity;
};

export type BuildBinaryOptions = {
  readonly root?: string;
  readonly outDirectory?: string;
  readonly entryPath?: string;
  /** The injected build instant; production uses the wall clock once. */
  readonly now?: () => Date;
  /** The git reader; production spawns `git` once per read. */
  readonly git?: (arguments_: readonly string[]) => string | undefined;
};

const readManifestVersion = (root: string): string => {
  const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
    readonly version?: unknown;
  };
  const version = manifest.version;
  return typeof version === "string" && version.length > 0 ? version : "0.0.0";
};

const spawnGit = (root: string) => (arguments_: readonly string[]): string | undefined => {
  try {
    return execFileSync("git", [...arguments_], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
};

/**
 * Capture the identity this build injects.
 *
 * The dirty flag is computed over TRACKED files only (`--untracked-files=no`),
 * so an untracked scratch file cannot change the reported identity. A build
 * with no git metadata reports `unknown` and is never dirty.
 */
export const captureBuildIdentity = (options: BuildBinaryOptions = {}): CapturedBuildIdentity => {
  const root = options.root ?? REPOSITORY_ROOT;
  const git = options.git ?? spawnGit(root);
  const version = readManifestVersion(root);
  const commit = git(["rev-parse", "HEAD"]);
  const hasCommit = commit !== undefined && commit.length > 0;
  const dirtyStatus = hasCommit ? git(["status", "--porcelain", "--untracked-files=no"]) : undefined;
  return {
    version,
    commit: hasCommit ? commit : NO_GIT_COMMIT,
    builtAt: (options.now?.() ?? new Date()).toISOString(),
    dirty: hasCommit && dirtyStatus !== undefined && dirtyStatus.length > 0,
    channel: DECLARED_CHANNEL,
  };
};

/**
 * Compile one artifact from the primary bin and fail loudly on a wrong output.
 *
 * The compiler is the pinned runtime — no second compiler, bundler, or
 * packaging engine — and it is invoked exactly once.
 */
export const compileArtifact = (options: BuildBinaryOptions = {}): ArtifactBuild => {
  const root = options.root ?? REPOSITORY_ROOT;
  const outDirectory = options.outDirectory ?? DEFAULT_OUT_DIRECTORY;
  const entryPath = options.entryPath ?? PRIMARY_ENTRY;
  const identity = captureBuildIdentity(options);
  mkdirSync(outDirectory, { recursive: true });
  const outputPath = resolve(outDirectory, PRIMARY_WORKING_NAME);
  rmSync(outputPath, { force: true });
  execFileSync(
    "bun",
    [
      "build",
      "--compile",
      "--outfile",
      outputPath,
      "--define",
      `${DEFINE_IDENTIFIER}=${JSON.stringify(identity)}`,
      entryPath,
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (!existsSync(outputPath)) {
    throw new Error(`the compiler produced no artifact at ${outputPath}`);
  }
  const stats = statSync(outputPath);
  if (stats.size === 0) {
    throw new Error(`the compiled artifact at ${outputPath} is empty`);
  }
  if ((stats.mode & 0o111) === 0) {
    throw new Error(`the compiled artifact at ${outputPath} is not executable`);
  }
  return {
    path: outputPath,
    size: stats.size,
    target: `${process.platform}-${process.arch}`,
    identity,
  };
};

/** The operator-facing build report; it never claims byte-identical rebuilds. */
export const renderBuildReport = (build: ArtifactBuild): string =>
  [
    `artifact=${build.path}`,
    `version=${build.identity.version}`,
    `commit=${build.identity.commit}`,
    `builtAt=${build.identity.builtAt}`,
    `dirty=${String(build.identity.dirty)}`,
    `channel=${build.identity.channel}`,
    `size=${String(build.size)}`,
    `target=${build.target}`,
    "",
  ].join("\n");

const USAGE = [
  "Usage: bun run build:binary [--out <directory>]",
  "",
  "Compiles the primary bin into one self-contained executable.",
  `Default output: dist/${PRIMARY_WORKING_NAME}`,
  "",
].join("\n");

/** Parse the one declared flag; an unknown argument is a usage refusal. */
export const parseArguments = (
  argv: readonly string[],
): { readonly ok: true; readonly outDirectory?: string } | { readonly ok: false } => {
  let outDirectory: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--out") {
      const value = argv[index + 1];
      if (value === undefined || value.length === 0) return { ok: false };
      outDirectory = resolve(value);
      index += 1;
      continue;
    }
    return { ok: false };
  }
  return { ok: true, ...(outDirectory === undefined ? {} : { outDirectory }) };
};

const isMain = (): boolean => import.meta.main;

if (isMain()) {
  const argv = process.argv.slice(2);
  if (argv.includes("--help")) {
    process.stdout.write(USAGE);
  } else {
    const parsed = parseArguments(argv);
    if (!parsed.ok) {
      process.stderr.write(`build-binary: unrecognised arguments\n\n${USAGE}`);
      process.exitCode = 1;
    } else {
      try {
        const build = compileArtifact(
          parsed.outDirectory === undefined ? {} : { outDirectory: parsed.outDirectory },
        );
        process.stdout.write(renderBuildReport(build));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`build-binary: ${message}\n`);
        process.exitCode = 1;
      }
    }
  }
}
