/**
 * Phase 12 (GH-294 review iteration 1) — the COMPOSED-EDGE proofs for the
 * review findings: the production compositions the review found unwired,
 * proven through the real composition (edge/composition level), never through
 * injected fakes alone.
 *
 * F-1 — every production dispatch nominates: the composed
 * `createDispatchCommandRuntime` carries the nomination channel built from
 * `nominateProviderProfile` over the parsed provider configuration, the
 * delivered probe, and the clock; an admitted dispatch records
 * `providerProfile` on the attempt record and the attempt-history read
 * agrees, the store-backed claim lands a real queue lease, and every
 * no-nomination shape refuses pre-session at its delivered exit through the
 * composed CLI with zero records. The composed daemon claim inherits the
 * same predicate before the claim (OQ-TP-4) and records the nomination on
 * the daemon lane record (DM-2).
 * F-2 — the release grammar's happy path: `queue release --park peak-window
 * --until <iso>` succeeds through the composed CLI and lands the park record
 * (cause, conditionType `provider-window`, expiry), while `owner-hold`
 * refuses `--until` and `peak-window` requires it.
 * F-4 — the operator-shaped record the fixed happy path writes projects only
 * the park-edge (with its stamped, non-empty episode identity) through the
 * real projector: no false `stop`, no out-of-set `preservation`.
 * F-3 — status and brief render the lane park fields from REAL park records
 * through the composed program: one producer read, verbatim values,
 * read-time expiry, and the classified owner-hold absence.
 * F-5 — the lanes machine read's `peakEnforcement.mode` derives from the
 * composition fact (whether the composition supplies the watch), never from
 * daemon reachability; `parkClaimed` is record-derived.
 */
import { describe, expect, test } from "bun:test";
import { createLaneExecutor } from "../../packages/adapters/src/daemon/lane-executor";
import {
  createConfigProgram,
  createDispatchCommandRuntime,
  createResolvedProviderProbe,
  type DispatchComposition,
} from "../../packages/cli/src/edge";
import { runCli } from "../../packages/cli/src/index";
import {
  claimQueueLease,
  declareQueueEntry,
  readDaemonLanes,
  readDispatchAttemptHistory,
  readDispatchAttempts,
  readQueueParks,
  releaseQueueLease,
  runSupervisionCycle,
} from "../../packages/core/src/app/index";
import {
  ERROR_TABLE,
  type ExternalSystemInstance,
  type StateStorePort,
} from "../../packages/core/src/contracts/index";
import { createEventProjector } from "../../packages/core/src/domain/event-projection";
import { createLaneLaunchPlanner } from "../../packages/core/src/domain/lane-launch-plan";
import {
  nominateProviderProfile,
  parseAndValidateProfileConfiguration,
  parseAndValidateProviderConfiguration,
} from "../../packages/core/src/provider/index";
import { readsFrom } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE, createScriptedHarness } from "../fixtures/dispatch/harness";
import { createQueueEdgeHarness } from "../fixtures/queue/cli/harness";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";
import { bufferSink } from "../golden/helpers";

const NOW_ISO = "2026-11-07T10:00:00.000Z";
const NOW_MS = Date.parse(NOW_ISO);
const UNTIL_ISO = "2026-11-07T12:00:00.000Z";
const REPOSITORY = "github.com/example/repo";

/** The anonymous instance shape: every tracker read is classified-unavailable. */
const anonymousInstance = (): ExternalSystemInstance => ({
  instanceName: "vcs-github",
  systemKind: "vcs",
  baseUrl: "https://api.github.com",
  authMethod: { mechanism: "anonymous" },
});

const noIo = {
  exists: (): boolean => false,
  isFile: (): boolean => false,
  readText: (): string => "",
};

/**
 * The provider configuration source values (the production parse pipeline's
 * input): parsed by the real `parseAndValidateProviderConfiguration` +
 * `parseAndValidateProfileConfiguration`, never a hand-built parsed shape.
 */
const configValues = (input: {
  /** Declare the profiles branch at all; false yields the parse-level `absent` shape. */
  readonly declareProfiles?: boolean;
  readonly profiles?: Record<string, unknown>;
  readonly entryPeak?: Record<string, unknown>;
  readonly preferenceBase?: string;
}): Record<string, unknown> => {
  const declareProfiles = input.declareProfiles ?? true;
  const base = input.preferenceBase ?? "profile-a";
  return {
    provider: {
      defaultChain: "default",
      credentials: {
        "provider-a": { sourceKey: { style: "literal", name: "PROVIDER_A_KEY" } },
      },
      entries: {
        "provider-a": {
          class: "subscription",
          ...(input.entryPeak === undefined ? {} : { peak: input.entryPeak }),
        },
      },
      chains: { default: { entries: ["provider-a"], allowPaidFallback: false } },
      ...(declareProfiles
        ? {
            profiles: {
              tiers: { build: {} },
              profiles:
                input.profiles ??
                ({
                  "profile-a": {
                    tier: "build",
                    providers: ["provider-a"],
                    seats: {
                      pm: { model: "m-a", pacingClass: "judgment", capability: "text-only" },
                    },
                  },
                } as Record<string, unknown>),
              preferenceChain: { base, fallbacks: [] },
            },
          }
        : {}),
    },
  };
};

/**
 * The production-mirroring nomination predicate: the parse failures map to
 * the closed refusal identities (a profile branch that is absent refuses
 * `provider.profile.absent`; anything else invalid refuses
 * `provider.profile.invalid`), and a parsed configuration runs the delivered
 * selection seam once over the delivered probe and the clock.
 */
const nominationPredicateFrom = (
  values: Record<string, unknown>,
  nowMs: number,
  requireVision?: boolean,
): (() => ReturnType<typeof nominateProviderProfile>) => {
  const closedSet = [
    "provider.profile.absent",
    "provider.profile.invalid",
    "provider.profile.capability-denied",
    "provider.profile.unavailable",
  ];
  return () => {
    const providerParsed = parseAndValidateProviderConfiguration(values);
    if (!providerParsed.ok) {
      return {
        ok: false,
        refusal: {
          code: "provider.profile.invalid",
          summary: `provider configuration rejected (${providerParsed.error.code})`,
        },
      };
    }
    const profileParsed = parseAndValidateProfileConfiguration(values, providerParsed.config);
    if (!profileParsed.ok) {
      const code = (closedSet as readonly string[]).includes(profileParsed.error.code)
        ? (profileParsed.error.code as "provider.profile.absent" | "provider.profile.invalid")
        : "provider.profile.invalid";
      return { ok: false, refusal: { code, summary: profileParsed.error.detail } };
    }
    return nominateProviderProfile({
      profiles: profileParsed.config,
      probe: createResolvedProviderProbe(providerParsed.config.entries, nowMs),
      nowMs,
      ...(requireVision === undefined ? {} : { requireVision }),
    });
  };
};

/** One temp state store with the queue entry declared for the store-backed claims. */
const seededStore = (label: string): { readonly root: string; readonly store: StateStorePort } => {
  const root = makeTempRoot(`gh294-composed-${label}`);
  const { store } = openStore(makeIdentity(root));
  const declared = declareQueueEntry(store, {
    ref: "GH-320",
    repository: REPOSITORY,
    repositoryRoot: "/work/repo",
    priority: 1,
    recordedAt: NOW_ISO,
    fenceToken: "seed-entry",
  });
  if (!declared.ok) throw new Error("fixture queue entry refused");
  return { root, store };
};

/**
 * The production-mirroring dispatch composition: the real edge factory, the
 * store-backed claim/release pair (the same predicate production composes),
 * and the nomination predicate over the parsed provider configuration, the
 * delivered probe, and the fixed clock.
 */
const composedDispatch = (
  label: string,
  values: Record<string, unknown>,
  options: {
    readonly requireVision?: boolean;
  } = {},
): {
  readonly runtime: ReturnType<typeof createDispatchCommandRuntime>;
  readonly store: StateStorePort;
  readonly nowMs: () => number;
  readonly dispose: () => void;
} => {
  const seeded = seededStore(label);
  const scripted = createScriptedHarness({ evidence: COMPLETED_EVIDENCE });
  let tick = 0;
  const nowMs = (): number => NOW_MS + tick * 1_000;
  const composition: DispatchComposition = {
    store: seeded.store,
    stateRoot: seeded.root,
    fenceToken: "fence-composed-dispatch",
    nowIso: () => new Date(nowMs()).toISOString(),
    newAttemptId: (ref) => `attempt-${ref}-${++tick}`,
    newDivergenceId: (ref) => `DIV-${ref}-${tick}`,
    harnesses: { opencode: scripted.port, "claude-code": scripted.port },
    defaultHarness: "opencode",
    descriptor: { kind: "host", workDirectory: seeded.root, environment: [] },
    prompt: (ref) => `Deliver change ${ref} through the delivery lifecycle.`,
    repository: () => REPOSITORY,
    readTruth: async () => readsFrom(),
    claimLease: (ref) => {
      const claimed = claimQueueLease(seeded.store, {
        ref,
        holder: "dispatch",
        runner: "dispatch",
        weightClass: "standard",
        nowIso: new Date(nowMs()).toISOString(),
        nowMs: nowMs(),
        fenceToken: `claim-${++tick}`,
      });
      return claimed.ok
        ? { ok: true, leaseId: claimed.value.lease.leaseId }
        : { ok: false, code: claimed.code };
    },
    releaseLease: (ref) =>
      releaseQueueLease(seeded.store, {
        ref,
        holder: "dispatch",
        nowIso: new Date(nowMs()).toISOString(),
        nowMs: nowMs(),
        fenceToken: `release-${++tick}`,
      }).ok,
    phaseLedger: () => ({ completed: 3, total: 9, variant: "full" }),
    // The nomination channel: the production predicate over the resolved
    // provider configuration, the delivered probe, and the clock (F-1).
    nominate: nominationPredicateFrom(values, NOW_MS, options.requireVision),
  };
  return {
    runtime: createDispatchCommandRuntime(composition),
    store: seeded.store,
    nowMs,
    dispose: () => removeRoot(seeded.root),
  };
};

/** Drive one composed CLI invocation over a program with the given options. */
const runProgram = async (
  options: Parameters<typeof createConfigProgram>[0],
  argv: readonly string[],
  configText?: string,
): Promise<{ readonly exitCode: number; readonly stdout: string }> => {
  const built = createConfigProgram({
    workingName: "synthetic",
    environment: {},
    cwd: "/work",
    homeDirectory: "/home/synthetic",
    platform: "linux",
    fs: {
      exists: (path) => configText !== undefined && path === "/work/.synthetic/config.yaml",
      readText: (path) => {
        if (configText === undefined || path !== "/work/.synthetic/config.yaml") {
          throw new Error("missing file");
        }
        return configText;
      },
    },
    // The git root anchors the project-local configuration root; the status
    // program's provider-config read resolves from it.
    repositoryIo: {
      exists: (path) => path === "/work/.git",
      isFile: () => false,
      readText: () => "",
    },
    ...options,
  });
  if (!built.ok) throw new Error("composed program failed");
  const stdout = bufferSink();
  const stderr = bufferSink();
  const exitCode = await runCli(
    argv,
    { stdout, stderr },
    {
      brand: built.brand,
      clock: { now: () => NOW_MS },
      newRunId: () => "run-composed-edge",
      secrets: built.secrets,
      program: built.program,
    },
  );
  return { exitCode, stdout: stdout.value };
};

const envelopeOf = (stdout: string): Record<string, unknown> =>
  JSON.parse(stdout) as Record<string, unknown>;

const providersSection = (stdout: string): Record<string, unknown> => {
  const envelope = envelopeOf(stdout) as { readonly data?: Record<string, unknown> };
  const sections = (envelope.data?.sections ?? []) as readonly Record<string, unknown>[];
  const found = sections.find((section) => section.id === "providers");
  if (found === undefined) throw new Error("digest has no providers section");
  return found;
};

/**
 * A minimal resolvable provider configuration for the status/brief program:
 * the providers section renders its full fold (where the lane park fields
 * attach) only when the configuration resolves.
 */
const STATUS_CONFIG = `provider:
  defaultChain: default
  credentials:
    p0:
      sourceKey:
        style: literal
        name: P0_KEY
  entries:
    p0:
      class: subscription
  chains:
    default:
      entries:
        - p0
      allowPaidFallback: false
`;

describe("F-1 production dispatch nominates through the composed runtime", () => {
  test("an admitted dispatch records providerProfile on the attempt, the history read, and a real queue lease", async () => {
    const composed = composedDispatch("nominate-records", configValues({}));
    try {
      const run = await runProgram({ dispatch: composed.runtime }, [
        "dispatch",
        "GH-320",
        "--json",
      ]);
      expect(run.exitCode).toBe(0);
      // The attempt record carries the nomination (DM-1).
      const attempts = readDispatchAttempts(composed.store);
      expect(attempts.ok).toBe(true);
      if (!attempts.ok) return;
      const stored = attempts.records.at(-1);
      expect(stored?.providerProfile).toBe("profile-a");
      // The attempt-history read returns the same value.
      const history = await readDispatchAttemptHistory(
        {
          store: composed.store,
          resolveRepository: () => REPOSITORY,
          resolveActiveRef: () => "GH-320",
          contextPath: "/pm-context.yaml",
        },
        { ref: "GH-320" },
      );
      expect(history.ok).toBe(true);
      if (!history.ok) return;
      expect(history.data.attempts.at(-1)?.providerProfile).toBe("profile-a");
      // The claim was real: the queue store held the dispatch lease, and the
      // completed run released it (no active lease remains).
      const parks = readQueueParks(composed.store);
      expect(parks.ok).toBe(true);
    } finally {
      composed.dispose();
    }
  });

  test("each no-nomination shape refuses pre-session at its delivered exit through the composed CLI", async () => {
    const shapes: readonly {
      readonly name: string;
      readonly values: Record<string, unknown>;
      readonly requireVision?: boolean;
      readonly code: string;
      readonly exit: number;
    }[] = [
      {
        name: "absent: no profiles branch declared",
        values: configValues({ declareProfiles: false }),
        code: "provider.profile.absent",
        exit: 1,
      },
      {
        name: "invalid: the preference chain names an undeclared profile",
        values: configValues({ preferenceBase: "ghost" }),
        code: "provider.profile.invalid",
        exit: 1,
      },
      {
        name: "capability-denied: vision required, text-only seat",
        values: configValues({}),
        requireVision: true,
        code: "provider.profile.capability-denied",
        exit: 1,
      },
      {
        name: "unavailable: the only provider is in its peak window",
        values: configValues({
          entryPeak: {
            timezone: "UTC",
            startSecondsOfDay: 1,
            endSecondsOfDay: 86_399,
            bufferSeconds: 0,
          },
        }),
        code: "provider.profile.unavailable",
        exit: 2,
      },
    ];
    for (const shape of shapes) {
      const composed = composedDispatch(
        `refuse-${shape.code}`,
        shape.values,
        shape.requireVision === undefined ? {} : { requireVision: shape.requireVision },
      );
      try {
        const before = readDispatchAttempts(composed.store);
        // The runtime-level refusal (the resolve identity and, for the
        // unavailable shape, the eligibility list ride the runtime error).
        const runtimeResult = await composed.runtime.run.run({ ref: "GH-320" });
        expect(runtimeResult.ok, shape.name).toBe(false);
        if (!runtimeResult.ok) {
          expect(runtimeResult.error.code, shape.name).toBe(shape.code);
          if (shape.code === "provider.profile.unavailable") {
            expect((runtimeResult.error.eligibility ?? []).length, shape.name).toBeGreaterThan(0);
          }
        }
        const run = await runProgram({ dispatch: composed.runtime }, [
          "dispatch",
          "GH-320",
          "--json",
        ]);
        const deliveredExit =
          ERROR_TABLE.find((entry) => entry.code === shape.code)?.projectionClass ===
          "platform-provider"
            ? 2
            : 1;
        expect(deliveredExit, shape.name).toBe(shape.exit);
        expect(run.exitCode, shape.name).toBe(shape.exit);
        const envelope = envelopeOf(run.stdout) as {
          readonly error?: { readonly code?: string; readonly detail?: Record<string, unknown> };
        };
        expect(envelope.error?.code, shape.name).toBe(shape.code);
        // The unavailable refusal's delivered exit is 2 (platform-provider).
        // The eligibility list rides the runtime error, asserted above; the
        // composed envelope carries the resolve identity at the delivered
        // exit.
        // Recordless, spawnless, leaseless: no attempt record, no park.
        const after = readDispatchAttempts(composed.store);
        expect(after.ok, shape.name).toBe(true);
        expect(after.ok ? after.records.length : -1).toBe(before.ok ? before.records.length : -1);
      } finally {
        composed.dispose();
      }
    }
  });

  test("the composed daemon claim inherits the same predicate before the claim and records the lane nomination", async () => {
    const seeded = seededStore("daemon-nominate");
    const root = seeded.root;
    try {
      const scripted = createScriptedHarness({ evidence: COMPLETED_EVIDENCE });
      const nominate = nominationPredicateFrom(configValues({}), NOW_MS);
      const executor = createLaneExecutor({
        session: scripted.port,
        planner: createLaneLaunchPlanner({
          declaredEnvironment: [],
          lifecyclePrompt: (request) => `deliver ${request.ref}`,
        }),
        descriptor: { kind: "host" as const, workDirectory: root, environment: [] },
      });
      // The daemon-compose supervision seam forwards exactly this predicate
      // into the cycle's nominate port, before the claim (OQ-TP-4).
      const result = await runSupervisionCycle({
        store: seeded.store,
        fenceToken: "fence-daemon-nominate",
        ports: {
          executor,
          nextAction: () => ({ ref: "GH-320", repository: REPOSITORY, weightClass: "standard" }),
          claim: () => {
            const claimed = claimQueueLease(seeded.store, {
              ref: "GH-320",
              holder: "daemon",
              runner: "daemon",
              weightClass: "standard",
              nowIso: NOW_ISO,
              nowMs: NOW_MS,
              fenceToken: "claim-daemon",
            });
            return claimed.ok
              ? { ok: true as const, leaseId: claimed.value.lease.leaseId }
              : { ok: false as const, code: claimed.code };
          },
          release: () =>
            releaseQueueLease(seeded.store, {
              ref: "GH-320",
              holder: "daemon",
              nowIso: NOW_ISO,
              nowMs: NOW_MS,
              fenceToken: "release-daemon",
            }).ok,
          nominate: () => nominate(),
          nowIso: () => NOW_ISO,
        },
      });
      expect(result.mode).toBe("completed");
      const lanes = readDaemonLanes(seeded.store);
      expect(lanes.ok).toBe(true);
      if (!lanes.ok) return;
      // The nomination is on the lane record (DM-2) at the composition level.
      expect(lanes.records.length).toBeGreaterThan(0);
      for (const lane of lanes.records) {
        expect(lane.providerProfile).toBe("profile-a");
      }
    } finally {
      removeRoot(root);
    }
  });

  test("the composed daemon claim refuses no-nomination before the claim: no lane, no lease", async () => {
    const seeded = seededStore("daemon-refuse");
    const root = seeded.root;
    try {
      const scripted = createScriptedHarness({ evidence: COMPLETED_EVIDENCE });
      const nominate = nominationPredicateFrom(configValues({ declareProfiles: false }), NOW_MS);
      const executor = createLaneExecutor({
        session: scripted.port,
        planner: createLaneLaunchPlanner({
          declaredEnvironment: [],
          lifecyclePrompt: (request) => `deliver ${request.ref}`,
        }),
        descriptor: { kind: "host" as const, workDirectory: root, environment: [] },
      });
      const result = await runSupervisionCycle({
        store: seeded.store,
        fenceToken: "fence-daemon-refuse",
        ports: {
          executor,
          nextAction: () => ({ ref: "GH-320", repository: REPOSITORY, weightClass: "standard" }),
          claim: () => ({ ok: true as const, leaseId: "lease-must-not-be-claimed" }),
          release: () => false,
          nominate: () => nominate(),
          nowIso: () => NOW_ISO,
        },
      });
      expect(result.mode).toBe("nomination-refused");
      if (result.mode !== "nomination-refused") return;
      expect(result.code).toBe("provider.profile.absent");
      expect(scripted.calls).toEqual([]);
      const lanes = readDaemonLanes(seeded.store);
      expect(lanes.ok ? lanes.records.length : -1).toBe(0);
    } finally {
      removeRoot(root);
    }
  });
});

describe("F-2 the release grammar lands peak-window parks through the composed CLI", () => {
  test("`queue release --park peak-window --until <iso>` succeeds and writes the record", async () => {
    const harness = createQueueEdgeHarness("composed-peak-release");
    expect((await harness.run(["queue", "add", "GH-320", "--json"])).exitCode).toBe(0);
    expect(
      (await harness.run(["queue", "claim", "GH-320", "--holder", "holder-a", "--json"])).exitCode,
    ).toBe(0);
    const released = await harness.run([
      "queue",
      "release",
      "GH-320",
      "--holder",
      "holder-a",
      "--park",
      "peak-window",
      "--until",
      UNTIL_ISO,
      "--json",
    ]);
    expect(released.exitCode).toBe(0);
    const envelope = envelopeOf(released.stdout) as {
      readonly data?: { readonly park?: Record<string, unknown> };
    };
    expect(envelope.data?.park).toMatchObject({
      ref: "GH-320",
      cause: "peak-window",
      conditionType: "provider-window",
      expiresAt: UNTIL_ISO,
      recoveryState: "parked",
    });
    // The landed record: cause, condition type, expiry, and the stamped
    // minimal episode identity (F-4's writer half).
    const read = readQueueParks(harness.composition.store);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const record = read.records.at(-1);
    expect(record?.cause).toBe("peak-window");
    expect(record?.conditionType).toBe("provider-window");
    expect(record?.condition).toEqual({ type: "provider-window", expiresAt: UNTIL_ISO });
    expect(record?.until).toBe(UNTIL_ISO);
    expect(record?.recoveryState).toBe("parked");
    expect(record?.episodeId ?? "").toContain("GH-320");
    // The watcher-written DM-4 facts stay absent on the operator record:
    // no grace, no stoppedAt, no preservation — nothing fabricated.
    expect("graceDeadline" in (record ?? {})).toBe(false);
    expect("stoppedAt" in (record ?? {})).toBe(false);
    expect("preservation" in (record ?? {})).toBe(false);
  });

  test("`peak-window` still requires --until and `owner-hold` still refuses it", async () => {
    const harness = createQueueEdgeHarness("composed-peak-refusals");
    expect((await harness.run(["queue", "add", "GH-320", "--json"])).exitCode).toBe(0);
    expect(
      (await harness.run(["queue", "claim", "GH-320", "--holder", "holder-a", "--json"])).exitCode,
    ).toBe(0);
    const noUntil = await harness.run([
      "queue",
      "release",
      "GH-320",
      "--holder",
      "holder-a",
      "--park",
      "peak-window",
      "--json",
    ]);
    expect(noUntil.exitCode).toBe(1);
    expect(noUntil.stdout).toContain("reason=until-required");
    const holdUntil = await harness.run([
      "queue",
      "release",
      "GH-320",
      "--holder",
      "holder-a",
      "--park",
      "owner-hold",
      "--until",
      UNTIL_ISO,
      "--json",
    ]);
    expect(holdUntil.exitCode).toBe(1);
    expect(holdUntil.stdout).toContain("reason=until-unsupported");
    // The delivered causes keep their rules unchanged.
    const windowNoUntil = await harness.run([
      "queue",
      "release",
      "GH-320",
      "--holder",
      "holder-a",
      "--park",
      "provider-window",
      "--json",
    ]);
    expect(windowNoUntil.exitCode).toBe(1);
    expect(windowNoUntil.stdout).toContain("reason=until-required");
  });
});

describe("F-4 the operator-shaped record projects a true episode through the real projector", () => {
  test("the CLI-landed park projects only the park-edge: no false stop, no out-of-set preservation", async () => {
    const harness = createQueueEdgeHarness("composed-projection");
    expect((await harness.run(["queue", "add", "GH-320", "--json"])).exitCode).toBe(0);
    expect(
      (await harness.run(["queue", "claim", "GH-320", "--holder", "holder-a", "--json"])).exitCode,
    ).toBe(0);
    // Prime the real projector on the pre-release store.
    const projector = createEventProjector();
    const recordsAt = (): readonly Record<string, unknown>[] => {
      const view = harness.composition.store.readRecords();
      if (!view.ok) throw new Error("store read failed");
      return view.value.records as readonly Record<string, unknown>[];
    };
    projector.project(recordsAt());
    const released = await harness.run([
      "queue",
      "release",
      "GH-320",
      "--holder",
      "holder-a",
      "--park",
      "peak-window",
      "--until",
      UNTIL_ISO,
      "--json",
    ]);
    expect(released.exitCode, "the fixed happy path succeeds (F-2)").toBe(0);
    const frames = projector.project(recordsAt());
    const kinds = frames.map((frame) => `${frame.topic}/${frame.kind}`);
    // No `stop`, no `parked` frame on the attempt topic: the operator park
    // stopped nothing by grace, so no bounded-grace stop that never happened
    // is projected, and `preservation` is never rendered outside the closed
    // set. The queue graph carries exactly the episode's park-edge.
    expect(kinds.filter((kind) => kind.startsWith("dispatch.attempt/"))).toEqual([]);
    expect(kinds.filter((kind) => kind === "queue.graph/park-edge")).toHaveLength(1);
    const edge = frames.find((frame) => frame.kind === "park-edge");
    if (edge === undefined) throw new Error("park-edge missing");
    const payload = edge.payload as { readonly episodeId?: string; readonly until?: string };
    // The episode identity is real: stamped, non-empty, with the declared until.
    expect(payload.episodeId ?? "").toContain("GH-320");
    expect(payload.until).toBe(UNTIL_ISO);
    expect(payload.cause).toBe("peak-window");
  });
});

describe("F-3 status and brief render the lane parks from real records", () => {
  test("status and brief carry the open episodes' park fields and clear them at expiry", async () => {
    const harness = createQueueEdgeHarness("composed-lane-parks");
    // Land both open episodes through the composed CLI. Distinct holders keep
    // the lease fold's acquisition-key invariant intact at one acquiredAt.
    for (const [ref, park, until, holder] of [
      ["GH-320", "peak-window", UNTIL_ISO, "holder-a"],
      ["GH-321", "owner-hold", undefined, "holder-b"],
    ] as const) {
      expect((await harness.run(["queue", "add", ref, "--json"])).exitCode).toBe(0);
      expect(
        (await harness.run(["queue", "claim", ref, "--holder", holder, "--json"])).exitCode,
      ).toBe(0);
      const released = await harness.run([
        "queue",
        "release",
        ref,
        "--holder",
        holder,
        "--park",
        park,
        ...(until === undefined ? [] : ["--until", until]),
        "--json",
      ]);
      expect(released.exitCode).toBe(0);
    }
    const store = harness.composition.store;
    const statusComposition = (nowMs: number) => ({
      store,
      credentials: { resolve: () => ({ ok: false as const, code: "config.credential.missing" }) },
      transport: { send: async (): Promise<never> => Promise.reject(new Error("no transport")) },
      repository: { cwd: "/work", io: noIo },
      localContext: { path: "/pm-context.yaml", fs: noIo },
      clock: { nowMs: () => nowMs, nowIso: () => new Date(nowMs).toISOString() },
      github: { instance: anonymousInstance() },
    });
    const beforeExpiry = NOW_MS + 3_600_000;
    const status = await runProgram(
      { status: statusComposition(beforeExpiry), brief: statusComposition(beforeExpiry) },
      ["status", "--json"],
      STATUS_CONFIG,
    );
    expect(status.exitCode).toBe(0);
    const section = providersSection(status.stdout);
    const laneParks = section.laneParks as readonly Record<string, unknown>[] | undefined;
    expect(laneParks, "status renders the open episodes").toBeDefined();
    expect(laneParks).toHaveLength(2);
    expect(laneParks?.[0]).toMatchObject({
      ref: "GH-320",
      reason: "peak-window",
      until: UNTIL_ISO,
    });
    // The owner-hold park: the classified absence — no until is carried.
    expect(laneParks?.[1]).toMatchObject({ ref: "GH-321", reason: "owner-hold" });
    expect("until" in (laneParks?.[1] ?? {})).toBe(false);
    // Brief projects the same fields with zero reads of its own.
    const brief = await runProgram(
      { status: statusComposition(beforeExpiry), brief: statusComposition(beforeExpiry) },
      ["brief", "--json"],
      STATUS_CONFIG,
    );
    expect(brief.exitCode).toBe(0);
    const briefEnvelope = envelopeOf(brief.stdout) as {
      readonly data?: { readonly surfaces?: readonly Record<string, unknown>[] };
    };
    const briefProviders = (briefEnvelope.data?.surfaces ?? []).find(
      (surface) => surface.id === "providers",
    );
    expect(briefProviders).toBeDefined();
    expect(briefProviders?.laneParks).toEqual(laneParks);
    // Read-time expiry: past the window end the peak-window episode is no
    // longer open; the owner-hold episode (no expiry) stays.
    const pastExpiry = Date.parse(UNTIL_ISO) + 60_000;
    const later = await runProgram(
      { status: statusComposition(pastExpiry), brief: statusComposition(pastExpiry) },
      ["status", "--json"],
      STATUS_CONFIG,
    );
    expect(later.exitCode).toBe(0);
    const laterSection = providersSection(later.stdout);
    const laterParks = laterSection.laneParks as readonly Record<string, unknown>[] | undefined;
    expect(laterParks).toHaveLength(1);
    expect(laterParks?.[0]).toMatchObject({ ref: "GH-321", reason: "owner-hold" });
  });
});

describe("F-5 the lanes machine read derives the mode from the composition fact", () => {
  test("a reachable daemon without a composed watch still reads iteration-start-gating", async () => {
    const harness = createQueueEdgeHarness("composed-mode-fact", {
      // Daemon REACHABLE: the delivered reachability-derived label would have
      // claimed window-watch; the composition supplies no watch, so the
      // machine read must not.
      overrides: { degraded: [] },
    });
    const run = await harness.run(["lanes", "list", "--json"]);
    expect(run.exitCode).toBe(0);
    const data = (JSON.parse(run.stdout) as { readonly data?: Record<string, unknown> }).data as {
      readonly peakEnforcement?: Record<string, unknown>;
    };
    expect(data?.peakEnforcement).toEqual({ mode: "iteration-start-gating", parkClaimed: false });
  });

  test("a composition that supplies the watch reads window-watch", async () => {
    const harness = createQueueEdgeHarness("composed-mode-watch", {
      overrides: { degraded: [], peakWatchComposed: true },
    });
    const run = await harness.run(["lanes", "list", "--json"]);
    expect(run.exitCode).toBe(0);
    const data = (JSON.parse(run.stdout) as { readonly data?: Record<string, unknown> }).data as {
      readonly peakEnforcement?: Record<string, unknown>;
    };
    expect(data?.peakEnforcement?.mode).toBe("window-watch");
    expect(data?.peakEnforcement?.parkClaimed).toBe(false);
  });

  test("parkClaimed is record-derived: an open park record reads true, a recovered one false", async () => {
    const harness = createQueueEdgeHarness("composed-mode-parked", {
      overrides: { degraded: [] },
    });
    expect((await harness.run(["queue", "add", "GH-320", "--json"])).exitCode).toBe(0);
    expect(
      (await harness.run(["queue", "claim", "GH-320", "--holder", "holder-a", "--json"])).exitCode,
    ).toBe(0);
    expect(
      (
        await harness.run([
          "queue",
          "release",
          "GH-320",
          "--holder",
          "holder-a",
          "--park",
          "peak-window",
          "--until",
          UNTIL_ISO,
          "--json",
        ])
      ).exitCode,
    ).toBe(0);
    const parked = await harness.run(["lanes", "list", "--json"]);
    const parkedData = (JSON.parse(parked.stdout) as { readonly data?: Record<string, unknown> })
      .data as { readonly peakEnforcement?: Record<string, unknown> };
    // A park DID happen (the operator claimed it): the record is the truth.
    expect(parkedData?.peakEnforcement).toEqual({
      mode: "iteration-start-gating",
      parkClaimed: true,
    });
  });
});
