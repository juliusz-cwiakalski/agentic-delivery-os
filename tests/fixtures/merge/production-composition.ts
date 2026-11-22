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

import { createHash } from "node:crypto";
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

/** One recorded outbound provider request (method, url, serialized body). */
export type MergeTransportRequest = {
  readonly method: string;
  readonly url: string;
  readonly body?: string;
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
  /** A second local head whose record declares the same branch (duplicate cells). */
  readonly duplicateHeadSha: string;
  /** The declaration-cap boundary heads: exactly 256 (accepted) and 257 (refused). */
  readonly cap256: { readonly ref: string; readonly headSha: string };
  readonly cap257: { readonly ref: string; readonly headSha: string };
  readonly stateLocation: string;
  readonly store: StateStorePort;
  readonly transportCalls: readonly string[];
  /** Every outbound request, with its method and serialized body. */
  readonly transportRequests: readonly MergeTransportRequest[];
  readonly credentialReads: () => number;
  /** Replace the provider reply between invocations (one fixture, two phases). */
  setReply: (reply: (url: string) => MergeProviderReply) => void;
  /** The composed healthy reply the fixture started from (for fault composition). */
  readonly defaultReply: (url: string) => MergeProviderReply;
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

/**
 * The healthy reply set: work items, a green check page, and two open requests.
 *
 * The request read is stateful across one landing: BEFORE the provider landing
 * (`PUT .../merge`) the single-request read serves the OPEN request with its
 * mergeability facts (the landing decision's LF-1 read); AFTER the landing the
 * read-back serves the merged shape. The delivery request number is the open
 * list's first entry.
 */
const healthyReply = (input: {
  readonly checkConclusion?: "success" | "failure";
  readonly branches: readonly { readonly branch: string; readonly headSha: string }[];
}): ((url: string) => MergeProviderReply) => {
  let landed = false;
  return (url) => {
    if (url.includes("/issues/")) {
      const number = Number(url.match(/issues\/(\d+)/u)?.[1] ?? 0);
      return {
        status: 200,
        body: {
          number,
          title: number === 12 ? "Digit prefix" : "Engine-first operations",
          state: "open",
          labels: [],
          updated_at: "2026-11-18T09:59:00Z",
        },
      };
    }
    if (url.includes("/check-runs")) {
      return {
        status: 200,
        body: {
          check_runs: ["CI / test", "CI / lint"].map((name, index) => ({
            id: 7001 + index,
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
        body: input.branches.map((branch, index) => ({
          number: 301 + index,
          state: "open",
          head: { ref: branch.branch, sha: branch.headSha },
          base: { ref: MERGE_PROD_BASE },
          commits: 1,
          changed_files: 1,
        })),
      };
    }
    if (url.includes("/graphql")) return { status: 200, body: { data: {} } };
    // The provider landing (PUT .../merge) flips the read-back: the only
    // merged-truth observer is the post-landing read of the single request.
    if (url.endsWith("/merge")) {
      landed = true;
      return { status: 200, body: { merged: true } };
    }
    if (url.includes("/pulls/")) {
      const branch = input.branches[0] as { readonly branch: string; readonly headSha: string };
      if (landed) {
        return {
          status: 200,
          body: {
            number: 301,
            state: "closed",
            merged_at: "2026-11-18T09:30:00Z",
            merged: true,
            head: { ref: branch.branch, sha: branch.headSha },
            base: { ref: MERGE_PROD_BASE },
            merge_commit_sha: "b1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
          },
        };
      }
      // The landing decision's mergeability read (LF-1): the OPEN request with
      // its provider-asserted mergeability facts.
      return {
        status: 200,
        body: {
          number: 301,
          state: "open",
          head: { ref: branch.branch, sha: branch.headSha },
          base: { ref: MERGE_PROD_BASE },
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

const DIGIT_PREFIX_BRANCH = "feat/ABC2-12/digit-prefix";

/** Build one real checkout with `main-tools` and two change branches, each carrying its own change record. */
const buildCheckout = (
  base: string,
): {
  readonly root: string;
  readonly headSha: string;
  readonly duplicateHeadSha: string;
  readonly cap256: { readonly ref: string; readonly headSha: string };
  readonly cap257: { readonly ref: string; readonly headSha: string };
  readonly branches: readonly { readonly branch: string; readonly headSha: string }[];
} => {
  const root = createRepository(base, "checkout");
  git(root, ["checkout", "-b", MERGE_PROD_BASE]);
  git(root, [
    "remote",
    "add",
    "origin",
    `https://github.com/${MERGE_PROD_OWNER}/engine-first-merge.git`,
  ]);
  // The repository-declared CI workflow the battery's ci-green read consumes
  // (F-2): the workflow's job names are the expected check set on the fixture
  // page, and every job is green there.
  const workflowDirectory = join(root, ".github/workflows");
  mkdirSync(workflowDirectory, { recursive: true });
  writeFileSync(
    join(workflowDirectory, "ci.yml"),
    [
      "jobs:",
      "  'CI / test':",
      "    steps: [echo]",
      "  'CI / lint':",
      "    steps: [echo]",
      "",
    ].join("\n"),
    "utf8",
  );
  git(root, ["add", "-A"]);
  git(root, ["commit", "-m", "chore: seed the CI workflow"]);
  const recordFor = (ref: string, directory: string, title: string): void => {
    git(root, ["checkout", "-B", ref, MERGE_PROD_BASE]);
    git(root, ["commit", "--allow-empty", "-m", `feat: fixture work (${ref})`]);
    // The change record is committed ON THE FEATURE BRANCH (GH-366 F-1): the
    // resolution reads it at the request head through the bounded local read,
    // never from the working tree.
    const recordDirectory = join(root, directory);
    mkdirSync(recordDirectory, { recursive: true });
    writeFileSync(
      join(recordDirectory, `chg-${ref.split("/")[1]}-pm-notes.yaml`),
      [
        `change_id: ${ref.split("/")[1]}`,
        `title: "${title}"`,
        `branch: ${ref}`,
        "phases:",
        "  clarify_scope: { started: 2026-11-18T06:00:00.000Z, completed: 2026-11-18T06:00:00.000Z }",
        "notes: []",
        "",
      ].join("\n"),
      "utf8",
    );
    git(root, ["add", "doc/changes"]);
    git(root, ["commit", "-m", `docs(${ref.split("/")[1]}): declare the change branch`]);
  };
  recordFor(
    MERGE_PROD_BRANCH,
    "doc/changes/2026-11/2026-11-18--GH-293--engine-first-operations",
    "Engine-first operations",
  );
  const headSha = shaOf(git(root, ["rev-parse", "HEAD"]));
  // A second local head carrying the same record (an empty commit on a second
  // GH-293 branch): the duplicate-open cells need two READABLE heads whose
  // records both declare the same branch.
  git(root, ["checkout", "-b", "fix/GH-293/duplicate"]);
  git(root, ["commit", "--allow-empty", "-m", "duplicate head"]);
  const duplicateHeadSha = shaOf(git(root, ["rev-parse", "HEAD"]));
  recordFor(
    DIGIT_PREFIX_BRANCH,
    "doc/changes/2026-11/2026-11-18--ABC2-12--digit-prefix",
    "Digit prefix",
  );
  const digitHeadSha = shaOf(git(root, ["rev-parse", "HEAD"]));
  // The declaration-cap boundary heads (TC-MRG-004): detached commits whose
  // records declare exactly 256- and 257-character branch values, addressable
  // by the resolution through provider-served source refs of the same length.
  const capBranchOf = (total: number): string => {
    const prefix = "feat/GH-293/";
    return prefix + "c".repeat(total - prefix.length);
  };
  const capCommit = (value: string): string => {
    git(root, ["checkout", "--detach", MERGE_PROD_BRANCH]);
    const capDirectory = `doc/changes/2026-11/2026-11-18--GH-293--cap-${String(value.length)}`;
    mkdirSync(join(root, capDirectory), { recursive: true });
    writeFileSync(
      join(root, capDirectory, "chg-GH-293-pm-notes.yaml"),
      `change_id: GH-293\ntitle: "Cap boundary"\nbranch: ${value}\nnotes: []\n`,
      "utf8",
    );
    git(root, ["add", "doc/changes"]);
    git(root, ["commit", "-m", `cap-${String(value.length)} record`]);
    return shaOf(git(root, ["rev-parse", "HEAD"]));
  };
  const cap256 = { ref: capBranchOf(256), headSha: capCommit(capBranchOf(256)) };
  const cap257 = { ref: capBranchOf(257), headSha: capCommit(capBranchOf(257)) };
  git(root, ["checkout", MERGE_PROD_BRANCH]);
  git(root, ["branch", "-f", MERGE_PROD_BASE, "HEAD~2"]);
  return {
    root,
    headSha,
    duplicateHeadSha,
    cap256,
    cap257,
    branches: [
      { branch: MERGE_PROD_BRANCH, headSha },
      { branch: DIGIT_PREFIX_BRANCH, headSha: digitHeadSha },
    ],
  };
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
  const transportRequests: MergeTransportRequest[] = [];
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
  const defaultReply = healthyReply({ branches: checkout.branches });
  let reply = options.reply ?? defaultReply;
  let clockIso = options.clockIso ?? (() => "2026-11-18T10:00:00.000Z");
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
    duplicateHeadSha: checkout.duplicateHeadSha,
    cap256: checkout.cap256,
    cap257: checkout.cap257,
    stateLocation,
    store,
    transportCalls,
    transportRequests,
    credentialReads: () => counter.value,
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

/** A digest of one file's bytes, for the "nothing landed" assertions. */
export const digestOf = (path: string): string =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
