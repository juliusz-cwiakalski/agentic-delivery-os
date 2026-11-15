/**
 * GH-320 prior-identity fixture harness (shape-only, scratch materialised).
 *
 * A committed fixture cannot carry a nested `.git`, so every case materialises a
 * scratch checkout from a shape map (`git init`, one commit) and a scratch HOME
 * per case. The composition is the production composition; only the notice sink
 * and the configuration filesystem facts are injected so a case can observe
 * emissions and per-layer reads without touching a real home.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { FileSystemFacts } from "../../../../packages/adapters/src/file/index";
import { nodeFileSystemFacts } from "../../../../packages/adapters/src/file/index";
import { runEntrypoint } from "../../../../packages/cli/src/entrypoint";
import { createProductionComposer } from "../../../../packages/cli/src/production";
import { bufferSink } from "../../../../tests/golden/helpers";

export const SCRATCH_BASE = join(process.cwd(), "tmp/tmpdir/gh320-prior-identity");

export type Scratch = { readonly root: string; readonly dispose: () => void };

const ensureBase = (): void => {
  mkdirSync(SCRATCH_BASE, { recursive: true, mode: 0o700 });
};

const makeScratch = (label: string): Scratch => {
  ensureBase();
  const root = mkdtempSync(join(SCRATCH_BASE, `${label}-`));
  return { root, dispose: () => rmSync(root, { recursive: true, force: true }) };
};

const writeTree = (root: string, files: Readonly<Record<string, string>>): void => {
  for (const [relative, content] of Object.entries(files)) {
    const path = join(root, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
};

/** Materialise a scratch checkout from a shape map and commit it once. */
export const scratchCheckout = (
  label: string,
  files: Readonly<Record<string, string>>,
): Scratch => {
  const scratch = makeScratch(label);
  writeTree(scratch.root, files);
  if (Object.keys(files).length === 0) writeTree(scratch.root, { "README.md": "fixture\n" });
  const git = (args: readonly string[]): void => {
    const result = spawnSync("git", args, { cwd: scratch.root, encoding: "utf8" });
    if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  };
  git(["init", "-q", "."]);
  git(["remote", "add", "origin", "https://github.com/acme/scratch.git"]);
  git(["add", "-A"]);
  git([
    "-c",
    "user.email=fixture@example.test",
    "-c",
    "user.name=fixture",
    "commit",
    "-qm",
    "init",
  ]);
  return scratch;
};

/** Materialise a scratch home with the given relative files/directories. */
export const scratchHome = (
  label: string,
  files: Readonly<Record<string, string>> = {},
): Scratch => {
  const scratch = makeScratch(label);
  writeTree(scratch.root, files);
  return scratch;
};

/** A counting filesystem-fact wrapper over the node facts. */
export type CountingFs = FileSystemFacts & {
  readonly existsCalls: string[];
  readonly readCalls: string[];
};

export const countingFs = (): CountingFs => {
  const base = nodeFileSystemFacts();
  const existsCalls: string[] = [];
  const readCalls: string[] = [];
  return {
    existsCalls,
    readCalls,
    exists: (path) => {
      existsCalls.push(path);
      return base.exists(path);
    },
    readText: (path) => {
      readCalls.push(path);
      return base.readText(path);
    },
  };
};

const SCRUBBED = [
  "DELIVERY_OS_WORKING_NAME",
  "JAISHIP_STATE_DIR",
  "DELIVERY_OS_STATE_DIR",
  "CI",
  "XDG_CONFIG_HOME",
  "XDG_CONFIG_DIRS",
  "DELIVERY_OS_CONFIG",
] as const;

export type InProcessRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly notices: readonly string[];
  readonly fs: CountingFs;
};

/**
 * Run one invocation through the delivered composition in process.
 *
 * `checkout` is the invoking working directory and `home` the composed home; the
 * environment carries only PATH by default, so no ambient identity leaks in.
 */
export const runThroughComposition = async (input: {
  readonly bin: "jaiship" | "delivery-os";
  readonly argv: readonly string[];
  readonly checkout: string;
  readonly home: string;
  readonly fs?: CountingFs;
  readonly extra?: Readonly<Record<string, string | undefined>>;
}): Promise<InProcessRun> => {
  const fs = input.fs ?? countingFs();
  const environment: Record<string, string | undefined> = {
    PATH: process.env.PATH,
    HOME: input.home,
    ...input.extra,
  };
  for (const key of SCRUBBED) {
    if (input.extra?.[key] !== undefined) continue;
    delete environment[key];
  }
  const stdout = bufferSink();
  const stderr = bufferSink();
  const notices: string[] = [];
  const exitCode = await runEntrypoint(input.argv, {
    streams: { stdout, stderr },
    environment,
    declaredWorkingName: input.bin,
    ...(input.bin === "jaiship" ? { priorWorkingName: "delivery-os" } : {}),
    credentialReferences: [],
    composeProgram: createProductionComposer({
      environment,
      cwd: input.checkout,
      homeDirectory: input.home,
      workingName: input.bin,
      configurationFs: fs,
      noticeSink: { write: (chunk) => notices.push(chunk) },
    }),
  });
  return { exitCode, stdout: stdout.value, stderr: stderr.value, notices, fs };
};

/** The relative shapes a case materialises. */
const LANE = "lane:\n  liveness-interval: 500\n  restart-budget: ";
export const laneYaml = (budget: number, interval = 500): string =>
  `lane:\n  liveness-interval: ${String(interval)}\n  restart-budget: ${String(budget)}\n`;

export const SHAPES = {
  configOnly: {
    ".delivery-os/config.yaml": laneYaml(4),
  },
  bothLayers: {
    ".delivery-os/config.yaml": laneYaml(4),
    ".delivery-os/config.local.yaml": laneYaml(5),
  },
  mixedLayers: {
    ".jaiship/config.yaml": laneYaml(9, 700),
    ".delivery-os/config.local.yaml": laneYaml(6),
  },
  localOnly: {
    ".delivery-os/config.local.yaml": laneYaml(7),
  },
  noConfig: { "README.md": "no configuration here\n" },
} as const;
void LANE;

/** Read one file from a scratch tree. */
export const readTree = (root: string, relative: string): string =>
  readFileSync(join(root, relative), "utf8");
