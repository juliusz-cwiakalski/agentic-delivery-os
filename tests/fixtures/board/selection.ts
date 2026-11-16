/**
 * Repository-selection fixtures for the board (GH-297 TC-BOARD-010..016, 064).
 *
 * Composes the real board edge runtime over real temporary checkouts, a real
 * host-index file, and per-repository state roots. Only the transport, the
 * indexed issue facts, and the counters are injected; the selection and the
 * per-repository reads under test are the production ones.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readHostIndexFile } from "../../../packages/adapters/src/file/host-index-store";
import { nodeRepositoryIo } from "../../../packages/adapters/src/repo/index";
import { createBoardCommandDefinition } from "../../../packages/cli/src/commands/board";
import {
  type BoardHostIndexDocument,
  createBoardCommandRuntime,
  type StatusTransport,
} from "../../../packages/cli/src/edge";
import { type CliDependencies, type CliStreams, runCli } from "../../../packages/cli/src/index";
import {
  type ExternalSystemInstance,
  HOST_INDEX_SCHEMA,
  MERGE_WAIVER_SCHEMA,
  type StateStorePort,
} from "../../../packages/core/src/contracts/index";
import {
  appendMergeWaiver,
  createNodeStateEdge,
  createStateStore,
  readAllMergeWaivers,
  readOwnerGateSlaDecisions,
  STATE_SCHEMA_VERSION,
} from "../../../packages/core/src/state/index";
import { SYNTHETIC_BRAND } from "../../golden/helpers";
import { APPROVED_BASE, nonCheckoutDirectory } from "../projects/state-scope";
import { createRepository, git, removeDirectory } from "../projects/temp-repos";

/** One indexed issue the injected transport answers for a repository. */
export type SelectionIssue = {
  readonly number: number;
  readonly title?: string;
  readonly labels: readonly string[];
  readonly updatedAt: string;
};

export type SelectionRepository = {
  readonly projectKey: string;
  readonly rootExists?: boolean;
};

export type SelectionHarnessOptions = {
  readonly repositories: readonly SelectionRepository[];
  readonly invokingKey: string | undefined;
  /** Per-repository issue facts; absent answers an empty tracker page. */
  readonly issues?: Readonly<Record<string, readonly SelectionIssue[]>>;
  /** Overrides the real index-file state; the default writes a present file. */
  readonly index?: "absent" | "unreadable" | "unparseable" | "present";
  readonly label?: string;
};

export type SelectionRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly data?: Record<string, unknown>;
  readonly errorCode?: string;
};

export type SelectionHarness = {
  readonly hostRoot: string;
  readonly indexPath: string;
  readonly indexReads: () => number;
  readonly indexWrites: () => number;
  readonly indexRevision: () => number;
  readonly storesOpened: readonly string[];
  /** The per-repository store (the same instance the board reads and writes). */
  readonly storeFor: (projectKey: string) => StateStorePort;
  readonly seedWaiver: (
    projectKey: string,
    waiver: { readonly changeRef: string; readonly authorizer: string },
  ) => void;
  readonly readWaivers: (projectKey: string) => readonly { readonly changeRef: string }[];
  readonly readDecisions: (projectKey: string) => readonly { readonly gateId: string }[];
  readonly run: (argv: readonly string[]) => Promise<SelectionRun>;
  readonly dispose: () => void;
};

const github = (): ExternalSystemInstance => ({
  instanceName: "vcs-github",
  systemKind: "vcs",
  baseUrl: "https://api.github.example.com",
  authMethod: {
    mechanism: "credential-reference",
    reference: { referenceName: "read", sourceKey: { style: "literal", name: "TOKEN" } },
  },
});

const INDEX_REVISION = 7;

const repositoryNameOf = (url: string): string | undefined =>
  /\/repos\/[^/]+\/([^/?]+)/u.exec(url)?.[1];

const issuesTransport = (
  issues: Readonly<Record<string, readonly SelectionIssue[]>>,
): StatusTransport => ({
  send: async (request) => {
    if (request.url.includes("/issues?")) {
      const name = repositoryNameOf(request.url);
      const rows = name === undefined ? [] : (issues[name] ?? []);
      return {
        status: 200,
        body: rows.map((issue) => ({
          number: issue.number,
          title: issue.title ?? `Issue ${String(issue.number)}`,
          state: "open",
          labels: issue.labels.map((label) => ({ name: label })),
          updated_at: issue.updatedAt,
        })),
      };
    }
    if (request.url.includes("/pulls?")) return { status: 200, body: [] };
    return { status: 404, body: {} };
  },
});

export const createSelectionHarness = (options: SelectionHarnessOptions): SelectionHarness => {
  const label = options.label ?? "selection";
  mkdirSync(APPROVED_BASE, { recursive: true });
  const base = mkdtempSync(join(APPROVED_BASE, `board-${label}-`));
  // An invoking checkout with no derivable identity must live outside every
  // work tree, so the declared `unbound` scope is the real resolution.
  const unboundBase =
    options.invokingKey === undefined
      ? mkdtempSync(join(nonCheckoutDirectory(`board-${label}`), "invoking-"))
      : undefined;
  const hostRoot = join(base, "host");
  mkdirSync(hostRoot, { recursive: true });
  const indexPath = join(hostRoot, "host-index.json");
  const roots = new Map<string, string>();
  const stateLocations = new Map<string, string>();
  const storesByKey = new Map<string, StateStorePort>();
  const storesOpened: string[] = [];
  for (const repository of options.repositories) {
    const root = createRepository(base, `checkout-${repository.projectKey}`);
    git(root, ["remote", "add", "origin", `https://github.com/acme/${repository.projectKey}.git`]);
    roots.set(repository.projectKey, root);
    const stateLocation = join(hostRoot, "projects", repository.projectKey);
    stateLocations.set(repository.projectKey, stateLocation);
    storesByKey.set(
      repository.projectKey,
      createStateStore(
        {
          level: "local",
          workspaceId: "default",
          fenceNamespace: "cli",
          schemaVersion: STATE_SCHEMA_VERSION,
          stateDirectory: stateLocation,
        },
        { driver: "jsonl", edge: createNodeStateEdge() },
      ),
    );
  }
  const document: BoardHostIndexDocument = {
    projects: options.repositories
      .filter((repository) => repository.rootExists !== false)
      .map((repository) => ({
        projectKey: repository.projectKey,
        root: roots.get(repository.projectKey) ?? "",
        stateLocation: stateLocations.get(repository.projectKey) ?? "",
      })),
  };
  if (options.index !== "absent") {
    const text =
      options.index === "unparseable"
        ? "{not-json"
        : JSON.stringify({
            schema: HOST_INDEX_SCHEMA,
            revision: INDEX_REVISION,
            projects: document.projects,
          });
    if (options.index === "unreadable") {
      // A directory at the file path makes the real reader report `unreadable`.
      mkdirSync(indexPath, { recursive: true });
    } else {
      writeFileSync(indexPath, text, "utf8");
    }
  }
  let indexReads = 0;
  const indexWrites = 0;
  const composition = {
    store: createStateStore(
      {
        level: "local" as const,
        workspaceId: "default",
        fenceNamespace: "cli",
        schemaVersion: STATE_SCHEMA_VERSION,
        stateDirectory: join(hostRoot, "invoking"),
      },
      { driver: "jsonl" as const, edge: createNodeStateEdge() },
    ),
    repository: {
      cwd:
        options.invokingKey === undefined
          ? (unboundBase ?? base)
          : (roots.get(options.invokingKey) ?? base),
      io: nodeRepositoryIo(),
    },
    github: {
      instance: github(),
      credentials: {
        resolve: () => ({ ok: true as const, material: { value: "fixture-token" } }),
      },
      transport: issuesTransport(options.issues ?? {}),
    },
    nowIso: () => "2026-11-06T12:00:00Z",
    nowMs: () => Date.parse("2026-11-06T12:00:00Z"),
    newFenceToken: () => "board-selection-fence",
    ...(options.invokingKey === undefined ? {} : { repositoryKey: options.invokingKey }),
    hostRoot,
    readHostIndex: () => {
      indexReads += 1;
      if (options.index === "unreadable") return { state: "unreadable" as const };
      return readHostIndexFile(hostRoot);
    },
    hostIndexPath: () => indexPath,
    // The indexed facts are injected (the fixture keys are not minted); the
    // real file at `indexPath` is the snapshot target the write audit measures.
    parseHostIndex: (text: string) =>
      text.trim().length === 0 || options.index === "unparseable" ? undefined : document,
    rootExists: (root: string) => root.length > 0,
    stateLocationFor: (projectKey: string) =>
      stateLocations.get(projectKey) ?? join(hostRoot, "projects", projectKey),
    openStore: (stateLocation: string) => {
      storesOpened.push(stateLocation);
      const key = [...stateLocations.entries()].find(([, value]) => value === stateLocation)?.[0];
      const found = key === undefined ? undefined : storesByKey.get(key);
      return (
        found ??
        createStateStore(
          {
            level: "local" as const,
            workspaceId: "default",
            fenceNamespace: "cli",
            schemaVersion: STATE_SCHEMA_VERSION,
            stateDirectory: stateLocation,
          },
          { driver: "jsonl" as const, edge: createNodeStateEdge() },
        )
      );
    },
  };
  const definition = createBoardCommandDefinition(createBoardCommandRuntime(composition));
  let ordinal = 0;
  const run = async (argv: readonly string[]): Promise<SelectionRun> => {
    indexReads = 0;
    storesOpened.length = 0;
    const out: string[] = [];
    const err: string[] = [];
    const streams: CliStreams = {
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: (chunk: string) => err.push(chunk) },
    };
    ordinal += 1;
    const deps: CliDependencies = {
      brand: SYNTHETIC_BRAND,
      clock: { now: () => Date.parse("2026-11-06T12:00:00Z") },
      newRunId: () => `run-board-selection-${String(ordinal)}`,
      secrets: [],
      program: { commands: { board: definition } },
    };
    const exitCode = await runCli(["--json", ...argv], streams, deps);
    const stdout = out.join("");
    const stderr = err.join("");
    const parsed =
      stdout.trim().startsWith("{") && stdout.trim().endsWith("}")
        ? (JSON.parse(stdout) as Record<string, unknown>)
        : undefined;
    const data = parsed?.data;
    const error = parsed?.error as { code?: string } | undefined;
    return {
      exitCode,
      stdout,
      stderr,
      ...(typeof data === "object" && data !== null && !Array.isArray(data)
        ? { data: data as Record<string, unknown> }
        : {}),
      ...(error?.code === undefined ? {} : { errorCode: error.code }),
    };
  };
  const storeFor = (projectKey: string): StateStorePort => {
    const store = storesByKey.get(projectKey);
    if (store === undefined) throw new Error(`no store for ${projectKey}`);
    return store;
  };
  const indexRevision = (): number => {
    const parsed = JSON.parse(readFileSync(indexPath, "utf8")) as { revision?: number };
    return parsed.revision ?? 0;
  };
  return {
    hostRoot,
    indexPath,
    indexReads: () => indexReads,
    indexWrites: () => indexWrites,
    indexRevision,
    storesOpened,
    storeFor,
    seedWaiver: (projectKey, waiver) => {
      const appended = appendMergeWaiver(storeFor(projectKey), {
        fenceToken: `fixture-board-waiver-${projectKey}`,
        record: {
          schema: MERGE_WAIVER_SCHEMA,
          changeRef: waiver.changeRef,
          gateId: "owner-gate",
          gateClass: "owner-review",
          authorizer: waiver.authorizer,
          authorizedAt: "2026-11-06T10:00:00Z",
        },
      });
      if (!appended.ok) throw new Error(appended.error.code);
    },
    readWaivers: (projectKey) => {
      const read = readAllMergeWaivers(storeFor(projectKey));
      if (!read.ok) throw new Error(read.error.code);
      return read.records;
    },
    readDecisions: (projectKey) => {
      const read = readOwnerGateSlaDecisions(storeFor(projectKey));
      if (!read.ok) throw new Error(read.error.code);
      return read.value.records;
    },
    run,
    dispose: () => {
      removeDirectory(base);
      if (unboundBase !== undefined) removeDirectory(unboundBase);
    },
  };
};
