/**
 * GH-350 TC-SIM-001, -002, -004..-008 — the `provider simulate` contract at the
 * command layer: strict versioned facts, the delivered engine replayed with
 * fixture seams, additive payload, determinism, exits, and in-document
 * selection.
 *
 * Every case materialises its configuration and fixture as injected strings: no
 * case reads the ambient environment, a live home, a network, the local delivery
 * context, or the repository's own configuration.
 */
import { describe, expect, test } from "bun:test";
import type {
  ProviderComposition,
  ProviderSpendTotalsPort,
  ProviderSpendTotalsRead,
} from "@delivery-os/core/contracts";
import { PROVIDER_SIMULATE_FIXTURE_MAX_BYTES } from "@delivery-os/core/contracts";
import {
  PROVIDER_SIMULATE_CREDENTIAL_OUTCOMES,
  PROVIDER_SIMULATE_KEYS,
  PROVIDER_SIMULATE_SCHEMA_VERSION,
  parseProviderSimulateFixture,
  simulateProviderResolution,
} from "@delivery-os/core/provider";
import { createConfigProgram } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { ERROR_TABLE } from "../../packages/core/src/contracts/error-table";
import { createProviderEngine } from "../../packages/core/src/provider/engine";
import { parseAndValidateProviderConfiguration } from "../../packages/core/src/provider/validate";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
const NOW_ISO = "2026-01-01T12:00:00Z";
const CONFIG_PATH = "/repo/.jaiship/config.yaml";
const FIXTURE_PATH = "/repo/simulate.json";

type Run = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string; readonly summary?: string; readonly kind?: string };
  readonly fixtureReads: readonly string[];
  readonly seamCalls: {
    readonly credential: number;
    readonly transport: number;
    readonly spend: number;
    readonly ref: number;
  };
};

type HarnessOptions = {
  readonly config: string;
  readonly fixture?: string;
  readonly fixturePath?: string;
  readonly configPath?: string;
  readonly fixtureExists?: boolean;
  readonly fixtureReadable?: boolean;
  readonly spend?: (input: {
    readonly scopes: readonly unknown[];
  }) => Promise<ProviderSpendTotalsRead>;
  readonly ref?:
    | { readonly status: "resolved"; readonly workItemRef: string }
    | { readonly status: "unresolved" };
};

const harness = (options: HarnessOptions) => {
  const root = makeTempRoot("gh350-simulate");
  const store = openStore(makeIdentity(root)).store;
  const fixtureReads: string[] = [];
  const seamCalls = { credential: 0, transport: 0, spend: 0, ref: 0 };
  const configPath = options.configPath ?? CONFIG_PATH;
  const fixturePath = options.fixturePath ?? FIXTURE_PATH;
  const fixture = options.fixture;

  const provider: ProviderComposition = {
    clock: { nowMs: () => NOW },
    credentialPort: {
      resolve: () => {
        seamCalls.credential += 1;
        throw new Error("simulate must not resolve a credential");
      },
    },
    transport: {
      send: async () => {
        seamCalls.transport += 1;
        throw new Error("simulate must not call a real transport");
      },
    },
    sleep: { sleep: async () => undefined },
    stateStore: store,
    newFenceToken: () => "fence-simulate",
    spendTotals: {
      read: async (input) => {
        seamCalls.spend += 1;
        if (options.spend !== undefined) return options.spend(input);
        throw new Error("simulate must not use the composition's spend port");
      },
    },
    resolveWorkItemRef: () => {
      seamCalls.ref += 1;
      return options.ref ?? { status: "unresolved" };
    },
    workItemContextPath: "/repo/.ai/local/pm-context.yaml",
    fixtureFs: {
      exists: (path) => {
        if (path !== fixturePath) return false;
        return options.fixtureExists ?? true;
      },
      readText: (path) => {
        fixtureReads.push(path);
        if (options.fixtureReadable === false) throw new Error("unreadable fixture");
        if (fixture === undefined) throw new Error("no fixture supplied");
        return fixture;
      },
    },
  };

  const program = createConfigProgram({
    workingName: "jaiship",
    environment: { HOME: "/home/synthetic", XDG_CONFIG_DIRS: "/etc/xdg" },
    cwd: "/repo",
    homeDirectory: "/home/synthetic",
    platform: "linux",
    fs: {
      exists: (path) => path === configPath,
      readText: (path) => {
        if (path !== configPath) throw new Error("missing file");
        return options.config;
      },
    },
    repositoryIo: {
      exists: (path) => path === "/repo/.git",
      isFile: () => false,
      readText: () => "",
    },
    provider,
  });
  if (!program.ok) throw new Error("the provider program did not compose");

  const run = async (argv: readonly string[]): Promise<Run> => {
    let stdout = "";
    let stderr = "";
    const deps: CliDependencies = {
      brand: program.brand,
      clock: { now: () => NOW },
      newRunId: () => "run-gh350-simulate",
      secrets: program.secrets,
      program: program.program,
    };
    const exitCode = await runCli(
      ["provider", ...argv],
      {
        stdout: { write: (chunk: string) => (stdout += chunk) },
        stderr: { write: (chunk: string) => (stderr += chunk) },
      },
      deps,
    );
    const parsed =
      stdout.trim().length === 0 ? undefined : (JSON.parse(stdout) as Record<string, unknown>);
    return {
      exitCode,
      stdout,
      stderr,
      ...(parsed === undefined
        ? {}
        : {
            ...(parsed.data === undefined ? {} : { data: parsed.data as Record<string, unknown> }),
            ...(parsed.error === undefined ? {} : { error: parsed.error as Run["error"] }),
          }),
      fixtureReads,
      seamCalls,
    };
  };

  return {
    run,
    fixtureReads,
    seamCalls,
    dispose: () => {
      removeRoot(root);
    },
  };
};

/* -------------------------------- fixtures ------------------------------- */

const PEAK_CONFIG = `provider:
  defaultChain: ch
  entries:
    sub:
      class: subscription
      peak:
        startSecondsOfDay: 0
        endSecondsOfDay: 86399
    alt:
      class: subscription
  chains:
    ch:
      entries:
        - sub
    alt-chain:
      entries:
        - alt
  profiles:
    tiers:
      t:
        description: simulate tier
    profiles:
      prof:
        tier: t
        providers:
          - alt
        seats:
          seat:
            model: simulate-model
            pacingClass: judgment
            capability: text-only
    preferenceChain:
      base: prof
`;

const CLEAR_CONFIG = `provider:
  defaultChain: ch
  entries:
    sub:
      class: subscription
  chains:
    ch:
      entries:
        - sub
`;

const BUDGET_CONFIG = `provider:
  defaultChain: ch
  entries:
    sub:
      class: subscription
  chains:
    ch:
      entries:
        - sub
  budgets:
    ticket-cap:
      scope: ticket
      basis: cost
      ceiling: 40
`;

const fixtureOf = (value: Record<string, unknown>): string => JSON.stringify(value);

const minimalFixture: Record<string, unknown> = {
  schemaVersion: PROVIDER_SIMULATE_SCHEMA_VERSION,
  now: NOW_ISO,
};

/* -------------------------------- TC-SIM-001 ----------------------------- */

describe("TC-SIM-001 grammar is validated before any read, probe, or write", () => {
  test("9/9 refusals with the delivered identities, zero fixture opens, control accepted", async () => {
    const h = harness({
      config: CLEAR_CONFIG,
      fixture: fixtureOf(minimalFixture),
    });
    try {
      const arms: readonly {
        readonly label: string;
        readonly argv: readonly string[];
        readonly code: string;
      }[] = [
        { label: "no --fixture", argv: ["simulate", "--json"], code: "input.value.rejected" },
        {
          label: "no value",
          argv: ["simulate", "--fixture", "--json"],
          code: "fallback.invocation",
        },
        {
          label: "unknown flag",
          argv: ["simulate", "--fixture", FIXTURE_PATH, "--bogus", "--json"],
          code: "fallback.invocation",
        },
        {
          label: "--chain",
          argv: ["simulate", "--fixture", FIXTURE_PATH, "--chain", "x", "--json"],
          code: "input.value.rejected",
        },
        {
          label: "--profile",
          argv: ["simulate", "--fixture", FIXTURE_PATH, "--profile", "y", "--json"],
          code: "input.value.rejected",
        },
        {
          label: "--all",
          argv: ["simulate", "--fixture", FIXTURE_PATH, "--all", "--json"],
          code: "input.value.rejected",
        },
        {
          label: "positional",
          argv: ["simulate", "--fixture", FIXTURE_PATH, "extra", "--json"],
          code: "input.value.rejected",
        },
        {
          label: "unknown subcommand",
          argv: ["simulator", "--json"],
          code: "input.value.rejected",
        },
        {
          label: "duplicated --fixture",
          argv: ["simulate", "--fixture", FIXTURE_PATH, "--fixture", FIXTURE_PATH, "--json"],
          code: "input.value.rejected",
        },
      ];
      for (const arm of arms) {
        const run = await h.run(arm.argv);
        expect(run.exitCode, arm.label).toBe(1);
        expect(run.error?.code, arm.label).toBe(arm.code);
        expect(run.data, arm.label).toBeUndefined();
        expect(run.fixtureReads, arm.label).toEqual([]);
      }
      const control = await h.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
      expect(control.exitCode).toBe(0);
      expect(control.data?.decision).toBeDefined();
      expect(control.fixtureReads).toEqual([FIXTURE_PATH]);
    } finally {
      h.dispose();
    }
  });
});

/* -------------------------------- TC-SIM-002 ----------------------------- */

describe("TC-SIM-002 the fixture is strict, bounded, and free of credential values", () => {
  const invalid: readonly { readonly label: string; readonly fixture: Record<string, unknown> }[] =
    [
      {
        label: "unknown top-level key",
        fixture: { ...minimalFixture, extra: true },
      },
      {
        label: "unknown nested key",
        fixture: {
          ...minimalFixture,
          credentials: { c: { value: "CANARY" } },
        },
      },
      {
        label: "missing schemaVersion",
        fixture: { now: NOW_ISO },
      },
      {
        label: "missing now",
        fixture: { schemaVersion: PROVIDER_SIMULATE_SCHEMA_VERSION },
      },
      {
        label: "now without an explicit zone",
        fixture: { ...minimalFixture, now: "2026-01-01T12:00:00" },
      },
      {
        label: "wrong type for chain",
        fixture: { ...minimalFixture, chain: 42 },
      },
      {
        label: "unsupported schemaVersion",
        fixture: { ...minimalFixture, schemaVersion: "delivery.provider.simulate.v2" },
      },
      {
        label: "credentials.x.value",
        fixture: { ...minimalFixture, credentials: { x: { value: "CANARY" } } },
      },
      {
        label: "a secret inside a quota block",
        fixture: {
          ...minimalFixture,
          quota: { sub: { httpStatus: 200, body: "{}", secret: "CANARY" } },
        },
      },
    ];

  test("9/9 structural defects refuse input.value.rejected naming the field, no content echoed", async () => {
    for (const arm of invalid) {
      const h = harness({ config: CLEAR_CONFIG, fixture: fixtureOf(arm.fixture) });
      try {
        const run = await h.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
        expect(run.exitCode, arm.label).toBe(1);
        expect(run.error?.code, arm.label).toBe("input.value.rejected");
        expect(run.error?.summary, arm.label).toBeDefined();
        expect(run.stdout, arm.label).not.toContain("CANARY");
        expect(run.data, arm.label).toBeUndefined();
      } finally {
        h.dispose();
      }
    }
  });

  test("the byte bound is the declared constant: 65535 and 65536 accepted, 65537 refused", async () => {
    const base = fixtureOf(minimalFixture);
    const padTo = (bytes: number): string => {
      const padding = bytes - Buffer.byteLength(base, "utf8");
      if (padding < 0) throw new Error("fixture already over the bound");
      return `${base}${" ".repeat(padding)}`;
    };
    expect(Buffer.byteLength(padTo(PROVIDER_SIMULATE_FIXTURE_MAX_BYTES - 1), "utf8")).toBe(
      PROVIDER_SIMULATE_FIXTURE_MAX_BYTES - 1,
    );
    for (const bytes of [
      PROVIDER_SIMULATE_FIXTURE_MAX_BYTES - 1,
      PROVIDER_SIMULATE_FIXTURE_MAX_BYTES,
    ]) {
      const h = harness({ config: CLEAR_CONFIG, fixture: padTo(bytes) });
      try {
        const run = await h.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
        expect(run.exitCode, String(bytes)).toBe(0);
      } finally {
        h.dispose();
      }
    }
    const over = harness({
      config: CLEAR_CONFIG,
      fixture: padTo(PROVIDER_SIMULATE_FIXTURE_MAX_BYTES + 1),
    });
    try {
      const run = await over.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
      expect(run.exitCode).toBe(1);
      expect(run.error?.code).toBe("input.value.rejected");
      expect(run.error?.summary).toContain("65536");
      expect(run.error?.summary).toContain("65537");
    } finally {
      over.dispose();
    }
  });

  test("the schema has no credential value field: the outcome is a closed enum", () => {
    expect([...PROVIDER_SIMULATE_CREDENTIAL_OUTCOMES]).toEqual(["resolved", "missing", "rejected"]);
    for (const forbidden of ["value", "secret", "token", "key"]) {
      expect([...PROVIDER_SIMULATE_KEYS], forbidden).not.toContain(forbidden);
    }
    const parsed = parseProviderSimulateFixture(
      {
        text: fixtureOf({ ...minimalFixture, credentials: { c: "resolved" } }),
        byteLength: Buffer.byteLength(
          fixtureOf({ ...minimalFixture, credentials: { c: "resolved" } }),
        ),
      },
      PROVIDER_SIMULATE_FIXTURE_MAX_BYTES,
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.fixture.credentials.c).toBe("resolved");
  });
});

/* -------------------------------- TC-SIM-004 ----------------------------- */

describe("TC-SIM-004 parity with resolve for identical facts", () => {
  const QUOTA_BODY = JSON.stringify({
    code: 200,
    success: true,
    data: { limits: [{ type: "TOKENS_LIMIT", percentage: 100, nextResetTime: NOW + 3_600_000 }] },
  });
  const PARITY_CONFIG = `provider:
  defaultChain: ch
  credentials:
    c:
      sourceKey:
        style: literal
        name: SIM_KEY
  entries:
    sub:
      class: subscription
      quota:
        endpoint: https://parity.test/quota
        credentialRef: c
  chains:
    ch:
      entries:
        - sub
  budgets:
    daily:
      scope: window
      basis: cost
      ceiling: 40
      windowSeconds: 3600
`;
  const parityFixture = {
    schemaVersion: PROVIDER_SIMULATE_SCHEMA_VERSION,
    now: NOW_ISO,
    workItemRef: "GH-350",
    credentials: { c: "resolved" },
    quota: { sub: { httpStatus: 200, body: QUOTA_BODY } },
    spend: {
      telemetryState: "present",
      points: [{ atMs: NOW - 60_000, cost: 40, tokens: 100 }],
    },
  };

  test("the six resolve keys are deeply equal, including causes, expiries and codes", async () => {
    const h = harness({ config: PARITY_CONFIG, fixture: fixtureOf(parityFixture) });
    try {
      const run = await h.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
      expect(run.exitCode).toBe(0);
      const simulated = run.data as Record<string, unknown>;

      const resolvedConfig = parseAndValidateProviderConfiguration({
        provider: {
          defaultChain: "ch",
          credentials: { c: { sourceKey: { style: "literal", name: "SIM_KEY" } } },
          entries: {
            sub: {
              class: "subscription",
              quota: {
                enabled: true,
                endpoint: "https://parity.test/quota",
                credentialRef: "c",
                timeoutMs: 15000,
                thresholdPercent: 100,
                maxSleepLoops: 24,
                outageParkTtlSeconds: 300,
                credentialParkTtlSeconds: 900,
                capParkTtlSeconds: 300,
              },
            },
          },
          chains: { ch: { entries: ["sub"], allowPaidFallback: false } },
          budgets: {
            daily: {
              enabled: true,
              scope: "window",
              basis: "cost",
              ceiling: 40,
              windowSeconds: 3600,
            },
          },
        },
      });
      if (!resolvedConfig.ok) throw new Error(resolvedConfig.error.detail);

      const spend: ProviderSpendTotalsPort = {
        read: async (input) => ({
          status: "measured",
          totals: input.scopes.map((scope) => ({
            scopeKey: scope.scopeKey,
            cost: 40,
            tokens: 100,
            newestAtMs: NOW - 60_000,
          })),
        }),
      };
      const engine = createProviderEngine({
        clock: { nowMs: () => NOW },
        credentialPort: { resolve: () => ({ ok: true, material: { value: "" } }) },
        transport: {
          send: async () => ({ status: 200, bodyText: QUOTA_BODY }),
        },
        sleep: { sleep: async () => undefined },
        spendTotals: spend,
      });
      const resolved = await engine.resolve({
        config: resolvedConfig.config,
        persist: false,
        workItemRef: "GH-350",
      });
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;
      expect(simulated.summary).toBe(
        resolved.decision.kind === "selected"
          ? `selected ${resolved.decision.providerName} (${resolved.decision.costClass})`
          : `parked ${resolved.decision.park.name} (${resolved.decision.park.cause}) until ${resolved.decision.park.expiresAt}`,
      );
      expect(simulated.chain).toEqual(resolved.chainName);
      expect(simulated.decision).toEqual(resolved.decision);
      expect(simulated.skipped).toEqual(resolved.skipped);
      expect(simulated.parks).toEqual(resolved.parks);
      expect(simulated.announcements).toEqual(resolved.announcements);
      expect(simulated.parks).not.toHaveLength(0);
    } finally {
      h.dispose();
    }
  });

  test("the comparator is non-vacuous: a different instant changes the decision", async () => {
    const later = { ...parityFixture, now: "2026-02-01T12:00:00Z" };
    const h = harness({ config: PARITY_CONFIG, fixture: fixtureOf(later) });
    try {
      const run = await h.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
      expect(run.exitCode).toBe(0);
      const data = run.data as Record<string, unknown>;
      expect(data.simulation).toBeDefined();
      const other = harness({ config: PARITY_CONFIG, fixture: fixtureOf(parityFixture) });
      try {
        const base = await other.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
        expect((base.data as Record<string, unknown>).decision).not.toEqual(data.decision);
      } finally {
        other.dispose();
      }
    } finally {
      h.dispose();
    }
  });
});

/* -------------------------------- TC-SIM-005 ----------------------------- */

describe("TC-SIM-005 the payload is additive and the ref never becomes a resolve key", () => {
  test("the seven keys are in the delivered order and simulation carries exactly its seven", async () => {
    const h = harness({
      config: BUDGET_CONFIG,
      fixture: fixtureOf({
        schemaVersion: PROVIDER_SIMULATE_SCHEMA_VERSION,
        now: NOW_ISO,
        workItemRef: "GH-350",
        spend: { telemetryState: "present", points: [] },
      }),
    });
    try {
      const run = await h.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
      expect(run.exitCode).toBe(0);
      const data = run.data as Record<string, unknown>;
      expect(Object.keys(data)).toEqual([
        "summary",
        "chain",
        "decision",
        "skipped",
        "parks",
        "announcements",
        "simulation",
      ]);
      const simulation = data.simulation as Record<string, unknown>;
      expect(Object.keys(simulation)).toEqual([
        "fixturePath",
        "fixtureSchemaVersion",
        "now",
        "workItemRef",
        "stateWrites",
        "inputs",
        "summary",
      ]);
      expect(simulation.stateWrites).toBe(0);
      expect(simulation.fixturePath).toBe(FIXTURE_PATH);
      expect(simulation.fixtureSchemaVersion).toBe(PROVIDER_SIMULATE_SCHEMA_VERSION);
      expect(simulation.now).toBe(NOW_ISO);
      expect(simulation.workItemRef).toBe("GH-350");
      expect(simulation.inputs).toEqual({
        credentials: "fixture",
        quota: "fixture",
        spend: "fixture",
        zones: "runtime",
      });
      expect(Object.keys(data)).not.toContain("workItemRef");
      expect(Object.keys(data.decision as Record<string, unknown>)).not.toContain("workItemRef");
    } finally {
      h.dispose();
    }
  });

  test("a fixture-supplied zone table is disclosed as fixture, not runtime", async () => {
    const h = harness({
      config: `provider:
  defaultChain: ch
  entries:
    sub:
      class: subscription
      peak:
        timezone: Europe/Berlin
        startSecondsOfDay: 0
        endSecondsOfDay: 86399
  chains:
    ch:
      entries:
        - sub
`,
      fixture: fixtureOf({
        schemaVersion: PROVIDER_SIMULATE_SCHEMA_VERSION,
        now: NOW_ISO,
        zones: { "Europe/Berlin": [{ fromMs: 0, offsetSeconds: 3600 }] },
      }),
    });
    try {
      const run = await h.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
      expect(run.exitCode).toBe(0);
      const simulation = (run.data as Record<string, unknown>).simulation as Record<
        string,
        unknown
      >;
      expect((simulation.inputs as Record<string, unknown>).zones).toBe("fixture");
      expect(JSON.stringify(run.data)).toContain("Europe/Berlin");
    } finally {
      h.dispose();
    }
  });
});

/* -------------------------------- TC-SIM-006 ----------------------------- */

describe("TC-SIM-006 one fixture replays byte-identically and key order is not an input", () => {
  const shape = {
    schemaVersion: PROVIDER_SIMULATE_SCHEMA_VERSION,
    now: NOW_ISO,
    spend: { telemetryState: "present", points: [{ atMs: NOW - 1_000, cost: 1, tokens: 2 }] },
    credentials: { c: "resolved" },
    quota: { sub: { httpStatus: 200, body: "{}" } },
    workItemRef: "GH-350",
  };

  test("two identical runs are byte-identical and a key-shuffled document decides identically", async () => {
    const config = `provider:
  defaultChain: ch
  credentials:
    c:
      sourceKey:
        style: literal
        name: SIM_KEY
  entries:
    sub:
      class: subscription
  chains:
    ch:
      entries:
        - sub
  budgets:
    cap:
      scope: ticket
      basis: cost
      ceiling: 40
`;
    const first = harness({ config, fixture: fixtureOf(shape) });
    const second = harness({ config, fixture: fixtureOf(shape) });
    const shuffled = harness({
      config,
      fixture: JSON.stringify({
        workItemRef: shape.workItemRef,
        quota: shape.quota,
        credentials: shape.credentials,
        spend: shape.spend,
        now: shape.now,
        schemaVersion: shape.schemaVersion,
      }),
    });
    try {
      const base = await first.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
      const repeat = await second.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
      const reordered = await shuffled.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
      expect(base.exitCode).toBe(0);
      expect(repeat.stdout).toBe(base.stdout);
      expect(reordered.data).toEqual(base.data);
      const points = (base.data as { simulation: { summary: unknown } }).simulation;
      expect(points).toBeDefined();
    } finally {
      first.dispose();
      second.dispose();
      shuffled.dispose();
    }
  });
});

/* -------------------------------- TC-SIM-007 ----------------------------- */

describe("TC-SIM-007 exits mirror resolve and no provider.simulate row exists", () => {
  test("selected is 0 and parked equals resolve's delivered projection", async () => {
    const clear = harness({ config: CLEAR_CONFIG, fixture: fixtureOf(minimalFixture) });
    try {
      const run = await clear.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
      expect(run.exitCode).toBe(0);
      const resolved = await clear.run(["resolve", "--json"]);
      expect(run.exitCode).toBe(resolved.exitCode);
    } finally {
      clear.dispose();
    }

    const parked = harness({
      config: PEAK_CONFIG,
      fixture: fixtureOf(minimalFixture),
    });
    try {
      const run = await parked.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
      const decision = (run.data as { decision: { kind: string } }).decision;
      expect(decision.kind).toBe("parked");
      // The delivered `resolve` projects a parked decision to exit 0 (a
      // delivered case pins that); simulate mirrors it exactly. AC-F5-3's "2
      // for parked" is escalated as a spec-versus-delivered divergence.
      const resolved = await parked.run(["resolve", "--json"]);
      expect(run.exitCode).toBe(resolved.exitCode);
    } finally {
      parked.dispose();
    }
  });

  test("a classified decision failure is 1 with the delivered provider identity", async () => {
    const h = harness({
      config: BUDGET_CONFIG,
      fixture: fixtureOf({
        schemaVersion: PROVIDER_SIMULATE_SCHEMA_VERSION,
        now: NOW_ISO,
        workItemRef: "GH-350",
        spend: {
          telemetryState: "present",
          points: [{ atMs: NOW - 1_000, cost: 40, tokens: 0 }],
        },
      }),
    });
    try {
      const run = await h.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
      expect(run.exitCode).toBe(1);
      expect(run.error?.code).toBe("provider.budget.exceeded");
      expect(run.data).toBeUndefined();
    } finally {
      h.dispose();
    }
  });

  test("a fixture defect and an invocation defect are both 1", async () => {
    const broken = harness({ config: CLEAR_CONFIG, fixture: "not json" });
    try {
      const fixtureDefect = await broken.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
      expect(fixtureDefect.exitCode).toBe(1);
      expect(fixtureDefect.error?.code).toBe("input.value.rejected");
      const invocationDefect = await broken.run(["simulate", "--bogus", "--json"]);
      expect(invocationDefect.exitCode).toBe(1);
      expect(invocationDefect.error?.code).toBe("fallback.invocation");
    } finally {
      broken.dispose();
    }
  });

  test("the error table holds zero provider.simulate identities", () => {
    expect(ERROR_TABLE.filter((row) => row.code.startsWith("provider.simulate"))).toEqual([]);
  });
});

/* -------------------------------- TC-SIM-008 ----------------------------- */

describe("TC-SIM-008 selection lives inside the document and has no second authority", () => {
  test("absent selection uses the default; chain and profile change the scope; an undeclared chain is classified", async () => {
    const h = harness({ config: PEAK_CONFIG, fixture: fixtureOf(minimalFixture) });
    try {
      const fallback = await h.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
      expect(fallback.exitCode).toBe(0);
      expect((fallback.data as { chain: string }).chain).toBe("ch");

      const chained = harness({
        config: PEAK_CONFIG,
        fixture: fixtureOf({ ...minimalFixture, chain: "alt-chain" }),
      });
      try {
        const run = await chained.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
        expect(run.exitCode).toBe(0);
        expect((run.data as { chain: string }).chain).toBe("alt-chain");
        expect((run.data as { decision: { providerName: string } }).decision.providerName).toBe(
          "alt",
        );
      } finally {
        chained.dispose();
      }

      const profiled = harness({
        config: PEAK_CONFIG,
        fixture: fixtureOf({ ...minimalFixture, chain: "ch", profile: "prof" }),
      });
      try {
        const run = await profiled.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
        // The profile's providers do not intersect the selected chain: the
        // delivered classification answers, not a silent default.
        expect(run.exitCode).toBe(1);
        expect(run.error?.code).toBe("provider.chain.empty");
      } finally {
        profiled.dispose();
      }

      const undeclared = harness({
        config: PEAK_CONFIG,
        fixture: fixtureOf({ ...minimalFixture, chain: "missing" }),
      });
      try {
        const run = await undeclared.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
        expect(run.exitCode).toBe(1);
        expect(run.error?.code).toBe("provider.chain.empty");
      } finally {
        undeclared.dispose();
      }
    } finally {
      h.dispose();
    }
  });

  test("every CLI selection form is refused before any evaluation", async () => {
    const h = harness({ config: PEAK_CONFIG, fixture: fixtureOf(minimalFixture) });
    try {
      for (const flag of ["--chain", "--profile", "--all"]) {
        const argv =
          flag === "--all"
            ? ["simulate", "--fixture", FIXTURE_PATH, flag, "--json"]
            : ["simulate", "--fixture", FIXTURE_PATH, flag, "x", "--json"];
        const run = await h.run(argv);
        expect(run.exitCode, flag).toBe(1);
        expect(run.fixtureReads, flag).toEqual([]);
      }
    } finally {
      h.dispose();
    }
  });
});

/* ------------------------------ module-level ----------------------------- */

describe("the simulate composition is the delivered engine over fixture seams", () => {
  test("a fixture-backed run needs no injected engine seam and reports the declared inputs", async () => {
    const parsed = parseProviderSimulateFixture(
      { text: fixtureOf(minimalFixture), byteLength: Buffer.byteLength(fixtureOf(minimalFixture)) },
      PROVIDER_SIMULATE_FIXTURE_MAX_BYTES,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const config = (() => {
      const resolved = parseAndValidateProviderConfiguration({
        provider: {
          defaultChain: "ch",
          entries: { sub: { class: "subscription" } },
          chains: { ch: { entries: ["sub"], allowPaidFallback: false } },
        },
      });
      if (!resolved.ok) throw new Error(resolved.error.detail);
      return resolved.config;
    })();
    const outcome = await simulateProviderResolution({
      fixturePath: FIXTURE_PATH,
      fixture: parsed.fixture,
      config,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.data.decision.kind).toBe("selected");
    expect(outcome.data.simulation.stateWrites).toBe(0);
    expect(outcome.data.simulation.inputs.spend).toBe("none");
  });
});
