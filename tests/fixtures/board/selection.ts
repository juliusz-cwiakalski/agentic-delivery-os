/**
 * Repository-selection fixtures for the board (GH-297 TC-BOARD-010..016, 064).
 *
 * Composes the real board edge runtime over real temporary checkouts, a seeded
 * host-index document, and per-repository state roots. Only the transport, the
 * index bytes, and the counters are injected; the selection logic under test is
 * the production one.
 */
import { mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { nodeRepositoryIo } from "../../../packages/adapters/src/repo/index";
import { createBoardCommandDefinition } from "../../../packages/cli/src/commands/board";
import {
  type BoardHostIndexDocument,
  createBoardCommandRuntime,
  type StatusTransport,
} from "../../../packages/cli/src/edge";
import { type CliDependencies, type CliStreams, runCli } from "../../../packages/cli/src/index";
import type { ExternalSystemInstance } from "../../../packages/core/src/contracts/index";
import {
  createNodeStateEdge,
  createStateStore,
  STATE_SCHEMA_VERSION,
} from "../../../packages/core/src/state/index";
import { SYNTHETIC_BRAND } from "../../golden/helpers";
import { APPROVED_BASE, nonCheckoutDirectory } from "../projects/state-scope";
import { createRepository, git, removeDirectory } from "../projects/temp-repos";

export type SelectionRepository = {
  readonly projectKey: string;
  readonly rootExists?: boolean;
};

export type SelectionHarnessOptions = {
  readonly repositories: readonly SelectionRepository[];
  readonly invokingKey: string | undefined;
  /** Overrides the index read result; the default is a present document. */
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
  readonly indexReads: () => number;
  readonly storesOpened: readonly string[];
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

const emptyTransport = (): StatusTransport => ({
  send: async (request) => {
    if (request.url.includes("/issues?")) return { status: 200, body: [] };
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
  const roots = new Map<string, string>();
  const stateLocations = new Map<string, string>();
  const storesOpened: string[] = [];
  for (const repository of options.repositories) {
    const root = createRepository(base, `checkout-${repository.projectKey}`);
    git(root, ["remote", "add", "origin", `https://github.com/acme/${repository.projectKey}.git`]);
    roots.set(repository.projectKey, root);
    stateLocations.set(repository.projectKey, join(hostRoot, "projects", repository.projectKey));
  }
  let indexReads = 0;
  const document: BoardHostIndexDocument = {
    projects: options.repositories
      .filter((repository) => repository.rootExists !== false)
      .map((repository) => ({
        projectKey: repository.projectKey,
        root: roots.get(repository.projectKey) ?? "",
        stateLocation: stateLocations.get(repository.projectKey) ?? "",
      })),
  };
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
      transport: emptyTransport(),
    },
    nowIso: () => "2026-11-06T12:00:00Z",
    nowMs: () => Date.parse("2026-11-06T12:00:00Z"),
    newFenceToken: () => "board-selection-fence",
    ...(options.invokingKey === undefined ? {} : { repositoryKey: options.invokingKey }),
    hostRoot,
    readHostIndex: () => {
      indexReads += 1;
      if (options.index === "absent") return { state: "absent" as const };
      if (options.index === "unreadable") return { state: "unreadable" as const };
      if (options.index === "unparseable") {
        return { state: "present" as const, text: "{not-json" };
      }
      return { state: "present" as const, text: "seeded" };
    },
    parseHostIndex: (text: string) =>
      text === "seeded" && options.index !== "unparseable" ? document : undefined,
    rootExists: (root: string) => root.length > 0,
    stateLocationFor: (projectKey: string) =>
      stateLocations.get(projectKey) ?? join(hostRoot, "projects", projectKey),
    openStore: (stateLocation: string) => {
      storesOpened.push(stateLocation);
      return createStateStore(
        {
          level: "local" as const,
          workspaceId: "default",
          fenceNamespace: "cli",
          schemaVersion: STATE_SCHEMA_VERSION,
          stateDirectory: stateLocation,
        },
        { driver: "jsonl" as const, edge: createNodeStateEdge() },
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
  return {
    hostRoot,
    indexReads: () => indexReads,
    storesOpened,
    run,
    dispose: () => {
      removeDirectory(base);
      if (unboundBase !== undefined) removeDirectory(unboundBase);
    },
  };
};
