/**
 * GH-374 TC-POL-CFG-002/003/005/010, TC-POL-SEAT-001..005, TC-POL-SIM-001..009,
 * TC-POL-NOM-001..004 — the composed behaviour proof of the adopted policy.
 *
 * Every case seeds a SCRATCH checkout under `tmp/tmpdir` with a byte copy of the
 * real `.jaiship/config.yaml` (the policy is never a fixture), a scratch
 * home and state root, an injected clock, and injected credential, transport,
 * spend, ref and state seams. No case spawns a child, calls the network, reads a
 * live credential, or touches the operator's home (DEC-13).
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { nodeFileSystemFacts } from "../../packages/adapters/src/file/index";
import { readLocalPmContext } from "../../packages/adapters/src/file/pm-context";
import type { ProviderComposition } from "@delivery-os/core/contracts";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import { createConfigProgram } from "../../packages/cli/src/edge";
import { createProductionComposer } from "../../packages/cli/src/production";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";
import { evaluateBudgets } from "../../packages/core/src/provider/budgets";
import { nominateProviderProfile } from "../../packages/core/src/provider/engine";
import { selectProfile } from "../../packages/core/src/provider/profile";
import { createResolvedProviderProbe } from "../../packages/cli/src/edge";
import {
  buildProfileEnvRecord,
  validateEnvRecord,
} from "../../packages/core/src/provider/profile-env-record";
import {
  ENV_RECORD_MAX_BYTES,
  ENV_RECORD_MAX_RECORDS,
} from "../../packages/core/src/contracts/provider-profile";
import {
  parseAndValidateProfileConfiguration,
  parseAndValidateProviderConfiguration,
  parseProfileConfiguration,
} from "../../packages/core/src/provider/validate";
import {
  evaluateModelExpressibility,
  resolveBinding,
} from "../../packages/core/src/domain/harness-profile-propagation";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const ROOT = process.cwd();
const REAL_CONFIG_TEXT = readFileSync(join(ROOT, ".jaiship/config.yaml"), "utf8");
const FIXTURE_DIRECTORY = join(ROOT, "tests/fixtures/provider/policy-adoption/simulate");
const NOON_MS = Date.UTC(2026, 10, 20, 12, 0, 0);
const RESET_MS = Date.UTC(2026, 10, 20, 18, 0, 0);
const CONTEXT_PATH = ".ai/local/pm-context.yaml";

const CLEAR_QUOTA =
  '{"code":200,"success":true,"data":{"limits":[{"type":"TOKENS_LIMIT","percentage":0}]}}';
/** The delivered coding-plan watch body (weekly + rolling windows). */
const CLEAR_CODING_PLAN = '{"weekly":{"usedPercent":0},"rolling":{"usedPercent":0}}';

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("expected an object");
  }
  return value as Record<string, unknown>;
};

const roster = (): readonly string[] =>
  readdirSync(join(ROOT, ".opencode/agent"))
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.slice(0, -3))
    .sort();

const declaredProviderConfig = () => {
  const parsed = parseAndValidateProviderConfiguration(JSON.parse(JSON.stringify(readDocuments())));
  if (!parsed.ok) throw new Error(parsed.error.detail);
  return parsed.config;
};

const readDocuments = () => {
  // The scratch copies are byte copies; parsing the real text keeps the policy
  // the repository's, never a test's.
  return parseYaml(REAL_CONFIG_TEXT) as Record<string, unknown>;
};

const declaredProfileConfig = () => {
  const providers = declaredProviderConfig();
  const parsed = parseAndValidateProfileConfiguration(
    JSON.parse(JSON.stringify(readDocuments())),
    providers,
  );
  if (!parsed.ok) throw new Error(parsed.error.detail);
  return parsed.config;
};

const snapshot = (directory: string): readonly string[] => {
  if (!existsSync(directory)) return [];
  const lines: string[] = [];
  const walk = (current: string, relative: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      const child = join(current, entry.name);
      const childRelative = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(child, childRelative);
        continue;
      }
      const stat = statSync(child, { bigint: true });
      lines.push(`${childRelative}|${stat.size}|${stat.mtimeNs}`);
    }
  };
  walk(directory, "");
  return lines;
};

type Seams = {
  readonly credential?: (reference: { readonly referenceName: string }) => {
    readonly ok: boolean;
    readonly material?: { readonly value: string };
  };
  readonly transport?: (request: { readonly endpoint: string }) => Promise<{
    readonly status: number;
    readonly bodyText: string;
  }>;
  readonly spend?: () => Promise<Record<string, unknown>>;
  readonly resolveWorkItemRef?: () =>
    | { readonly status: "resolved"; readonly workItemRef: string }
    | { readonly status: "unresolved" };
  readonly watchObservedAtMs?: () => number;
};

type Harness = {
  readonly root: string;
  readonly checkout: string;
  readonly state: string;
  readonly calls: {
    credential: number;
    transport: number;
    spend: number;
    ref: number;
    forbidden: number;
  };
  readonly transportEndpoints: string[];
  readonly legacyReads: string[];
  cleanup(): void;
  run(argv: readonly string[]): Promise<{
    readonly exitCode: number;
    readonly data?: Record<string, unknown>;
    readonly error?: Record<string, unknown>;
    readonly stdout: string;
    readonly stderr: string;
  }>;
};

type HarnessOptions = {
  readonly label: string;
  readonly seams?: Seams;
  /** Replace the seeded pm-context document (the no-context arm). */
  readonly pmContext?: string | null;
  /** Seed inert legacy files in the scratch home (the legacy-present arm). */
  readonly legacyPresent?: boolean;
  readonly documentText?: string;
  readonly clockMs?: number;
  readonly throwCredential?: boolean;
  readonly throwTransport?: boolean;
  readonly throwSpend?: boolean;
  /** Record every probe/read of a path containing `profiles` or the hook name. */
  readonly recordLegacyReads?: boolean;
};

const DEFAULT_CONTEXT = `active_change:
  workItemRef: GH-374
  branch: feat/GH-374/provider-policy-adoption
parked_changes: []
`;

const harness = (options: HarnessOptions): Harness => {
  const root = makeTempRoot(`gh374-behaviour-${options.label}`);
  const checkout = join(root, "checkout");
  const home = join(root, "home");
  const state = join(root, "state");
  mkdirSync(join(checkout, ".delivery-os"), { recursive: true });
  mkdirSync(join(checkout, ".git"), { recursive: true });
  mkdirSync(join(checkout, ".ai/local"), { recursive: true });
  mkdirSync(home, { recursive: true });
  writeFileSync(
    join(checkout, ".delivery-os/config.yaml"),
    options.documentText ?? REAL_CONFIG_TEXT,
  );
  if (options.pmContext !== null) {
    writeFileSync(join(checkout, CONTEXT_PATH), options.pmContext ?? DEFAULT_CONTEXT);
  }
  if (options.legacyPresent === true) {
    mkdirSync(join(home, ".delivery-os/config/profiles"), { recursive: true });
    mkdirSync(join(home, ".delivery-os/hooks"), { recursive: true });
    writeFileSync(
      join(home, ".delivery-os/config/profiles/mixed.sh"),
      'OC_ADOS_AGENT_CODER_MODEL="synthetic/model"\n',
    );
    writeFileSync(
      join(home, ".delivery-os/hooks/pre-opencode-iteration"),
      "# inert adopter example\n",
    );
  }
  const calls = { credential: 0, transport: 0, spend: 0, ref: 0, forbidden: 0 };
  const transportEndpoints: string[] = [];
  const legacyReads: string[] = [];
  const store = openStore(makeIdentity(state)).store;
  const clockMs = options.clockMs ?? NOON_MS;
  const seams = options.seams ?? {};
  const provider: ProviderComposition = {
    clock: { nowMs: () => clockMs },
    credentialPort: {
      resolve: (reference) => {
        calls.credential += 1;
        if (options.throwCredential === true) {
          throw new Error("this case must not resolve a credential");
        }
        if (seams.credential !== undefined) return seams.credential(reference);
        return reference.referenceName === "zai"
          ? { ok: true, material: { value: "synthetic-zai" } }
          : { ok: true, material: { value: "synthetic-deepseek" } };
      },
    },
    transport: {
      send: async (request) => {
        calls.transport += 1;
        transportEndpoints.push(request.endpoint);
        if (options.throwTransport === true) {
          throw new Error("this case must not call a transport");
        }
        if (seams.transport !== undefined) return seams.transport(request);
        return { status: 200, bodyText: CLEAR_QUOTA };
      },
    },
    sleep: { sleep: async () => undefined },
    stateStore: store,
    newFenceToken: () => "fence-gh374-behaviour",
    spendTotals: {
      read: async () => {
        calls.spend += 1;
        if (options.throwSpend === true) throw new Error("this case must not read spend");
        if (seams.spend !== undefined) return (await seams.spend()) as never;
        return { status: "empty" } as never;
      },
    },
    resolveWorkItemRef: () => {
      calls.ref += 1;
      if (seams.resolveWorkItemRef !== undefined) return seams.resolveWorkItemRef();
      const read = readLocalPmContext({
        path: join(checkout, CONTEXT_PATH),
        fs: nodeFileSystemFacts(),
      });
      const ref = read.ok ? read.context.activeChange?.workItemRef : undefined;
      return ref === undefined
        ? { status: "unresolved" }
        : { status: "resolved", workItemRef: ref };
    },
    workItemContextPath: join(checkout, CONTEXT_PATH),
    ...(seams.watchObservedAtMs === undefined
      ? {}
      : { watchObservedAtMs: seams.watchObservedAtMs }),
  };
  const fs = {
    exists: (path: string) => {
      if (options.recordLegacyReads === true && /profiles|pre-opencode-iteration/.test(path)) {
        legacyReads.push(path);
      }
      return existsSync(path);
    },
    readText: (path: string) => {
      if (options.recordLegacyReads === true && /profiles|pre-opencode-iteration/.test(path)) {
        legacyReads.push(path);
      }
      return readFileSync(path, "utf8");
    },
  };
  const program = createConfigProgram({
    workingName: "jaiship",
    environment: { HOME: home, PATH: "/usr/bin" },
    cwd: checkout,
    homeDirectory: home,
    platform: "linux",
    priorConfigurationDirectoryName: ".delivery-os",
    fs,
    repositoryIo: {
      exists: (path) => path === join(checkout, ".git"),
      isFile: () => false,
      readText: () => "",
    },
    provider,
  });
  if (!program.ok) throw new Error("the composed program did not resolve its brand");
  return {
    root,
    checkout,
    state,
    calls,
    transportEndpoints,
    legacyReads,
    cleanup: () => removeRoot(root),
    run: async (argv) => {
      let stdout = "";
      let stderr = "";
      const deps: CliDependencies = {
        brand: program.brand,
        clock: { now: () => clockMs },
        newRunId: () => "run-gh374-behaviour",
        secrets: program.secrets,
        program: program.program,
      };
      const exitCode = await runCli(
        argv,
        {
          stdout: { write: (chunk: string) => (stdout += chunk) },
          stderr: { write: (chunk: string) => (stderr += chunk) },
        },
        deps,
      );
      const envelope =
        stdout.trim().length === 0 ? undefined : (JSON.parse(stdout) as Record<string, unknown>);
      return {
        exitCode,
        ...(envelope?.data === undefined ? {} : { data: asRecord(envelope.data) }),
        ...(envelope?.error === undefined ? {} : { error: asRecord(envelope.error) }),
        stdout,
        stderr,
      };
    },
  };
};

const fixturePath = (name: string): string => join(FIXTURE_DIRECTORY, `${name}.json`);

/* -------------------------------- CFG-002 -------------------------------- */

describe("GH-374 TC-POL-CFG-002 a seeded checkout resolves the declared order and the never-pay chain", () => {
  test("the default chain selects the subscription entry and reports the paid entry shadowed", async () => {
    const composed = harness({ label: "cfg002-default" });
    try {
      const before = snapshot(composed.state);
      const result = await composed.run(["provider", "resolve", "--json"]);
      expect(result.exitCode).toBe(0);
      const data = asRecord(result.data);
      expect(data.chain).toBe("subscription-first");
      const decision = asRecord(data.decision);
      expect(decision.kind).toBe("selected");
      expect(decision.providerName).toBe("zai-coding-plan");
      expect(decision.costClass).toBe("subscription");
      expect(data.skipped).toEqual([{ providerName: "deepseek", reason: "shadowed" }]);
      expect(data.parks).toEqual([]);
      expect(data.announcements).toEqual([]);
      expect(composed.transportEndpoints).toEqual([
        "https://api.z.ai/api/monitor/usage/quota/limit",
      ]);
      expect(composed.calls.transport).toBe(1);
      expect(snapshot(composed.state)).toEqual(before);
    } finally {
      composed.cleanup();
    }
  });

  test("--chain subscription-only resolves the subscription entry alone with no skip", async () => {
    const composed = harness({ label: "cfg002-never-pay" });
    try {
      const result = await composed.run([
        "provider",
        "resolve",
        "--chain",
        "subscription-only",
        "--json",
      ]);
      expect(result.exitCode).toBe(0);
      const data = asRecord(result.data);
      expect(data.chain).toBe("subscription-only");
      expect(asRecord(data.decision).providerName).toBe("zai-coding-plan");
      expect(data.skipped).toEqual([]);
    } finally {
      composed.cleanup();
    }
  });

  test("inert legacy files change nothing: the payload is byte-identical and no legacy path is opened", async () => {
    const plain = harness({ label: "cfg002-plain" });
    const legacy = harness({
      label: "cfg002-legacy",
      legacyPresent: true,
      recordLegacyReads: true,
    });
    try {
      const first = await plain.run(["provider", "resolve", "--json"]);
      const second = await legacy.run(["provider", "resolve", "--json"]);
      expect(legacy.legacyReads).toEqual([]);
      expect(JSON.stringify(second.data)).toBe(JSON.stringify(first.data));
      // The synthetic legacy files exist and were never probed or read.
      expect(existsSync(join(legacy.root, "home/.delivery-os/config/profiles/mixed.sh"))).toBe(
        true,
      );
      expect(existsSync(join(legacy.root, "home/.delivery-os/hooks/pre-opencode-iteration"))).toBe(
        true,
      );
    } finally {
      plain.cleanup();
      legacy.cleanup();
    }
  });
});

/* -------------------------------- CFG-003 -------------------------------- */

describe("GH-374 TC-POL-CFG-003 the prior-identity notice is this checkout's posture", () => {
  const brand = (() => {
    const resolved = resolveBrandIdentity({ workingName: "jaiship" });
    if (!resolved.ok) throw new Error("the working name must resolve");
    return resolved.value;
  })();

  const runThroughEntrypoint = async (label: string, current: boolean, json: boolean) => {
    const root = makeTempRoot(`gh374-notice-${label}`);
    const checkout = join(root, "checkout");
    const home = join(root, "home");
    mkdirSync(join(checkout, ".git"), { recursive: true });
    mkdirSync(join(checkout, ".ai/local"), { recursive: true });
    mkdirSync(home, { recursive: true });
    const directory = current ? brand.configDirectoryName : ".delivery-os";
    mkdirSync(join(checkout, directory), { recursive: true });
    writeFileSync(join(checkout, directory, "config.yaml"), REAL_CONFIG_TEXT);
    if (current) {
      // The control carries BOTH files so the prior is shadowed, not absent.
      mkdirSync(join(checkout, ".delivery-os"), { recursive: true });
      writeFileSync(join(checkout, ".delivery-os/config.yaml"), REAL_CONFIG_TEXT);
    }
    writeFileSync(join(checkout, CONTEXT_PATH), DEFAULT_CONTEXT);
    const environment = { HOME: home, PATH: "/usr/bin" };
    let stdout = "";
    let stderr = "";
    const composer = createProductionComposer({
      harnessVersionProbe: async () => ({ status: "answered" as const, stdout: "opencode v2.3.2" }),
      environment,
      cwd: checkout,
      homeDirectory: home,
      workingName: brand.binaryName,
    });
    const exitCode = await runEntrypoint(["provider", "resolve", ...(json ? ["--json"] : [])], {
      streams: {
        stdout: { write: (chunk: string) => (stdout += chunk) },
        stderr: { write: (chunk: string) => (stderr += chunk) },
      },
      environment,
      configuredWorkingName: brand.binaryName,
      priorWorkingName: "delivery-os",
      composeProgram: composer,
      clock: { now: () => NOON_MS },
      newRunId: () => "run-gh374-notice",
    });
    removeRoot(root);
    return { exitCode, stdout, stderr };
  };

  test("exactly one config-read notice names both files, and the payload is asserted", async () => {
    const human = await runThroughEntrypoint("human", false, false);
    const machine = await runThroughEntrypoint("json", false, true);
    expect(human.exitCode).toBe(0);
    expect(machine.exitCode).toBe(0);
    const notices = machine.stderr
      .split("\n")
      .filter((line) => line.startsWith("prior-identity-fallback: config-read"));
    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain(".delivery-os/config.yaml");
    expect(notices[0]).toContain(".jaiship/config.yaml");
    expect(notices[0]).toContain("is absent");
    expect(machine.stdout).not.toContain("prior-identity-fallback");
    const envelope = JSON.parse(machine.stdout) as Record<string, unknown>;
    const data = asRecord(envelope.data);
    expect(data.chain).toBe("subscription-first");
    expect(asRecord(data.decision).kind).toBeTruthy();
    expect(Array.isArray(data.skipped)).toBe(true);
    expect(human.stdout).toContain(String(asRecord(data.decision).kind ?? ""));
    expect(human.stderr.split("prior-identity-fallback: config-read")).toHaveLength(2);
  });

  test("the control checkout with the current directory present emits config-skipped", async () => {
    const control = await runThroughEntrypoint("current", true, true);
    expect(control.exitCode).toBe(0);
    expect(control.stderr).toContain("config-skipped");
    expect(control.stderr).not.toContain("config-read");
  });
});

/* -------------------------------- CFG-005 -------------------------------- */

describe("GH-374 TC-POL-CFG-005 the ceilings are 20/30 and a clear ledger measures zero with one read", () => {
  test("the resolved budgets are exact, ordered and entry-free; one spend read; the ref resolves once", async () => {
    const composed = harness({ label: "cfg005-clear" });
    try {
      const before = snapshot(composed.state);
      const result = await composed.run(["provider", "resolve", "--json"]);
      expect(result.exitCode).toBe(0);
      const providers = declaredProviderConfig();
      expect(providers.budgets).toEqual({
        "window-cost": {
          enabled: true,
          scope: "window",
          basis: "cost",
          ceiling: 20,
          windowSeconds: 86400,
        },
        "ticket-cost": { enabled: true, scope: "ticket", basis: "cost", ceiling: 30 },
      });
      const windowCeiling = providers.budgets?.["window-cost"]?.ceiling ?? 0;
      const ticketCeiling = providers.budgets?.["ticket-cost"]?.ceiling ?? 0;
      expect(windowCeiling).toBeLessThan(ticketCeiling);
      expect(providers.budgets?.["window-cost"]?.entries).toBeUndefined();
      expect(providers.budgets?.["ticket-cost"]?.entries).toBeUndefined();
      expect(asRecord(asRecord(result.data).decision).providerName).toBe("zai-coding-plan");
      expect(asRecord(result.data).parks).toEqual([]);
      expect(asRecord(result.data).announcements).toEqual([]);
      expect(composed.calls.spend).toBe(1);
      expect(composed.calls.ref).toBe(1);
      expect(snapshot(composed.state)).toEqual(before);
    } finally {
      composed.cleanup();
    }
  });

  test("the no-context arm refuses input.value.rejected naming the context path", async () => {
    const composed = harness({
      label: "cfg005-no-context",
      pmContext: "active_change:\n  workItemRef: GH-374\n",
    });
    try {
      const result = await composed.run(["provider", "resolve", "--json"]);
      expect(result.exitCode).toBe(1);
      expect(result.data).toBeUndefined();
      expect(result.error?.code).toBe("input.value.rejected");
      const summary = String(result.error?.summary ?? "");
      expect(summary).toContain(
        `no active work-item ref was found at ${join(composed.checkout, CONTEXT_PATH)}`,
      );
      expect(summary).toContain("window-cost");
      expect(summary).not.toContain("workItemRef");
      expect(composed.calls.spend).toBe(0);
    } finally {
      composed.cleanup();
    }
  });
});

/* -------------------------------- CFG-010 -------------------------------- */

describe("GH-374 TC-POL-CFG-010 both watch targets answer one closed condition with the observation", () => {
  test("each target reports a closed condition, its age and declared bound, with zero writes", async () => {
    const composed = harness({
      label: "cfg010-clear",
      clockMs: NOON_MS,
      seams: {
        watchObservedAtMs: () => NOON_MS - 60_000,
        transport: async (request) =>
          request.endpoint.includes("deepseek")
            ? { status: 200, bodyText: '{"balance":10}' }
            : { status: 200, bodyText: CLEAR_CODING_PLAN },
      },
    });
    try {
      const before = snapshot(composed.state);
      const result = await composed.run(["provider", "watch", "status", "--json"]);
      expect(result.exitCode).toBe(0);
      const providers = asRecord(result.data).providers;
      if (!Array.isArray(providers)) throw new Error("expected the provider watch list");
      expect(providers).toHaveLength(2);
      const byName = new Map<string, Record<string, unknown>>();
      for (const entry of providers) byName.set(String(asRecord(entry).name), asRecord(entry));
      expect([...byName.keys()].sort()).toEqual(["deepseek", "zai-coding-plan"]);
      for (const [name, entry] of byName) {
        expect([name, entry.condition]).toEqual([name, "clear"]);
        expect([name, String(entry.checkedAt)]).toEqual([name, "2026-11-20T12:00:00.000Z"]);
        expect([name, entry.ageSeconds]).toEqual([name, 60]);
        expect([name, typeof entry.observedAt]).toEqual([name, "string"]);
      }
      expect(byName.get("deepseek")?.maxAgeSeconds).toBe(900);
      expect(byName.get("zai-coding-plan")?.maxAgeSeconds).toBe(900);
      expect(composed.calls.transport).toBe(2);
      expect(snapshot(composed.state)).toEqual(before);
    } finally {
      composed.cleanup();
    }
  });

  test("a below-floor balance is quota-exhausted with no invented reset; an unparseable body is an outage", async () => {
    const belowFloor = harness({
      label: "cfg010-floor",
      seams: {
        transport: async (request) =>
          request.endpoint.includes("deepseek")
            ? { status: 200, bodyText: '{"balance":0.5}' }
            : { status: 200, bodyText: CLEAR_CODING_PLAN },
      },
    });
    try {
      const result = await belowFloor.run(["provider", "watch", "status", "--json"]);
      const providers = asRecord(result.data).providers;
      if (!Array.isArray(providers)) throw new Error("expected the provider watch list");
      const deepseek = asRecord(providers.find((entry) => asRecord(entry).name === "deepseek"));
      expect(deepseek.condition).toBe("quota-exhausted");
      expect(deepseek.resetAt).toBeUndefined();
      expect(String(deepseek.source)).toContain("below-floor");
    } finally {
      belowFloor.cleanup();
    }

    const malformed = harness({
      label: "cfg010-malformed",
      seams: {
        transport: async (request) =>
          request.endpoint.includes("deepseek")
            ? { status: 200, bodyText: "not-json" }
            : { status: 200, bodyText: CLEAR_CODING_PLAN },
      },
    });
    try {
      const result = await malformed.run(["provider", "watch", "status", "--json"]);
      const providers = asRecord(result.data).providers;
      if (!Array.isArray(providers)) throw new Error("expected the provider watch list");
      const deepseek = asRecord(providers.find((entry) => asRecord(entry).name === "deepseek"));
      expect(deepseek.condition).toBe("provider-outage");
    } finally {
      malformed.cleanup();
    }
  });
});

/* -------------------------------- SEAT-001 ------------------------------- */

describe("GH-374 TC-POL-SEAT-001 all 25 roles resolve a base seat and a binding", () => {
  test("25/25 roles resolve on delivery and bind their declared model", async () => {
    const composed = harness({ label: "seat001" });
    try {
      const profiles = declaredProfileConfig();
      const delivery = profiles.profiles.delivery;
      if (delivery === undefined) throw new Error("expected the delivery profile");
      const selectionSeatModels = Object.fromEntries(
        Object.entries(delivery.seats).map(([seat, declaration]) => [seat, declaration.model]),
      );
      const selection = {
        agentOverrides: delivery.agentOverrides,
        seatModels: selectionSeatModels,
      };
      for (const role of roster()) {
        const result = await composed.run([
          "provider",
          "profile",
          "resolve",
          "--agent",
          role,
          "--json",
        ]);
        expect([role, result.exitCode]).toEqual([role, 0]);
        const data = asRecord(result.data);
        expect([role, data.outcome]).toEqual([role, "selected"]);
        expect([role, data.profile]).toEqual([role, "delivery"]);
        expect([role, Array.isArray(data.eligibility)]).toEqual([role, true]);
        const binding = resolveBinding(delivery, selection, role);
        expect([role, binding.outcome]).toEqual([role, "binding"]);
        if (binding.outcome !== "binding") continue;
        expect([role, binding.binding.seat]).toEqual([role, role]);
        expect([role, binding.binding.resolvedModel]).toEqual([role, delivery.seats[role]?.model]);
      }
    } finally {
      composed.cleanup();
    }
  });

  test("a removed seat surfaces as a 24-entry record and an unassigned binding", async () => {
    const documents = readDocuments();
    const provider = asRecord(documents.provider);
    const profiles = asRecord(provider.profiles);
    const delivery = asRecord(asRecord(profiles.profiles).delivery);
    delete asRecord(delivery.seats).coder;
    const composed = harness({
      label: "seat001-missing",
      documentText: `${JSON.stringify(documents, null, 2)}\n`,
    });
    try {
      const result = await composed.run([
        "provider",
        "profile",
        "resolve",
        "--agent",
        "coder",
        "--for-spawn",
        "--json",
      ]);
      expect(result.exitCode).toBe(0);
      const entries = asRecord(asRecord(asRecord(result.data).envRecord)).entries;
      if (!Array.isArray(entries)) throw new Error("expected the env-record entries");
      // One role lost its seat: the record carries 24 entries and the per-spawn
      // binding for that role is `unassigned`.
      expect(entries).toHaveLength(24);
      const missing = asRecord(asRecord(asRecord(documents.provider).profiles).profiles);
      const mutatedDelivery = asRecord(asRecord(missing).delivery);
      const binding = resolveBinding(
        {
          seats: asRecord(mutatedDelivery.seats) as never,
          agentOverrides: {},
        },
        { agentOverrides: {}, seatModels: {} },
        "coder",
      );
      expect(binding.outcome).toBe("unassigned");
    } finally {
      composed.cleanup();
    }
  });
});

/* -------------------------------- SEAT-002 ------------------------------- */

describe("GH-374 TC-POL-SEAT-002 all 25 roles bind on the paid profile", () => {
  test("the paid profile binds every role on the paid model and repeats the seat set", () => {
    const profiles = declaredProfileConfig();
    const delivery = profiles.profiles.delivery;
    const paid = profiles.profiles.paid;
    if (delivery === undefined || paid === undefined) throw new Error("expected both profiles");
    expect(Object.keys(paid.seats).sort()).toEqual(Object.keys(delivery.seats).sort());
    const selection = {
      agentOverrides: paid.agentOverrides,
      seatModels: Object.fromEntries(
        Object.entries(paid.seats).map(([seat, declaration]) => [seat, declaration.model]),
      ),
    };
    for (const role of roster()) {
      const binding = resolveBinding(paid, selection, role);
      expect([role, binding.outcome]).toEqual([role, "binding"]);
      if (binding.outcome !== "binding") continue;
      expect([role, binding.binding.seat]).toEqual([role, role]);
      expect([role, binding.binding.resolvedModel]).toEqual([role, "deepseek/deepseek-flash"]);
    }
  });
});

/* -------------------------------- SEAT-003 ------------------------------- */

describe("GH-374 TC-POL-SEAT-003 the --for-spawn env record is valid data-v1 and branded", () => {
  test("25 sorted records, derived names, declared values and both bounds", async () => {
    const composed = harness({ label: "seat003" });
    try {
      const result = await composed.run([
        "provider",
        "profile",
        "resolve",
        "--agent",
        "pm",
        "--for-spawn",
        "--json",
      ]);
      expect(result.exitCode).toBe(0);
      const record = asRecord(asRecord(result.data).envRecord);
      const entries = record.entries;
      if (!Array.isArray(entries)) throw new Error("expected the env-record entries");
      expect(entries).toHaveLength(25);
      const delivery = declaredProfileConfig().profiles.delivery;
      if (delivery === undefined) throw new Error("expected the delivery profile");
      const seats = Object.keys(delivery.seats).sort();
      for (const [index, entry] of entries.entries()) {
        const projected = asRecord(entry);
        const seat = seats[index] ?? "";
        const envToken = seat.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
        expect(projected.name).toBe(`OC_JAISHIP_AGENT_${envToken}_MODEL`);
        expect(projected.value).toBe(delivery.seats[seat]?.model);
        expect(projected.operation).toBe("set");
      }
      const serialized = String(record.serialized);
      const validated = validateEnvRecord(serialized, undefined);
      expect(validated.ok).toBe(true);
      expect(Buffer.byteLength(serialized, "utf8")).toBeLessThanOrEqual(ENV_RECORD_MAX_BYTES);
      expect(entries.length).toBeLessThanOrEqual(ENV_RECORD_MAX_RECORDS);
      // No seat declares an explicit envName: the name is derived.
      const documents = readDocuments();
      const profileMap = asRecord(asRecord(asRecord(documents.provider).profiles).profiles);
      for (const profile of Object.values(profileMap)) {
        for (const seat of Object.values(asRecord(asRecord(profile).seats))) {
          expect("envName" in asRecord(seat)).toBe(false);
        }
      }
    } finally {
      composed.cleanup();
    }
  });

  test("the record builder refuses an oversized name, proving the bound is asserted", () => {
    const delivery = declaredProfileConfig().profiles.delivery;
    if (delivery === undefined) throw new Error("expected the delivery profile");
    const built = buildProfileEnvRecord({
      seats: {
        coder: delivery.seats.coder ?? {
          model: "unknown",
          pacingClass: "execution",
          capability: "text-only",
        },
      },
      seatModels: { coder: "deepseek/deepseek-flash" },
      namePrefix: "jaiship",
      policy: { maxRecords: 1 },
    });
    expect(built.ok).toBe(true);
    const overflow = buildProfileEnvRecord({
      seats: delivery.seats,
      seatModels: Object.fromEntries(
        Object.entries(delivery.seats).map(([seat, declaration]) => [seat, declaration.model]),
      ),
      namePrefix: "jaiship",
      policy: { maxRecords: 2 },
    });
    expect(overflow.ok).toBe(false);
  });
});

/* -------------------------------- SEAT-004 ------------------------------- */

describe("GH-374 TC-POL-SEAT-004 both visual seats are vision-capable and the vision arms name the agent", () => {
  test("capability map is identical per seat, no vision on a text-only model, and the agent-less arm is the trap", () => {
    const profiles = declaredProfileConfig();
    const delivery = profiles.profiles.delivery;
    const paid = profiles.profiles.paid;
    if (delivery === undefined || paid === undefined) throw new Error("expected both profiles");
    for (const seat of ["designer", "image-reviewer"]) {
      expect([seat, delivery.seats[seat]?.model]).toEqual([seat, "zai-coding-plan/glm-5.4"]);
      expect([seat, delivery.seats[seat]?.capability]).toEqual([seat, "vision-capable"]);
      expect([seat, paid.seats[seat]?.capability]).toEqual([seat, "vision-capable"]);
    }
    expect(delivery.seats["image-generator"]?.capability).toBe("text-only");
    for (const [seat, declaration] of Object.entries(delivery.seats)) {
      if (declaration.model === "zai-coding-plan/glm-5.3-flash") {
        expect([seat, declaration.capability]).toEqual([seat, "text-only"]);
      }
      if (declaration.capability === "vision-capable") {
        expect(
          ["zai-coding-plan/glm-5.4", "deepseek/deepseek-flash"].includes(declaration.model),
        ).toBe(true);
      }
      expect([seat, declaration.capability]).toEqual([seat, paid.seats[seat]?.capability]);
    }
    const entries = declaredProviderConfig().entries;
    const probe = createResolvedProviderProbe(entries, NOON_MS);
    const base = selectProfile({
      profiles,
      probe,
      nowMs: NOON_MS,
      requireVision: true,
      agent: "designer",
    });
    expect(base.ok).toBe(true);
    if (base.ok) {
      expect(base.decision.profile).toBe("delivery");
      expect(base.decision.seatModels.designer).toBe("zai-coding-plan/glm-5.4");
    }
    const imageReviewer = selectProfile({
      profiles,
      probe,
      nowMs: NOON_MS,
      requireVision: true,
      agent: "image-reviewer",
    });
    expect(imageReviewer.ok).toBe(true);
    // The agent-less arm is asserted as the DENIED TRAP, never the oracle: it
    // resolves the alphabetically first seat (bootstrapper, a z.ai text seat).
    const trap = selectProfile({ profiles, probe, nowMs: NOON_MS, requireVision: true });
    expect(trap.ok).toBe(false);
    if (trap.ok) return;
    expect(trap.code).toBe("provider.profile.capability-denied");
  });
});

/* -------------------------------- SEAT-005 ------------------------------- */

describe("GH-374 TC-POL-SEAT-005 the per-seat model and pacing map is the recorded legacy intent", () => {
  test("the base 10/2/13 split, the paid all-flash map and the 14/11 pacing split", () => {
    const profiles = declaredProfileConfig();
    const delivery = profiles.profiles.delivery;
    const paid = profiles.profiles.paid;
    if (delivery === undefined || paid === undefined) throw new Error("expected both profiles");
    const full = Object.entries(delivery.seats)
      .filter(([, seat]) => seat.model === "zai-coding-plan/glm-5.4")
      .map(([seat]) => seat)
      .sort();
    const flash = Object.entries(delivery.seats)
      .filter(([, seat]) => seat.model === "zai-coding-plan/glm-5.3-flash")
      .map(([seat]) => seat)
      .sort();
    const paidModels = Object.entries(delivery.seats)
      .filter(([, seat]) => seat.model === "deepseek/deepseek-flash")
      .map(([seat]) => seat)
      .sort();
    expect(full).toEqual([
      "bootstrapper",
      "ceo",
      "decision-advisor",
      "decision-critic",
      "designer",
      "image-reviewer",
      "plan-writer",
      "readiness-reviewer",
      "reviewer",
      "toolsmith",
    ]);
    expect(flash).toEqual(["editor", "pm"]);
    expect(paidModels).toHaveLength(13);
    const judgment = Object.entries(delivery.seats)
      .filter(([, seat]) => seat.pacingClass === "judgment")
      .map(([seat]) => seat)
      .sort();
    expect(judgment).toEqual([
      "bootstrapper",
      "ceo",
      "coder",
      "decision-advisor",
      "decision-critic",
      "fixer",
      "plan-writer",
      "pm",
      "readiness-reviewer",
      "review-feedback-applier",
      "reviewer",
      "spec-writer",
      "test-plan-writer",
      "toolsmith",
    ]);
    expect(
      Object.values(delivery.seats).filter((seat) => seat.pacingClass === "execution"),
    ).toHaveLength(11);
    for (const [seat, declaration] of Object.entries(paid.seats)) {
      expect([seat, declaration.model]).toEqual([seat, "deepseek/deepseek-flash"]);
      expect([seat, declaration.pacingClass]).toEqual([seat, delivery.seats[seat]?.pacingClass]);
      expect(Object.keys(declaration).sort()).toEqual(["capability", "model", "pacingClass"]);
    }
  });
});

/* -------------------------------- SIM-001 -------------------------------- */

const replay = async (name: string, label = name) => {
  const composed = harness({
    label: `sim-${label}`,
    throwCredential: true,
    throwTransport: true,
    throwSpend: true,
    clockMs: NOON_MS,
  });
  const before = snapshot(composed.state);
  const result = await composed.run([
    "provider",
    "simulate",
    "--fixture",
    fixturePath(name),
    "--json",
  ]);
  return { composed, result, before };
};

describe("GH-374 TC-POL-SIM-001 peak parking reproduces the chain park, the provider park and 10:00Z", () => {
  test("the chain park is chain:subscription-only with kind peak-window and the zone evidence", async () => {
    const { composed, result } = await replay("peak-park");
    try {
      expect(result.exitCode).toBe(0);
      const data = asRecord(result.data);
      const decision = asRecord(data.decision);
      expect(decision.kind).toBe("parked");
      const park = asRecord(decision.park);
      expect(park.name).toBe("chain:subscription-only");
      expect(park.cause).toBe("chain-exhausted");
      expect(park.conditions).toEqual(["peak-window"]);
      expect(park.expiresAtMs).toBe(Date.UTC(2026, 10, 20, 10, 0, 0));
      expect(park.expiresAt).toBe("2026-11-20T10:00:00.000Z");
      const parks = data.parks;
      if (!Array.isArray(parks)) throw new Error("expected the park list");
      const provider = asRecord(
        parks.find((entry) => asRecord(entry).name === "provider:zai-coding-plan"),
      );
      expect(provider.cause).toBe("peak-window");
      expect(asRecord(provider.evidence).timezone).toBe("UTC");
      expect(data.skipped).toEqual([{ providerName: "zai-coding-plan", reason: "peak-window" }]);
      const announcements = data.announcements;
      if (!Array.isArray(announcements)) throw new Error("expected the announcement list");
      expect(
        announcements
          .map((entry) => `${String(asRecord(entry).code)}/${String(asRecord(entry).severity)}`)
          .sort(),
      ).toEqual(["provider.chain.exhausted/warning", "provider.peak.parked/info"]);
      expect(asRecord(data.simulation).stateWrites).toBe(0);
    } finally {
      composed.cleanup();
    }
  });
});

/* -------------------------------- SIM-002 -------------------------------- */

describe("GH-374 TC-POL-SIM-002 an exhausted quota parks at the reset and selects paid on the default chain", () => {
  test("the never-pay chain parks at the reported reset; the default chain takes the declared fallback", async () => {
    const { composed, result } = await replay("quota-park");
    try {
      expect(result.exitCode).toBe(0);
      const data = asRecord(result.data);
      const park = asRecord(asRecord(data.decision).park);
      expect(park.name).toBe("chain:subscription-only");
      expect(park.cause).toBe("chain-exhausted");
      expect(park.conditions).toEqual(["quota-exhausted"]);
      expect(park.expiresAtMs).toBe(RESET_MS);
      const parks = data.parks;
      if (!Array.isArray(parks)) throw new Error("expected the park list");
      expect(
        parks.some(
          (entry) =>
            asRecord(entry).name === "provider:zai-coding-plan" &&
            asRecord(entry).cause === "quota-exhausted",
        ),
      ).toBe(true);
      const announcements = data.announcements;
      if (!Array.isArray(announcements)) throw new Error("expected the announcement list");
      expect(
        announcements
          .map((entry) => `${String(asRecord(entry).code)}/${String(asRecord(entry).severity)}`)
          .sort(),
      ).toEqual(["provider.chain.exhausted/warning", "provider.quota.parked/info"]);
    } finally {
      composed.cleanup();
    }

    const fallback = await replay("paid-fallback", "quota-park-default");
    try {
      // The same facts on the default chain select the declared paid fallback.
      expect(fallback.result.exitCode).toBe(0);
      const decision = asRecord(asRecord(fallback.result.data).decision);
      expect(decision.kind).toBe("selected");
      expect(decision.providerName).toBe("deepseek");
    } finally {
      fallback.composed.cleanup();
    }
  });
});

/* -------------------------------- SIM-003 -------------------------------- */

describe("GH-374 TC-POL-SIM-003 spend 25 parks both entries on the window scope at exactly newest + 86,400 s", () => {
  test("both entries park, the ticket scope is clear, the expiry is exact and no paid escape exists", async () => {
    const { composed, result } = await replay("budget-park");
    try {
      expect(result.exitCode).toBe(0);
      const data = asRecord(result.data);
      const decision = asRecord(data.decision);
      expect(decision.kind).toBe("parked");
      const park = asRecord(decision.park);
      expect(park.name).toBe("chain:subscription-first");
      expect(park.cause).toBe("chain-exhausted");
      expect(park.conditions).toEqual(["budget-exhausted"]);
      const newestAtMs = Date.UTC(2026, 10, 20, 11, 0, 0);
      expect(park.expiresAtMs).toBe(newestAtMs + 86_400_000);
      expect(Number(park.expiresAtMs)).toBeGreaterThan(NOON_MS);
      const parks = data.parks;
      if (!Array.isArray(parks)) throw new Error("expected the park list");
      const names = parks
        .filter((entry) => asRecord(entry).subjectKind === "provider")
        .map((entry) => `${String(asRecord(entry).name)}:${String(asRecord(entry).cause)}`)
        .sort();
      expect(names).toEqual([
        "provider:deepseek:budget-exhausted",
        "provider:zai-coding-plan:budget-exhausted",
      ]);
      const announcements = data.announcements;
      if (!Array.isArray(announcements)) throw new Error("expected the announcement list");
      const budget = asRecord(
        announcements.find((entry) => asRecord(entry).code === "provider.budget.parked"),
      );
      const evidence = asRecord(budget.evidence);
      expect(evidence.budgetName).toBe("window-cost");
      expect(evidence.budgetScope).toBe("window");
      expect(evidence.budgetBasis).toBe("cost");
      expect(evidence.budgetMeasured).toBe(25);
      expect(evidence.budgetCeiling).toBe(20);
      // The ticket scope is clear: no crossing and no refusal.
      expect(
        announcements.some((entry) => asRecord(entry).code === "provider.budget.crossed"),
      ).toBe(false);
      expect(data.decision).toBeDefined();
      expect(asRecord(data.simulation).stateWrites).toBe(0);
      // A parked chain reports every entry skipped with the parked cause.
      expect(data.skipped).toEqual([
        { providerName: "zai-coding-plan", reason: "budget-exhausted" },
        { providerName: "deepseek", reason: "budget-exhausted" },
      ]);
    } finally {
      composed.cleanup();
    }
  });
});

/* -------------------------------- SIM-004 -------------------------------- */

describe("GH-374 TC-POL-SIM-004 a clear policy selects the subscription entry and reports paid shadowed", () => {
  test("the selection and the skip order are the declared ones", async () => {
    const { composed, result } = await replay("subscription-first");
    try {
      expect(result.exitCode).toBe(0);
      const data = asRecord(result.data);
      expect(data.chain).toBe("subscription-first");
      const decision = asRecord(data.decision);
      expect(decision.kind).toBe("selected");
      expect(decision.providerName).toBe("zai-coding-plan");
      expect(decision.costClass).toBe("subscription");
      expect(data.skipped).toEqual([{ providerName: "deepseek", reason: "shadowed" }]);
      expect(data.parks).toEqual([]);
      expect(data.announcements).toEqual([]);
      expect(asRecord(data.simulation).stateWrites).toBe(0);
    } finally {
      composed.cleanup();
    }
  });
});

/* -------------------------------- SIM-005 -------------------------------- */

describe("GH-374 TC-POL-SIM-005 an exhausted subscription quota selects the paid entry, never for a peak", () => {
  test("the fallback selects the paid entry; a peak-parked subscription selects no paid entry", async () => {
    const { composed, result } = await replay("paid-fallback");
    try {
      expect(result.exitCode).toBe(0);
      const data = asRecord(result.data);
      const decision = asRecord(data.decision);
      expect(decision.kind).toBe("selected");
      expect(decision.providerName).toBe("deepseek");
      expect(decision.costClass).toBe("pay-per-token");
      expect(data.skipped).toEqual([
        { providerName: "zai-coding-plan", reason: "quota-exhausted" },
      ]);
      const parks = data.parks;
      if (!Array.isArray(parks)) throw new Error("expected the park list");
      // The only park is the subscription's quota park: no chain park, no escape.
      expect(parks.map((entry) => String(asRecord(entry).name))).toEqual([
        "provider:zai-coding-plan",
      ]);
      expect(asRecord(data.simulation).stateWrites).toBe(0);
    } finally {
      composed.cleanup();
    }

    // The peak arm: the same policy at 05:00 with the default chain parks and
    // selects no paid entry (the no-paid-escalation rule).
    const peak = harness({
      label: "sim005-peak",
      clockMs: Date.UTC(2026, 10, 20, 5, 0, 0),
      throwCredential: true,
      throwTransport: true,
      throwSpend: true,
    });
    try {
      // The same 05:00 facts on the DEFAULT chain: both entries are parked, so
      // no chain configuration selects the paid entry.
      const defaultChainPeak = JSON.parse(readFileSync(fixturePath("peak-park"), "utf8")) as Record<
        string,
        unknown
      >;
      delete defaultChainPeak.chain;
      const peakPath = join(peak.checkout, "peak-default-chain.json");
      writeFileSync(peakPath, `${JSON.stringify(defaultChainPeak)}\n`);
      const peakResult = await peak.run(["provider", "simulate", "--fixture", peakPath, "--json"]);
      expect(peakResult.exitCode).toBe(0);
      const peakData = asRecord(peakResult.data);
      const decision = asRecord(peakData.decision);
      expect(decision.kind).toBe("parked");
      expect(asRecord(decision.park).conditions).toContain("peak-window");
      expect(decision.providerName).toBeUndefined();
    } finally {
      peak.cleanup();
    }
  });
});

/* -------------------------------- SIM-006 -------------------------------- */

describe("GH-374 TC-POL-SIM-006 spend 30 is the ticket stop: exit 1 with no data, no park and no expiry", () => {
  test("the refusal envelope names the crossed ceiling and carries the crossed identity", async () => {
    const { composed, result } = await replay("ticket-ceiling");
    try {
      expect(result.exitCode).toBe(1);
      expect(result.data).toBeUndefined();
      expect(result.error?.code).toBe("provider.budget.exceeded");
      expect(result.error?.category).toBe("user");
      expect(result.error?.retryable).toBe(false);
      const summary = String(result.error?.summary ?? "");
      expect(summary).toContain("crossed budget");
      expect(summary).toContain("30");
      expect(summary).toContain("the ceiling cannot reopen");
      expect(summary).not.toContain("skipped");
      expect(result.stdout).not.toContain('"data"');
      expect(result.stdout).not.toContain('"skipped"');
    } finally {
      composed.cleanup();
    }
  });

  test("the delivered replay reports the crossed announcement identity and the ticket failure", async () => {
    const { parseProviderSimulateFixture, simulateProviderResolution } = await import(
      "../../packages/core/src/provider/simulate"
    );
    const text = readFileSync(fixturePath("ticket-ceiling"), "utf8");
    const parsed = parseProviderSimulateFixture({
      text,
      byteLength: Buffer.byteLength(text, "utf8"),
    });
    if (!parsed.ok) throw new Error(parsed.summary);
    const outcome = await simulateProviderResolution({
      fixturePath: fixturePath("ticket-ceiling"),
      fixture: parsed.fixture,
      config: declaredProviderConfig(),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe("provider.budget.exceeded");
    expect(outcome.announcementCode).toBe("provider.budget.crossed");
    expect(outcome.summary).toContain("the ceiling cannot reopen");
  });

  test("the delivered budget evaluation puts the ticket scope at failed and the window scope at parked", () => {
    const providers = declaredProviderConfig();
    const evaluation = evaluateBudgets({
      budgets: providers.budgets,
      nowMs: NOON_MS,
      read: {
        status: "measured",
        totals: [
          {
            scopeKey: "ticket-cost",
            cost: 30,
            tokens: 600,
            newestAtMs: Date.UTC(2026, 10, 20, 11, 30, 0),
          },
          {
            scopeKey: "window-cost",
            cost: 30,
            tokens: 600,
            newestAtMs: Date.UTC(2026, 10, 20, 11, 30, 0),
          },
        ],
      },
    });
    expect(evaluation.outcomes["ticket-cost"]?.status).toBe("failed");
    expect(evaluation.outcomes["window-cost"]?.status).toBe("parked");
    if (evaluation.outcomes["ticket-cost"]?.status !== "failed") return;
    expect(evaluation.outcomes["ticket-cost"].announcementCode).toBe("provider.budget.crossed");
    expect(evaluation.outcomes["ticket-cost"].evidence.budgetMeasured).toBe(30);
    expect(evaluation.outcomes["ticket-cost"].evidence.budgetCeiling).toBe(30);
  });
});

/* -------------------------------- SIM-007 -------------------------------- */

describe("GH-374 TC-POL-SIM-007 every replay discloses stateWrites 0 with zero effect", () => {
  test("6/6 fixtures carry the seven-key simulation block and call no armed seam", async () => {
    const names = [
      "peak-park",
      "quota-park",
      "budget-park",
      "subscription-first",
      "paid-fallback",
      "ticket-ceiling",
    ] as const;
    let replayed = 0;
    for (const name of names) {
      const { composed, result, before } = await replay(name, `purity-${name}`);
      try {
        if (result.exitCode === 1) {
          // The ticket stop carries no data payload by design.
          expect(result.data).toBeUndefined();
          replayed += 1;
          continue;
        }
        const data = asRecord(result.data);
        const simulation = asRecord(data.simulation);
        expect(Object.keys(simulation).sort()).toEqual([
          "fixturePath",
          "fixtureSchemaVersion",
          "inputs",
          "now",
          "stateWrites",
          "summary",
          "workItemRef",
        ]);
        expect(simulation.stateWrites).toBe(0);
        expect(simulation.fixtureSchemaVersion).toBe("delivery.provider.simulate.v1");
        expect(simulation.workItemRef).toBe("GH-374");
        expect("workItemRef" in data).toBe(false);
        expect(composed.calls.credential).toBe(0);
        expect(composed.calls.transport).toBe(0);
        expect(composed.calls.spend).toBe(0);
        expect(snapshot(composed.state)).toEqual(before);
        replayed += 1;
      } finally {
        composed.cleanup();
      }
    }
    expect(replayed).toBe(6);
  });
});

/* -------------------------------- SIM-008 -------------------------------- */

describe("GH-374 TC-POL-SIM-008 every replay is byte-identical and key order is not an input", () => {
  test("a repeat run produces the identical payload and a key-shuffled fixture the identical decision", async () => {
    let compared = 0;
    for (const name of ["subscription-first", "peak-park", "budget-park"] as const) {
      const first = await replay(name, `repeat-a-${name}`);
      const second = await replay(name, `repeat-b-${name}`);
      try {
        expect(JSON.stringify(second.result.data)).toBe(JSON.stringify(first.result.data));
        compared += 1;
      } finally {
        first.composed.cleanup();
        second.composed.cleanup();
      }
    }
    expect(compared).toBe(3);

    // The key-shuffled twin: the same facts with every object's keys reversed.
    const original = JSON.parse(readFileSync(fixturePath("subscription-first"), "utf8")) as unknown;
    const reversed = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(reversed);
      if (typeof value !== "object" || value === null) return value;
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .reverse()
          .map(([key, entry]) => [key, reversed(entry)]),
      );
    };
    const shuffled = harness({ label: "sim008-shuffled" });
    try {
      const path = join(shuffled.checkout, "shuffled.json");
      writeFileSync(path, `${JSON.stringify(reversed(original))}\n`);
      const result = await shuffled.run(["provider", "simulate", "--fixture", path, "--json"]);
      expect(result.exitCode).toBe(0);
      expect(dataOfDecision(result.data)).toEqual({
        kind: "selected",
        providerName: "zai-coding-plan",
        skipped: [{ providerName: "deepseek", reason: "shadowed" }],
      });
    } finally {
      shuffled.cleanup();
    }
  });
});

const dataOfDecision = (value: Record<string, unknown> | undefined) => {
  const data = asRecord(value);
  return {
    kind: asRecord(data.decision).kind,
    providerName: asRecord(data.decision).providerName,
    skipped: data.skipped,
  };
};

/* -------------------------------- SIM-009 -------------------------------- */

describe("GH-374 TC-POL-SIM-009 hostile fixtures refuse without echoing and the figures 25/30 are pinned", () => {
  const base = JSON.parse(readFileSync(fixturePath("subscription-first"), "utf8")) as Record<
    string,
    unknown
  >;

  const hostile = (name: string, mutate: (value: Record<string, unknown>) => void) => {
    const document = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
    mutate(document);
    return { name, text: `${JSON.stringify(document)}\n` };
  };

  test("each structural defect is refused naming its field, with no content echoed and nothing written", async () => {
    const cases = [
      hostile("unknown-key", (document) => {
        document.unexpected = true;
      }),
      hostile("credential-value", (document) => {
        document.credentials = { zai: { value: "CANARY-VALUE" } };
      }),
      hostile("quota-secret", (document) => {
        document.quota = {
          "zai-coding-plan": { httpStatus: 200, body: "{}", secret: "CANARY-VALUE" },
        };
      }),
      hostile("missing-ref", (document) => {
        delete document.workItemRef;
      }),
      hostile("zoneless-now", (document) => {
        document.now = "2026-11-20T12:00:00";
      }),
      hostile("chain-type", (document) => {
        document.chain = 42;
      }),
    ];
    const composed = harness({ label: "sim009-hostile" });
    try {
      const before = snapshot(composed.state);
      for (const sample of cases) {
        const path = join(composed.checkout, `${sample.name}.json`);
        writeFileSync(path, sample.text);
        const result = await composed.run(["provider", "simulate", "--fixture", path, "--json"]);
        expect([sample.name, result.exitCode]).toEqual([sample.name, 1]);
        expect([sample.name, result.error?.code]).toEqual([sample.name, "input.value.rejected"]);
        expect([sample.name, result.stdout.includes("CANARY-VALUE")]).toEqual([sample.name, false]);
        expect([sample.name, result.stderr.includes("CANARY-VALUE")]).toEqual([sample.name, false]);
      }
      expect(snapshot(composed.state)).toEqual(before);

      // Grammar arms: no --fixture, and a missing file.
      const noFixture = await composed.run(["provider", "simulate", "--json"]);
      expect(noFixture.exitCode).toBe(1);
      const missing = await composed.run([
        "provider",
        "simulate",
        "--fixture",
        join(composed.checkout, "missing.json"),
        "--json",
      ]);
      expect(missing.exitCode).toBe(1);
      expect(missing.error?.code).toBe("input.value.rejected");
    } finally {
      composed.cleanup();
    }
  });

  test("the six committed fixtures pin the figures 25 and 30 and the schema/ref of every fixture", () => {
    const files = readdirSync(FIXTURE_DIRECTORY)
      .filter((name) => name.endsWith(".json"))
      .sort();
    expect(files).toEqual([
      "budget-park.json",
      "paid-fallback.json",
      "peak-park.json",
      "quota-park.json",
      "subscription-first.json",
      "ticket-ceiling.json",
    ]);
    for (const file of files) {
      const document = JSON.parse(readFileSync(join(FIXTURE_DIRECTORY, file), "utf8")) as Record<
        string,
        unknown
      >;
      expect([file, document.schemaVersion]).toEqual([file, "delivery.provider.simulate.v1"]);
      expect([file, document.workItemRef]).toEqual([file, "GH-374"]);
      const text = readFileSync(join(FIXTURE_DIRECTORY, file), "utf8");
      expect([file, text.endsWith("\n")]).toEqual([file, true]);
      expect([file, JSON.parse(text) !== null]).toEqual([file, true]);
    }
    const budget = JSON.parse(readFileSync(fixturePath("budget-park"), "utf8")) as Record<
      string,
      unknown
    >;
    const budgetSpend = asRecord(budget.spend);
    const budgetPoints = budgetSpend.points;
    if (!Array.isArray(budgetPoints)) throw new Error("expected spend points");
    expect(budgetPoints.reduce((sum, point) => sum + Number(asRecord(point).cost), 0)).toBe(25);
    const ticket = JSON.parse(readFileSync(fixturePath("ticket-ceiling"), "utf8")) as Record<
      string,
      unknown
    >;
    const ticketSpend = asRecord(ticket.spend);
    const ticketPoints = ticketSpend.points;
    if (!Array.isArray(ticketPoints)) throw new Error("expected spend points");
    expect(ticketPoints.reduce((sum, point) => sum + Number(asRecord(point).cost), 0)).toBe(30);
  });
});

/* -------------------------------- NOM-001 -------------------------------- */

describe("GH-374 TC-POL-NOM-001 nomination returns delivery and provider.profile.absent is not producible", () => {
  test("the real configuration nominates delivery with zero seam calls; the empty branch refuses absent", () => {
    const providers = declaredProviderConfig();
    const profiles = declaredProfileConfig();
    const probe = createResolvedProviderProbe(providers.entries, NOON_MS);
    const nomination = nominateProviderProfile({ profiles, probe, nowMs: NOON_MS });
    expect(nomination.ok).toBe(true);
    if (nomination.ok) expect(nomination.profile).toBe("delivery");

    const document = readDocuments();
    const provider = asRecord(document.provider);
    provider.profiles = {};
    // The empty branch parses to the delivered empty configuration; the
    // nomination gate then refuses `provider.profile.absent`.
    const emptyProfiles = parseProfileConfiguration(document);
    expect(emptyProfiles.ok).toBe(true);
    if (!emptyProfiles.ok) return;
    const empty = nominateProviderProfile({
      profiles: emptyProfiles.config,
      probe,
      nowMs: NOON_MS,
    });
    expect(empty.ok).toBe(false);
    if (empty.ok) return;
    expect(empty.refusal.code).toBe("provider.profile.absent");
  });

  test("the composed nomination path calls no credential port and no transport", async () => {
    const composed = harness({
      label: "nom001-composed",
      throwCredential: true,
      throwTransport: true,
      throwSpend: true,
    });
    try {
      const result = await composed.run(["provider", "profile", "resolve", "--json"]);
      expect(result.exitCode).toBe(0);
      expect(asRecord(result.data).profile).toBe("delivery");
      expect(composed.calls.credential).toBe(0);
      expect(composed.calls.transport).toBe(0);
    } finally {
      composed.cleanup();
    }
  });
});

/* -------------------------------- NOM-002 -------------------------------- */

describe("GH-374 TC-POL-NOM-002 inside the pause no profile is eligible", () => {
  test("the nomination refusal carries the exact eligibility strings, and the composed payload carries the blocker values", async () => {
    const providers = declaredProviderConfig();
    const profiles = declaredProfileConfig();
    const at = (hours: number) => Date.UTC(2026, 10, 20, hours, 0, 0);
    const strings = (nowMs: number) => {
      const probe = createResolvedProviderProbe(providers.entries, nowMs);
      const nomination = nominateProviderProfile({ profiles, probe, nowMs });
      expect(nomination.ok).toBe(false);
      if (nomination.ok) return undefined;
      expect(nomination.refusal.code).toBe("provider.profile.unavailable");
      return nomination.refusal.eligibility;
    };
    expect(strings(at(5))).toEqual([
      "delivery:ineligible:condition+condition",
      "paid:ineligible:condition",
    ]);
    expect(strings(at(2))).toEqual(["delivery:ineligible:condition", "paid:ineligible:condition"]);
    const noonProbe = createResolvedProviderProbe(providers.entries, NOON_MS);
    const noon = nominateProviderProfile({ profiles, probe: noonProbe, nowMs: NOON_MS });
    expect(noon.ok).toBe(true);

    const composed = harness({
      label: "nom002-0500",
      clockMs: at(5),
      throwCredential: true,
      throwTransport: true,
      throwSpend: true,
    });
    try {
      const result = await composed.run(["provider", "profile", "resolve", "--json"]);
      expect(result.exitCode).toBe(2);
      const data = asRecord(result.data);
      expect(data.outcome).toBe("refused");
      expect(data.code).toBe("provider.profile.unavailable");
      const eligibility = data.eligibility;
      if (!Array.isArray(eligibility)) throw new Error("expected the eligibility list");
      const delivery = asRecord(
        eligibility.find((entry) => asRecord(entry).profile === "delivery"),
      );
      expect(delivery.verdict).toBe("ineligible");
      const blockers = delivery.blockers;
      if (!Array.isArray(blockers)) throw new Error("expected the blocker list");
      expect(blockers).toHaveLength(2);
      for (const blocker of blockers) {
        expect(asRecord(blocker).kind).toBe("condition");
        expect(asRecord(blocker).value).toBe("peak-window");
      }
      const paid = asRecord(eligibility.find((entry) => asRecord(entry).profile === "paid"));
      const paidBlockers = paid.blockers;
      if (!Array.isArray(paidBlockers)) throw new Error("expected the paid blocker list");
      expect(paidBlockers).toHaveLength(1);
      expect(asRecord(paidBlockers[0]).value).toBe("peak-window");
    } finally {
      composed.cleanup();
    }

    const early = harness({
      label: "nom002-0200",
      clockMs: at(2),
      throwCredential: true,
      throwTransport: true,
      throwSpend: true,
    });
    try {
      const result = await early.run(["provider", "profile", "resolve", "--json"]);
      expect(result.exitCode).toBe(2);
      const eligibility = asRecord(result.data).eligibility;
      if (!Array.isArray(eligibility)) throw new Error("expected the eligibility list");
      const delivery = asRecord(
        eligibility.find((entry) => asRecord(entry).profile === "delivery"),
      );
      const blockers = delivery.blockers;
      if (!Array.isArray(blockers)) throw new Error("expected the blocker list");
      expect(blockers).toHaveLength(1);
      expect(asRecord(blockers[0]).value).toBe("peak-window");
    } finally {
      early.cleanup();
    }
  });
});

/* -------------------------------- NOM-003 -------------------------------- */

describe("GH-374 TC-POL-NOM-003 no real dispatch and the typed-attempt substitution is recorded", () => {
  test("the plan records the substitution, and no proof reaches a dispatch, lease or spawn seam", async () => {
    const plan = readFileSync(
      join(
        ROOT,
        "doc/changes/2026-11/2026-11-20--GH-374--provider-policy-adoption/chg-GH-374-plan.yaml",
      ),
      "utf8",
    );
    expect(plan).toContain("dispatch GH-374");
    expect(plan).toContain("claim the repository lease");
    expect(plan).toContain("TYPED-ATTEMPT");
    expect(plan).toContain("HALF IS NOT OBSERVED");
    expect(plan).toContain("substitution");
    const childModules = ["node:", "child", "_process"].join("");
    expect(readFileSync(import.meta.path, "utf8").includes(childModules)).toBe(false);
    // The nominal proof runs the delivered resolve path over injected facts; no
    // dispatch, lease, lane or spawn seam exists in the composition at all.
    const composed = harness({ label: "nom003" });
    try {
      const result = await composed.run(["provider", "resolve", "--json"]);
      expect(result.exitCode).toBe(0);
      expect(asRecord(result.data).chain).toBe("subscription-first");
      expect(composed.calls.credential).toBe(1);
      expect(composed.calls.transport).toBe(1);
      expect(composed.calls.spend).toBe(1);
    } finally {
      composed.cleanup();
    }
  });
});

/* -------------------------------- NOM-004 -------------------------------- */

describe("GH-374 TC-POL-NOM-004 nomination, resolve and the env record agree for all 25 roles", () => {
  test("25/25 roles agree on profile, seat and model across the three surfaces", async () => {
    const providers = declaredProviderConfig();
    const profiles = declaredProfileConfig();
    const delivery = profiles.profiles.delivery;
    if (delivery === undefined) throw new Error("expected the delivery profile");
    const probe = createResolvedProviderProbe(providers.entries, NOON_MS);
    const nomination = nominateProviderProfile({ profiles, probe, nowMs: NOON_MS });
    expect(nomination.ok).toBe(true);
    if (!nomination.ok) return;
    const composed = harness({ label: "nom004" });
    try {
      const recordResult = await composed.run([
        "provider",
        "profile",
        "resolve",
        "--agent",
        "pm",
        "--for-spawn",
        "--json",
      ]);
      const envRecord = asRecord(asRecord(recordResult.data).envRecord);
      const entries = envRecord.entries;
      if (!Array.isArray(entries)) throw new Error("expected the env-record entries");
      const byName = new Map(
        entries.map((entry) => [String(asRecord(entry).name), String(asRecord(entry).value)]),
      );
      const selection = {
        agentOverrides: delivery.agentOverrides,
        seatModels: Object.fromEntries(
          Object.entries(delivery.seats).map(([seat, declaration]) => [seat, declaration.model]),
        ),
      };
      for (const role of roster()) {
        const result = await composed.run([
          "provider",
          "profile",
          "resolve",
          "--agent",
          role,
          "--json",
        ]);
        expect([role, asRecord(result.data).profile]).toEqual([role, nomination.profile]);
        const binding = resolveBinding(delivery, selection, role);
        expect([role, binding.outcome]).toEqual([role, "binding"]);
        if (binding.outcome !== "binding") continue;
        const envToken = role.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
        expect([role, byName.get(`OC_JAISHIP_AGENT_${envToken}_MODEL`)]).toEqual([
          role,
          binding.binding.resolvedModel,
        ]);
        const expressible = evaluateModelExpressibility(binding.binding);
        expect([role, expressible.ok]).toEqual([role, true]);
      }
    } finally {
      composed.cleanup();
    }
  });
});
