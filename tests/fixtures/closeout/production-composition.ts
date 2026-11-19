/**
 * The production closeout-composition harness (GH-349 AC-F4-2, B1).
 *
 * One real temp checkout carrying the change folder, one distinct home, and the
 * real `createProductionComposer` program. Only external I/O is injected: the
 * recording GitHub transport, the credential port, the configuration
 * filesystem, and the harness spawn seams. Every closeout read and the
 * milestone composition are the shipped code; the provider bytes are synthetic.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FileSystemFacts } from "../../../packages/adapters/src/file/config";
import { type CliStreams, runCli } from "../../../packages/cli/src/index";
import { createProductionComposer } from "../../../packages/cli/src/production";
import type {
  BrandIdentity,
  CredentialPort,
  HarnessSpawnRunner,
  HarnessSpawnRunnerResult,
} from "../../../packages/core/src/contracts/index";
import { streamStarterFromRunner } from "../harness/stream";
import {
  brandOf,
  createHostFixture,
  type HostFixture,
  stateOverrideVariable,
} from "../projects/state-scope";
import { createRepository, git, removeDirectory } from "../projects/temp-repos";

export const CLOSEOUT_PROD_REF = "GH-349";
export const CLOSEOUT_PROD_OWNER = "owner";
export const CLOSEOUT_PROD_REPOSITORY = `github.com/${CLOSEOUT_PROD_OWNER}/milestone-prod`;
export const CLOSEOUT_PROD_BASE = "main-tools";
export const CLOSEOUT_PROD_MILESTONE_NUMBER = 4;
/** The provider's verbatim milestone title, prefix included. */
export const CLOSEOUT_PROD_MILESTONE_TITLE = "M4: Jaiship-native delivery";

export type CloseoutProductionRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope?: Record<string, unknown>;
};

export type CloseoutProviderReply =
  | { readonly status: number; readonly body: unknown }
  | { readonly throw: true };

export type CloseoutAttachedItem = {
  readonly number: number;
  readonly state: "open" | "closed";
};

export type CloseoutProductionHarnessOptions = {
  readonly label: string;
  readonly attached: readonly CloseoutAttachedItem[];
  /** The work item's provider-asserted milestone container, when carried. */
  readonly milestoneTitle?: string;
  /** A project-committed configuration document, or none. */
  readonly configYaml?: string;
};

export type CloseoutProductionHarness = {
  readonly brand: BrandIdentity;
  readonly host: HostFixture;
  readonly checkout: string;
  readonly ref: string;
  readonly transportCalls: readonly string[];
  readonly run: (argv: readonly string[]) => Promise<CloseoutProductionRun>;
  dispose: () => void;
};

const resolvingCredentials = (): CredentialPort => ({
  resolve: () => ({ ok: true, material: { value: "synthetic-closeout-read" } }),
});

/** The work item's own numeric identity (the milestone read's first request). */
const WORK_ITEM_ENTITY = "349";

/** One healthy reply set: the work item, its milestone page, and no merged request. */
const healthyReply =
  (options: CloseoutProductionHarnessOptions): ((url: string) => CloseoutProviderReply) =>
  (url) => {
    if (url.includes("/issues?milestone=")) {
      return {
        status: 200,
        body: options.attached.map((item) => ({
          number: item.number,
          title: `Attached ticket ${String(item.number)}`,
          state: item.state,
          labels: [],
          updated_at: "2026-11-18T09:58:00Z",
        })),
      };
    }
    if (url.includes(`/issues/${WORK_ITEM_ENTITY}`)) {
      const open = options.attached.filter((item) => item.state === "open").length;
      const closed = options.attached.length - open;
      return {
        status: 200,
        body: {
          number: 349,
          title: "Milestone synchronization",
          state: "closed",
          labels: [],
          updated_at: "2026-11-18T09:59:00Z",
          milestone: {
            number: CLOSEOUT_PROD_MILESTONE_NUMBER,
            title: options.milestoneTitle ?? CLOSEOUT_PROD_MILESTONE_TITLE,
            state: "open",
            open_issues: open,
            closed_issues: closed,
          },
        },
      };
    }
    if (url.includes("/pulls?")) return { status: 200, body: [] };
    if (url.includes("/graphql")) return { status: 200, body: { data: {} } };
    return { status: 404, body: {} };
  };

/** Build one real checkout with the change folder and its pm-notes declaration. */
const buildCheckout = (base: string): string => {
  const root = createRepository(base, "checkout");
  git(root, ["checkout", "-b", CLOSEOUT_PROD_BASE]);
  git(root, [
    "remote",
    "add",
    "origin",
    `https://github.com/${CLOSEOUT_PROD_OWNER}/milestone-prod.git`,
  ]);
  const folder = join(
    root,
    "doc",
    "changes",
    "2026-11",
    `2026-11-01--${CLOSEOUT_PROD_REF}--milestone-prod`,
  );
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, `chg-${CLOSEOUT_PROD_REF}-pm-notes.yaml`),
    [
      "schemaVersion: delivery.pm-notes.v1",
      `change:`,
      `  ref: ${CLOSEOUT_PROD_REF}`,
      `milestone: "${CLOSEOUT_PROD_MILESTONE_TITLE}"`,
      "",
    ].join("\n"),
  );
  return root;
};

export const createCloseoutProductionHarness = (
  options: CloseoutProductionHarnessOptions,
): CloseoutProductionHarness => {
  const brand = brandOf();
  const host = createHostFixture(options.label);
  const base = `${host.hostRoot}-closeout-prod`;
  const checkout = buildCheckout(base);
  const transportCalls: string[] = [];
  const spawnRunner: HarnessSpawnRunner = async (): Promise<HarnessSpawnRunnerResult> => ({
    stdout: JSON.stringify({ session: { id: "ses-gh349" }, result: { completion: "complete" } }),
    stderr: "",
    status: 0,
    timedOut: false,
  });
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
      },
      cwd: checkout,
      homeDirectory: host.home,
      workingName: "delivery-os",
      repositoryFacts: {
        originUrl: CLOSEOUT_PROD_REPOSITORY.replace("github.com", "https://github.com"),
      },
      harnessSpawnRunner: spawnRunner,
      harnessSpawnStarter: streamStarterFromRunner(spawnRunner),
      credentials: resolvingCredentials(),
      githubTransport: {
        send: async (request) => {
          transportCalls.push(request.url);
          const result = healthyReply(options)(request.url);
          if ("throw" in result) throw new Error("synthetic transport failure");
          return { status: result.status, body: result.body };
        },
      },
      configurationFs,
    });
    return composer(brand);
  };
  let ordinal = 0;
  const run = async (argv: readonly string[]): Promise<CloseoutProductionRun> => {
    const out: string[] = [];
    const err: string[] = [];
    const streams: CliStreams = {
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: (chunk: string) => err.push(chunk) },
    };
    ordinal += 1;
    const exitCode = await runCli(argv, streams, {
      brand,
      clock: { now: () => Date.parse("2026-11-18T10:00:00.000Z") },
      newRunId: () => `run-gh349-closeout-${String(ordinal)}`,
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
    checkout,
    ref: CLOSEOUT_PROD_REF,
    transportCalls,
    run,
    dispose: () => {
      removeDirectory(base);
      host.dispose();
    },
  };
};
