/**
 * GH-273 production-composition harness — the real `createProductionComposer`
 * program over a real temporary checkout whose `.git` metadata is fabricated on
 * disk. Only the origin remote is injected (`ProductionCompositionFacts.
 * repositoryFacts.originUrl`); the harness deliberately exposes **no** way to
 * supply a repository root, so every assertion reads the pair the production
 * derivation actually wrote (spec DEC-2, DEC-5; test plan TR-1/TR-2).
 *
 * No `git` binary is spawned and no network call leaves the process: the
 * injected seams record their calls for the purity assertions.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type {
  GitChildRunner,
  GitChildRunnerResult,
} from "../../../../packages/adapters/src/git/index";
import { findGitRoot, nodeRepositoryIo } from "../../../../packages/adapters/src/repo/index";
import { type CliStreams, runCli } from "../../../../packages/cli/src/index";
import { createProductionComposer } from "../../../../packages/cli/src/production";
import { queueGraphDocumentPath, readQueueEntries } from "../../../../packages/core/src/app/queue";
import { resolveBrandIdentity } from "../../../../packages/core/src/branding/index";
import type {
  BrandIdentity,
  CredentialPort,
  HarnessSpawnRunner,
  HarnessSpawnRunnerResult,
  QueueEntryRecord,
  StateStorePort,
} from "../../../../packages/core/src/contracts/index";
import {
  createNodeStateEdge,
  createStateStore,
  STATE_SCHEMA_VERSION,
} from "../../../../packages/core/src/state/index";
import { streamStarterFromRunner } from "../../harness/stream";

const WORKING_NAME = "delivery-os";
const BASE = join(process.cwd(), "tmp", "tmpdir");

/** One `.git` metadata helper: a directory, or a linked-worktree `.git` file. */
export type Checkout = {
  readonly directory: string;
  readonly commonDir: string;
};

/** Create a normal checkout directory carrying only the declared origin. */
export const makeCheckout = (
  parent: string,
  name: string,
  originUrl: string | undefined,
): Checkout => {
  const directory = join(parent, name);
  const commonDir = join(directory, ".git");
  mkdirSync(commonDir, { recursive: true });
  writeFileSync(join(commonDir, "HEAD"), "ref: refs/heads/main\n");
  if (originUrl !== undefined) {
    writeFileSync(join(commonDir, "config"), `[remote "origin"]\n\turl = ${originUrl}\n`);
  }
  return { directory, commonDir };
};

/** Create a nested directory inside the checkout (no `.git` of its own). */
export const makeNestedDirectory = (checkout: string, ...segments: readonly string[]): string => {
  const directory = join(checkout, ...segments);
  mkdirSync(directory, { recursive: true });
  return directory;
};

/**
 * Create a linked worktree whose `.git` is a file pointing at the main
 * checkout's `.git/worktrees/<name>`, with `commondir` and `HEAD` exactly as
 * `tests/behaviour/status-repository.test.ts` builds it.
 */
export const makeLinkedWorktree = (
  parent: string,
  label: string,
  originUrl: string,
): { readonly main: Checkout; readonly root: string } => {
  const main = makeCheckout(parent, `${label}-main`, originUrl);
  const root = join(parent, `${label}-worktree`);
  mkdirSync(root, { recursive: true });
  const gitDir = join(main.commonDir, "worktrees", "linked");
  writeFileSync(join(root, ".git"), `gitdir: ${gitDir}\n`);
  mkdirSync(gitDir, { recursive: true });
  writeFileSync(join(gitDir, "commondir"), "../..\n");
  writeFileSync(join(gitDir, "HEAD"), "ref: refs/heads/main\n");
  return { main, root };
};

/**
 * Create a directory outside every git work tree, so `findGitRoot` cannot
 * ascend into this repository's own checkout. The OS temp root is the primary
 * choice; when the environment points `TMPDIR` inside the repository (the
 * aggregate gate's repo-local temp), the repository's parent directory is the
 * same-filesystem fallback and is still outside the work tree.
 */
export const makeNonCheckoutDirectory = (label: string): string => {
  const candidates = [tmpdir(), dirname(process.cwd())];
  for (const parent of candidates) {
    const directory = mkdtempSync(join(parent, `gh273-${label}-`));
    if (findGitRoot(directory, nodeRepositoryIo()) === undefined) return directory;
    rmSync(directory, { recursive: true, force: true });
  }
  throw new Error(`no directory outside every git work tree is available for the ${label} fixture`);
};

/** The origin URL written into a fabricated `.git/config`. */
export const originOfConfig = (configText: string): string | undefined => {
  const match = /\[remote "origin"\]\s*\n\s*url = (.+)/u.exec(configText);
  return match?.[1]?.trim();
};

/** One recorded external call, for the pure-path assertions. */
export type RecordedSpawn = { readonly file: string; readonly args: readonly string[] };
export type RecordedTransport = { readonly url: string; readonly method: string };
export type RecordedGit = { readonly file: string; readonly args: readonly string[] };

export type ProductionQueueHarness = {
  readonly brand: BrandIdentity;
  readonly home: string;
  readonly stateDirectory: string;
  readonly workingDirectory: string;
  readonly store: StateStorePort;
  readonly spawns: readonly RecordedSpawn[];
  readonly transportCalls: readonly RecordedTransport[];
  readonly gitCalls: readonly RecordedGit[];
  readonly run: (argv: readonly string[]) => Promise<{
    readonly exitCode: number;
    readonly stdout: string;
    readonly stderr: string;
    readonly envelope?: Record<string, unknown>;
  }>;
  /** The verified queue ledger entries, oldest first. */
  readonly ledgerEntries: () => readonly QueueEntryRecord[];
  /** The derived queue graph document bytes, when one was written. */
  readonly graphDocument: () => string | undefined;
  readonly dispose: () => void;
};

export type ProductionQueueHarnessOptions = {
  readonly label: string;
  /** The real working directory the production composer resolves the root from. */
  readonly workingDirectory: string;
  /** The only injected repository fact: the origin remote (no root member exists). */
  readonly originUrl?: string;
  /** Re-open an existing home/state root (replay and ledger reads). */
  readonly home?: string;
};

const refusingCredentials: CredentialPort = {
  resolve: () => ({
    ok: false,
    code: "config.credential.missing",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    projectionClass: "user-validation",
  }),
};

/** Compose the real production program over a real working directory. */
export const createProductionQueueHarness = (
  options: ProductionQueueHarnessOptions,
): ProductionQueueHarness => {
  const brandResult = resolveBrandIdentity({ workingName: WORKING_NAME });
  if (!brandResult.ok) throw new Error("brand resolution failed");
  const brand = brandResult.value;
  mkdirSync(BASE, { recursive: true });
  const ownedHome = options.home === undefined;
  const home = options.home ?? mkdtempSync(join(BASE, `gh273-${options.label}-`));
  const stateDirectory = join(home, brand.stateDirectoryName);
  const spawns: RecordedSpawn[] = [];
  const transportCalls: RecordedTransport[] = [];
  const gitCalls: RecordedGit[] = [];
  const spawnRunner: HarnessSpawnRunner = async (file, args): Promise<HarnessSpawnRunnerResult> => {
    spawns.push({ file, args });
    return {
      stdout: JSON.stringify({
        session: { id: "ses-gh273" },
        result: { completion: "complete" },
      }),
      stderr: "",
      status: 0,
      timedOut: false,
    };
  };
  const gitRunner: GitChildRunner = async (file, args): Promise<GitChildRunnerResult> => {
    gitCalls.push({ file, args });
    return { stdout: "", stderr: "git is not available in this suite", status: 1, timedOut: false };
  };
  const program = createProductionComposer({
    environment: {
      HOME: home,
      HARNESS_MODEL: "synthetic/model-large",
      HARNESS_SMALL_MODEL: "synthetic/model-small",
    },
    cwd: options.workingDirectory,
    homeDirectory: home,
    workingName: WORKING_NAME,
    repositoryFacts: {
      ...(options.originUrl === undefined ? {} : { originUrl: options.originUrl }),
    },
    harnessSpawnRunner: spawnRunner,
    harnessSpawnStarter: streamStarterFromRunner(spawnRunner),
    credentials: refusingCredentials,
    githubTransport: {
      send: async (request) => {
        transportCalls.push({ url: request.url, method: request.method });
        throw new Error("the queue add path must not call the provider transport");
      },
    },
    gitChildRunner: gitRunner,
  })(brand);
  const store = createStateStore(
    {
      level: "local",
      workspaceId: "default",
      fenceNamespace: "cli",
      schemaVersion: STATE_SCHEMA_VERSION,
      stateDirectory,
    },
    { driver: "jsonl", edge: createNodeStateEdge() },
  );
  let runOrdinal = 0;
  const run = async (argv: readonly string[]) => {
    const out: string[] = [];
    const err: string[] = [];
    const streams: CliStreams = {
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: (chunk: string) => err.push(chunk) },
    };
    runOrdinal += 1;
    const exitCode = await runCli(argv, streams, {
      brand,
      clock: { now: () => Date.parse("2026-11-08T10:00:00.000Z") },
      newRunId: () => `run-gh273-${String(runOrdinal)}`,
      secrets: [],
      program,
    });
    const stdout = out.join("");
    const stderr = err.join("");
    const trimmed = stdout.trim();
    const envelope =
      trimmed.startsWith("{") && trimmed.endsWith("}")
        ? (JSON.parse(trimmed) as Record<string, unknown>)
        : undefined;
    return {
      exitCode,
      stdout,
      stderr,
      ...(envelope === undefined ? {} : { envelope }),
    };
  };
  const ledgerEntries = (): readonly QueueEntryRecord[] => {
    const read = readQueueEntries(store);
    if (!read.ok) throw new Error(`queue ledger read failed: ${read.code}`);
    return read.records;
  };
  const graphDocument = (): string | undefined => {
    try {
      return readFileSync(queueGraphDocumentPath(store.identity), "utf8");
    } catch {
      return undefined;
    }
  };
  const dispose = (): void => {
    if (ownedHome) rmSync(home, { recursive: true, force: true });
  };
  return {
    brand,
    home,
    stateDirectory,
    workingDirectory: options.workingDirectory,
    store,
    spawns,
    transportCalls,
    gitCalls,
    run,
    ledgerEntries,
    graphDocument,
    dispose,
  };
};

/** Create a fresh home under the repository-local temp tree. */
export const makeHarnessHome = (label: string): string => {
  mkdirSync(BASE, { recursive: true });
  return mkdtempSync(join(BASE, `gh273-${label}-`));
};

/** Remove a home created outside the harness (same-home replay helpers). */
export const removeHome = (home: string): void => {
  rmSync(home, { recursive: true, force: true });
};

/** The checkout root a fabricated `.git` describes (for expected assertions). */
export const checkoutRootOf = (checkout: Checkout): string => checkout.directory;

/** Write a `.git/config` origin into an existing checkout. */
export const setCheckoutOrigin = (checkout: Checkout, originUrl: string): void => {
  mkdirSync(dirname(join(checkout.commonDir, "config")), { recursive: true });
  writeFileSync(join(checkout.commonDir, "config"), `[remote "origin"]\n\turl = ${originUrl}\n`);
};
