/**
 * TC-HOLDEDGE-001 / TC-HOLDEDGE-002 (GH-280, D22) — the real production
 * composer over a temp HOME whose `<stateDirectoryName>/owner-hold` marker is
 * materialized on disk. No reader is injected: queue list/plan, queue claim
 * (supplied ref and no ref), dispatch, and status all resolve the hold through
 * the production `readOwnerHoldMarker` + `resolveOwnerHoldFact` closure. A
 * marker-removal mutation control flips every surface back to unheld, and the
 * marker is restored to prove per-pass re-resolution.
 *
 * Doctor is deliberately not asserted: it is a command-runtime capability and
 * the production composer supplies no `DoctorComposition` (D20/GAP-T8).
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { GitChildRunner } from "../../packages/adapters/src/git/index";
import type { CliStreams } from "../../packages/cli/src/index";
import { runCli } from "../../packages/cli/src/index";
import { createProductionComposer } from "../../packages/cli/src/production";
import { declareQueueEntry, readDispatchAttempts } from "../../packages/core/src/app/index";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";
import type {
  CredentialPort,
  HarnessSpawnRunner,
  HarnessSpawnRunnerResult,
} from "../../packages/core/src/contracts/index";
import { ownerHoldEnvironmentVariableName } from "../../packages/core/src/domain/index";
import {
  createNodeStateEdge,
  createStateStore,
  STATE_SCHEMA_VERSION,
} from "../../packages/core/src/state/index";
import { streamStarterFromRunner } from "../fixtures/harness/stream";
import { projectScopeFor } from "../fixtures/projects/state-scope";
import { makeCheckout } from "../fixtures/queue/production/harness";

const WORKING_NAME = "delivery-os";
const ORIGIN = "https://github.com/owner/repo.git";
const REPOSITORY = "github.com/owner/repo";
const REF = "GH-320";
const NOW_ISO = "2026-11-08T10:00:00.000Z";
const BASE = join(process.cwd(), "tmp", "tmpdir");

type Envelope = {
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string; readonly summary?: string };
};
type Resolution = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope?: Envelope;
};

type Harness = {
  readonly brand: ReturnType<typeof brandOf>;
  readonly home: string;
  readonly checkout: string;
  readonly stateDirectory: string;
  readonly markerPath: string;
  readonly store: ReturnType<typeof createStateStore>;
  readonly spawns: { readonly file: string; readonly args: readonly string[] }[];
  readonly transportCalls: string[];
  readonly credentialReads: number;
  readonly run: (argv: readonly string[]) => Promise<Resolution>;
  readonly dispose: () => void;
};

const brandOf = () => {
  const resolved = resolveBrandIdentity({ workingName: WORKING_NAME });
  if (!resolved.ok) throw new Error("brand resolution failed");
  return resolved.value;
};

const dataOf = (run: Resolution): Record<string, unknown> => {
  const data = run.envelope?.data;
  if (data === undefined) throw new Error(`no data envelope: ${run.stdout}${run.stderr}`);
  return data;
};

const providersSectionOf = (run: Resolution): Record<string, unknown> => {
  const sections = dataOf(run).sections;
  if (!Array.isArray(sections)) throw new Error("status data has no sections");
  const section = sections.find(
    (entry) => (entry as { readonly id?: string }).id === "providers",
  ) as Record<string, unknown> | undefined;
  if (section === undefined) throw new Error("providers section is missing");
  return section;
};

const ownerHoldOf = (run: Resolution): unknown => {
  const data = dataOf(run);
  if (Array.isArray(data.sections)) {
    const providers = providersSectionOf(run);
    return (providers.evidence as Record<string, unknown>).ownerHold;
  }
  return data.ownerHold;
};

const createHarness = (input: {
  readonly label: string;
  readonly environmentExtra?: Readonly<Record<string, string>>;
}): Harness => {
  mkdirSync(BASE, { recursive: true });
  const brand = brandOf();
  const home = mkdtempSync(join(BASE, `gh280-${input.label}-`));
  const checkout = makeCheckout(home, "checkout", ORIGIN);
  // The store opens at the checkout's derived project root (GH-288 F-1); the
  // owner-hold marker stays at the host root and is read there.
  const hostRoot = join(home, brand.stateDirectoryName);
  const stateDirectory = projectScopeFor({
    cwd: checkout.directory,
    hostRoot,
    home,
    brand,
  }).scope.stateLocation;
  const spawns: { readonly file: string; readonly args: readonly string[] }[] = [];
  const transportCalls: string[] = [];
  let credentialReads = 0;
  const spawnRunner: HarnessSpawnRunner = async (file, args): Promise<HarnessSpawnRunnerResult> => {
    spawns.push({ file, args });
    return {
      stdout: JSON.stringify({
        session: { id: "ses-gh280" },
        result: { completion: "complete" },
      }),
      stderr: "",
      status: 0,
      timedOut: false,
    };
  };
  const credentials: CredentialPort = {
    resolve: () => {
      credentialReads += 1;
      return { ok: true, material: { value: "synthetic-owner-hold" } };
    },
  };
  const gitRunner: GitChildRunner = async () => ({
    stdout: "",
    stderr: "git is unavailable in this hermetic suite",
    status: 1,
    timedOut: false,
  });
  const program = createProductionComposer({
    environment: {
      HOME: home,
      PATH: "/synthetic/bin:/synthetic/usr/bin",
      HARNESS_MODEL: "synthetic/model-large",
      HARNESS_SMALL_MODEL: "synthetic/model-small",
      ...input.environmentExtra,
    },
    cwd: checkout.directory,
    homeDirectory: home,
    workingName: WORKING_NAME,
    repositoryFacts: { originUrl: ORIGIN },
    harnessSpawnRunner: spawnRunner,
    harnessSpawnStarter: streamStarterFromRunner(spawnRunner),
    credentials,
    githubTransport: {
      send: async (request) => {
        transportCalls.push(request.url);
        if (request.url.includes("/issues/")) {
          return {
            status: 200,
            body: { number: 320, title: "Owner hold fixture", state: "open", labels: [] },
          };
        }
        return { status: 404, body: {} };
      },
    },
    gitChildRunner: gitRunner,
  })(brand);
  const store = createStateStore(
    {
      level: "local",
      workspaceId: "default",
      fenceNamespace: "cli",
      schemaVersion: STATE_SCHEMA_VERSION,
      stateDirectory,
    },
    { driver: "jsonl", edge: createNodeStateEdge() },
  );
  let ordinal = 0;
  const run = async (argv: readonly string[]): Promise<Resolution> => {
    const out: string[] = [];
    const err: string[] = [];
    const streams: CliStreams = {
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: (chunk: string) => err.push(chunk) },
    };
    ordinal += 1;
    const exitCode = await runCli(argv, streams, {
      brand,
      clock: { now: () => Date.parse(NOW_ISO) },
      newRunId: () => `run-gh280-${String(ordinal)}`,
      secrets: [],
      program,
    });
    const stdout = out.join("");
    const stderr = err.join("");
    const trimmed = stdout.trim();
    const envelope =
      trimmed.startsWith("{") && trimmed.endsWith("}")
        ? (JSON.parse(trimmed) as Envelope)
        : undefined;
    return { exitCode, stdout, stderr, ...(envelope === undefined ? {} : { envelope }) };
  };
  return {
    brand,
    home,
    checkout: checkout.directory,
    stateDirectory,
    markerPath: join(hostRoot, "owner-hold"),
    store,
    spawns,
    transportCalls,
    get credentialReads() {
      return credentialReads;
    },
    run,
    dispose: () => rmSync(home, { recursive: true, force: true }),
  };
};

const seedQueueEntry = (harness: Harness, checkoutRoot: string): void => {
  const seeded = declareQueueEntry(harness.store, {
    ref: REF,
    repository: REPOSITORY,
    repositoryRoot: checkoutRoot,
    priority: 5,
    recordedAt: NOW_ISO,
    fenceToken: "gh280-seed",
  });
  if (!seeded.ok) throw new Error(`queue seed failed: ${seeded.code}`);
};

const writeMarker = (harness: Harness, reason: string): void => {
  mkdirSync(dirname(harness.markerPath), { recursive: true });
  writeFileSync(harness.markerPath, `${reason}\n`);
};

const removeMarker = (harness: Harness): void => {
  unlinkSync(harness.markerPath);
};

describe("TC-HOLDEDGE-001/002 the production composer resolves a temp-HOME marker", () => {
  test("queue list/plan, both claims, dispatch, and status report the marker hold", async () => {
    const harness = createHarness({ label: "marker" });
    try {
      seedQueueEntry(harness, harness.checkout);
      writeMarker(harness, "peak-hour cost pause");

      const list = await harness.run(["queue", "list", "--json"]);
      expect(list.exitCode).toBe(0);
      expect(ownerHoldOf(list)).toEqual({
        source: "marker",
        reason: "peak-hour cost pause",
      });
      const entries = dataOf(list).entries as readonly Record<string, unknown>[] | undefined;
      expect(entries?.[0]?.state).toBe("held");
      expect(
        (entries?.[0]?.blocking as readonly Record<string, unknown>[] | undefined)?.[0]?.reason,
      ).toBe("owner-hold");

      const plan = await harness.run(["queue", "plan", "--json"]);
      expect(plan.exitCode).toBe(0);
      expect(ownerHoldOf(plan)).toEqual({
        source: "marker",
        reason: "peak-hour cost pause",
      });

      const claimWithRef = await harness.run(["queue", "claim", REF, "--json"]);
      expect(claimWithRef.exitCode).toBe(1);
      expect(claimWithRef.envelope?.error?.code).toBe("queue.precondition.unmet");
      expect(claimWithRef.envelope?.error?.summary).toContain("reason=owner-hold");
      expect(claimWithRef.envelope?.error?.summary).toContain(
        "owner hold active (marker): peak-hour cost pause",
      );

      const claimNoRef = await harness.run(["queue", "claim", "--json"]);
      expect(claimNoRef.exitCode).toBe(1);
      expect(claimNoRef.envelope?.error?.code).toBe("queue.precondition.unmet");
      expect(claimNoRef.envelope?.error?.summary).toContain("reason=owner-hold");
      expect(claimNoRef.envelope?.error?.summary).not.toContain("no-eligible-action");

      const dispatch = await harness.run(["dispatch", REF, "--json"]);
      expect(dispatch.exitCode).toBe(1);
      expect(dispatch.envelope?.error?.code).toBe("queue.precondition.unmet");
      expect(dispatch.envelope?.error?.summary).toContain("reason=owner-hold");
      expect(dispatch.envelope?.error?.summary).toContain(
        "owner hold active (marker): peak-hour cost pause",
      );
      expect(harness.spawns).toEqual([]);
      const attempts = readDispatchAttempts(harness.store);
      expect(attempts.ok ? attempts.records : []).toEqual([]);

      const status = await harness.run(["status", "--json"]);
      expect(status.exitCode).toBe(0);
      const providers = providersSectionOf(status);
      expect((providers.evidence as Record<string, unknown>).ownerHold).toEqual({
        source: "marker",
        reason: "peak-hour cost pause",
      });
    } finally {
      harness.dispose();
    }
  });

  test("removing the marker flips every surface back; restoring it re-activates (mutation control)", async () => {
    const harness = createHarness({ label: "mutation" });
    try {
      seedQueueEntry(harness, harness.checkout);
      writeMarker(harness, "pause for the mutation control");

      const held = await harness.run(["queue", "list", "--json"]);
      expect(ownerHoldOf(held)).toEqual({
        source: "marker",
        reason: "pause for the mutation control",
      });
      const heldStatus = await harness.run(["status", "--json"]);
      expect(
        (providersSectionOf(heldStatus).evidence as Record<string, unknown>).ownerHold,
      ).toEqual({ source: "marker", reason: "pause for the mutation control" });
      const heldDispatch = await harness.run(["dispatch", REF, "--json"]);
      expect(heldDispatch.envelope?.error?.summary).toContain("owner-hold");

      removeMarker(harness);

      const unheldList = await harness.run(["queue", "list", "--json"]);
      expect(ownerHoldOf(unheldList)).toBeUndefined();
      const unheldStatus = await harness.run(["status", "--json"]);
      expect(
        (providersSectionOf(unheldStatus).evidence as Record<string, unknown>).ownerHold,
      ).toBeUndefined();
      const unheldClaim = await harness.run(["queue", "claim", REF, "--json"]);
      expect(unheldClaim.envelope?.error?.summary ?? "").not.toContain("owner-hold");
      const unheldDispatch = await harness.run(["dispatch", REF, "--json"]);
      expect(unheldDispatch.envelope?.error?.summary ?? "").not.toContain("owner-hold");
      expect(unheldDispatch.envelope?.error?.summary ?? "").not.toContain("reason=owner-hold");

      writeMarker(harness, "restored hold");
      const restored = await harness.run(["queue", "list", "--json"]);
      expect(ownerHoldOf(restored)).toEqual({ source: "marker", reason: "restored hold" });
    } finally {
      harness.dispose();
    }
  });

  test("the environment source is resolved by the same production composition", async () => {
    const brand = brandOf();
    const environmentKey = ownerHoldEnvironmentVariableName(brand.environmentPrefix);
    const harness = createHarness({
      label: "environment",
      environmentExtra: { [environmentKey]: "environment reason" },
    });
    try {
      seedQueueEntry(harness, harness.checkout);
      const list = await harness.run(["queue", "list", "--json"]);
      expect(ownerHoldOf(list)).toEqual({ source: "env", reason: "environment reason" });
      const status = await harness.run(["status", "--json"]);
      expect((providersSectionOf(status).evidence as Record<string, unknown>).ownerHold).toEqual({
        source: "env",
        reason: "environment reason",
      });
    } finally {
      harness.dispose();
    }
  });
});
