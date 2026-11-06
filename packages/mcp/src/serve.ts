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
import {
  acquireFileConfig,
  nodeFileSystemFacts,
  nodePmNotesFileSystemFacts,
  readCiWorkflowJobNames,
  readLocalPmContext,
  readPmNotesText,
  runtimePlatform,
} from "@delivery-os/adapters/file";
import {
  nodeRepositoryIo,
  parseGitHubRemote,
  readRepositoryFacts,
} from "@delivery-os/adapters/repo";
import { resolveBrandIdentity } from "@delivery-os/core/branding";
import type { BrandIdentity } from "@delivery-os/core/contracts";
import { STATE_SCHEMA_VERSION } from "@delivery-os/core/contracts";
import { readProviderParkViews } from "@delivery-os/core/provider";
import {
  createNodeStateEdge,
  createStateStore,
  readChangeTransitionsTolerant,
} from "@delivery-os/core/state";
import type { GateReportRegistryRead, GateReportToolRuntime } from "./commands/gate-report.js";
import type { StatusToolRuntime } from "./commands/status.js";
import { createToolset } from "./commands/toolset.js";
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

const trimTrailingSeparators = (path: string): string => path.replace(/[\\/]+$/u, "");

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

const stateIdentity = (brand: BrandIdentity, homeDirectory: string) => ({
  level: "local" as const,
  workspaceId: "default",
  fenceNamespace: "mcp",
  schemaVersion: STATE_SCHEMA_VERSION,
  stateDirectory: `${trimTrailingSeparators(homeDirectory)}/${brand.stateDirectoryName}`,
});

const buildStatusRuntime = (
  cwd: string,
  store: ReturnType<typeof createStateStore>,
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

  const store = createStateStore(stateIdentity(brand, homeDirectory), {
    driver: "jsonl",
    edge: createNodeStateEdge(),
  });
  const toolset = createToolset({
    brand,
    status: buildStatusRuntime(cwd, store),
    verify: buildVerifyRuntime(store, cwd),
    gates: buildGateRuntime(store, cwd),
  });

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

/** The declared process entry: starts the protocol loop at module load. */
export const serve: Promise<void> = run();
