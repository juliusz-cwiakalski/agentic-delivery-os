/**
 * The production-composition harness for the two-layer state scope (GH-288
 * TC-PROJ-001/002/009).
 *
 * Composes the real `createProductionComposer` program over a real checkout,
 * a per-test host root, and a home that is a distinct directory. The only
 * injected facts are the remote origin and the recording seams: there is
 * deliberately **no** way to inject a state root or a project key, so every
 * assertion reads the pair the production derivation actually resolved.
 */
import { createHash } from "node:crypto";
import {
  type Dirent,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import type {
  GitChildRunner,
  GitChildRunnerResult,
} from "../../../packages/adapters/src/git/index";
import { type CliStreams, runCli } from "../../../packages/cli/src/index";
import { createProductionComposer } from "../../../packages/cli/src/production";
import { queueGraphDocumentPath, readQueueEntries } from "../../../packages/core/src/app/queue";
import type {
  BrandIdentity,
  CredentialPort,
  HarnessSpawnRunner,
  HarnessSpawnRunnerResult,
  QueueEntryRecord,
  StateStorePort,
} from "../../../packages/core/src/contracts/index";
import {
  createNodeStateEdge,
  createStateStore,
  STATE_SCHEMA_VERSION,
} from "../../../packages/core/src/state/index";
import { streamStarterFromRunner } from "../harness/stream";
import {
  APPROVED_BASE,
  brandOf,
  createHostFixture,
  type HostFixture,
  projectScopeFor,
  stateOverrideVariable,
} from "./state-scope";

/** One recorded external call, for the purity assertions. */
export type RecordedSpawn = { readonly file: string; readonly args: readonly string[] };

export type ProductionRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope?: Record<string, unknown>;
};

export type ProductionProjectsHarness = {
  readonly brand: BrandIdentity;
  readonly hostRoot: string;
  readonly home: string;
  readonly checkout: string;
  readonly workingDirectory: string;
  readonly projectKey: string;
  readonly stateLocation: string;
  readonly store: StateStorePort;
  readonly spawns: readonly RecordedSpawn[];
  readonly transportCalls: readonly string[];
  readonly gitCalls: readonly RecordedSpawn[];
  readonly run: (argv: readonly string[]) => Promise<ProductionRun>;
  readonly ledgerEntries: () => readonly QueueEntryRecord[];
  readonly graphDocument: () => string | undefined;
  /** name → sha256 of every regular file under a directory (recursive). */
  readonly snapshot: (directory: string) => Readonly<Record<string, string>>;
  readonly fileList: (directory: string) => readonly string[];
  readonly dispose: () => void;
};

export type ProductionProjectsHarnessOptions = {
  readonly label: string;
  /** The real working directory the composer resolves the checkout from. */
  readonly workingDirectory: string;
  /** The only injected repository fact: the origin remote (no root member). */
  readonly originUrl?: string;
  /** An existing host/home pair (replay helpers); a fresh one otherwise. */
  readonly host?: HostFixture;
  /** Extra environment entries for the composed program. */
  readonly environmentExtra?: Readonly<Record<string, string>>;
  readonly credential?: "resolved" | "missing";
};

const hashFile = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

const walkFiles = (root: string, relative = ""): string[] => {
  const results: string[] = [];
  const directory = relative.length === 0 ? root : join(root, relative);
  let entries: Dirent[];
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const next = relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
    if (entry.isDirectory()) results.push(...walkFiles(root, next));
    else results.push(next);
  }
  return results.sort();
};

const resolvingCredentials: CredentialPort = {
  resolve: () => ({ ok: true, material: { value: "synthetic-projects-read" } }),
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

/** Compose the real production program over one real checkout. */
export const createProductionProjectsHarness = (
  options: ProductionProjectsHarnessOptions,
): ProductionProjectsHarness => {
  const brand = brandOf();
  mkdirSync(APPROVED_BASE, { recursive: true });
  const host = options.host ?? createHostFixture(options.label, { brand });
  const ownsHost = options.host === undefined;
  const spawns: RecordedSpawn[] = [];
  const transportCalls: string[] = [];
  const gitCalls: RecordedSpawn[] = [];
  const spawnRunner: HarnessSpawnRunner = async (file, args): Promise<HarnessSpawnRunnerResult> => {
    spawns.push({ file, args });
    return {
      stdout: JSON.stringify({
        session: { id: "ses-gh288" },
        result: { completion: "complete" },
      }),
      stderr: "",
      status: 0,
      timedOut: false,
    };
  };
  const gitRunner: GitChildRunner = async (file, args): Promise<GitChildRunnerResult> => {
    gitCalls.push({ file, args });
    if (args[0] === "for-each-ref") return { stdout: "", stderr: "", status: 0, timedOut: false };
    if (args[0] === "rev-list") return { stdout: "0", stderr: "", status: 0, timedOut: false };
    return { stdout: "", stderr: "git is not available in this suite", status: 1, timedOut: false };
  };
  const program = createProductionComposer({
    environment: {
      HOME: host.home,
      [stateOverrideVariable(brand)]: host.hostRoot,
      PATH: "/synthetic/bin:/synthetic/usr/bin",
      HARNESS_MODEL: "synthetic/model-large",
      HARNESS_SMALL_MODEL: "synthetic/model-small",
      ...options.environmentExtra,
    },
    cwd: options.workingDirectory,
    homeDirectory: host.home,
    workingName: "delivery-os",
    repositoryFacts: {
      ...(options.originUrl === undefined ? {} : { originUrl: options.originUrl }),
    },
    harnessSpawnRunner: spawnRunner,
    harnessSpawnStarter: streamStarterFromRunner(spawnRunner),
    credentials: options.credential === "missing" ? refusingCredentials : resolvingCredentials,
    githubTransport: {
      send: async (request) => {
        transportCalls.push(request.url);
        if (request.url.includes("/issues/")) {
          return {
            status: 200,
            body: { number: 241, title: "Projects fixture", state: "open", labels: [] },
          };
        }
        if (request.url.includes("/pulls?")) return { status: 200, body: [] };
        return { status: 404, body: {} };
      },
    },
    gitChildRunner: gitRunner,
  })(brand);
  const resolved = projectScopeFor({
    cwd: options.workingDirectory,
    hostRoot: host.hostRoot,
    home: host.home,
    brand,
  });
  const store = createStateStore(
    {
      level: "local",
      workspaceId: "default",
      fenceNamespace: "cli",
      schemaVersion: STATE_SCHEMA_VERSION,
      stateDirectory: resolved.scope.stateLocation,
    },
    { driver: "jsonl", edge: createNodeStateEdge() },
  );
  let runOrdinal = 0;
  const run = async (argv: readonly string[]): Promise<ProductionRun> => {
    const out: string[] = [];
    const err: string[] = [];
    const streams: CliStreams = {
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: (chunk: string) => err.push(chunk) },
    };
    runOrdinal += 1;
    const exitCode = await runCli(argv, streams, {
      brand,
      clock: { now: () => Date.parse("2026-11-11T10:00:00.000Z") },
      newRunId: () => `run-gh288-${String(runOrdinal)}`,
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
    return { exitCode, stdout, stderr, ...(envelope === undefined ? {} : { envelope }) };
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
  return {
    brand,
    hostRoot: host.hostRoot,
    home: host.home,
    checkout: options.workingDirectory,
    workingDirectory: options.workingDirectory,
    projectKey:
      resolved.scope.kind === "project" ? resolved.scope.projectKey : resolved.scope.stateLocation,
    stateLocation: resolved.scope.stateLocation,
    store,
    spawns,
    transportCalls,
    gitCalls,
    run,
    ledgerEntries,
    graphDocument,
    snapshot: (directory) =>
      Object.fromEntries(
        walkFiles(directory).map((name) => [name, hashFile(join(directory, name))]),
      ),
    fileList: (directory) => walkFiles(directory),
    dispose: () => {
      if (ownsHost) host.dispose();
    },
  };
};

/** A fresh host/home pair for tests that only need the fixture. */
export const makeHostRoot = (label: string): HostFixture => createHostFixture(label);

/** A fresh directory under the approved base. */
export const makeBaseDirectory = (label: string): string => {
  mkdirSync(APPROVED_BASE, { recursive: true });
  return mkdtempSync(join(APPROVED_BASE, `gh288-${label}-`));
};

/** The directory's file names, for the host-root absence assertion. */
export const namesOf = (directory: string): readonly string[] => {
  try {
    return readdirSync(directory).sort();
  } catch {
    return [];
  }
};

/** The directory's mode bits, for the state-survival assertion. */
export const modeOf = (directory: string): number | undefined => {
  try {
    return statSync(directory).mode & 0o777;
  } catch {
    return undefined;
  }
};

/** Remove one directory tree. */
export const removeDirectoryTree = (directory: string): void => {
  rmSync(directory, { recursive: true, force: true });
};
