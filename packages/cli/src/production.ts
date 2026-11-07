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
import { createProcessCredentialPort } from "@delivery-os/adapters/credentials";
import {
  nodeFileSystemFacts,
  nodePmNotesFileSystemFacts,
  readPmNotesText,
} from "@delivery-os/adapters/file";
import { createGitBranchSeam, createGitMergeSeam } from "@delivery-os/adapters/git";
import { createGitHubClient, type GithubClientOptions } from "@delivery-os/adapters/github";
import {
  nodeRepositoryIo,
  parseGitHubRemote,
  readRepositoryFacts,
} from "@delivery-os/adapters/repo";
import type { BrandIdentity, ExternalSystemInstance } from "@delivery-os/core/contracts";
import {
  createNodeStateEdge,
  createStateStore,
  readChangeTransitionsTolerant,
  STATE_SCHEMA_VERSION,
} from "@delivery-os/core/state";
import {
  type ConfigProgramOptions,
  createCloseoutComposition,
  createConfigProgram,
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

const repositoryTargetOf = (cwd: string): RepositoryTarget | undefined => {
  const facts = readRepositoryFacts({ cwd, io: nodeRepositoryIo() });
  const parsed = parseGitHubRemote(facts.originUrl);
  return parsed.ok ? { owner: parsed.owner, name: parsed.name } : undefined;
};

/** Construction facts the bin passes to the production composer. */
export type ProductionCompositionFacts = {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  readonly homeDirectory: string;
  readonly workingName: string;
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
    const instance = githubInstance();
    const transport = nativeTransport;
    const target = repositoryTargetOf(cwd);
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

    const commitOptions = createProductionCommitRuntimeOptions({
      store,
      changesDirectory,
      fs: notesFs,
      cwd,
      environment,
      sessionEnvironmentKeys: [],
      phaseCommit: true,
      nowIso,
      newFenceToken,
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
