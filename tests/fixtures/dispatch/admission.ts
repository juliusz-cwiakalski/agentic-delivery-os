/**
 * The production-composed admission harness (GH-279).
 *
 * Exercises the real production composer (including the real preflight at the
 * composition boundary) over a temporary checkout and state root, with only the
 * credential port, the provider transport, and the harness runner injected. No
 * test touches the network, a real harness, or the live state directory.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type CliStreams, runCli } from "../../../packages/cli/src/index";
import { createProductionComposer } from "../../../packages/cli/src/production";
import {
  readDispatchAttempts,
  readDispatchDivergences,
  readDispatchHandover,
} from "../../../packages/core/src/app/dispatch-ledger";
import { declareQueueEntry } from "../../../packages/core/src/app/queue";
import { resolveBrandIdentity } from "../../../packages/core/src/branding/index";
import {
  type BrandIdentity,
  type CredentialPort,
  type DispatchAttemptRecord,
  type DispatchEnvelopeData,
  type ExternalSystemInstance,
  type HarnessSpawnRunner,
  type HarnessSpawnRunnerResult,
  type StateStorePort,
} from "../../../packages/core/src/contracts/index";
import {
  createNodeStateEdge,
  createStateStore,
  STATE_SCHEMA_VERSION,
} from "../../../packages/core/src/state/index";
import { streamStarterFromRunner } from "../harness/harness-io";

const ROOT = process.cwd();
const GITHUB_ORIGIN = "https://github.com/owner/repo.git";

/** The planted credential value; never a real or realistic token. */
export const ADMISSION_CANARY = "planted-gh279-canary-value";

export const ADMISSION_REPOSITORY = "github.com/owner/repo";

export const ADMISSION_OPEN_ISSUE = {
  number: 301,
  title: "Admission preflight",
  state: "open",
  labels: [],
} as const;

export type TransportResponse = { readonly status: number; readonly body: unknown };

export type AdmissionTransport = {
  readonly send: (request: {
    readonly url: string;
    readonly method: string;
  }) => Promise<TransportResponse>;
};

export type AdmissionHarnessOptions = {
  readonly label?: string;
  readonly ref?: string;
  readonly credential?: "resolved" | "missing";
  readonly environment?: Readonly<Record<string, string | undefined>>;
  /** The provider transport; the default answers one readable issue and no PRs. */
  readonly transport?: AdmissionTransport;
  readonly originUrl?: string;
  readonly secrets?: readonly string[];
  readonly githubInstance?: ExternalSystemInstance;
};

export type AdmissionObservation = {
  readonly exit: number;
  readonly envelope?: {
    readonly exitCode: number;
    readonly data?: DispatchEnvelopeData;
    readonly error?: {
      readonly code: string;
      readonly category: string;
      readonly retryable: boolean;
      readonly consequence: string;
      readonly remediationHint: string;
      readonly summary?: string;
    };
  };
  readonly stdout: string;
  readonly stderr: string;
  readonly requests: readonly string[];
  readonly spawns: number;
  readonly resumes: number;
  readonly credentialResolutions: number;
  readonly leaseRecords: number;
  readonly attempts: readonly DispatchAttemptRecord[];
  readonly divergences: number;
  readonly handovers: number;
};

export type AdmissionHarness = {
  readonly brand: BrandIdentity;
  readonly home: string;
  readonly checkout: string;
  readonly store: StateStorePort;
  readonly run: (argv?: readonly string[]) => Promise<AdmissionObservation>;
  readonly dispose: () => void;
};

const resolveBrand = (): BrandIdentity => {
  const resolved = resolveBrandIdentity({ workingName: "delivery-os" });
  if (!resolved.ok) throw new Error("brand resolution failed");
  return resolved.value;
};

const createCheckout = (parent: string, name: string, originUrl: string): string => {
  const directory = join(parent, name);
  mkdirSync(join(directory, ".git"), { recursive: true });
  writeFileSync(join(directory, ".git", "config"), `[remote "origin"]\n\turl = ${originUrl}\n`);
  return directory;
};

const credentialPort = (mode: "resolved" | "missing"): CredentialPort => ({
  resolve: () =>
    mode === "missing"
      ? {
          ok: false,
          code: "config.credential.missing",
          domainKind: "config",
          category: "user",
          retryable: false,
          consequence: "not_landed",
          projectionClass: "user-validation",
        }
      : { ok: true, material: { value: ADMISSION_CANARY } },
});

/** The default transport: a readable issue plus an empty pull list. */
export const readableAdmissionTransport = (input: {
  readonly requests?: string[];
  readonly issue?: unknown;
  readonly pullLists?: unknown;
}): AdmissionTransport => ({
  send: async (request) => {
    input.requests?.push(request.url);
    if (request.url.includes("/issues")) {
      return { status: 200, body: input.issue ?? ADMISSION_OPEN_ISSUE };
    }
    if (request.url.includes("/pulls?")) {
      return { status: 200, body: input.pullLists ?? [] };
    }
    return { status: 404, body: {} };
  },
});

/** A transport that fails a named work-item read with one scripted response. */
export const scriptedIssueTransport = (input: {
  readonly requests?: string[];
  readonly issueNumber?: number;
  readonly response: () => Promise<TransportResponse>;
}): AdmissionTransport => ({
  send: async (request) => {
    input.requests?.push(request.url);
    if (
      input.issueNumber !== undefined &&
      request.url.includes(`/issues/${input.issueNumber}`)
    ) {
      return input.response();
    }
    if (request.url.includes("/issues/")) {
      return { status: 200, body: ADMISSION_OPEN_ISSUE };
    }
    if (request.url.includes("/pulls?")) return { status: 200, body: [] };
    return { status: 404, body: {} };
  },
});

const completedRunner = (): HarnessSpawnRunner => async (): Promise<HarnessSpawnRunnerResult> => ({
  stdout: JSON.stringify({
    session: { id: "ses-admission" },
    result: { completion: "complete" },
  }),
  stderr: "",
  status: 0,
  timedOut: false,
});

/** Compose one production dispatch program over the injected seams. */
export const createAdmissionHarness = (
  options: AdmissionHarnessOptions = {},
): AdmissionHarness => {
  const brand = resolveBrand();
  const base = join(ROOT, "tmp", "tmpdir");
  mkdirSync(base, { recursive: true });
  const home = mkdtempSync(join(base, options.label ?? "gh279-admission-"));
  const checkout = createCheckout(home, "checkout", options.originUrl ?? GITHUB_ORIGIN);
  const store = createStateStore(
    {
      level: "local",
      workspaceId: "default",
      fenceNamespace: "cli",
      schemaVersion: STATE_SCHEMA_VERSION,
      stateDirectory: join(home, brand.stateDirectoryName),
    },
    { driver: "jsonl", edge: createNodeStateEdge() },
  );
  const ref = options.ref ?? "GH-301";
  const seeded = declareQueueEntry(store, {
    ref,
    repository: ADMISSION_REPOSITORY,
    repositoryRoot: ROOT,
    recordedAt: new Date().toISOString(),
    fenceToken: "seed-fence",
  });
  if (!seeded.ok) throw new Error("queue seeding failed");

  const requests: string[] = [];
  const baseTransport = options.transport ?? readableAdmissionTransport({ requests });
  const transport: AdmissionTransport = {
    send: async (request) => {
      if (options.transport === undefined) return baseTransport.send(request);
      requests.push(request.url);
      return baseTransport.send(request);
    },
  };

  let credentialResolutions = 0;
  const mode = options.credential ?? "resolved";
  const countedCredentials: CredentialPort = {
    resolve: (reference) => {
      credentialResolutions += 1;
      return credentialPort(mode).resolve(reference);
    },
  };

  let spawns = 0;
  let resumes = 0;
  const runner: HarnessSpawnRunner = async (file, args, runnerOptions) => {
    spawns += 1;
    if (args.includes("--resume")) resumes += 1;
    return completedRunner()(file, args, runnerOptions);
  };

  const program = createProductionComposer({
    environment: {
      HOME: home,
      HARNESS_MODEL: "synthetic/model-large",
      HARNESS_SMALL_MODEL: "synthetic/model-small",
      ...(options.environment ?? {}),
    },
    cwd: checkout,
    homeDirectory: home,
    workingName: "delivery-os",
    repositoryFacts: { originUrl: options.originUrl ?? GITHUB_ORIGIN },
    harnessSpawnRunner: runner,
    harnessSpawnStarter: streamStarterFromRunner(runner),
    credentials: countedCredentials,
    githubTransport: transport,
    ...(options.githubInstance === undefined ? {} : { githubInstance: options.githubInstance }),
    gitChildRunner: async (_file, args) => {
      if (args[0] === "for-each-ref") return { stdout: "", stderr: "", status: 0, timedOut: false };
      if (args[0] === "rev-list") return { stdout: "0", stderr: "", status: 0, timedOut: false };
      return { stdout: "", stderr: "", status: 1, timedOut: false };
    },
  })(brand);

  const run = async (argv: readonly string[] = ["dispatch", ref, "--json"]) => {
    const out: string[] = [];
    const err: string[] = [];
    const streams: CliStreams = {
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: (chunk: string) => err.push(chunk) },
    };
    const exit = await runCli(argv, streams, {
      brand,
      clock: { now: () => Date.parse("2026-11-08T10:00:00.000Z") },
      newRunId: () => "run-admission",
      secrets: options.secrets ?? [],
      program,
    });
    const stdout = out.join("");
    const stderr = err.join("");
    const envelope = stdout.trim().startsWith("{")
      ? (JSON.parse(stdout) as AdmissionObservation["envelope"])
      : undefined;
    const attempts = readDispatchAttempts(store);
    const divergences = readDispatchDivergences(store);
    const handovers = readDispatchHandover(store);
    const records = store.readRecords();
    return {
      exit,
      ...(envelope === undefined ? {} : { envelope }),
      stdout,
      stderr,
      requests,
      spawns,
      resumes,
      credentialResolutions,
      leaseRecords: records.ok
        ? records.value.records.filter((record) => record.kind === "queue.lease").length
        : -1,
      attempts: attempts.ok ? attempts.records : [],
      divergences: divergences.ok ? divergences.records.length : -1,
      handovers: handovers.ok ? handovers.records.length : -1,
    };
  };

  return {
    brand,
    home,
    checkout,
    store,
    run,
    dispose: () => rmSync(home, { recursive: true, force: true }),
  };
};

/** Compose, run one dispatch, and dispose the temp root. */
export const runAdmission = async (
  options: AdmissionHarnessOptions,
  argv?: readonly string[],
): Promise<AdmissionObservation> => {
  const harness = createAdmissionHarness(options);
  try {
    return await harness.run(argv);
  } finally {
    harness.dispose();
  }
};
