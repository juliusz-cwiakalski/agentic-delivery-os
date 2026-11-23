/**
 * The production verify-gates composition harness (GH-388 TC-VGATES-071/072,
 * TC-MERGE-040/041).
 *
 * One real temp checkout per fixture (`main-tools` plus the change branch with
 * one commit carrying its complete pm-notes), one distinct home, and the real
 * `createProductionComposer` program. Only external I/O is injected: the
 * recording GitHub transport, the credential port, the configuration
 * filesystem, the harness spawn seams, and an optional state-store wrapper for
 * append faults. Every provider read is real code; the bytes are synthetic.
 * The no-network guard is installed by the caller per arm (the delivered
 * TC-ENGINE pattern). Both `verify gates` and `merge` run through this one
 * composer against this one state store, so the native sequence is exercisable
 * end to end.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FileSystemFacts } from "../../../packages/adapters/src/file/config";
import { nodeFileSystemFacts } from "../../../packages/adapters/src/file/index";
import { type CliStreams, runCli } from "../../../packages/cli/src/index";
import { createProductionComposer } from "../../../packages/cli/src/production";
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
import { streamStarterFromRunner } from "../harness/stream";
import {
  brandOf,
  createHostFixture,
  type HostFixture,
  projectScopeFor,
  stateOverrideVariable,
} from "../projects/state-scope";
import { createRepository, git, removeDirectory } from "../projects/temp-repos";

export const VG_PROD_REF = "GH-388";
export const VG_PROD_BRANCH = "fix/GH-388/verify-gates-persistence";
export const VG_PROD_BASE = "main-tools";
export const VG_PROD_OWNER = "owner";
export const VG_PROD_REPOSITORY = `github.com/${VG_PROD_OWNER}/verify-gates-persistence`;
/** The CI workflow job names the checkout declares and the provider page answers. */
export const VG_PROD_JOBS = ["CI / test", "CI / lint"] as const;

export type VerifyGatesProductionRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope?: Record<string, unknown>;
};

/** One recorded outbound provider request (method, url, serialized body). */
export type VerifyGatesTransportRequest = {
  readonly method: string;
  readonly url: string;
  readonly body?: string;
};

export type VerifyGatesProviderReply =
  | { readonly status: number; readonly body: unknown }
  | { readonly throw: true };

export type VerifyGatesProductionHarnessOptions = {
  readonly label: string;
  /** The credential port's outcome; `missing` is the declared refusal. */
  readonly credential?: "resolved" | "missing";
  /** A project-committed configuration document, or none. */
  readonly configYaml?: string;
  /** Per-URL provider reply; the default answers the clean-PR posture. */
  readonly reply?: (url: string) => VerifyGatesProviderReply;
  /** Wrap the main state store (targeted append faults). */
  readonly stateStoreWrap?: (store: StateStorePort) => StateStorePort;
  /** The clock the composed program reads; defaults to a fixed instant. */
  readonly clockIso?: () => string;
};

export type VerifyGatesProductionHarness = {
  readonly brand: BrandIdentity;
  readonly host: HostFixture;
  readonly checkout: string;
  readonly ref: string;
  readonly branch: string;
  readonly headSha: string;
  readonly stateLocation: string;
  readonly store: StateStorePort;
  readonly transportCalls: readonly string[];
  /** Every outbound request, with its method and serialized body. */
  readonly transportRequests: readonly VerifyGatesTransportRequest[];
  readonly credentialReads: () => number;
  /** Every composed invocation's argv, in order (the no-dry-run evidence). */
  readonly invocations: readonly (readonly string[])[];
  /** Replace the provider reply between invocations (one fixture, two phases). */
  setReply: (reply: (url: string) => VerifyGatesProviderReply) => void;
  /** The composed clean-PR reply the fixture started from. */
  readonly defaultReply: (url: string) => VerifyGatesProviderReply;
  /** Replace the credential port's outcome between invocations. */
  setCredential: (credential: "resolved" | "missing") => void;
  setClock: (clock: () => string) => void;
  run: (argv: readonly string[]) => Promise<VerifyGatesProductionRun>;
  dispose: () => void;
};

const resolvingCredentials = (counter: { value: number }): CredentialPort => ({
  resolve: () => {
    counter.value += 1;
    return { ok: true, material: { value: "synthetic-verify-gates-read" } };
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

/**
 * The clean-PR reply set: open non-draft mergeable request targeting the
 * integration base, a green check-run page over the branch tip, resolved
 * request detail, and a work item without owner-attention labels. The request
 * read is stateful across one landing: BEFORE the provider landing
 * (`PUT .../merge`) the single-request read serves the OPEN request; AFTER the
 * landing the read-back serves the merged shape.
 */
const cleanPrReply = (input: {
  readonly branch: string;
  readonly headSha: string;
  readonly checkConclusion?: "success" | "failure";
}): ((url: string) => VerifyGatesProviderReply) => {
  let landed = false;
  return (url) => {
    if (url.includes("/issues/")) {
      const number = Number(url.match(/issues\/(\d+)/u)?.[1] ?? 0);
      return {
        status: 200,
        body: {
          number,
          title: "Verify gates persistence",
          state: "open",
          labels: [],
          updated_at: "2026-11-23T09:00:00Z",
        },
      };
    }
    if (url.includes("/check-runs")) {
      return {
        status: 200,
        body: {
          check_runs: VG_PROD_JOBS.map((name, index) => ({
            id: 8001 + index,
            name,
            status: "completed",
            conclusion: input.checkConclusion ?? "success",
          })),
        },
      };
    }
    if (url.includes("/pulls?")) {
      return {
        status: 200,
        body: [
          {
            number: 388,
            state: "open",
            head: { ref: input.branch, sha: input.headSha },
            base: { ref: VG_PROD_BASE },
            commits: 1,
            changed_files: 1,
          },
        ],
      };
    }
    if (url.includes("/graphql")) return { status: 200, body: { data: {} } };
    if (url.endsWith("/merge")) {
      landed = true;
      // The provider landing reply carries the squash SHA (the adapter reads
      // `sha` from the PUT body; the read-back is the already-merged path).
      return {
        status: 200,
        body: { merged: true, sha: "c1d2e3f4a5b60718293a4b5c6d7e8f9012345678" },
      };
    }
    if (url.includes("/pulls/")) {
      if (landed) {
        return {
          status: 200,
          body: {
            number: 388,
            state: "closed",
            merged_at: "2026-11-23T09:30:00Z",
            merged: true,
            head: { ref: input.branch, sha: input.headSha },
            base: { ref: VG_PROD_BASE },
            merge_commit_sha: "c1d2e3f4a5b60718293a4b5c6d7e8f9012345678",
          },
        };
      }
      // The landing decision's mergeability read (LF-1): the OPEN request with
      // its provider-asserted mergeability facts.
      return {
        status: 200,
        body: {
          number: 388,
          state: "open",
          draft: false,
          head: { ref: input.branch, sha: input.headSha },
          base: { ref: VG_PROD_BASE },
          commits: 1,
          changed_files: 1,
          mergeable: true,
          mergeable_state: "clean",
        },
      };
      return {
        status: 200,
        body: {
          number: 388,
          state: "open",
          draft: false,
          head: { ref: input.branch, sha: input.headSha },
          base: { ref: VG_PROD_BASE },
          commits: 1,
          changed_files: 1,
          mergeable: true,
          mergeable_state: "clean",
        },
      };
    }
    return { status: 404, body: {} };
  };
};

/**
 * The complete pm-notes document for the fixture ref: the delivered
 * complete-base classification fixture's 11-phase shape, re-identified for the
 * harness ref, carrying the branch declaration the change-branch resolution
 * reads at the head. Undeclared top-level keys stay opaque, so the added
 * `branch:` member never disturbs the lifecycle classification.
 */
const pmNotesForRef = (): string => {
  const base = readFileSync(
    join(process.cwd(), "tests/fixtures/verify/classification/full/base-complete.yaml"),
    "utf8",
  );
  return `${base.replace("change_id: GH-177", `change_id: ${VG_PROD_REF}`)}branch: ${VG_PROD_BRANCH}\n`;
};

/** Build one real checkout with `main-tools` and the change branch at head H. */
const buildCheckout = (base: string): { readonly root: string; readonly headSha: string } => {
  const root = createRepository(base, "checkout");
  git(root, ["checkout", "-b", VG_PROD_BASE]);
  git(root, [
    "remote",
    "add",
    "origin",
    `https://github.com/${VG_PROD_OWNER}/verify-gates-persistence.git`,
  ]);
  // The repository-declared CI workflow the battery's ci-green read consumes:
  // the workflow's job names are the expected check set on the fixture page,
  // and every job is green there.
  const workflowDirectory = join(root, ".github/workflows");
  mkdirSync(workflowDirectory, { recursive: true });
  writeFileSync(
    join(workflowDirectory, "ci.yml"),
    ["jobs:", ...VG_PROD_JOBS.map((name) => `  '${name}':\n    steps: [echo]`), ""].join("\n"),
    "utf8",
  );
  git(root, ["add", "-A"]);
  git(root, ["commit", "-m", "chore: seed the CI workflow"]);
  git(root, ["checkout", "-B", VG_PROD_BRANCH, VG_PROD_BASE]);
  git(root, ["commit", "--allow-empty", "-m", `feat: fixture work (${VG_PROD_REF})`]);
  // The complete pm-notes document is committed ON THE CHANGE BRANCH and stays
  // in the working tree (the checkout remains on the branch): the lifecycle
  // gate reads the working tree through the composition's changes directory,
  // and the merge resolution reads the same bytes at the request head.
  const recordDirectory = join(
    root,
    `doc/changes/2026-11/2026-11-23--${VG_PROD_REF}--verify-gates-persistence`,
  );
  mkdirSync(recordDirectory, { recursive: true });
  writeFileSync(join(recordDirectory, `chg-${VG_PROD_REF}-pm-notes.yaml`), pmNotesForRef(), "utf8");
  git(root, ["add", "doc/changes"]);
  git(root, ["commit", "-m", `docs(${VG_PROD_REF}): declare the change branch`]);
  const headSha = git(root, ["rev-parse", "HEAD"]).trim();
  return { root, headSha };
};

export const createVerifyGatesProductionHarness = (
  options: VerifyGatesProductionHarnessOptions,
): VerifyGatesProductionHarness => {
  const brand = brandOf();
  const host = createHostFixture(options.label);
  const base = `${host.hostRoot}-vg-prod`;
  const checkout = buildCheckout(base);
  const counter = { value: 0 };
  const transportCalls: string[] = [];
  const transportRequests: VerifyGatesTransportRequest[] = [];
  const invocations: string[][] = [];
  const spawnRunner: HarnessSpawnRunner = async (): Promise<HarnessSpawnRunnerResult> => ({
    stdout: JSON.stringify({ session: { id: "ses-gh388" }, result: { completion: "complete" } }),
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
  if (scope.scope.kind !== "project") {
    throw new Error("the verify-gates fixture is not a project scope");
  }
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
  const defaultReply = cleanPrReply({ branch: VG_PROD_BRANCH, headSha: checkout.headSha });
  let reply = options.reply ?? defaultReply;
  let clockIso = options.clockIso ?? (() => "2026-11-23T10:00:00.000Z");
  let credentialMode: "resolved" | "missing" = options.credential ?? "resolved";
  // The configuration sandbox intercepts only the configuration document;
  // every other path (the declared CI workflow read included) falls through to
  // the node filesystem so the delivered read sees the real checkout.
  const nodeFs = nodeFileSystemFacts();
  const configurationFs: FileSystemFacts = {
    exists: (path) =>
      path.endsWith("config.yaml") ? options.configYaml !== undefined : nodeFs.exists(path),
    readText: (path) =>
      path.endsWith("config.yaml") ? (options.configYaml ?? "") : nodeFs.readText(path),
    ...(nodeFs.listDirectory === undefined ? {} : { listDirectory: nodeFs.listDirectory }),
  };
  const composeProgram = () => {
    const composer = createProductionComposer({
      harnessVersionProbe: async () => ({ status: "answered" as const, stdout: "opencode v2.3.2" }),
      environment: {
        HOME: host.home,
        PATH: "/synthetic/bin",
        [stateOverrideVariable(brand)]: host.hostRoot,
        // Deliberately no token: a real credential read would fail, so the
        // injected port is the only source (the delivered TC-ENGINE pattern).
      },
      cwd: checkout.root,
      homeDirectory: host.home,
      workingName: "delivery-os",
      repositoryFacts: {
        originUrl: VG_PROD_REPOSITORY.replace("github.com", "https://github.com"),
      },
      harnessSpawnRunner: spawnRunner,
      harnessSpawnStarter: streamStarterFromRunner(spawnRunner),
      credentials:
        credentialMode === "missing" ? refusingCredentials(counter) : resolvingCredentials(counter),
      githubTransport: {
        send: async (request) => {
          transportCalls.push(request.url);
          transportRequests.push({
            method: request.method,
            url: request.url,
            ...(request.body === undefined ? {} : { body: request.body }),
          });
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
  const run = async (argv: readonly string[]): Promise<VerifyGatesProductionRun> => {
    const out: string[] = [];
    const err: string[] = [];
    const streams: CliStreams = {
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: (chunk: string) => err.push(chunk) },
    };
    ordinal += 1;
    invocations.push([...argv]);
    const exitCode = await runCli(argv, streams, {
      brand,
      clock: { now: () => Date.parse(clockIso()) },
      newRunId: () => `run-vgprod-${String(ordinal)}`,
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
    ref: VG_PROD_REF,
    branch: VG_PROD_BRANCH,
    headSha: checkout.headSha,
    stateLocation,
    store,
    transportCalls,
    transportRequests,
    credentialReads: () => counter.value,
    invocations,
    defaultReply,
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

/**
 * Normalize one production run's bytes for golden comparison: the temp
 * checkout's real head SHA (full and 7-char forms), the fixture paths, and the
 * envelope's wall-clock duration are the only unstable members. Every other
 * byte must match, so any report change survives neither capture nor compare.
 */
export const normalizeProductionBytes = (
  text: string,
  identity: {
    readonly headSha: string;
    readonly checkout: string;
    readonly hostRoot: string;
  },
): string =>
  text
    .split(identity.headSha)
    .join("<head-sha>")
    .split(identity.headSha.slice(0, 7))
    .join("<head-sha-7>")
    .split(identity.checkout)
    .join("<checkout>")
    .split(identity.hostRoot)
    .join("<host-root>")
    .replace(/"totalMs":\d+/u, `"totalMs":0`);
