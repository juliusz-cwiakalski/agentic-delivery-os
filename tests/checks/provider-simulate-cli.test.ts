/**
 * GH-350 TC-SIM-003 and TC-REF-004 (checks arms) — simulation has zero effect on
 * state, credentials, network, spend, and the local delivery context, and its
 * work-item ref comes only from the fixture.
 *
 * Every case runs the delivered composed program over a scratch store under
 * `tmp/tmpdir`; the composition's side-effecting seams are counting throwers, so
 * a reached seam fails by name rather than being silently absent.
 */

import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProviderComposition, ProviderSpendTotalsRead } from "@delivery-os/core/contracts";
import { PARK_EVIDENCE_FIELDS } from "@delivery-os/core/contracts";
import { PROVIDER_SIMULATE_SCHEMA_VERSION } from "@delivery-os/core/provider";
import { createConfigProgram } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import {
  listStoreFiles,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
} from "../fixtures/state/harness";

const NOW_ISO = "2026-01-01T12:00:00Z";
const CONFIG_PATH = "/repo/.jaiship/config.yaml";
const FIXTURE_PATH = "/repo/simulate.json";

type Counters = {
  credential: number;
  transport: number;
  spend: number;
  ref: number;
};

type Run = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string; readonly summary?: string };
  readonly counters: Counters;
  readonly fsCalls: readonly string[];
  readonly stateBefore: readonly string[];
  readonly stateAfter: readonly string[];
};

const POLICY_CONFIG = `provider:
  defaultChain: ch
  credentials:
    c:
      sourceKey:
        style: literal
        name: SIM_KEY
  entries:
    sub:
      class: subscription
      peak:
        startSecondsOfDay: 0
        endSecondsOfDay: 86399
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

const PARK_CONFIG = `provider:
  defaultChain: ch
  entries:
    sub:
      class: subscription
      peak:
        startSecondsOfDay: 0
        endSecondsOfDay: 86399
  chains:
    ch:
      entries:
        - sub
`;

const BUDGET_FREE_CONFIG = `provider:
  defaultChain: ch
  entries:
    sub:
      class: subscription
  chains:
    ch:
      entries:
        - sub
`;

const fixtureOf = (value: Record<string, unknown>): string => JSON.stringify(value);

const baseFixture = (extra: Record<string, unknown> = {}): string =>
  fixtureOf({
    schemaVersion: PROVIDER_SIMULATE_SCHEMA_VERSION,
    now: NOW_ISO,
    spend: {
      telemetryState: "present",
      points: [{ atMs: Date.parse(NOW_ISO) - 1_000, cost: 0, tokens: 0 }],
    },
    ...extra,
  });

const harness = (options: {
  readonly config: string;
  readonly fixture: string;
  readonly workItemRef?: string;
}) => {
  const root = makeTempRoot("gh350-simulate-cli");
  const identity = makeIdentity(root);
  const { store } = openStore(identity);
  const counters: Counters = { credential: 0, transport: 0, spend: 0, ref: 0 };
  const fsCalls: string[] = [];
  const snapshot = (): string[] =>
    listStoreFiles(identity.stateDirectory).map((name) => {
      const bytes = readFileSync(join(identity.stateDirectory, name));
      return `${name}:${createHash("sha256").update(bytes).digest("hex")}`;
    });

  const provider: ProviderComposition = {
    clock: { nowMs: () => Date.parse(NOW_ISO) },
    credentialPort: {
      resolve: () => {
        counters.credential += 1;
        throw new Error("simulate must not resolve a credential");
      },
    },
    transport: {
      send: async () => {
        counters.transport += 1;
        throw new Error("simulate must not call a transport");
      },
    },
    sleep: { sleep: async () => undefined },
    stateStore: store,
    newFenceToken: () => "fence-simulate-cli",
    spendTotals: {
      read: async (): Promise<ProviderSpendTotalsRead> => {
        counters.spend += 1;
        throw new Error("simulate must not use the composition's spend port");
      },
    },
    resolveWorkItemRef: () => {
      counters.ref += 1;
      throw new Error("simulate must never read the local delivery context");
    },
    workItemContextPath: "/repo/.ai/local/pm-context.yaml",
    fixtureFs: {
      exists: (path) => {
        fsCalls.push(path);
        return path === FIXTURE_PATH;
      },
      readText: (path) => {
        fsCalls.push(path);
        if (path !== FIXTURE_PATH) throw new Error("missing file");
        return options.fixture;
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
      exists: (path) => path === CONFIG_PATH,
      readText: (path) => {
        if (path !== CONFIG_PATH) throw new Error("missing file");
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
    const stateBefore = snapshot();
    let stdout = "";
    let stderr = "";
    const deps: CliDependencies = {
      brand: program.brand,
      clock: { now: () => Date.parse(NOW_ISO) },
      newRunId: () => "run-gh350-simulate-cli",
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
      ...(parsed === undefined
        ? {}
        : {
            ...(parsed.data === undefined ? {} : { data: parsed.data as Record<string, unknown> }),
            ...(parsed.error === undefined ? {} : { error: parsed.error as Run["error"] }),
          }),
      counters: { ...counters },
      fsCalls,
      stateBefore,
      stateAfter: snapshot(),
    };
  };

  return { run, counters, dispose: () => removeRoot(root) };
};

describe("TC-SIM-003 simulation has zero effect on state, credentials, network and spend", () => {
  test("a parking fixture produces the payload with stateWrites 0 and reaches no seam", {
    timeout: 30_000,
  }, async () => {
    const h = harness({ config: PARK_CONFIG, fixture: baseFixture() });
    try {
      const run = await h.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
      expect(run.exitCode).toBe(0);
      const data = run.data as Record<string, unknown>;
      const simulation = data.simulation as Record<string, unknown>;
      expect(simulation.stateWrites).toBe(0);
      expect((data.decision as { kind: string }).kind).toBe("parked");
      expect(run.counters).toEqual({ credential: 0, transport: 0, spend: 0, ref: 0 });
      expect(run.stateAfter).toEqual(run.stateBefore);
      expect([...new Set(run.fsCalls)]).toEqual([FIXTURE_PATH]);
    } finally {
      h.dispose();
    }
  });

  test("a configured credential outcome is answered by the fixture, never by the port", async () => {
    const h = harness({
      config: BUDGET_FREE_CONFIG,
      fixture: baseFixture({ credentials: { c: "missing" } }),
    });
    try {
      const run = await h.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
      expect(run.exitCode).toBe(0);
      expect(run.counters.credential).toBe(0);
    } finally {
      h.dispose();
    }
  });
});

describe("TC-REF-004 simulate takes its ref only from the fixture", () => {
  test("a budget-free configuration accepts the field absent and present, disclosing it when supplied", async () => {
    const absent = harness({ config: BUDGET_FREE_CONFIG, fixture: baseFixture() });
    const present = harness({
      config: BUDGET_FREE_CONFIG,
      fixture: baseFixture({ workItemRef: "GH-350" }),
    });
    try {
      const withoutRef = await absent.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
      expect(withoutRef.exitCode).toBe(0);
      const withoutSimulation = withoutRef.data?.simulation as Record<string, unknown>;
      expect(Object.keys(withoutSimulation)).not.toContain("workItemRef");

      const withRef = await present.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
      expect(withRef.exitCode).toBe(0);
      const withSimulation = withRef.data?.simulation as Record<string, unknown>;
      expect(withSimulation.workItemRef).toBe("GH-350");
      expect(Object.keys(withRef.data ?? {})).not.toContain("workItemRef");
      expect(withRef.counters.ref).toBe(0);
      expect(absent.counters.ref).toBe(0);
    } finally {
      absent.dispose();
      present.dispose();
    }
  });

  test("an enabled budget requires the ref in the fixture and refuses absent or malformed before evaluation", async () => {
    const absent = harness({ config: POLICY_CONFIG, fixture: baseFixture() });
    const malformed = harness({
      config: POLICY_CONFIG,
      fixture: baseFixture({ workItemRef: "gh-350" }),
    });
    const valid = harness({
      config: POLICY_CONFIG,
      fixture: baseFixture({ workItemRef: "GH-350" }),
    });
    try {
      for (const [label, h] of [
        ["absent", absent],
        ["malformed", malformed],
      ] as const) {
        const run = await h.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
        expect(run.exitCode, label).toBe(1);
        expect(run.error?.code, label).toBe("input.value.rejected");
        expect(run.error?.summary, label).toContain("workItemRef");
        expect(run.counters.spend, label).toBe(0);
        expect(run.counters.ref, label).toBe(0);
      }
      const run = await valid.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
      expect(run.exitCode).toBe(0);
      const simulation = run.data?.simulation as Record<string, unknown>;
      expect(simulation.workItemRef).toBe("GH-350");
      expect(run.counters.ref).toBe(0);
      expect(run.counters.spend).toBe(0);
    } finally {
      absent.dispose();
      malformed.dispose();
      valid.dispose();
    }
  });

  test("the five-field evidence allowlist and the resolve keys are unchanged", async () => {
    expect(PARK_EVIDENCE_FIELDS).toHaveLength(14);
    const h = harness({
      config: BUDGET_FREE_CONFIG,
      fixture: baseFixture({ workItemRef: "GH-350" }),
    });
    try {
      const first = await h.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
      const second = await h.run(["simulate", "--fixture", FIXTURE_PATH, "--json"]);
      expect(first.exitCode).toBe(0);
      expect(second.stdout).toBe(first.stdout);
      expect(Object.keys(first.data ?? {})).toEqual([
        "summary",
        "chain",
        "decision",
        "skipped",
        "parks",
        "announcements",
        "simulation",
      ]);
      expect(Object.keys(first.data ?? {})).not.toContain("budgetMeasured");
    } finally {
      h.dispose();
    }
  });
});
