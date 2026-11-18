/**
 * The production merge-composition harness (GH-293 TC-ENGINE-050..053).
 *
 * One real temp checkout per fixture (`main-tools` plus a feature branch with one
 * commit), one distinct home, and the real `createProductionComposer` program.
 * Only external I/O is injected: the recording GitHub transport, the credential
 * port, the configuration filesystem, the harness spawn seams, and an optional
 * state-store wrapper for append faults. Every provider read is real code; the
 * bytes are synthetic.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type {
  BrandIdentity,
  CredentialPort,
  HarnessSpawnRunner,
  HarnessSpawnRunnerResult,
  StateStorePort,
} from "../../../packages/core/src/contracts/index";
import {
  createNodeStateEdge,
  createStateStore,
  STATE_SCHEMA_VERSION,
} from "../../../packages/core/src/state/index";
import { projectScopeFor } from "../projects/state-scope";
import { type CliStreams, runCli } from "../../../packages/cli/src/index";
import { createProductionComposer } from "../../../packages/cli/src/production";
import type { FileSystemFacts } from "../../../packages/adapters/src/file/config";
import { streamStarterFromRunner } from "../harness/stream";
import {
  brandOf,
  createHostFixture,
  stateOverrideVariable,
  type HostFixture,
} from "../projects/state-scope";
import { createRepository, git, removeDirectory } from "../projects/temp-repos";

export const MERGE_PROD_REF = "GH-293";
export const MERGE_PROD_BRANCH = "feat/GH-293/engine-first-operations";
export const MERGE_PROD_BASE = "main-tools";
export const MERGE_PROD_OWNER = "owner";
export const MERGE_PROD_REPOSITORY = `github.com/${MERGE_PROD_OWNER}/engine-first-merge`;

export type MergeProductionRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope?: Record<string, unknown>;
};

export type MergeProviderReply =
  | { readonly status: number; readonly body: unknown }
  | { readonly throw: true };

export type MergeProductionHarnessOptions = {
  readonly label: string;
  /** The credential port's outcome; `missing` is the declared refusal. */
  readonly credential?: "resolved" | "missing";
  /** A project-committed configuration document, or none. */
  readonly configYaml?: string;
  /** Per-URL provider reply; the default answers a healthy dry run. */
  readonly reply?: (url: string) => MergeProviderReply;
  /** Wrap the main state store (targeted append faults). */
  readonly stateStoreWrap?: (store: StateStorePort) => StateStorePort;
  /** The clock the composed program reads; defaults to a fixed instant. */
  readonly clockIso?: () => string;
};

export type MergeProductionHarness = {
  readonly brand: BrandIdentity;
  readonly host: HostFixture;
  readonly checkout: string;
  readonly ref: string;
  readonly branch: string;
  readonly headSha: string;
  readonly stateLocation: string;
  readonly store: StateStorePort;
  readonly transportCalls: readonly string[];
  readonly credentialReads: () => number;
  /** Replace the provider reply between invocations (one fixture, two phases). */
  setReply: (reply: (url: string) => MergeProviderReply) => void;
  /** Replace the credential port's outcome between invocations. */
  setCredential: (credential: "resolved" | "missing") => void;
  setClock: (clock: () => string) => void;
  run: (argv: readonly string[]) => Promise<MergeProductionRun>;
  dispose: () => void;
};

const resolvingCredentials = (counter: { value: number }): CredentialPort => ({
  resolve: () => {
    counter.value += 1;
    return { ok: true, material: { value: "synthetic-merge-read" } };
  },
});

const refusingCredentials = (counter: { value: number }): CredentialPort => ({
  resolve: () => {
    counter.value += 1;
    return {
      ok: false,
      code: "config.credential.missing",
      domainKind: "config",
      category: "user",
      retryable: false,
      consequence: "not_landed",
      projectionClass: "user-validation",
    };
  },
});

const shaOf = (value: string): string => value.trim();

/** The healthy reply set: a work item, a green check page, and one open request. */
const healthyReply =
  (input: {
    readonly headSha: string;
    readonly branch: string;
    readonly checkConclusion?: "success" | "failure";
  }): ((url: string) => MergeProviderReply) =>
  (url) => {
    if (url.includes("/issues/")) {
      return {
        status: 200,
        body: { number: 293, title: "Engine-first operations", state: "open", labels: [] },
      };
    }
    if (url.includes("/check-runs")) {
      return {
        status: 200,
        body: {
          check_runs: [
            {
              id: 7001,
              name: "CI / test",
              status: "completed",
              conclusion: input.checkConclusion ?? "success",
            },
          ],
        },
      };
    }
    if (url.includes("/pulls?")) {
      return {
        status: 200,
        body: [
          {
            number: 301,
            state: "open",
            head: { ref: input.branch, sha: input.headSha },
            base: { ref: MERGE_PROD_BASE },
            commits: 1,
            changed_files: 1,
            mergeable: true,
          },
        ],
      };
    }
    if (url.includes("/graphql")) return { status: 200, body: { data: {} } };
    return { status: 404, body: {} };
  };

/** Build one real checkout with `main-tools` and a one-commit feature branch. */
const buildCheckout = (base: string): { readonly root: string; readonly headSha: string } => {
  const root = createRepository(base, "checkout");
  git(root, ["checkout", "-b", MERGE_PROD_BASE]);
  git(root, [
    "remote",
    "add",
    "origin",
    `https://github.com/${MERGE_PROD_OWNER}/engine-first-merge.git`,
  ]);
  git(root, ["checkout", "-b", MERGE_PROD_BRANCH]);
  // A second commit on the feature branch, so the branch is ahead of the base.
  git(root, ["commit", "--allow-empty", "-m", "feat: fixture work"]);
  const headSha = shaOf(git(root, ["rev-parse", "HEAD"]));
  git(root, ["branch", "-f", MERGE_PROD_BASE, "HEAD~1"]);
  return { root, headSha };
};

export const createMergeProductionHarness = (
  options: MergeProductionHarnessOptions,
): MergeProductionHarness => {
  const brand = brandOf();
  const host = createHostFixture(options.label);
  const base = `${host.hostRoot}-merge-prod`;
  const checkout = buildCheckout(base);
  const counter = { value: 0 };
  const transportCalls: string[] = [];
  const spawnRunner: HarnessSpawnRunner = async (): Promise<HarnessSpawnRunnerResult> => ({
    stdout: JSON.stringify({ session: { id: "ses-gh293" }, result: { completion: "complete" } }),
    stderr: "",
    status: 0,
    timedOut: false,
  });
  const scope = projectScopeFor({
    cwd: checkout.root,
    hostRoot: host.hostRoot,
    home: host.home,
    brand,
  });
  if (scope.scope.kind !== "project") throw new Error("the merge fixture is not a project scope");
  const stateLocation = scope.scope.stateLocation;
  const opened = createStateStore(
    {
      level: "local",
      workspaceId: "default",
      fenceNamespace: "cli",
      schemaVersion: STATE_SCHEMA_VERSION,
      stateDirectory: stateLocation,
    },
    { driver: "jsonl", edge: createNodeStateEdge() },
  );
  const store = options.stateStoreWrap?.(opened) ?? opened;
  let reply =
    options.reply ??
    healthyReply({
      headSha: checkout.headSha,
      branch: MERGE_PROD_BRANCH,
    });
  let clockIso = options.clockIso ?? (() => "2026-11-18T10:00:00.000Z");
  let credentialMode: "resolved" | "missing" = options.credential ?? "resolved";
  const configurationFs: FileSystemFacts = {
    exists: (path) => options.configYaml !== undefined && path.endsWith("config.yaml"),
    readText: () => options.configYaml ?? "",
  };
  const composeProgram = () => {
    const composer = createProductionComposer({
      harnessVersionProbe: async () => ({ status: "answered" as const, stdout: "opencode v2.3.2" }),
      environment: {
        HOME: host.home,
        PATH: "/synthetic/bin",
        [stateOverrideVariable(brand)]: host.hostRoot,
        // Deliberately no token: a real credential read would fail, so the
        // injected port is the only source (TC-ENGINE-050).
      },
      cwd: checkout.root,
      homeDirectory: host.home,
      workingName: "delivery-os",
      repositoryFacts: {
        originUrl: MERGE_PROD_REPOSITORY.replace("github.com", "https://github.com"),
      },
      harnessSpawnRunner: spawnRunner,
      harnessSpawnStarter: streamStarterFromRunner(spawnRunner),
      credentials:
        credentialMode === "missing" ? refusingCredentials(counter) : resolvingCredentials(counter),
      githubTransport: {
        send: async (request) => {
          transportCalls.push(request.url);
          const result = reply(request.url);
          if ("throw" in result) throw new Error("synthetic transport failure");
          return { status: result.status, body: result.body };
        },
      },
      configurationFs,
      ...(options.stateStoreWrap === undefined ? {} : { stateStoreWrap: options.stateStoreWrap }),
    });
    return composer(brand);
  };
  let ordinal = 0;
  const run = async (argv: readonly string[]): Promise<MergeProductionRun> => {
    const out: string[] = [];
    const err: string[] = [];
    const streams: CliStreams = {
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: (chunk: string) => err.push(chunk) },
    };
    ordinal += 1;
    const exitCode = await runCli(argv, streams, {
      brand,
      clock: { now: () => Date.parse(clockIso()) },
      newRunId: () => `run-gh293-merge-${String(ordinal)}`,
      secrets: [],
      program: composeProgram(),
    });
    const stdout = out.join("");
    const stderr = err.join("");
    const trimmed = stdout.trim();
    return {
      exitCode,
      stdout,
      stderr,
      ...(trimmed.startsWith("{") && trimmed.endsWith("}")
        ? { envelope: JSON.parse(trimmed) as Record<string, unknown> }
        : {}),
    };
  };
  return {
    brand,
    host,
    checkout: checkout.root,
    ref: MERGE_PROD_REF,
    branch: MERGE_PROD_BRANCH,
    headSha: checkout.headSha,
    stateLocation,
    store,
    transportCalls,
    credentialReads: () => counter.value,
    setReply: (next) => {
      reply = next;
    },
    setClock: (next) => {
      clockIso = next;
    },
    setCredential: (next) => {
      credentialMode = next;
    },
    run,
    dispose: () => {
      removeDirectory(base);
      host.dispose();
    },
  };
};

/** A digest of one file's bytes, for the "nothing landed" assertions. */
export const digestOf = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
