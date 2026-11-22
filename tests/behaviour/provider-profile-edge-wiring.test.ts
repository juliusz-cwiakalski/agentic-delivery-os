/**
 * TC-PROFILE-043/044/046 (production-wiring half) — the real CLI edge carries
 * every spec-declared provider flag into the production engine: `--profile`,
 * `--agent`, `--for-spawn`, and `--provider`. These tests drive
 * `createConfigProgram` + `runCli` (not a stub command runtime), so a flag the
 * edge drops fails here rather than passing against a contract-only fake.
 *
 * TC-PROFILE-024..028 (production half) — the switch/revert/persist lifecycle
 * is reachable from the production `profile resolve` path with the synchronous
 * probe (enabled + UTC peak) and an injected clock/state store.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  CredentialPort,
  ProviderClock,
  QuotaTransport,
  StateStorePort,
} from "@delivery-os/core/contracts";
import { PROVIDER_PARK_RECORD_KEY } from "@delivery-os/core/contracts";
import { createConfigProgram } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { createParkRecord, persistProviderResolution } from "../../packages/core/src/provider/parks";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const PEAK_ACTIVE = Date.UTC(2026, 0, 1, 7, 0, 0);
const PEAK_CLEAR = Date.UTC(2026, 0, 1, 12, 0, 0);
const OUTSIDE_PEAKS = Date.UTC(2026, 0, 1, 18, 0, 0);
const COMMITTED_CONFIG = readFileSync(join(process.cwd(), ".jaiship/config.yaml"), "utf8");

const CONFIG = `provider:
  defaultChain: default
  credentials:
    zai:
      sourceKey:
        style: literal
        name: ZAI_API_KEY
  entries:
    p0:
      class: subscription
      peak:
        timezone: UTC
        startSecondsOfDay: 21600
        endSecondsOfDay: 36000
        bufferSeconds: 0
    p1:
      class: subscription
  chains:
    default:
      entries:
        - p1
        - p0
      allowPaidFallback: false
  profiles:
    tiers:
      primary: {}
      secondary: {}
    profiles:
      base:
        tier: primary
        providers:
          - p0
        seats:
          pm:
            model: p0-model
            pacingClass: judgment
            capability: text-only
        agentOverrides:
          reviewer: pm
      fallback:
        tier: secondary
        providers:
          - p1
        seats:
          pm:
            model: p1-model
            pacingClass: execution
            capability: text-only
    preferenceChain:
      base: base
      fallbacks:
        - fallback
    watch:
      p0:
        mapping: deepseek-balance
        endpoint: https://p0.test/balance
        credentialRef: zai
        floor: 5
`;

type Sink = { write: (chunk: string) => void; readonly value: string };
const sink = (): Sink => {
  let text = "";
  return {
    write: (chunk) => {
      text += chunk;
    },
    get value() {
      return text;
    },
  };
};

const roots: string[] = [];

afterEach(() => {
  for (const root of roots) removeRoot(root);
  roots.length = 0;
});

type Harness = {
  readonly run: (
    args: readonly string[],
  ) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  readonly store: StateStorePort;
  readonly root: string;
  readonly setNow: (value: number) => void;
  readonly contentReads: string[];
  readonly existenceProbes: string[];
};

type HarnessOptions = {
  readonly config?: string;
  readonly seed?: (store: StateStorePort) => void;
};

const harness = (options: HarnessOptions = {}): Harness => {
  const root = makeTempRoot("provider-profile-edge");
  roots.push(root);
  const store = openStore(makeIdentity(root)).store;
  const configText = options.config ?? CONFIG;
  options.seed?.(store);
  let now = PEAK_CLEAR;
  const clock: ProviderClock = { nowMs: () => now };
  const contentReads: string[] = [];
  const existenceProbes: string[] = [];
  let counter = 0;
  const credentialPort: CredentialPort = {
    resolve: () => ({ ok: true, material: { value: "CANARY-SECRET" } }),
  };
  const transport: QuotaTransport = {
    send: async () => ({
      status: 200,
      bodyText: JSON.stringify({ currency: "USD", balance: 12.5 }),
    }),
  };
  const program = createConfigProgram({
    workingName: "synthetic",
    environment: {},
    cwd: "/repo",
    homeDirectory: "/home/synthetic",
    platform: "linux",
    fs: {
      exists: (path) => {
        existenceProbes.push(path);
        return path === "/repo/.synthetic/config.yaml";
      },
      readText: (path) => {
        contentReads.push(path);
        if (path !== "/repo/.synthetic/config.yaml") throw new Error("missing file");
        return configText;
      },
    },
    repositoryIo: {
      exists: (path) => path === "/repo/.git",
      isFile: () => false,
      readText: () => "",
    },
    provider: {
      clock,
      credentialPort,
      transport,
      sleep: { sleep: async () => undefined },
      stateStore: store,
      newFenceToken: () => `fence-${counter++}`,
    },
  });
  if (!program.ok) throw new Error("program composition failed");
  const run = async (
    args: readonly string[],
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
    const stdout = sink();
    const stderr = sink();
    const deps: CliDependencies = {
      brand: program.brand,
      clock: { now: () => now },
      newRunId: () => "run-provider-profile-edge",
      secrets: program.secrets,
      program: program.program,
    };
    const exitCode = await runCli(["provider", ...args], { stdout, stderr }, deps);
    return { exitCode, stdout: stdout.value, stderr: stderr.value };
  };
  return {
    run,
    store,
    root,
    setNow: (value) => {
      now = value;
    },
    contentReads,
    existenceProbes,
  };
};

const data = (stdout: string): Record<string, unknown> =>
  (JSON.parse(stdout) as { data: Record<string, unknown> }).data;
const error = (stdout: string): Record<string, unknown> =>
  (JSON.parse(stdout) as { error: Record<string, unknown> }).error;

describe("GH-377 TC-PROFILE-059/060 recorded parks drive the production profile resolve", () => {
  const seedZaiQuotaPark = (store: StateStorePort): void => {
    const park = createParkRecord({
      subjectKind: "provider",
      subjectName: "zai-coding-plan",
      cause: "quota-exhausted",
      conditions: ["quota-exhausted"],
      createdAtMs: OUTSIDE_PEAKS - 60_000,
      expiresAtMs: OUTSIDE_PEAKS + 3_600_000,
      evidence: {},
    });
    const persisted = persistProviderResolution({
      store,
      fenceToken: "seed-zai-quota",
      nowMs: OUTSIDE_PEAKS - 60_000,
      parks: [park],
      announcements: [],
    });
    if (!persisted.ok) throw new Error("park seed failed");
  };

  test("TC-PROFILE-059 a quota park selects paid without a local override", async () => {
    const before = createHash("sha256").update(COMMITTED_CONFIG).digest("hex");
    const { run, setNow, contentReads } = harness({
      config: COMMITTED_CONFIG,
      seed: seedZaiQuotaPark,
    });
    setNow(OUTSIDE_PEAKS);
    const result = await run(["profile", "resolve", "--agent", "pm", "--for-spawn", "--json"]);
    expect(result.exitCode).toBe(0);
    const envelope = data(result.stdout);
    // The delivered lifecycle returns `switched` on the first base→fallback
    // move and `selected` once the target is stable; the selection facts are
    // the contract (spec §8.5 keeps the lifecycle unchanged).
    expect(["selected", "switched"]).toContain(String(envelope.outcome));
    expect(envelope.profile).toBe("paid");
    const eligibility = envelope.eligibility as readonly Record<string, unknown>[];
    const delivery = eligibility.find((entry) => entry.profile === "delivery");
    expect(delivery?.verdict).toBe("ineligible");
    const blockers = (delivery?.blockers ?? []) as readonly Record<string, unknown>[];
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toMatchObject({ kind: "condition", value: "quota-exhausted" });
    expect(String(blockers[0]?.detail)).toContain("zai-coding-plan");
    expect(eligibility.find((entry) => entry.profile === "paid")?.verdict).toBe("eligible");

    const envRecord = envelope.envRecord as { readonly entries: readonly Record<string, unknown>[] };
    const values = envRecord.entries.map((entry) => entry.value);
    expect(values).toContain("deepseek/deepseek-flash");
    expect(values.some((value) => String(value).includes("zai-coding-plan"))).toBe(false);
    expect(contentReads.filter((path) => path.includes("config.local.yaml"))).toEqual([]);
    expect(createHash("sha256").update(COMMITTED_CONFIG).digest("hex")).toBe(before);
  });

  test("TC-PROFILE-060 healthy facts select delivery and shadow paid", async () => {
    const { run, setNow } = harness({ config: COMMITTED_CONFIG });
    setNow(OUTSIDE_PEAKS);
    const result = await run(["profile", "resolve", "--agent", "pm", "--for-spawn", "--json"]);
    expect(result.exitCode).toBe(0);
    const envelope = data(result.stdout);
    expect(envelope.outcome).toBe("selected");
    expect(envelope.profile).toBe("delivery");
    const eligibility = envelope.eligibility as readonly Record<string, unknown>[];
    expect(eligibility.find((entry) => entry.profile === "delivery")).toMatchObject({
      verdict: "eligible",
    });
    expect(eligibility.find((entry) => entry.profile === "paid")).toMatchObject({
      verdict: "shadowed",
      blockers: [],
    });
    const envRecord = envelope.envRecord as { readonly entries: readonly Record<string, unknown>[] };
    expect(envRecord.entries.map((entry) => entry.value)).toContain("zai-coding-plan/glm-5.3-flash");
  });
});

describe("TC-PROFILE-043 `provider resolve --profile` production wiring", () => {
  test("a known profile scopes candidates to its providers", async () => {
    const { run } = harness();
    const result = await run(["resolve", "--profile", "base", "--json"]);
    expect(result.exitCode).toBe(0);
    const envelope = data(result.stdout);
    expect(envelope.profile).toBe("base");
    expect(envelope.decision).toMatchObject({ kind: "selected", providerName: "p0" });
  });

  test("an unknown profile is classified at exit 1 in production", async () => {
    const { run } = harness();
    const result = await run(["resolve", "--profile", "ghost", "--json"]);
    expect(result.exitCode).toBe(1);
    expect(error(result.stdout).code).toBe("provider.profile.invalid");
  });

  test("the flag absent keeps the delivered resolve unchanged", async () => {
    const { run } = harness();
    const result = await run(["resolve", "--json"]);
    expect(result.exitCode).toBe(0);
    const envelope = data(result.stdout);
    expect(envelope.profile).toBeUndefined();
    expect(envelope.decision).toMatchObject({ kind: "selected", providerName: "p1" });
  });
});

describe("TC-PROFILE-044/024..028 profile resolve production wiring", () => {
  test("`--agent` is carried into the production profile resolve", async () => {
    const { run } = harness();
    const result = await run(["profile", "resolve", "--agent", "reviewer", "--json"]);
    expect(result.exitCode).toBe(0);
    const envelope = data(result.stdout);
    expect(envelope.outcome).toBe("selected");
    expect(envelope.profile).toBe("base");
    expect(envelope.agentOverrides).toEqual({ reviewer: "pm" });
  });

  test("`--for-spawn` returns the structured data-v1 env record", async () => {
    const { run } = harness();
    const result = await run(["profile", "resolve", "--for-spawn", "--json"]);
    expect(result.exitCode).toBe(0);
    const envelope = data(result.stdout);
    const envRecord = envelope.envRecord as Record<string, unknown>;
    expect(envRecord.recordFormat).toBe("data-v1");
    expect(envRecord.serialized).toContain("# model-env data-v1");
    expect(JSON.stringify(envelope)).not.toContain("CANARY-SECRET");
  });

  test("a peak-window park switches, persists the target, and emits EVT-1", async () => {
    const { run, store, setNow } = harness();
    setNow(PEAK_ACTIVE);
    const first = await run(["profile", "resolve", "--json"]);
    expect(first.exitCode).toBe(0);
    const envelope = data(first.stdout);
    expect(envelope.outcome).toBe("switched");
    expect(envelope.profile).toBe("fallback");
    const events = envelope.events as readonly Record<string, unknown>[];
    const switched = events.find((event) => event.code === "profile.switched");
    expect(switched?.evidence).toMatchObject({
      previousProfile: "base",
      newProfile: "fallback",
      reason: "switch",
      revertCondition: "peak-window",
      providerName: "p0",
    });

    const persisted = store.read({ requiredKeys: ["provider.profile-target"] });
    expect(persisted.ok).toBe(true);
    if (!persisted.ok) return;
    expect(persisted.value.values["provider.profile-target"]).toMatchObject({
      targetProfile: "fallback",
      reason: "switch",
    });

    const second = await run(["profile", "resolve", "--json"]);
    expect(second.exitCode).toBe(0);
    const stable = data(second.stdout);
    expect(stable.outcome).toBe("selected");
    expect(stable.profile).toBe("fallback");
    const secondEvents = stable.events as readonly Record<string, unknown>[];
    expect(secondEvents.filter((event) => event.code === "profile.switched")).toHaveLength(0);
  });

  test("recovery reverts once and persists the restored target", async () => {
    const { run, store, setNow } = harness();
    setNow(PEAK_ACTIVE);
    const parked = await run(["profile", "resolve", "--json"]);
    expect(parked.exitCode).toBe(0);
    expect(data(parked.stdout).outcome).toBe("switched");

    setNow(PEAK_CLEAR);
    const recovered = await run(["profile", "resolve", "--json"]);
    expect(recovered.exitCode).toBe(0);
    const envelope = data(recovered.stdout);
    expect(envelope.outcome).toBe("reverted");
    expect(envelope.profile).toBe("base");
    const events = envelope.events as readonly Record<string, unknown>[];
    const reverted = events.find((event) => event.code === "profile.reverted");
    expect(reverted?.evidence).toMatchObject({
      previousProfile: "fallback",
      newProfile: "base",
      reason: "revert",
      providerName: "p0",
    });

    const persisted = store.read({ requiredKeys: ["provider.profile-target"] });
    expect(persisted.ok).toBe(true);
    if (!persisted.ok) return;
    expect(persisted.value.values["provider.profile-target"]).toMatchObject({
      targetProfile: "base",
      reason: "revert",
    });

    const stable = await run(["profile", "resolve", "--json"]);
    expect(stable.exitCode).toBe(0);
    const stableEnvelope = data(stable.stdout);
    expect(stableEnvelope.outcome).toBe("selected");
    const stableEvents = stableEnvelope.events as readonly Record<string, unknown>[];
    expect(stableEvents.filter((event) => event.code === "profile.reverted")).toHaveLength(0);
  });
});

describe("TC-PROFILE-045/046 `provider watch status --provider` production wiring", () => {
  test("a declared provider filter drives the production watch reader", async () => {
    const { run } = harness();
    const result = await run(["watch", "status", "--provider", "p0", "--json"]);
    expect(result.exitCode).toBe(0);
    const envelope = data(result.stdout);
    const providers = envelope.providers as readonly Record<string, unknown>[];
    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({ name: "p0", condition: "clear" });
    expect(result.stdout).not.toContain("CANARY-SECRET");
  });

  test("an undeclared provider filter is a classified rejection", async () => {
    const { run } = harness();
    const result = await run(["watch", "status", "--provider", "ghost", "--json"]);
    expect(result.exitCode).toBe(1);
    expect(error(result.stdout).code).toBe("input.value.rejected");
  });
});

const SEAT_REFUSAL_CONFIG = `provider:
  defaultChain: default
  entries:
    a:
      class: subscription
    b:
      class: subscription
    parked:
      class: pay-per-token
  chains:
    default:
      entries: [a]
      allowPaidFallback: false
  profiles:
    tiers:
      t: {}
    profiles:
      primary:
        tier: t
        providers: [a]
        seats:
          pm:
            model: parked/parked-model
            pacingClass: judgment
            capability: text-only
      narrow:
        tier: t
        providers: [b]
        seats:
          coder:
            model: b/coder-model
            pacingClass: execution
            capability: text-only
    preferenceChain:
      base: primary
      fallbacks: [narrow]
`;

describe("GH-377 TC-PROFILE-071 the seat-level refusal projects the delivered data envelope", () => {
  test("exit 2 with data present, the unchanged list, no profile event, and no writes", async () => {
    const seedParked = (store: StateStorePort): void => {
      const park = createParkRecord({
        subjectKind: "provider",
        subjectName: "parked",
        cause: "quota-exhausted",
        conditions: ["quota-exhausted"],
        createdAtMs: OUTSIDE_PEAKS - 60_000,
        expiresAtMs: OUTSIDE_PEAKS + 3_600_000,
        evidence: {},
      });
      const persisted = persistProviderResolution({
        store,
        fenceToken: "seed-seat-refusal",
        nowMs: OUTSIDE_PEAKS - 60_000,
        parks: [park],
        announcements: [],
      });
      if (!persisted.ok) throw new Error("park seed failed");
    };
    const { run, store, setNow } = harness({ config: SEAT_REFUSAL_CONFIG, seed: seedParked });
    setNow(OUTSIDE_PEAKS);
    const before = store.read({ requiredKeys: [] });
    if (!before.ok) throw new Error("store read failed");
    const beforeKeys = Object.keys(before.value.values).sort();
    const result = await run(["profile", "resolve", "--agent", "pm", "--for-spawn", "--json"]);
    expect(result.exitCode).toBe(2);
    const envelope = JSON.parse(result.stdout) as {
      readonly data?: Record<string, unknown>;
      readonly error?: Record<string, unknown>;
    };
    expect(envelope.error).toBeUndefined();
    const data = envelope.data;
    if (data === undefined) throw new Error("data absent");
    expect(data.outcome).toBe("refused");
    expect(data.code).toBe("provider.profile.unavailable");
    expect(String(data.summary)).toContain("pm");
    expect(String(data.summary)).toContain("parked");
    expect(data.eligibility).toEqual([
      { profile: "primary", verdict: "eligible", blockers: [] },
      { profile: "narrow", verdict: "shadowed", blockers: [] },
    ]);
    expect(data.events).toEqual([]);
    expect(data.envRecord).toBeUndefined();
    const after = store.read({ requiredKeys: [] });
    if (!after.ok) throw new Error("store read failed");
    expect(Object.keys(after.value.values).sort()).toEqual(beforeKeys);
  });
});

describe("GH-377 TC-PROFILE-075 advancing past expiry restores the preferred profile", () => {
  test("a recorded quota park switches to paid and reverts once after its expiry", async () => {
    const expiry = OUTSIDE_PEAKS + 3_600_000;
    const seedParked = (store: StateStorePort): void => {
      const park = createParkRecord({
        subjectKind: "provider",
        subjectName: "zai-coding-plan",
        cause: "quota-exhausted",
        conditions: ["quota-exhausted"],
        createdAtMs: OUTSIDE_PEAKS - 60_000,
        expiresAtMs: expiry,
        evidence: {},
      });
      const persisted = persistProviderResolution({
        store,
        fenceToken: "seed-expiry",
        nowMs: OUTSIDE_PEAKS - 60_000,
        parks: [park],
        announcements: [],
      });
      if (!persisted.ok) throw new Error("park seed failed");
    };
    const { run, store, setNow } = harness({ config: COMMITTED_CONFIG, seed: seedParked });
    setNow(expiry - 1_000);
    const parked = await run(["profile", "resolve", "--agent", "pm", "--for-spawn", "--json"]);
    expect(parked.exitCode).toBe(0);
    const parkedEnvelope = data(parked.stdout);
    expect(parkedEnvelope.profile).toBe("paid");

    const before = store.read({ requiredKeys: [PROVIDER_PARK_RECORD_KEY] });
    if (!before.ok) throw new Error("park read failed");
    setNow(expiry + 1_000);
    const recovered = await run(["profile", "resolve", "--agent", "pm", "--for-spawn", "--json"]);
    expect(recovered.exitCode).toBe(0);
    const recoveredEnvelope = data(recovered.stdout);
    expect(recoveredEnvelope.profile).toBe("delivery");
    expect(recoveredEnvelope.outcome).toBe("reverted");
    const events = recoveredEnvelope.events as readonly Record<string, unknown>[];
    expect(events.filter((event) => event.code === "profile.reverted")).toHaveLength(1);
    const after = store.read({ requiredKeys: [PROVIDER_PARK_RECORD_KEY] });
    expect(after.ok && JSON.stringify(after.value.values)).toBe(
      before.ok ? JSON.stringify(before.value.values) : "",
    );

    const stable = await run(["profile", "resolve", "--agent", "pm", "--for-spawn", "--json"]);
    expect(stable.exitCode).toBe(0);
    const stableEvents = data(stable.stdout).events as readonly Record<string, unknown>[];
    expect(stableEvents.filter((event) => event.code === "profile.reverted")).toHaveLength(0);
  });
});
