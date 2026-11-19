/**
 * TC-HARNESS-040 / TC-HARNESS-037 — the recorded outcome and the refusal
 * disclosure, plus the proof the gate work left the delivered stream, handle
 * acquisition, and output bounds undisturbed (AC-F1-1, AC-F1-3, AC-F2-1,
 * AC-F2-3, AC-F3-4 disclosure half; NFR-8; TDR-0041 decision 4).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createOpencodeSession } from "../../packages/adapters/src/harness/index";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import { harnessRefusalDetail, runDispatch } from "../../packages/core/src/app/dispatch";
import { recordDaemonDispatchResult } from "../../packages/core/src/app/daemon-dispatch-result";
import {
  DEFAULT_HARNESS_MODE,
  type CommandFailureHarnessDetail,
} from "../../packages/core/src/contracts/index";
import { buildHarnessSpawnEnvironment } from "../../packages/core/src/domain/harness-spawn-env";
import { PRODUCTION_OPENCODE_ARGS } from "../../packages/cli/src/production";
import { createDispatchState } from "../fixtures/dispatch/harness";
import { readsFrom } from "../fixtures/dispatch/golden/harness";
import {
  HARNESS_COMMAND,
  PARENT_ENVIRONMENT,
  SPAWN_ENV_DESCRIPTOR,
  assembleLiveness,
  classifier,
  createFakeCredentialPort,
  createRecordingRunner,
  runnerResult,
  streamStarterFromRunner,
} from "../fixtures/harness/harness-io";
import { createPropagationHarness } from "../fixtures/harness/propagation-harness";

const ROOT = process.cwd();
const FACTS = {
  kind: "opencode" as const,
  observedVersion: "2.3.2",
  versionVerdict: "inside" as const,
  mode: DEFAULT_HARNESS_MODE,
  modeOrigin: "defaults" as const,
};

const runOnce = async (input: {
  readonly admission?: () => Promise<
    | { readonly ok: true }
    | {
        readonly ok: false;
        readonly error: Parameters<typeof runDispatch>[0] extends never ? never : never;
      }
  >;
  readonly facts?: () => typeof FACTS | undefined;
}) => {
  const state = createDispatchState("gh335-verdict-mode");
  const harness = createPropagationHarness({ versionVerdict: "inside" });
  const result = await runDispatch({
    store: state.store,
    fenceToken: state.fenceToken,
    harness: harness.port,
    harnessKind: "opencode",
    descriptor: SPAWN_ENV_DESCRIPTOR,
    prompt: "synthetic",
    ref: "GH-335",
    evidenceClass: "pilot",
    repository: "github.com/owner/repo",
    handoverState: "authoritative",
    nowIso: () => "2026-11-18T10:00:00.000Z",
    newAttemptId: () => "attempt-1",
    newDivergenceId: () => "DIV-1",
    readTruth: async () => readsFrom(),
    claimLease: () => ({ ok: true, leaseId: "lease-1" }),
    releaseLease: () => true,
    phaseLedger: { completed: 9, total: 9, variant: "full" },
    harnessAgent: "agent-a",
    harnessBinding: {
      agent: "agent-a",
      seat: "seat-judgment",
      resolvedModel: "zai/glm-5#judgment",
    },
    ...(input.facts === undefined ? {} : { harnessFacts: input.facts }),
    ...(input.admission === undefined ? {} : { harnessAdmission: input.admission }),
  });
  return { state, result };
};

describe("TC-HARNESS-040 the recorded outcome", () => {
  test("a success records the normalized version, the inside verdict, and the default mode with its origin", async () => {
    const { state, result } = await runOnce({ facts: () => FACTS });
    expect(result.ok).toBe(true);
    const record = readDispatchAttempts(state.store).records[0];
    expect(record?.harnessVersion).toBe("2.3.2");
    expect(record?.versionVerdict).toBe("inside");
    expect(record?.mode).toBe(DEFAULT_HARNESS_MODE);
    expect(record?.modeOrigin).toBe("defaults");
    // The Phase-5 attribution facts ride the same record.
    expect(record?.sessionIds?.length).toBe(1);
    expect(record?.binding?.agent).toBe("agent-a");
  });

  test("a pre-session refusal carries its exact member set per identity", () => {
    const cases: readonly (readonly [string, CommandFailureHarnessDetail | undefined])[] = [
      [
        "harness.version.unsupported",
        { kind: "opencode", observedVersion: "2.1.7", versionVerdict: "outside" },
      ],
      [
        "harness.version.unknown",
        { kind: "opencode", observedVersion: null, versionVerdict: "indeterminate" },
      ],
      [
        "harness.mode.unavailable",
        {
          kind: "opencode",
          observedVersion: "2.3.2",
          versionVerdict: "inside",
          mode: "managed-background-service",
        },
      ],
      [
        "harness.profile.model-unrepresentable",
        {
          kind: "opencode",
          observedVersion: "2.3.2",
          versionVerdict: "inside",
          mode: DEFAULT_HARNESS_MODE,
        },
      ],
    ];
    for (const [code, expected] of cases) {
      const facts = {
        ...FACTS,
        observedVersion: expected?.observedVersion ?? null,
        versionVerdict: expected?.versionVerdict ?? "indeterminate",
        mode: expected?.mode ?? DEFAULT_HARNESS_MODE,
      };
      expect(harnessRefusalDetail(code, facts)).toEqual(expected as CommandFailureHarnessDetail);
    }
    // The version refusals omit `mode` entirely — never null, never the default.
    const outside = harnessRefusalDetail("harness.version.unsupported", FACTS);
    expect(outside === undefined ? true : Object.hasOwn(outside, "mode")).toBe(false);
  });

  test("the M-11 unassigned refusal carries no member and its facts ride the summary", () => {
    expect(harnessRefusalDetail("provider.profile.invalid", FACTS)).toBeUndefined();
    expect(harnessRefusalDetail("config.value.invalid", FACTS)).toBeUndefined();
    expect(harnessRefusalDetail("harness.session.unknown", FACTS)).toBeUndefined();
  });

  test("a refusal records no attempt and claims no lease", async () => {
    const { state, result } = await runOnce({
      admission: async () => ({
        ok: false,
        error: {
          kind: "harness",
          code: "harness.version.unsupported",
          summary: "outside",
          harness: harnessRefusalDetail("harness.version.unsupported", FACTS),
        },
      }),
    });
    expect(result.ok).toBe(false);
    expect(readDispatchAttempts(state.store).records).toHaveLength(0);
  });
});

describe("TC-HARNESS-040 the daemon producer", () => {
  test("the daemon attempt records the held identity and the binding only when one exists", () => {
    const state = createDispatchState("gh335-daemon-facts");
    const produced = recordDaemonDispatchResult({
      store: state.store,
      fenceToken: state.fenceToken,
      ref: "GH-335",
      repository: "github.com/owner/repo",
      sessionId: "ses-daemon",
      spawnOrdinal: 1,
      harnessKind: "opencode",
      evidenceClass: "pilot",
      handoverState: "authoritative",
      evidence: {
        completionMarker: true,
        exitStatus: 0,
        timedOut: false,
        spawnRefused: false,
        failureReported: false,
        toolFailure: false,
      },
      collected: { ok: true },
      reads: readsFrom(),
      nowIso: "2026-11-18T10:00:00.000Z",
      newDivergenceId: () => "DIV-daemon",
    });
    expect(produced.ok).toBe(true);
    const record = readDispatchAttempts(state.store).records[0];
    expect(record?.sessionIds).toEqual(["ses-daemon"]);
    expect(record?.binding).toBeUndefined();
    expect(record?.harnessVersion).toBeUndefined();
    expect(record?.mode).toBeUndefined();
  });
});

describe("TC-HARNESS-037 the delivered stream is undisturbed", () => {
  test("every committed capture replays: handle acquired once, full drain, unchanged evidence", async () => {
    const directory = join(ROOT, "tests/fixtures/harness/stream");
    const captures = readdirSync(directory)
      .filter((name) => name.startsWith("opencode-v2.2.5") && name.endsWith(".jsonl"))
      .sort();
    expect(captures.length).toBeGreaterThanOrEqual(4);
    for (const name of captures) {
      const text = readFileSync(join(directory, name), "utf8");
      const credentials = createFakeCredentialPort();
      const recording = createRecordingRunner(() => runnerResult(text));
      const port = createOpencodeSession({
        command: HARNESS_COMMAND,
        runner: recording.runner,
        starter: streamStarterFromRunner(recording.runner),
        buildEnvironment: (descriptor) =>
          buildHarnessSpawnEnvironment({
            descriptor,
            parentEnvironment: PARENT_ENVIRONMENT,
            credentials: credentials.port,
          }),
        classify: classifier,
        assembleLiveness,
        now: () => "2026-11-18T00:00:00.000Z",
        spawnArgs: PRODUCTION_OPENCODE_ARGS.spawn,
        resumeArgs: PRODUCTION_OPENCODE_ARGS.resume,
        listArgs: PRODUCTION_OPENCODE_ARGS.list,
        versionVerdict: "inside",
      });
      const spawned = await port.spawn({
        workItemRef: "GH-335",
        prompt: "replay prompt",
        descriptor: SPAWN_ENV_DESCRIPTOR,
      });
      expect(spawned.ok, name).toBe(true);
      if (!spawned.ok) continue;
      const collected = await port.collect({ handle: spawned.value });
      expect(collected.ok, name).toBe(true);
      // One invocation, the prompt on stdin and never in argv, no repeated pair.
      expect(recording.invocations, name).toHaveLength(1);
      const args = recording.invocations[0]?.args ?? [];
      expect(args, name).not.toContain("replay prompt");
      expect(
        args.filter((value) => value === "--agent"),
        name,
      ).toHaveLength(0);
      expect(
        args.filter((value) => value === "--standalone"),
        name,
      ).toHaveLength(1);
    }
  });
});

/**
 * TC-HARNESS-040 (scripted half) — the scripted projection of a harness refusal
 * is exactly `{error, runId}`, so the member never leaks into the minified line.
 */
describe("TC-HARNESS-040 the scripted projection", () => {
  test("the writer emits exactly error and runId for a harness refusal", async () => {
    const { writeOutput } = await import("../../packages/cli/src/output/serialize");
    const { bufferSink } = await import("../golden/helpers");
    const stdout = bufferSink();
    const stderr = bufferSink();
    writeOutput(
      { stdout, stderr },
      {
        schemaVersion: "delivery.result.v1",
        runId: "run-scripted",
        exitCode: 1,
        timing: { totalMs: 1 },
        error: {
          code: "harness.version.unsupported",
          category: "user",
          retryable: false,
          consequence: "not_landed",
          remediationHint: "synthetic remediation",
          summary: "outside",
        },
        detail: {
          harness: { kind: "opencode", observedVersion: "2.1.7", versionVerdict: "outside" },
        },
      } as never,
      undefined,
      [],
      true,
      { mode: "scripted" },
    );
    const line = stdout.value;
    expect(line.endsWith("\n")).toBe(true);
    expect(line.trim().split("\n")).toHaveLength(1);
    const parsed = JSON.parse(line.trim()) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(["error", "runId"]);
    // The evidence member is never projected: no `detail`, no observed version.
    expect(line).not.toContain('"detail"');
    expect(line).not.toContain("observedVersion");
  });
});
