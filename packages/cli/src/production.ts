/**
 * Production composition root for the executable entrypoint (GH-242 F-1).
 *
 * Wires the delivered adapters into the prompt-required command runtimes and
 * lets `createConfigProgram` compose the program. Provider-facing reads share
 * one GitHub client; an unresolved remote or missing credential produces the
 * command's own classified degradation rather than an unclassified crash. No
 * command is claimed that is not composed.
 */
import { writeFileSync } from "node:fs";
import {
  createEnvironmentCredentialPort,
  createProcessCredentialPort,
} from "@delivery-os/adapters/credentials";
import {
  acquireFileConfig,
  nodeFileSystemFacts,
  nodePmNotesFileSystemFacts,
  readPmNotesText,
  relativeChangeFolder,
  runtimePlatform,
} from "@delivery-os/adapters/file";
import { createGitBranchSeam, createGitMergeSeam } from "@delivery-os/adapters/git";
import { createGitHubClient, type GithubClientOptions } from "@delivery-os/adapters/github";
import { createClaudeSession, createOpencodeSession } from "@delivery-os/adapters/harness";
import { createHostSpawnRunner } from "@delivery-os/adapters/host";
import {
  findGitRoot,
  nodeRepositoryIo,
  parseGitHubRemote,
  readRepositoryFacts,
} from "@delivery-os/adapters/repo";
import {
  assembleHarnessLiveness,
  buildHarnessSpawnEnvironment,
  claimQueueLease,
  classifyHarnessEvidence,
  type DispatchLedgerFacts,
  type DispatchRead,
  type DispatchTruthReads,
  type HarnessSettings,
  normalizeRepositoryRemote,
  releaseQueueLease,
  resolveConfig,
  resolveHarnessSettings,
} from "@delivery-os/core";
import {
  type BrandIdentity,
  DISPATCH_DEFAULT_EVIDENCE_CLASS,
  type DispatchLedgerVariant,
  type DispatchPhaseLedger,
  type ExternalSystemInstance,
  type HarnessEnvironmentEntry,
  type HarnessEnvironmentBuilder,
  type HarnessKind,
  type HarnessSessionPort,
  type HarnessSpawnRunner,
} from "@delivery-os/core/contracts";
import {
  createNodeStateEdge,
  createStateStore,
  foldPhaseState,
  readChangeTransitionsTolerant,
  STATE_SCHEMA_VERSION,
} from "@delivery-os/core/state";
import {
  type ConfigProgramOptions,
  createCloseoutComposition,
  type DispatchCommandRuntime,
  type DispatchComposition,
  createConfigProgram,
  createDispatchCommandRuntime,
  createMergeCommandRuntime,
  createPhaseCommandRuntime,
  createPhaseCommitExtension,
  createPlanCommandRuntime,
  createProductionCommitRuntimeOptions,
  createStatusCommandRuntime,
  createVerifyCommandRuntime,
  createVerifyDeployCommandRuntime,
  createVerifyGatesCommandRuntime,
} from "./edge.js";
import type { EntrypointComposer } from "./entrypoint.js";

const PROVIDER_FAILURE = "config.credential.missing";

const trimTrailingSeparators = (path: string): string => path.replace(/[\\/]+$/u, "");

const credentialRefusal = async (): Promise<{ readonly ok: false; readonly code: string }> => ({
  ok: false,
  code: PROVIDER_FAILURE,
});

const githubInstance = (): ExternalSystemInstance => ({
  instanceName: "vcs-github",
  systemKind: "vcs",
  baseUrl: "https://api.github.com",
  authMethod: {
    mechanism: "credential-reference",
    reference: {
      referenceName: "github-read",
      sourceKey: { style: "literal", name: "GITHUB_TOKEN" },
    },
  },
});

type RepositoryTarget = { readonly owner: string; readonly name: string };

const nativeTransport: NonNullable<GithubClientOptions["transport"]> = {
  send: async (request) => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      ...(request.body === undefined ? {} : { body: request.body }),
    });
    const body: unknown = await response.json();
    return { status: response.status, body };
  },
};

const repositoryTargetOf = (originUrl: string | undefined): RepositoryTarget | undefined => {
  const parsed = parseGitHubRemote(originUrl);
  return parsed.ok ? { owner: parsed.owner, name: parsed.name } : undefined;
};

/** Construction facts the bin passes to the production composer. */
export type ProductionCompositionFacts = {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  readonly homeDirectory: string;
  readonly workingName: string;
  /**
   * The injected harness spawn runner. Production uses the host runner; tests
   * inject a recording runner so composition is proven without a harness process.
   */
  readonly harnessSpawnRunner?: HarnessSpawnRunner;
};

/**
 * Compose the prompt-required program over the delivered adapters.
 *
 * The composed brand is supplied by the entrypoint, so the name seam has one
 * source; only the working name input is repeated for `createConfigProgram`'s
 * own brand check.
 */
export const createProductionComposer = (facts: ProductionCompositionFacts): EntrypointComposer => {
  return (brand: BrandIdentity) => {
    const environment = facts.environment;
    const cwd = facts.cwd;
    const homeDirectory = trimTrailingSeparators(facts.homeDirectory);
    const stateDirectory = `${homeDirectory}/${brand.stateDirectoryName}`;
    const changesDirectory = `${cwd}/doc/changes`;
    const notesFs = nodePmNotesFileSystemFacts();
    const localFs = nodeFileSystemFacts();
    const nowIso = (): string => new Date().toISOString();
    const nowMs = (): number => Date.now();
    const newFenceToken = (): string => globalThis.crypto.randomUUID();
    const workspaceId = "default";

    const store = createStateStore(
      {
        level: "local",
        workspaceId,
        fenceNamespace: "cli",
        schemaVersion: STATE_SCHEMA_VERSION,
        stateDirectory,
      },
      { driver: "jsonl", edge: createNodeStateEdge() },
    );
    const credentials = createProcessCredentialPort(brand);
    const harnessCredentials = createEnvironmentCredentialPort({ environment, brand });
    const instance = githubInstance();
    const transport = nativeTransport;
    const repositoryFacts = readRepositoryFacts({ cwd, io: nodeRepositoryIo() });
    const target = repositoryTargetOf(repositoryFacts.originUrl);
    const dispatchRepository = normalizeRepositoryRemote(repositoryFacts.originUrl);
    const harnessSpawnRunner = facts.harnessSpawnRunner ?? createHostSpawnRunner();
    const clientTarget = target ?? { owner: "unresolved", name: "unresolved" };
    const client = createGitHubClient({
      instance,
      credentials,
      repository: clientTarget,
      transport,
    });
    const pmContextPath = `${cwd}/.ai/local/pm-context.yaml`;

    const statusComposition = () => ({
      store,
      credentials,
      transport,
      repository: { cwd, io: nodeRepositoryIo() },
      localContext: { path: pmContextPath, fs: localFs },
      clock: { nowMs, nowIso },
      github: { instance },
    });
    const noChain = () => ({
      ok: true as const,
      config: { credentials: {}, entries: {}, chains: {} },
    });

    const plan = createPlanCommandRuntime({ changesDirectory, fs: notesFs });
    const readChangeFolder = (changeRef: string): string | undefined =>
      relativeChangeFolder({
        changeRef,
        changesDirectory,
        repoRoot: cwd,
        fs: notesFs,
      });

    const commitOptions = createProductionCommitRuntimeOptions({
      store,
      changesDirectory,
      fs: notesFs,
      cwd,
      phaseCommit: true,
      nowIso,
      newFenceToken,
      readChangeFolder,
    });
    const phaseRuntime = createPhaseCommandRuntime({
      store,
      changesDirectory,
      fs: notesFs,
      writeFile: (file, text) => {
        writeFileSync(file, text);
      },
      nowIso,
      newFenceToken,
      readChangeFolder,
    });
    const phaseExtension = createPhaseCommitExtension(commitOptions);
    const committedPhaseRuntime = { ...phaseRuntime, commit: phaseExtension };

    const lintRuntime = {
      readPmNotes: (changeRef: string) =>
        readPmNotesText({ changeRef, changesDirectory, fs: notesFs }),
      readRegistry: (changeRef: string) => {
        const read = readChangeTransitionsTolerant(store, changeRef);
        if (!read.ok) return { ok: false as const, error: read.error };
        return {
          ok: true as const,
          verifiedEmpty: read.value.verifiedEmpty,
          recordCount: read.value.evidence.recordCount,
          verification: read.value.evidence.verification,
          projection: { present: true },
        };
      },
      readPlan: plan.readPlan,
      parseYaml: plan.parseYaml,
    };

    const queueFacts = {
      plans: {},
      workItems: {},
      ci: {},
      provider: { state: "unavailable" as const, reason: "not-configured" as const },
      close: {},
      deploy: { expectations: {}, verdicts: {} },
    };
    const queueComposition = {
      store,
      facts: queueFacts,
      ...(target === undefined
        ? {}
        : { repositoryBinding: { repository: `${target.owner}/${target.name}` } }),
      nowIso,
      nowMs,
      newFenceToken,
      degraded: ["daemon-unreachable" as const],
      readyRuntime: createStatusCommandRuntime(statusComposition(), noChain),
    };

    const gates = createVerifyGatesCommandRuntime({
      store,
      changesDirectory,
      fs: notesFs,
      repository: { cwd, io: nodeRepositoryIo() },
      workflow: { baseDirectory: cwd, fs: localFs },
      github: { instance, credentials, transport },
      nowMs,
    });

    const merge = createMergeCommandRuntime({
      store,
      git: createGitMergeSeam({ cwd }),
      values: () => ({}),
      readWorkItem: credentialRefusal,
      readCheckRuns: credentialRefusal,
      readRequestDetail: credentialRefusal,
      nowIso,
      nowMs,
      newFenceToken,
    });

    const closeout = createCloseoutComposition({
      workspaceId,
      provider: { kind: "github", client },
      git: createGitBranchSeam({ cwd }),
      store,
      nowIso,
      newFenceToken,
    });

    /** Map the resolved allowlist onto descriptor entries (names and references only). */
    const harnessEnvironmentEntries = (
      settings: HarnessSettings,
    ): readonly HarnessEnvironmentEntry[] =>
      settings.environment.map((entry) =>
        "credentialRef" in entry
          ? {
              kind: "credential" as const,
              name: entry.name,
              reference: {
                referenceName: entry.credentialRef,
                sourceKey: { style: "literal" as const, name: entry.credentialRef },
              },
            }
          : { kind: "variable" as const, name: entry.name },
      );

    /** The bound deny-by-default environment builder over the injected parent environment. */
    const buildHarnessEnvironment: HarnessEnvironmentBuilder = (descriptor) =>
      buildHarnessSpawnEnvironment({
        descriptor,
        parentEnvironment: environment,
        credentials: harnessCredentials,
        record: { DELIVERY_WORK_PATH: descriptor.workDirectory },
      });

    /** Build the delivered session port for one configured kind. */
    const harnessFor = (kind: HarnessKind): HarnessSessionPort => {
      const common = {
        runner: harnessSpawnRunner,
        buildEnvironment: buildHarnessEnvironment,
        classify: classifyHarnessEvidence,
        assembleLiveness: assembleHarnessLiveness,
        now: nowIso,
      };
      return kind === "opencode"
        ? createOpencodeSession({
            ...common,
            command: "opencode",
            spawnArgs: ["run", "--format", "json"],
            resumeArgs: ["run", "--format", "json", "--session"],
            listArgs: ["session", "list", "--format", "json"],
          })
        : createClaudeSession({
            ...common,
            command: "claude",
            headlessArgs: ["--print", "--output-format", "json"],
          });
    };

    const phaseSummary = (changeRef: string): DispatchPhaseLedger => {
      const transitions = readChangeTransitionsTolerant(store, changeRef);
      const completed = transitions.ok
        ? Object.values(foldPhaseState(changeRef, transitions.value.transitions).phases).filter(
            (phase) => phase.completed !== null,
          ).length
        : 0;
      let total = completed;
      let variant: DispatchLedgerVariant = "unknown";
      const artifact = plan.readPlan(changeRef);
      if (artifact.ok) {
        const parsed = plan.parseYaml(artifact.text);
        if (parsed.ok) {
          const phases = (parsed.value as { readonly phases?: unknown }).phases;
          if (Array.isArray(phases)) {
            total = Math.max(phases.length, completed);
            variant = "full";
          }
        }
      }
      return { completed, total, variant };
    };

    /**
     * The production truth read. The phase ledger is read from the state store
     * and plan artifact; the externally-owned sources this composition does not
     * read stay explicitly unreadable rather than fabricated.
     */
    const dispatchTruth = async (changeRef: string): Promise<DispatchTruthReads> => {
      const summary = phaseSummary(changeRef);
      const transitions = readChangeTransitionsTolerant(store, changeRef);
      const ledger: DispatchRead<DispatchLedgerFacts> = transitions.ok
        ? {
            ok: true,
            value: {
              completed: summary.completed,
              total: summary.total,
              progressed: summary.completed > 0,
              workRemaining: summary.completed < summary.total,
            },
          }
        : { ok: false, reason: "ledger", identity: transitions.error.code };
      return {
        artifacts: { ok: false, reason: "artifact", identity: "branch-and-pr-not-read" },
        ledger,
        tracker: { ok: false, reason: "tracker", identity: "tracker-not-read" },
        ci: { ok: false, reason: "state", identity: "ci-not-read" },
        verifyOutcome: null,
        trackerToken: null,
        phasesComplete: summary.total > 0 && summary.completed >= summary.total,
      };
    };

    const dispatchComposition = (
      settings: HarnessSettings,
      repository: string,
    ): DispatchComposition => ({
      store,
      stateRoot: stateDirectory,
      fenceToken: newFenceToken(),
      nowIso,
      newAttemptId: (ref) => `attempt-${ref}-${nowMs()}-${newFenceToken()}`,
      newDivergenceId: (ref) => `DIV-${ref}-${newFenceToken()}`,
      harnesses: { opencode: harnessFor("opencode"), "claude-code": harnessFor("claude-code") },
      defaultHarness: settings.kind,
      descriptor: {
        kind: settings.executionKind,
        workDirectory: cwd,
        environment: harnessEnvironmentEntries(settings),
      },
      prompt: (ref) => `Deliver change ${ref} through the delivery lifecycle.`,
      evidenceClass: DISPATCH_DEFAULT_EVIDENCE_CLASS,
      repository: () => repository,
      readTruth: dispatchTruth,
      claimLease: (ref) => {
        const claimed = claimQueueLease(store, {
          ref,
          holder: "dispatch",
          runner: "dispatch",
          weightClass: "standard",
          nowIso: nowIso(),
          nowMs: nowMs(),
          fenceToken: newFenceToken(),
        });
        return claimed.ok
          ? { ok: true, leaseId: claimed.value.lease.leaseId }
          : { ok: false, code: claimed.code };
      },
      releaseLease: (ref) => {
        const released = releaseQueueLease(store, {
          ref,
          holder: "dispatch",
          nowIso: nowIso(),
          nowMs: nowMs(),
          fenceToken: newFenceToken(),
        });
        return released.ok;
      },
      phaseLedger: phaseSummary,
    });

    /** Resolve the typed harness configuration branch through the delivered resolver. */
    const resolveProductionHarnessSettings = ():
      | { readonly ok: true; readonly settings: HarnessSettings }
      | { readonly ok: false; readonly code: string } => {
      const gitRoot = findGitRoot(cwd, nodeRepositoryIo());
      const acquired = acquireFileConfig({
        platform: runtimePlatform(),
        homeDirectory,
        environment,
        ...(gitRoot === undefined ? {} : { gitRoot }),
        enableSystemConfig: true,
        enableUserConfig: true,
        enableProjectLocalConfig: true,
        configurationDirectoryName: brand.configDirectoryName,
        fs: localFs,
      });
      if (!acquired.ok) return { ok: false, code: acquired.error.code };
      const resolved = resolveConfig({ sources: acquired.sources });
      if (!resolved.ok) return { ok: false, code: resolved.error.code };
      const settings = resolveHarnessSettings(resolved.value.values, resolved.value.origins);
      return settings.ok
        ? { ok: true, settings: settings.value }
        : { ok: false, code: settings.error.code };
    };

    // The dispatch run surface resolves the typed harness settings per
    // invocation, composes both delivered session ports over the host runner,
    // and declares the production evidence class. A configured default path
    // spawns; an invalid configuration is its delivered classified error.
    const dispatch: DispatchCommandRuntime = {
      run: {
        run: async (input) => {
          const resolution = resolveProductionHarnessSettings();
          if (!resolution.ok) {
            return {
              ok: false,
              error: {
                kind: "input",
                code: resolution.code,
                summary: `harness configuration rejected (${resolution.code})`,
              },
            };
          }
          if (dispatchRepository === undefined) {
            return {
              ok: false,
              error: {
                kind: "input",
                code: "input.value.rejected",
                summary: "repository identity is unresolvable",
              },
            };
          }
          return createDispatchCommandRuntime(
            dispatchComposition(resolution.settings, dispatchRepository),
          ).run.run(input);
        },
      },
    };

    const configured: ConfigProgramOptions = {
      workingName: facts.workingName,
      environment,
      cwd,
      homeDirectory,
      lint: lintRuntime,
      plan: { changesDirectory, fs: notesFs, readDiff: plan.readDiff },
      phase: committedPhaseRuntime,
      commit: commitOptions,
      status: statusComposition(),
      brief: statusComposition(),
      queueReady: statusComposition(),
      queue: queueComposition,
      lanes: queueComposition,
      blockers: {
        store,
        clock: { nowMs, nowIso },
        newFenceToken,
      },
      dispatch,
      verify: {
        ...createVerifyCommandRuntime({
          store,
          changesDirectory,
          fs: notesFs,
        }),
        gates,
        deploy: createVerifyDeployCommandRuntime({
          resolve: async () => ({ ok: false, kind: "no-target" }),
          github: {
            instance,
            credentials,
            transport,
            repository: clientTarget,
          },
        }),
      },
      merge,
      closeout,
      spend: {
        store,
        localContext: { path: pmContextPath, fs: localFs },
      },
      retro: {
        store,
        stateDirectory,
        workspaceId,
        changesDirectory,
        fs: notesFs,
        clock: { nowMs, nowIso },
        newRunId: () => globalThis.crypto.randomUUID(),
        newTraceId: () => globalThis.crypto.randomUUID(),
        newFenceToken,
      },
    };

    const program = createConfigProgram(configured);
    if (!program.ok) {
      throw new Error(`brand resolution failed: ${program.error.field}:${program.error.code}`);
    }
    return program.program;
  };
};
