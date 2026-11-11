/**
 * The Node-hosted MCP serve entry (F-1, DEC-1, DEC-2).
 *
 * This is the mcp composition root and the only module in the surface that may
 * touch a runtime API: it reads the process environment exactly once at
 * startup, wires the adapter subpaths and the core state/engines the way the
 * CLI edge composes them, and owns the stdio transport edge. Every exit is
 * delegated to `lifecycle.ts`; tool outcomes never choose an exit.
 *
 * No `bin` field ships, no installer entry is registered, and nothing
 * user-installable is produced (DEC-2). The declared `./serve` export is the
 * process entry the portability smoke resolves from the manifest.
 */
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import {
  acquireFileConfig,
  ensureProjectIdentityMarkerText,
  nodeFileSystemFacts,
  nodeOwnerHoldMarkerFileSystem,
  nodePmNotesFileSystemFacts,
  readCiWorkflowJobNames,
  readLocalPmContext,
  readOwnerHoldMarker,
  readPmNotesText,
  readProjectIdentityMarker,
  runtimePlatform,
} from "@delivery-os/adapters/file";
import {
  nodeRepositoryIo,
  parseGitHubRemote,
  readCheckoutIdentity,
  readRepositoryFacts,
} from "@delivery-os/adapters/repo";
import {
  resolveOwnerHoldFact,
  resolveProjectScope,
  type StateScopeRoots,
  stateScopeRoots,
} from "@delivery-os/core";
import { resolveBrandIdentity } from "@delivery-os/core/branding";
import type { BrandIdentity, OwnerHoldFact, StateStorePort } from "@delivery-os/core/contracts";
import { STATE_SCHEMA_VERSION } from "@delivery-os/core/contracts";
import { readProviderParkViews } from "@delivery-os/core/provider";
import {
  createNodeStateEdge,
  createStateStore,
  readBlockerLedger,
  readChangeTransitionsTolerant,
} from "@delivery-os/core/state";
import type { GateReportRegistryRead, GateReportToolRuntime } from "./commands/gate-report.js";
import type { StatusToolRuntime } from "./commands/status.js";
import { createToolset, type Toolset } from "./commands/toolset.js";
import type { VerifyArtifactToolRuntime, VerifyPmNotesRead } from "./commands/verify-artifact.js";
import { type LifecycleDiagnostics, type LifecycleOutcome, runLifecycle } from "./lifecycle.js";
import { runProtocol } from "./output/protocol.js";

const DEFAULT_WORKING_NAME = "delivery-os";
const SERVER_VERSION = "0.0.0";
/** The neutral working-name override the smoke and operators supply. */
const WORKING_NAME_OVERRIDE = "DELIVERY_OS_WORKING_NAME";

const diagnostics: LifecycleDiagnostics = {
  write: (line) => {
    process.stderr.write(line);
  },
};

const configurationOutcome = (detail: string): LifecycleOutcome => ({
  kind: "configuration",
  detail,
});

type BrandResolution =
  | { readonly ok: true; readonly brand: BrandIdentity }
  | { readonly ok: false; readonly outcome: LifecycleOutcome };

const resolveBrand = (
  environment: Readonly<Record<string, string | undefined>>,
): BrandResolution => {
  const override = environment[WORKING_NAME_OVERRIDE];
  const input =
    override === undefined
      ? { workingName: DEFAULT_WORKING_NAME }
      : { workingName: DEFAULT_WORKING_NAME, override };
  const branded = resolveBrandIdentity(input);
  return branded.ok
    ? { ok: true, brand: branded.value }
    : { ok: false, outcome: configurationOutcome(`${branded.error.field}:${branded.error.code}`) };
};

const buildStatusRuntime = (
  cwd: string,
  store: ReturnType<typeof createStateStore>,
  readOwnerHold: () => OwnerHoldFact,
): StatusToolRuntime => ({
  readRepository: () => {
    const facts = readRepositoryFacts({ cwd, io: nodeRepositoryIo() });
    const parsed = parseGitHubRemote(facts.originUrl);
    return parsed.ok
      ? {
          binding: {
            state: "observed",
            host: "github.com",
            owner: parsed.owner,
            name: parsed.name,
            remoteName: "origin",
          },
          head: facts.head,
        }
      : { binding: { state: "unavailable", reason: parsed.reason }, head: facts.head };
  },
  readWorkItems: async () => ({ ok: false, reason: "not-configured" }),
  readDeliveryRequests: async () => ({ ok: false, reason: "not-configured" }),
  readPipelineRuns: async () => ({ ok: false, reason: "not-configured" }),
  readProviderConfig: () => ({ ok: false, reason: "provider-chain-unresolved" }),
  readOwnerHold,
  readProviderParks: (nowMs) => {
    // The same verified-park fold the CLI status edge composes (review F-2):
    // the store is already built and read successfully for verify/gates here,
    // so the parks section reports its real state instead of a hardwired
    // `state.store.unknown`.
    const parks = readProviderParkViews(store, nowMs);
    if (!parks.ok) {
      return { ok: false, reason: "state-unreadable", failureCode: parks.error.code };
    }
    return { ok: true, parks: parks.value };
  },
  readLocalContext: () =>
    readLocalPmContext({
      path: `${cwd}/.ai/local/pm-context.yaml`,
      fs: nodeFileSystemFacts(),
    }),
  readBlockers: () => {
    // The same verified blocker-ledger read the CLI status edge composes; a
    // failed or torn read stays digest evidence, never a tool failure.
    const read = readBlockerLedger(store);
    return read.ok
      ? { ok: true, value: read.value }
      : { ok: false, reason: "state-unreadable", failureCode: read.error.code };
  },
  nowIso: () => new Date().toISOString(),
  nowMs: () => Date.now(),
});

const registryRead = (
  store: ReturnType<typeof createStateStore>,
  changeRef: string,
): GateReportRegistryRead => {
  const read = readChangeTransitionsTolerant(store, changeRef);
  if (!read.ok) return { ok: false, error: read.error };
  return {
    ok: true,
    present: read.value.present,
    verifiedEmpty: read.value.verifiedEmpty,
    transitions: read.value.transitions,
    recordCount: read.value.evidence.recordCount,
  };
};

const pmNotesRead = (cwd: string, changeRef: string): VerifyPmNotesRead =>
  readPmNotesText({
    changeRef,
    changesDirectory: `${cwd}/doc/changes`,
    fs: nodePmNotesFileSystemFacts(),
  });

const buildVerifyRuntime = (
  store: ReturnType<typeof createStateStore>,
  cwd: string,
): VerifyArtifactToolRuntime => ({
  readPmNotes: (changeRef) => pmNotesRead(cwd, changeRef),
  readRegistry: (changeRef) => registryRead(store, changeRef),
});

const buildGateRuntime = (
  store: ReturnType<typeof createStateStore>,
  cwd: string,
): GateReportToolRuntime => ({
  readLifecycle: (changeRef) => ({
    document: pmNotesRead(cwd, changeRef),
    registry: registryRead(store, changeRef),
  }),
  readRepository: () => {
    const facts = readRepositoryFacts({ cwd, io: nodeRepositoryIo() });
    const parsed = parseGitHubRemote(facts.originUrl);
    return {
      binding: parsed.ok
        ? "resolved"
        : parsed.reason === "remote-unsupported"
          ? "remote-unsupported"
          : "address-unresolved",
      head: facts.head,
    };
  },
  readWorkflow: () => {
    const read = readCiWorkflowJobNames({
      baseDirectory: cwd,
      fs: nodeFileSystemFacts(),
    });
    return { outcome: read.outcome, names: read.names };
  },
  readOpenPullRequests: async () => ({
    ok: false,
    reason: "credential-unavailable",
    failureCode: "config.credential.missing",
  }),
  readDeliveryRequestDetail: async () => ({
    ok: false,
    reason: "credential-unavailable",
    failureCode: "config.credential.missing",
  }),
  readCheckRuns: async () => ({
    ok: false,
    reason: "credential-unavailable",
    failureCode: "config.credential.missing",
  }),
  readWorkItem: async () => ({
    ok: false,
    reason: "credential-unavailable",
    failureCode: "config.credential.missing",
  }),
});

/** The injected facts the serve state composition resolves from. */
export type ServeStateFacts = {
  readonly brand: BrandIdentity;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  readonly homeDirectory: string;
};

/** The composed state seam: the store at the project root, the hold at the host root. */
export type ServeState =
  | {
      readonly ok: true;
      readonly store: StateStorePort;
      readonly roots: StateScopeRoots;
      readonly readOwnerHold: () => OwnerHoldFact;
    }
  | { readonly ok: false; readonly code: string };

/**
 * Compose the MCP store and its owner-hold read over the one policy (GH-288 F-6).
 *
 * This is the seam the parity suite drives in process: the same checkout, the
 * same environment, and the same policy call the CLI composition makes, so the
 * two surfaces cannot disagree about where a repository's state lives.
 */
export const composeServeState = (facts: ServeStateFacts): ServeState => {
  const scope = resolveProjectScope({
    environment: facts.environment,
    environmentPrefix: facts.brand.environmentPrefix,
    stateDirectoryName: facts.brand.stateDirectoryName,
    homeDirectory: facts.homeDirectory,
    checkout: readCheckoutIdentity({ cwd: facts.cwd, io: nodeRepositoryIo() }),
    ports: {
      readMarker: (commonDir) => readProjectIdentityMarker(commonDir),
      writeMarker: (commonDir, text) => ensureProjectIdentityMarkerText(commonDir, text),
      newProjectIdentifier: () => globalThis.crypto.randomUUID().replace(/-/gu, ""),
    },
  });
  if (!scope.ok) return { ok: false, code: scope.error.code };
  const roots = stateScopeRoots(scope.value);
  const store = createStateStore(
    {
      level: "local",
      workspaceId: "default",
      fenceNamespace: "mcp",
      schemaVersion: STATE_SCHEMA_VERSION,
      stateDirectory: roots.projectRoot,
    },
    { driver: "jsonl", edge: createNodeStateEdge() },
  );
  const readOwnerHold = (): OwnerHoldFact => {
    const marker = readOwnerHoldMarker(
      { storeDirectory: roots.hostRoot },
      nodeOwnerHoldMarkerFileSystem(),
    );
    return resolveOwnerHoldFact({
      environment: facts.environment,
      environmentPrefix: facts.brand.environmentPrefix,
      storeDirectory: roots.hostRoot,
      marker,
    });
  };
  return { ok: true, store, roots, readOwnerHold };
};

/** The composed serve surface: the state seam plus the callable toolset. */
export type ServeSurface =
  | { readonly ok: true; readonly toolset: Toolset; readonly state: ServeState & { ok: true } }
  | { readonly ok: false; readonly code: string };

/**
 * Compose the MCP toolset over the same policy-resolved state (GH-288 F-6).
 *
 * The parity suite drives this in process, so the MCP surface's store root and
 * its status payload are compared with the CLI's for the same checkout.
 */
export const composeServeSurface = (facts: ServeStateFacts): ServeSurface => {
  const state = composeServeState(facts);
  if (!state.ok) return { ok: false, code: state.code };
  const toolset = createToolset({
    brand: facts.brand,
    status: buildStatusRuntime(facts.cwd, state.store, state.readOwnerHold),
    verify: buildVerifyRuntime(state.store, facts.cwd),
    gates: buildGateRuntime(state.store, facts.cwd),
  });
  return { ok: true, toolset, state };
};

const run = async (): Promise<void> => {
  const environment: Readonly<Record<string, string | undefined>> = { ...process.env };
  const cwd = process.cwd();
  const homeDirectory = environment.HOME ?? environment.USERPROFILE ?? "";
  if (homeDirectory.length === 0) {
    runLifecycle(configurationOutcome("HOME is not set"), diagnostics);
  }

  const brandResult = resolveBrand(environment);
  const brand: BrandIdentity = (() => {
    if (brandResult.ok) return brandResult.brand;
    return runLifecycle(brandResult.outcome, diagnostics);
  })();

  const selectedConfig = environment[`${brand.environmentPrefix}CONFIG`];
  const repositoryFacts = readRepositoryFacts({ cwd, io: nodeRepositoryIo() });
  const acquired = acquireFileConfig({
    platform: runtimePlatform(),
    homeDirectory,
    environment,
    ...(repositoryFacts.root === undefined ? {} : { gitRoot: repositoryFacts.root }),
    ...(selectedConfig === undefined ? {} : { selectedConfig }),
    enableSystemConfig: false,
    enableUserConfig: true,
    enableProjectLocalConfig: true,
    configurationDirectoryName: brand.configDirectoryName,
    fs: nodeFileSystemFacts(),
  });
  if (!acquired.ok) {
    runLifecycle(configurationOutcome(acquired.error.code), diagnostics);
  }

  const surface = (() => {
    const composed = composeServeSurface({ brand, environment, cwd, homeDirectory });
    if (composed.ok) return composed;
    return runLifecycle(configurationOutcome(composed.code), diagnostics);
  })();
  const { toolset } = surface;

  const lines = createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY });
  try {
    const outcome = await runProtocol(
      {
        lines,
        writeFrame: (frame) => {
          process.stdout.write(`${frame}\n`);
        },
      },
      { brand, toolset, serverName: brand.binaryName, serverVersion: SERVER_VERSION },
    );
    runLifecycle(outcome, diagnostics);
  } finally {
    lines.close();
  }
};

/**
 * Whether this module is the process entry. Importing the composition seam for
 * in-process parity must never start the stdio loop, so the declared `serve`
 * promise resolves without side effects when the module is merely imported.
 */
const isProcessEntry = (): boolean => {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
};

/** The declared process entry: starts the protocol loop when executed directly. */
export const serve: Promise<void> = isProcessEntry() ? run() : Promise.resolve();
