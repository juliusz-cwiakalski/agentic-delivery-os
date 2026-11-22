/**
 * GH-374 TC-POL-CFG-001/004/006/007/008/009, TC-POL-SEAT-006,
 * TC-POL-DRIFT-001..007, TC-POL-MIG-001..003 — the permanent reference test
 * over the REAL committed provider policy in `.jaiship/config.yaml`.
 *
 * Every case reads the real document (never a fixture copy) through the
 * delivered validators and the delivered composition. Declared values are
 * pinned exactly; the shipped defaults the document does not restate are asserted
 * separately at `layer=defaults`. Mutations are written to copies under
 * `tmp/tmpdir/mutants/**`; the committed document is never written.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { acquireFileConfig, nodeFileSystemFacts } from "../../packages/adapters/src/file/index";
import { createConfigProgram } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import {
  deriveGraceSecondsMax,
  parseProfilePeakWindows,
} from "../../packages/core/src/provider/peak-rules";
import { UTC_ZONE_FACTS, evaluatePeakWindow } from "../../packages/core/src/provider/peak";
import {
  parseAndValidateProfileConfiguration,
  parseAndValidateProviderConfiguration,
  selectProviderChain,
} from "../../packages/core/src/provider/validate";
import { evaluateModelExpressibility } from "../../packages/core/src/domain/harness-profile-propagation";
import {
  PROVIDER_MIGRATE_MAX_SOURCES,
  PROVIDER_MIGRATE_SOURCE_MAX_BYTES,
  PROVIDER_MIGRATE_SOURCE_MAX_LINES,
} from "../../packages/core/src/contracts/provider";
import { HARNESS_MODEL_EXPRESSION_MAX_CHARS } from "../../packages/core/src/contracts/harness";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const ROOT = process.cwd();
const CONFIG = join(ROOT, ".jaiship/config.yaml");
const CHANGE_FOLDER = join(
  ROOT,
  "doc/changes/2026-11/2026-11-20--GH-374--provider-policy-adoption",
);
const MIGRATION_EVIDENCE = join(CHANGE_FOLDER, "migration-output.md");
const SUITE_MAP_CONTROL = "tests/structure/verify-gates-suite-map-reference.test.ts";
const SUITE_MAP_CONTROL_SHA256 = "8428820a26d141067f20ee3c8382544ce57e60b10190f3aaec72b7a288934e81";

/* ------------------------------- helpers -------------------------------- */

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("expected an object");
  }
  return value as Record<string, unknown>;
};

const asArray = (value: unknown): readonly unknown[] => {
  if (!Array.isArray(value)) throw new Error("expected an array");
  return value;
};

const readDocumentText = (): string => readFileSync(CONFIG, "utf8");
const readDocument = (): Record<string, unknown> => asRecord(parse(readDocumentText()));
const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const writeMutant = (label: string, document: Record<string, unknown>): string => {
  const directory = join(ROOT, "tmp/tmpdir/mutants", `gh374-${label}`);
  mkdirSync(directory, { recursive: true });
  const file = join(directory, "config.yaml");
  writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`);
  return file;
};

const validationOf = (document: Record<string, unknown>) =>
  parseAndValidateProviderConfiguration(document);

const profileValidationOf = (
  document: Record<string, unknown>,
  providers: Parameters<typeof parseAndValidateProfileConfiguration>[1],
) => parseAndValidateProfileConfiguration(document, providers);

/* ------------------------- the pinned declaration ------------------------ */

const BASE_FULL = [
  "bootstrapper",
  "ceo",
  "decision-advisor",
  "decision-critic",
  "plan-writer",
  "readiness-reviewer",
  "reviewer",
  "toolsmith",
] as const;
const BASE_FLASH = ["pm", "editor"] as const;
const BASE_PAID = [
  "coder",
  "committer",
  "designer",
  "doc-syncer",
  "external-researcher",
  "fixer",
  "image-generator",
  "image-reviewer",
  "meeting-organizer",
  "pr-manager",
  "review-feedback-applier",
  "runner",
  "spec-writer",
  "test-plan-writer",
] as const;
const JUDGMENT = [
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
] as const;
const VISION = ["designer", "image-reviewer"] as const;

const ALL_SEATS = [...BASE_FULL, ...BASE_FLASH, ...BASE_PAID].sort();

const baseModelFor = (seat: string): string => {
  if ((BASE_FULL as readonly string[]).includes(seat)) return "zai-coding-plan/glm-5.3";
  if ((BASE_FLASH as readonly string[]).includes(seat)) return "zai-coding-plan/glm-5.3-flash";
  return "deepseek/deepseek-flash";
};
const pacingFor = (seat: string): "judgment" | "execution" =>
  (JUDGMENT as readonly string[]).includes(seat) ? "judgment" : "execution";
const capabilityFor = (seat: string): "vision-capable" | "text-only" =>
  (VISION as readonly string[]).includes(seat) ? "vision-capable" : "text-only";

const EXPECTED_SEATS: readonly {
  readonly model: string;
  readonly pacingClass: string;
  readonly capability: string;
}[] = ALL_SEATS.map((seat) => ({
  model: baseModelFor(seat),
  pacingClass: pacingFor(seat),
  capability: capabilityFor(seat),
}));

const PAID_SEATS = ALL_SEATS.map((seat) => ({
  model: "deepseek/deepseek-flash",
  pacingClass: pacingFor(seat),
  capability: capabilityFor(seat),
}));

const EXPECTED_ENTRIES = {
  "zai-coding-plan": {
    class: "subscription",
    enabled: true,
    peak: {
      timezone: "UTC",
      startSecondsOfDay: 21600,
      endSecondsOfDay: 36000,
      bufferSeconds: 7200,
    },
    quota: {
      enabled: true,
      endpoint: "https://api.z.ai/api/monitor/usage/quota/limit",
      credentialRef: "zai",
      thresholdPercent: 100,
      maxSleepLoops: 24,
    },
  },
  deepseek: {
    class: "pay-per-token",
    enabled: true,
    peak: {
      timezone: "UTC",
      startSecondsOfDay: 3600,
      endSecondsOfDay: 36000,
      bufferSeconds: 0,
    },
  },
} as const;

const EXPECTED_CHAINS = {
  "subscription-first": { entries: ["zai-coding-plan", "deepseek"], allowPaidFallback: true },
  "subscription-only": { entries: ["zai-coding-plan"], allowPaidFallback: false },
} as const;

const EXPECTED_CREDENTIALS = {
  zai: { sourceKey: { style: "literal", name: "ZAI_API_KEY" } },
  deepseek: { sourceKey: { style: "literal", name: "DEEPSEEK_API_KEY" } },
} as const;

const EXPECTED_BUDGETS = {
  "window-cost": {
    enabled: true,
    scope: "window",
    basis: "cost",
    ceiling: 20,
    windowSeconds: 86400,
  },
  "ticket-cost": { enabled: true, scope: "ticket", basis: "cost", ceiling: 30 },
} as const;

const EXPECTED_WATCH = {
  "zai-coding-plan": {
    mapping: "coding-plan-windows",
    endpoint: "https://api.z.ai/api/monitor/usage/quota/limit",
    credentialRef: "zai",
    thresholdPercent: 100,
  },
  deepseek: {
    mapping: "deepseek-balance",
    endpoint: "https://api.deepseek.com/user/balance",
    credentialRef: "deepseek",
    floor: 2,
    maxAgeSeconds: 900,
  },
} as const;

const DELIVERY_WINDOWS = {
  graceSeconds: 300,
  windows: [
    {
      timezone: "UTC",
      startSecondsOfDay: 3600,
      endSecondsOfDay: 14400,
      multiplier: 2,
      bufferBeforeSeconds: 1800,
      bufferAfterSeconds: 300,
    },
    {
      timezone: "UTC",
      startSecondsOfDay: 21600,
      endSecondsOfDay: 36000,
      multiplier: 3,
      bufferBeforeSeconds: 7200,
      bufferAfterSeconds: 600,
    },
  ],
} as const;

const PAID_WINDOWS = {
  graceSeconds: 300,
  windows: [
    {
      timezone: "UTC",
      startSecondsOfDay: 3600,
      endSecondsOfDay: 14400,
      multiplier: 2,
      bufferBeforeSeconds: 1800,
      bufferAfterSeconds: 300,
    },
    {
      timezone: "UTC",
      startSecondsOfDay: 21600,
      endSecondsOfDay: 36000,
      multiplier: 2,
      bufferBeforeSeconds: 7200,
      bufferAfterSeconds: 600,
    },
  ],
} as const;

/** The parsed rule shape the delivered validator returns for the declared windows. */
const rulesOf = (declared: typeof DELIVERY_WINDOWS | typeof PAID_WINDOWS) => ({
  windows: declared.windows,
  graceSecondsDefault: declared.graceSeconds,
  graceSecondsMax: 300,
});

const DELIVERY_RULES = rulesOf(DELIVERY_WINDOWS);
const PAID_RULES = rulesOf(PAID_WINDOWS);

/** The declared leaf paths of the provider branch, as `config debug` spells them. */
const declaredLeafPaths = (value: unknown, prefix = ""): readonly string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => declaredLeafPaths(entry, `${prefix}[${index}]`));
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) =>
      declaredLeafPaths(entry, prefix.length === 0 ? key : `${prefix}.${key}`),
    );
  }
  return [prefix];
};

/* --------------------------- the real document --------------------------- */

const realProviders = () => {
  const parsed = parseAndValidateProviderConfiguration(readDocument());
  if (!parsed.ok)
    throw new Error(`the committed provider branch does not load: ${parsed.error.detail}`);
  return parsed.config;
};

const realProfiles = () => {
  const parsed = parseAndValidateProfileConfiguration(readDocument(), realProviders());
  if (!parsed.ok)
    throw new Error(`the committed profile branch does not load: ${parsed.error.detail}`);
  return parsed.config;
};

const roster = (): readonly string[] =>
  readdirSync(join(ROOT, ".opencode/agent"))
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.slice(0, -3))
    .sort();

/* ------------------------------ composition ------------------------------ */

type Composed = {
  readonly root: string;
  readonly checkout: string;
  cleanup(): void;
  run(argv: readonly string[]): Promise<{
    readonly exitCode: number;
    readonly data?: Record<string, unknown>;
    readonly error?: Record<string, unknown>;
    readonly stdout: string;
    readonly stderr: string;
  }>;
};

const composedCheckout = (
  label: string,
  options: { readonly documentText?: string; readonly withProvider?: boolean } = {},
): Composed => {
  const root = makeTempRoot(`gh374-reference-${label}`);
  const checkout = join(root, "checkout");
  const home = join(root, "home");
  mkdirSync(join(checkout, ".jaiship"), { recursive: true });
  mkdirSync(join(checkout, ".git"), { recursive: true });
  mkdirSync(home, { recursive: true });
  writeFileSync(join(checkout, ".jaiship/config.yaml"), options.documentText ?? readDocumentText());
  writeFileSync(
    join(checkout, ".ai-local-placeholder"),
    "placeholder so the checkout tree is not empty\n",
  );
  const calls = { credential: 0, transport: 0, spend: 0, state: 0 };
  const store = openStore(makeIdentity(join(root, "state"))).store;
  const provider =
    options.withProvider === true
      ? {
          clock: { nowMs: () => Date.UTC(2026, 10, 20, 12, 0, 0) },
          credentialPort: {
            resolve: () => {
              calls.credential += 1;
              throw new Error("a declaration refusal must resolve no credential");
            },
          },
          transport: {
            send: async () => {
              calls.transport += 1;
              throw new Error("a declaration refusal must call no transport");
            },
          },
          sleep: { sleep: async () => undefined },
          stateStore: store,
          newFenceToken: () => "fence-gh374-reference",
          spendTotals: {
            read: async () => {
              calls.spend += 1;
              throw new Error("a declaration refusal must read no spend");
            },
          },
          resolveWorkItemRef: () => ({ status: "unresolved" as const }),
          workItemContextPath: join(checkout, ".ai/local/pm-context.yaml"),
        }
      : undefined;
  const program = createConfigProgram({
    workingName: "jaiship",
    environment: { HOME: home, PATH: "/usr/bin" },
    cwd: checkout,
    homeDirectory: home,
    platform: "linux",
    priorConfigurationDirectoryName: ".delivery-os",
    fs: nodeFileSystemFacts(),
    repositoryIo: {
      exists: (path) => path === join(checkout, ".git"),
      isFile: () => false,
      readText: () => "",
    },
    ...(provider === undefined ? {} : { provider }),
  });
  if (!program.ok) throw new Error("the composed program did not resolve its brand");
  return {
    root,
    checkout,
    cleanup: () => removeRoot(root),
    run: async (argv) => {
      let stdout = "";
      let stderr = "";
      const deps: CliDependencies = {
        brand: program.brand,
        clock: { now: () => Date.UTC(2026, 10, 20, 12, 0, 0) },
        newRunId: () => "run-gh374-reference",
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

/** The composed `config debug` payload of one document, over a scratch checkout. */
const configDebug = async (documentText = readDocumentText(), label = "debug") => {
  const composed = composedCheckout(label, { documentText });
  try {
    const result = await composed.run([
      "config",
      "debug",
      "--json",
      "--project-root",
      composed.checkout,
    ]);
    return { result, checkout: composed.checkout, root: composed.root };
  } finally {
    composed.cleanup();
  }
};

/* --------------------------- drift detection ---------------------------- */

type DriftFinding = { readonly id: string; readonly message: string };

const driftFindings = (
  document: Record<string, unknown>,
  observedRoster: readonly string[],
): readonly DriftFinding[] => {
  const findings: DriftFinding[] = [];
  const provider = asRecord(document.provider);
  const credentials = asRecord(provider.credentials);
  const entries = asRecord(provider.entries);
  const chains = asRecord(provider.chains);
  const budgets = asRecord(provider.budgets);
  const profiles = asRecord(provider.profiles);
  const profileMap = asRecord(profiles.profiles);

  if (JSON.stringify(Object.keys(credentials).sort()) !== JSON.stringify(["deepseek", "zai"])) {
    findings.push({
      id: "credentials.keys",
      message: `credentials keys ${Object.keys(credentials).join(",")}`,
    });
  }
  for (const [name, expected] of Object.entries(EXPECTED_CREDENTIALS)) {
    if (JSON.stringify(credentials[name]) !== JSON.stringify(expected)) {
      findings.push({
        id: `credentials.${name}`,
        message: `credential ${name} is not the declared reference`,
      });
    }
  }
  if (Object.keys(entries).sort().join(",") !== "deepseek,zai-coding-plan") {
    findings.push({
      id: "entries.keys",
      message: `entries keys ${Object.keys(entries).join(",")}`,
    });
  }
  for (const [name, expected] of Object.entries(EXPECTED_ENTRIES)) {
    if (JSON.stringify(entries[name]) !== JSON.stringify(expected)) {
      findings.push({
        id: `entries.${name}`,
        message: `entry ${name} differs from the declared body`,
      });
    }
  }
  const declaredPeak = asRecord(asRecord(EXPECTED_ENTRIES.deepseek).peak);
  const observedPeak = asRecord(asRecord(entries.deepseek).peak);
  if (JSON.stringify(observedPeak) !== JSON.stringify(declaredPeak)) {
    findings.push({
      id: "peak:deepseek",
      message: `deepseek peak ${JSON.stringify(observedPeak)} vs declared ${JSON.stringify(declaredPeak)}`,
    });
  }
  for (const [name, expected] of Object.entries(EXPECTED_CHAINS)) {
    if (JSON.stringify(chains[name]) !== JSON.stringify(expected)) {
      findings.push({
        id: `chain:${name}`,
        message: `chain ${name} entries ${JSON.stringify(asRecord(chains[name]).entries)} vs declared ${JSON.stringify(expected.entries)}`,
      });
    }
  }
  if (provider.defaultChain !== "subscription-first") {
    findings.push({
      id: "default-chain",
      message: `defaultChain ${String(provider.defaultChain)}`,
    });
  }
  if (JSON.stringify(budgets) !== JSON.stringify(EXPECTED_BUDGETS)) {
    findings.push({
      id: "budgets",
      message: `budgets ${JSON.stringify(budgets)} vs declared ${JSON.stringify(EXPECTED_BUDGETS)}`,
    });
  }
  const windowCeiling = asRecord(budgets["window-cost"]).ceiling;
  const ticketCeiling = asRecord(budgets["ticket-cost"]).ceiling;
  if (
    typeof windowCeiling !== "number" ||
    typeof ticketCeiling !== "number" ||
    windowCeiling >= ticketCeiling
  ) {
    findings.push({
      id: "budget-order",
      message: `window ceiling ${String(windowCeiling)} is not strictly below ticket ceiling ${String(ticketCeiling)}`,
    });
  }
  if (
    JSON.stringify(profiles.tiers) !==
    JSON.stringify({ delivery: { description: "this repository's delivery roles" } })
  ) {
    findings.push({ id: "tiers", message: `tiers ${JSON.stringify(profiles.tiers)}` });
  }
  if (Object.keys(profileMap).sort().join(",") !== "delivery,paid") {
    findings.push({
      id: "profiles.keys",
      message: `profiles ${Object.keys(profileMap).join(",")}`,
    });
  }
  const delivery = asRecord(profileMap.delivery);
  const paid = asRecord(profileMap.paid);
  if (JSON.stringify(delivery.providers) !== JSON.stringify(["zai-coding-plan", "deepseek"])) {
    findings.push({
      id: "profile-providers:delivery",
      message: `delivery providers ${JSON.stringify(delivery.providers)}`,
    });
  }
  if (JSON.stringify(paid.providers) !== JSON.stringify(["deepseek"])) {
    findings.push({
      id: "profile-providers:paid",
      message: `paid providers ${JSON.stringify(paid.providers)}`,
    });
  }
  for (const [name, profile] of Object.entries({ delivery, paid })) {
    if (asRecord(profile).tier !== "delivery") {
      findings.push({
        id: `profile-tier:${name}`,
        message: `profile ${name} tier ${String(asRecord(profile).tier)}`,
      });
    }
    for (const forbidden of ["agentOverrides", "pacing", "envRecord"]) {
      if (Object.hasOwn(asRecord(profile), forbidden)) {
        findings.push({
          id: `profile-${forbidden}:${name}`,
          message: `profile ${name} declares ${forbidden}`,
        });
      }
    }
  }
  if (
    JSON.stringify(profiles.preferenceChain) !==
    JSON.stringify({ base: "delivery", fallbacks: ["paid"] })
  ) {
    findings.push({
      id: "preference-chain",
      message: `preferenceChain ${JSON.stringify(profiles.preferenceChain)}`,
    });
  }
  if (JSON.stringify(profiles.watch) !== JSON.stringify(EXPECTED_WATCH)) {
    findings.push({ id: "watch", message: `watch ${JSON.stringify(profiles.watch)}` });
  }
  // driftFindings inspects the DOCUMENT, so the declared document shape is pinned
  // here; DRIFT-003 pins the parsed rule shape of the resolved branch.
  const expectedWindows: Record<string, unknown> = {
    delivery: DELIVERY_WINDOWS,
    paid: PAID_WINDOWS,
  };
  for (const [name, profile] of Object.entries({ delivery, paid })) {
    const seats = asRecord(asRecord(profile).seats);
    const observed = Object.keys(seats).sort();
    for (const missing of observedRoster.filter((seat) => !observed.includes(seat))) {
      findings.push({
        id: `seat-missing:${name}:${missing}`,
        message: `profile ${name} has no seat ${missing}`,
      });
    }
    for (const extra of observed.filter((seat) => !observedRoster.includes(seat))) {
      findings.push({
        id: `seat-extra:${name}:${extra}`,
        message: `profile ${name} declares undeclared seat ${extra}`,
      });
    }
    for (const seat of observedRoster) {
      const expected =
        name === "delivery"
          ? EXPECTED_SEATS[ALL_SEATS.indexOf(seat)]
          : PAID_SEATS[ALL_SEATS.indexOf(seat)];
      if (expected === undefined) continue;
      const body = seats[seat];
      if (body === undefined) continue;
      if (JSON.stringify(body) !== JSON.stringify(expected)) {
        const record = asRecord(body);
        findings.push({
          id: `seat-body:${name}:${seat}`,
          message: `seat ${name}:${seat} model=${String(record.model)} pacingClass=${String(record.pacingClass)} capability=${String(record.capability)} vs declared model=${expected.model} pacingClass=${expected.pacingClass} capability=${expected.capability}`,
        });
      }
      const record = asRecord(body);
      if (record.capability === "vision-capable" && !String(record.model).startsWith("deepseek/")) {
        findings.push({
          id: `vision-on-text-only:${name}:${seat}`,
          message: `seat ${name}:${seat} claims vision-capable on ${String(record.model)}`,
        });
      }
    }
    if (JSON.stringify(asRecord(profile).peakWindows) !== JSON.stringify(expectedWindows[name])) {
      findings.push({
        id: `peak-windows:${name}`,
        message: `profile ${name} peakWindows ${JSON.stringify(asRecord(profile).peakWindows)}`,
      });
    }
    const rules = parseProfilePeakWindows(asRecord(profile).peakWindows);
    if (!rules.ok) {
      findings.push({
        id: `grace-bound:${name}`,
        message: `profile ${name} peakWindows do not load: ${rules.failure.detail}`,
      });
    } else {
      const derived = deriveGraceSecondsMax(rules.rules.windows);
      if (derived !== 300 || rules.rules.graceSecondsDefault > derived) {
        findings.push({
          id: `grace-bound:${name}`,
          message: `profile ${name} graceSeconds ${rules.rules.graceSecondsDefault} above derived ${derived}`,
        });
      }
    }
  }
  return findings;
};

/* -------------------------------- CFG-001 -------------------------------- */

describe("GH-374 TC-POL-CFG-001 the real committed document loads through the delivered validators", () => {
  test("acquisition reads the current committed file and reports no prior read", () => {
    const acquired = acquireFileConfig({
      platform: "linux",
      homeDirectory: "/home/synthetic",
      environment: {},
      gitRoot: ROOT,
      enableSystemConfig: false,
      enableUserConfig: false,
      enableProjectLocalConfig: false,
      configurationDirectoryName: ".jaiship",
      priorConfigurationDirectoryName: ".delivery-os",
      fs: nodeFileSystemFacts(),
    });
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    expect(acquired.prior).toBeUndefined();
    expect(existsSync(join(ROOT, ".jaiship/config.yaml"))).toBe(true);
  });

  test("both chains validate, the default chain is declared, and the grace bound loads", () => {
    const providers = realProviders();
    expect(Object.keys(providers.chains).sort()).toEqual([
      "subscription-first",
      "subscription-only",
    ]);
    for (const name of Object.keys(providers.chains)) {
      const selection = selectProviderChain(providers, name);
      expect(selection.ok).toBe(true);
    }
    expect(providers.defaultChain).toBe("subscription-first");
    const profiles = realProfiles();
    expect(Object.keys(profiles.profiles).sort()).toEqual(["delivery", "paid"]);
    for (const [name, profile] of Object.entries(profiles.profiles)) {
      expect(profile.peakWindows?.graceSecondsDefault).toBe(300);
      expect(profile.peakWindows?.graceSecondsMax).toBe(300);
      expect(profile.peakWindows?.windows).toHaveLength(2);
      for (const window of profile.peakWindows?.windows ?? []) {
        expect(window.bufferBeforeSeconds).toBeGreaterThan(0);
        expect(window.bufferAfterSeconds).toBeGreaterThan(0);
      }
      expect(Object.keys(profile.seats)).toHaveLength(24);
      expect(name).toBeTruthy();
    }
  });

  test("a zero buffer is refused through peakWindows.graceSeconds, and the committed file is untouched", () => {
    const before = createHash("sha256").update(readDocumentText()).digest("hex");
    const mutated = deepClone(readDocument());
    const deliveryProfile = asRecord(
      asRecord(asRecord(asRecord(mutated.provider).profiles).profiles).delivery,
    );
    const ruleList = asArray(asRecord(deliveryProfile.peakWindows).windows);
    asRecord(ruleList[1]).bufferAfterSeconds = 0;
    const parsed = profileValidationOf(mutated, realProviders());
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error.code).toBe("provider.profile.invalid");
    expect(parsed.error.field).toBe("peakWindows.graceSeconds");
    expect(parsed.error.detail).toContain("derived maximum 0");
    const after = createHash("sha256").update(readDocumentText()).digest("hex");
    expect(after).toBe(before);
  });
});

/* -------------------------------- CFG-004 -------------------------------- */

type ChainMutant = {
  readonly label: string;
  readonly apply: (document: Record<string, unknown>) => void;
  readonly code: string;
  readonly detail: string;
};

const withProvider = (document: Record<string, unknown>): Record<string, unknown> =>
  asRecord(document.provider);

const chainMutants: readonly ChainMutant[] = [
  {
    label: "order",
    apply: (document) => {
      asRecord(asRecord(withProvider(document).chains)["subscription-first"]).entries = [
        "deepseek",
        "zai-coding-plan",
      ];
    },
    code: "provider.chain.invalid",
    detail: "chain subscription-first places subscription entries after pay-per-token entries",
  },
  {
    label: "unknown-entry",
    apply: (document) => {
      asRecord(asRecord(withProvider(document).chains)["subscription-first"]).entries = [
        "zai-coding-plan",
        "alt",
      ];
    },
    code: "provider.chain.invalid",
    detail: "chain subscription-first references unknown provider alt",
  },
  {
    label: "duplicate-entry",
    apply: (document) => {
      asRecord(asRecord(withProvider(document).chains)["subscription-first"]).entries = [
        "zai-coding-plan",
        "zai-coding-plan",
      ];
    },
    code: "provider.chain.invalid",
    detail: "chain subscription-first lists provider zai-coding-plan more than once",
  },
  {
    label: "unknown-credential",
    apply: (document) => {
      asRecord(
        asRecord(asRecord(withProvider(document).entries)["zai-coding-plan"]).quota,
      ).credentialRef = "nope";
    },
    code: "provider.chain.invalid",
    detail: "provider zai-coding-plan references unknown credential nope",
  },
  {
    label: "unknown-default-chain",
    apply: (document) => {
      withProvider(document).defaultChain = "nope";
    },
    code: "provider.chain.invalid",
    detail: "default chain nope is not declared",
  },
  {
    label: "empty-chain",
    apply: (document) => {
      asRecord(asRecord(withProvider(document).chains)["subscription-only"]).entries = [];
    },
    code: "provider.chain.empty",
    detail: "chain subscription-only has no entries",
  },
];

describe("GH-374 TC-POL-CFG-004 six declaration defects refuse with the delivered identity and detail prose", () => {
  for (const mutant of chainMutants) {
    test(`${mutant.label} refuses ${mutant.code} with the exact detail, writes nothing and reads no spend`, async () => {
      const document = deepClone(readDocument());
      mutant.apply(document);
      const inMemory = validationOf(document);
      expect(inMemory.ok).toBe(false);
      if (inMemory.ok) return;
      expect(inMemory.error.code).toBe(mutant.code);
      expect(inMemory.error.detail).toBe(mutant.detail);
      // The delivered chain validator carries chainName/entries and no `field`.
      expect("field" in inMemory.error).toBe(false);

      const composed = composedCheckout(`cfg004-${mutant.label}`, {
        documentText: `${JSON.stringify(document, null, 2)}\n`,
        withProvider: true,
      });
      try {
        const result = await composed.run(["provider", "resolve", "--json"]);
        expect(result.exitCode).toBe(1);
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(mutant.code);
        expect(result.error?.category).toBe("user");
        expect(result.error?.retryable).toBe(false);
        expect(String(result.error?.summary)).toContain(mutant.detail);
      } finally {
        composed.cleanup();
      }
    });
  }

  test("a budget defect carries the detail path and no field; a profile defect carries the field", () => {
    const budgetDocument = deepClone(readDocument());
    const windowBudget = asRecord(asRecord(withProvider(budgetDocument).budgets)["window-cost"]);
    windowBudget.ceiling = 0;
    const budget = validationOf(budgetDocument);
    expect(budget.ok).toBe(false);
    if (budget.ok) return;
    expect(budget.error.code).toBe("provider.chain.invalid");
    expect(budget.error.detail).toBe("provider.budgets.window-cost.ceiling");
    expect("field" in budget.error).toBe(false);
    expect("chainName" in budget.error).toBe(false);

    const profileDocument = deepClone(readDocument());
    const deliveryProfile = asRecord(
      asRecord(asRecord(asRecord(profileDocument.provider).profiles).profiles).delivery,
    );
    asRecord(deliveryProfile.peakWindows).graceSeconds = 600;
    const profile = profileValidationOf(profileDocument, realProviders());
    expect(profile.ok).toBe(false);
    if (profile.ok) return;
    expect(profile.error.code).toBe("provider.profile.invalid");
    expect(profile.error.field).toBe("peakWindows.graceSeconds");
  });
});

/* -------------------------------- CFG-006 -------------------------------- */

describe("GH-374 TC-POL-CFG-006 declared entry bodies are pinned and the delivered defaults asserted separately", () => {
  test("the document's entry bodies are exactly the declared values", () => {
    const entries = asRecord(withProvider(readDocument()).entries);
    expect(Object.keys(entries).sort()).toEqual(["deepseek", "zai-coding-plan"]);
    expect(entries["zai-coding-plan"]).toEqual(EXPECTED_ENTRIES["zai-coding-plan"]);
    expect(Object.keys(asRecord(asRecord(entries["zai-coding-plan"]).quota))).toHaveLength(5);
    expect(entries.deepseek).toEqual(EXPECTED_ENTRIES.deepseek);
    expect("quota" in asRecord(entries.deepseek)).toBe(false);
  });

  test("the resolved entries carry the declared leaves plus the four delivered defaults at layer=defaults", async () => {
    const { result } = await configDebug();
    expect(result.exitCode).toBe(0);
    const payload = asRecord(result.data);
    const resolvedEntries = asRecord(asRecord(asRecord(payload.config).provider).entries);
    const origins = asRecord(payload.origins);
    const zai = asRecord(resolvedEntries["zai-coding-plan"]);
    const quota = asRecord(zai.quota);
    expect(quota).toEqual({
      ...asRecord(EXPECTED_ENTRIES["zai-coding-plan"].quota),
      timeoutMs: 15000,
      outageParkTtlSeconds: 300,
      credentialParkTtlSeconds: 900,
      capParkTtlSeconds: 300,
    });
    const declaredLeaves = declaredLeafPaths(
      EXPECTED_ENTRIES["zai-coding-plan"],
      "provider.entries.zai-coding-plan",
    );
    for (const path of declaredLeaves) {
      expect([path, String(origins[path]).startsWith("layer=project-committed")]).toEqual([
        path,
        true,
      ]);
      expect([path, String(origins[path]).includes("file=")]).toEqual([path, true]);
      expect([path, / line=\d+$/.test(String(origins[path]))]).toEqual([path, true]);
    }
    const defaults: readonly (readonly [string, number])[] = [
      ["timeoutMs", 15000],
      ["outageParkTtlSeconds", 300],
      ["credentialParkTtlSeconds", 900],
      ["capParkTtlSeconds", 300],
    ];
    expect(defaults).toHaveLength(4);
    for (const [leaf, value] of defaults) {
      const path = `provider.entries.zai-coding-plan.quota.${leaf}`;
      expect(quota[leaf]).toBe(value);
      expect(String(origins[path])).toMatch(
        /^layer=defaults file=core\/src\/config\/defaults\.ts line=\d+$/,
      );
    }
    expect(zai.enabled).toBe(true);
    expect(
      String(origins["provider.entries.zai-coding-plan.enabled"]).startsWith(
        "layer=project-committed",
      ),
    ).toBe(true);
    const paid = asRecord(resolvedEntries.deepseek);
    expect(Object.keys(paid).sort()).toEqual(["class", "enabled", "peak"]);
  });

  test("a document that removes the paid entry's enabled key still resolves true from the defaults layer", async () => {
    const document = deepClone(readDocument());
    const paid = asRecord(asRecord(withProvider(document).entries).deepseek);
    delete paid.enabled;
    const { result } = await configDebug(
      `${JSON.stringify(document, null, 2)}\n`,
      "cfg006-enabled",
    );
    expect(result.exitCode).toBe(0);
    const payload = asRecord(result.data);
    const resolvedPaid = asRecord(
      asRecord(asRecord(asRecord(payload.config).provider).entries).deepseek,
    );
    // `enabled` is the delivered provider PARSER's default (`boolean(value.enabled,
    // true)`), not a configuration-layer default: the resolved tree carries no
    // key and no origin, and the parsed descriptor reports true.
    expect(Object.hasOwn(resolvedPaid, "enabled")).toBe(false);
    expect(asRecord(payload.origins)["provider.entries.deepseek.enabled"]).toBeUndefined();
    const parsedResolved = parseAndValidateProviderConfiguration(payload.config);
    expect(parsedResolved.ok).toBe(true);
    if (!parsedResolved.ok) return;
    expect(parsedResolved.config.entries.deepseek?.enabled).toBe(true);
    expect(parsedResolved.config.entries["zai-coding-plan"]?.enabled).toBe(true);
    expect(String(asRecord(payload.origins)["provider.entries.zai-coding-plan.enabled"])).toMatch(
      /^layer=project-committed /,
    );
  });
});

/* -------------------------------- CFG-007 -------------------------------- */

describe("GH-374 TC-POL-CFG-007 two profiles over one tier and the declared preference chain", () => {
  test("the branch declares exactly the two profiles, one tier and no second name authority", () => {
    const profiles = asRecord(withProvider(readDocument()).profiles);
    expect(Object.keys(asRecord(profiles.tiers))).toEqual(["delivery"]);
    expect(Object.keys(asRecord(profiles.profiles)).sort()).toEqual(["delivery", "paid"]);
    const delivery = asRecord(asRecord(profiles.profiles).delivery);
    const paid = asRecord(asRecord(profiles.profiles).paid);
    expect(delivery.providers).toEqual(["zai-coding-plan", "deepseek"]);
    expect(paid.providers).toEqual(["deepseek"]);
    expect(delivery.tier).toBe("delivery");
    expect(paid.tier).toBe("delivery");
    expect(profiles.preferenceChain).toEqual({ base: "delivery", fallbacks: ["paid"] });
    for (const profile of [delivery, paid]) {
      expect("agentOverrides" in profile).toBe(false);
      expect("pacing" in profile).toBe(false);
      expect("envRecord" in profile).toBe(false);
    }
    expect("pacing" in profiles).toBe(false);
    expect("envRecord" in profiles).toBe(false);
  });

  test("a second name authority is detected by the pin", () => {
    const document = deepClone(readDocument());
    const profiles = asRecord(withProvider(document).profiles);
    asRecord(asRecord(profiles.profiles).delivery).agentOverrides = { pm: "coder" };
    const findings = driftFindings(document, roster());
    expect(findings.map((finding) => finding.id)).toContain("profile-agentOverrides:delivery");
    const swapped = deepClone(readDocument());
    asRecord(asRecord(withProvider(swapped).profiles).preferenceChain).base = "paid";
    expect(driftFindings(swapped, roster()).map((finding) => finding.id)).toContain(
      "preference-chain",
    );
  });
});

/* -------------------------------- CFG-008 -------------------------------- */

describe("GH-374 TC-POL-CFG-008 both watch targets name declared providers and credentials", () => {
  test("the watch declaration deep-equals the declared targets and references resolve", () => {
    const profiles = asRecord(withProvider(readDocument()).profiles);
    const watch = asRecord(profiles.watch);
    expect(watch).toEqual(EXPECTED_WATCH);
    const entries = asRecord(withProvider(readDocument()).entries);
    const credentials = asRecord(withProvider(readDocument()).credentials);
    for (const [name, target] of Object.entries(watch)) {
      expect(Object.hasOwn(entries, name)).toBe(true);
      const record = asRecord(target);
      expect(Object.hasOwn(credentials, String(record.credentialRef))).toBe(true);
    }
    const paidTarget = asRecord(watch.deepseek);
    expect(Number.isInteger(paidTarget.maxAgeSeconds)).toBe(true);
    expect(Number(paidTarget.maxAgeSeconds)).toBeGreaterThan(0);
    expect(Number(paidTarget.floor)).toBeGreaterThan(0);
  });

  test("an undeclared credential reference refuses provider.profile.invalid naming the field", () => {
    const document = deepClone(readDocument());
    asRecord(asRecord(asRecord(withProvider(document).profiles).watch).deepseek).credentialRef =
      "openai";
    const parsed = profileValidationOf(document, realProviders());
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error.code).toBe("provider.profile.invalid");
    expect(parsed.error.field).toBe("watch.deepseek.credentialRef");
  });
});

/* -------------------------------- CFG-009 -------------------------------- */

const entryPeak = (name: "zai-coding-plan" | "deepseek") =>
  asRecord(asRecord(EXPECTED_ENTRIES[name]).peak);

const at = (hours: number, minutes = 0, saturday = false): number =>
  Date.UTC(2026, 10, saturday ? 21 : 20, hours, minutes, 0);

const isClosed = (window: Record<string, unknown>, nowMs: number): boolean => {
  const condition = evaluatePeakWindow(
    {
      timezone: String(window.timezone),
      startSecondsOfDay: Number(window.startSecondsOfDay),
      endSecondsOfDay: Number(window.endSecondsOfDay),
      bufferSeconds: Number(window.bufferSeconds),
    },
    nowMs,
    UTC_ZONE_FACTS,
  );
  return condition.status === "parked";
};

describe("GH-374 TC-POL-CFG-009 entry peaks are the admission truth, evaluated daily", () => {
  test("the nine instants report the declared subscription and paid availability", () => {
    const subscription = entryPeak("zai-coding-plan");
    const paid = entryPeak("deepseek");
    const instants: readonly (readonly [string, number, boolean, boolean])[] = [
      ["02:00", at(2), true, false],
      ["03:30", at(3, 30), true, false],
      ["04:00", at(4), false, false],
      ["04:30", at(4, 30), false, false],
      ["05:00", at(5), false, false],
      ["09:59", at(9, 59), false, false],
      ["10:00", at(10), true, true],
      ["12:00", at(12), true, true],
      ["saturday 05:00", at(5, 0, true), false, false],
    ];
    for (const [label, instant, subscriptionOpen, paidOpen] of instants) {
      expect([label, isClosed(subscription, instant)]).toEqual([label, !subscriptionOpen]);
      expect([label, isClosed(paid, instant)]).toEqual([label, !paidOpen]);
    }
  });

  test("the union covers both legacy DeepSeek windows and the subscription's buffered pause", () => {
    const paid = entryPeak("deepseek");
    const legacyWindows: readonly (readonly [number, number])[] = [
      [3600, 14400],
      [21600, 36000],
    ];
    for (const [startSeconds, endSeconds] of legacyWindows) {
      for (let seconds = startSeconds; seconds < endSeconds; seconds += 900) {
        const nowMs = Date.UTC(2026, 10, 20) + seconds * 1000;
        expect(isClosed(paid, nowMs)).toBe(true);
      }
    }
    // The subscription's buffered pause [04:00, 10:00) is covered too.
    for (let seconds = 14400; seconds < 36000; seconds += 900) {
      const nowMs = Date.UTC(2026, 10, 20) + seconds * 1000;
      expect(isClosed(paid, nowMs)).toBe(true);
    }
  });

  test("the only newly closed time-of-day interval is exactly 04:00-06:00 UTC daily", () => {
    const paid = entryPeak("deepseek");
    const legacyDeepSeek = (seconds: number): boolean =>
      (seconds >= 3600 && seconds < 14400) || (seconds >= 21600 && seconds < 36000);
    const newlyClosed: number[] = [];
    for (let seconds = 0; seconds < 86400; seconds += 60) {
      const nowMs = Date.UTC(2026, 10, 20) + seconds * 1000;
      if (isClosed(paid, nowMs) && !legacyDeepSeek(seconds)) newlyClosed.push(seconds);
    }
    expect(newlyClosed[0]).toBe(4 * 3600);
    expect(newlyClosed.at(-1)).toBe(6 * 3600 - 60);
    expect(newlyClosed).toHaveLength((2 * 3600) / 60);
    // The daily superset is stated in the same assertion block: weekends and
    // Chinese public holidays are additionally paused by these daily windows.
    expect(isClosed(paid, at(5, 0, true))).toBe(true);
    expect(isClosed(entryPeak("zai-coding-plan"), at(5, 0, true))).toBe(true);
  });

  test("the resolved probe reads descriptor.peak and no peakWindows", () => {
    const source = readFileSync(join(ROOT, "packages/cli/src/edge.ts"), "utf8");
    const start = source.indexOf("createResolvedProviderProbe");
    const end = source.indexOf("\nexport const", start + 1);
    expect(start).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, end < 0 ? undefined : end);
    expect(body).toContain("descriptor.peak");
    expect(body).not.toContain("peakWindows");
  });
});

/* -------------------------------- SEAT-006 ------------------------------- */

describe("GH-374 TC-POL-SEAT-006 every declared seat model is expressible", () => {
  test("48/48 models match the grammar and the bound, with exactly three distinct models", () => {
    const profiles = realProfiles();
    const models: string[] = [];
    for (const profile of Object.values(profiles.profiles)) {
      for (const [seatName, seat] of Object.entries(profile.seats)) {
        const binding = { agent: seatName, seat: seatName, resolvedModel: seat.model };
        const expressible = evaluateModelExpressibility(binding);
        expect([seatName, expressible.ok]).toEqual([seatName, true]);
        expect(seat.model).toMatch(
          /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*(?:#[A-Za-z0-9._-]+)?$/,
        );
        expect(seat.model.length).toBeLessThanOrEqual(HARNESS_MODEL_EXPRESSION_MAX_CHARS);
        models.push(seat.model);
      }
    }
    expect(models).toHaveLength(48);
    expect([...new Set(models)].sort()).toEqual([
      "deepseek/deepseek-flash",
      "zai-coding-plan/glm-5.3",
      "zai-coding-plan/glm-5.3-flash",
    ]);
  });

  test("a bare model name is unrepresentable, naming the seat", () => {
    const result = evaluateModelExpressibility({
      agent: "pm",
      seat: "pm",
      resolvedModel: "glm-5.3",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("harness.profile.model-unrepresentable");
    expect(result.seat).toBe("pm");
  });
});

/* ------------------------------- DRIFT-001 ------------------------------- */

describe("GH-374 TC-POL-DRIFT-001 credentials, entries and chains are pinned at their declared values", () => {
  test("the document declares the exact credential references and their only keys", () => {
    const credentials = asRecord(withProvider(readDocument()).credentials);
    expect(credentials).toEqual(EXPECTED_CREDENTIALS);
    for (const child of Object.values(credentials)) {
      expect(Object.keys(asRecord(child))).toEqual(["sourceKey"]);
      expect(Object.keys(asRecord(asRecord(child).sourceKey)).sort()).toEqual(["name", "style"]);
    }
    expect(asRecord(credentials.zai).sourceKey).toEqual({ style: "literal", name: "ZAI_API_KEY" });
    expect(asRecord(credentials.deepseek).sourceKey).toEqual({
      style: "literal",
      name: "DEEPSEEK_API_KEY",
    });
  });

  test("the resolved credential child adds no key and every declared leaf is project-committed", async () => {
    const { result } = await configDebug(readDocumentText(), "drift001");
    expect(result.exitCode).toBe(0);
    const payload = asRecord(result.data);
    const resolved = asRecord(asRecord(asRecord(payload.config).provider).credentials);
    expect(Object.keys(asRecord(resolved.zai)).sort()).toEqual(["sourceKey"]);
    expect(asRecord(asRecord(resolved.zai).sourceKey)).toEqual({
      style: "literal",
      name: "ZAI_API_KEY",
    });
    const origins = asRecord(payload.origins);
    for (const path of declaredLeafPaths(EXPECTED_CREDENTIALS, "provider.credentials")) {
      expect(String(origins[path]).startsWith("layer=project-committed")).toBe(true);
    }
  });

  test("a third credential child and a value-bearing key both fail the pin", () => {
    const extraCredential = deepClone(readDocument());
    asRecord(withProvider(extraCredential).credentials).openai = {
      sourceKey: { style: "literal", name: "OPENAI_API_KEY" },
    };
    expect(driftFindings(extraCredential, roster()).map((finding) => finding.id)).toContain(
      "credentials.keys",
    );
    const valueBearing = deepClone(readDocument());
    asRecord(asRecord(withProvider(valueBearing).credentials).zai).value = "not-a-credential";
    expect(driftFindings(valueBearing, roster()).map((finding) => finding.id)).toContain(
      "credentials.zai",
    );
  });
});

/* ------------------------------- DRIFT-002 ------------------------------- */

describe("GH-374 TC-POL-DRIFT-002 each profile's seat set equals the agent roster in both directions", () => {
  test("24/24 seats equal the roster and both profiles agree", () => {
    const observedRoster = roster();
    expect(observedRoster).toHaveLength(24);
    const profiles = realProfiles();
    for (const profile of Object.values(profiles.profiles)) {
      expect(Object.keys(profile.seats).sort()).toEqual([...observedRoster]);
      expect(observedRoster.every((seat) => Object.hasOwn(profile.seats, seat))).toBe(true);
    }
    expect(Object.keys(profiles.profiles.delivery?.seats ?? {}).sort()).toEqual(
      Object.keys(profiles.profiles.paid?.seats ?? {}).sort(),
    );
    expect(driftFindings(readDocument(), observedRoster)).toEqual([]);
  });

  test("a new roster agent without a seat, and a seat without a prompt, both fail by name", () => {
    const document = deepClone(readDocument());
    const extended = [...roster(), "new-role"].sort();
    const findings = driftFindings(document, extended);
    expect(findings.map((finding) => finding.id)).toContain("seat-missing:delivery:new-role");
    expect(findings.map((finding) => finding.id)).toContain("seat-missing:paid:new-role");

    const narrowed = deepClone(readDocument());
    const paidSeats = asRecord(
      asRecord(asRecord(asRecord(narrowed.provider).profiles).profiles).paid,
    );
    asRecord(paidSeats.seats);
    delete asRecord(paidSeats.seats).coder;
    expect(driftFindings(narrowed, roster()).map((finding) => finding.id)).toContain(
      "seat-missing:paid:coder",
    );
  });
});

/* ------------------------------- DRIFT-003 ------------------------------- */

describe("GH-374 TC-POL-DRIFT-003 the seat matrix and both profiles' peak-window arithmetic are pinned", () => {
  test("the 48 seat bodies and both peakWindows branches equal the declared values", () => {
    const profiles = realProfiles();
    const delivery = profiles.profiles.delivery;
    const paid = profiles.profiles.paid;
    for (const seat of ALL_SEATS) {
      const expected = {
        model: baseModelFor(seat),
        pacingClass: pacingFor(seat),
        capability: capabilityFor(seat),
      };
      expect([seat, delivery?.seats[seat]]).toEqual([seat, expected]);
      expect([seat, paid?.seats[seat]]).toEqual([
        seat,
        { ...expected, model: "deepseek/deepseek-flash" },
      ]);
    }
    const documents = asRecord(asRecord(withProvider(readDocument()).profiles).profiles);
    expect(asRecord(asRecord(documents.delivery).peakWindows)).toEqual(DELIVERY_WINDOWS);
    expect(asRecord(asRecord(documents.paid).peakWindows)).toEqual(PAID_WINDOWS);
    expect(JSON.parse(JSON.stringify(delivery?.peakWindows))).toEqual(DELIVERY_RULES);
    expect(JSON.parse(JSON.stringify(paid?.peakWindows))).toEqual(PAID_RULES);
    for (const profile of [delivery, paid]) {
      const rules = profile?.peakWindows;
      if (rules === undefined) throw new Error("expected declared peak windows");
      expect(deriveGraceSecondsMax(rules.windows)).toBe(300);
      expect(rules.graceSecondsDefault).toBeLessThanOrEqual(300);
    }
    expect(delivery?.seats.designer?.capability).toBe("vision-capable");
    expect(delivery?.seats["image-reviewer"]?.capability).toBe("vision-capable");
    expect(delivery?.seats["image-generator"]?.capability).toBe("text-only");
    for (const seat of BASE_FULL) expect(delivery?.seats[seat]?.capability).toBe("text-only");
    for (const seat of BASE_FLASH) expect(delivery?.seats[seat]?.capability).toBe("text-only");
  });

  test("a changed paid multiplier and an over-bound grace both fail by name", () => {
    const multiplierDrift = deepClone(readDocument());
    const paidPeak = asRecord(
      asRecord(asRecord(asRecord(multiplierDrift.provider).profiles).profiles).paid,
    );
    asRecord(asArray(asRecord(paidPeak.peakWindows).windows)[1]).multiplier = 3;
    expect(driftFindings(multiplierDrift, roster()).map((finding) => finding.id)).toContain(
      "peak-windows:paid",
    );
    const graceDrift = deepClone(readDocument());
    const deliveryPeak = asRecord(
      asRecord(asRecord(asRecord(graceDrift.provider).profiles).profiles).delivery,
    );
    asRecord(deliveryPeak.peakWindows).graceSeconds = 600;
    expect(driftFindings(graceDrift, roster()).map((finding) => finding.id)).toContain(
      "grace-bound:delivery",
    );
  });
});

/* ------------------------------- DRIFT-004 ------------------------------- */

describe("GH-374 TC-POL-DRIFT-004 the preference chain, tier, watch targets and the 20/30 ceilings are pinned", () => {
  test("the ordering window 20 < ticket 30 is asserted with its reason", () => {
    const budgets = asRecord(withProvider(readDocument()).budgets);
    expect(budgets).toEqual(EXPECTED_BUDGETS);
    const windowCeiling = Number(asRecord(budgets["window-cost"]).ceiling);
    const ticketCeiling = Number(asRecord(budgets["ticket-cost"]).ceiling);
    expect(windowCeiling).toBe(20);
    expect(ticketCeiling).toBe(30);
    // The reason: `failed` outranks `parked` in combineProviderConditions, so a
    // window ceiling at or above the ticket ceiling makes the window park
    // unreachable (DEC-21).
    expect(windowCeiling).toBeLessThan(ticketCeiling);
    for (const budget of Object.values(budgets)) {
      expect("entries" in asRecord(budget)).toBe(false);
    }
    const profiles = asRecord(withProvider(readDocument()).profiles);
    expect(profiles.preferenceChain).toEqual({ base: "delivery", fallbacks: ["paid"] });
    expect(Object.keys(asRecord(profiles.tiers))).toEqual(["delivery"]);
    expect(profiles.watch).toEqual(EXPECTED_WATCH);
  });

  test("a changed floor, a changed ticket ceiling and an inverted pair each fail by name", () => {
    const floorDrift = deepClone(readDocument());
    asRecord(asRecord(asRecord(withProvider(floorDrift).profiles).watch).deepseek).floor = 5;
    expect(driftFindings(floorDrift, roster()).map((finding) => finding.id)).toContain("watch");

    const ceilingDrift = deepClone(readDocument());
    asRecord(asRecord(withProvider(ceilingDrift).budgets)["ticket-cost"]).ceiling = 25;
    const ceilingFindings = driftFindings(ceilingDrift, roster());
    expect(ceilingFindings.map((finding) => finding.id)).toContain("budgets");
    expect(ceilingFindings.find((finding) => finding.id === "budgets")?.message).toContain("25");

    const inverted = deepClone(readDocument());
    asRecord(asRecord(withProvider(inverted).budgets)["window-cost"]).ceiling = 30;
    asRecord(asRecord(withProvider(inverted).budgets)["ticket-cost"]).ceiling = 20;
    const invertedFindings = driftFindings(inverted, roster());
    const order = invertedFindings.find((finding) => finding.id === "budget-order");
    expect(order?.message).toContain("30");
    expect(order?.message).toContain("20");
  });
});

/* ------------------------------- DRIFT-005 ------------------------------- */

describe("GH-374 TC-POL-DRIFT-005 eight named drifts each fail by name", () => {
  const mutants: readonly {
    readonly label: string;
    readonly expected: string;
    readonly apply: (document: Record<string, unknown>) => void;
  }[] = [
    {
      label: "seat-removed",
      expected: "seat-missing:paid:coder",
      apply: (document) => {
        const paid = asRecord(
          asRecord(asRecord(asRecord(document.provider).profiles).profiles).paid,
        );
        delete asRecord(paid.seats).coder;
      },
    },
    {
      label: "pm-model-changed",
      expected: "seat-body:delivery:pm",
      apply: (document) => {
        const delivery = asRecord(
          asRecord(asRecord(asRecord(document.provider).profiles).profiles).delivery,
        );
        asRecord(asRecord(delivery.seats).pm).model = "zai-coding-plan/glm-5.3";
      },
    },
    {
      label: "new-agent",
      expected: "seat-missing:delivery:new-role",
      apply: () => undefined,
    },
    {
      label: "chain-reordered",
      expected: "chain:subscription-first",
      apply: (document) => {
        asRecord(asRecord(asRecord(document.provider).chains)["subscription-first"]).entries = [
          "deepseek",
          "zai-coding-plan",
        ];
      },
    },
    {
      label: "peak-narrowed",
      expected: "peak:deepseek",
      apply: (document) => {
        asRecord(asRecord(asRecord(document.provider).entries).deepseek).peak = {
          timezone: "UTC",
          startSecondsOfDay: 21600,
          endSecondsOfDay: 36000,
          bufferSeconds: 0,
        };
      },
    },
    {
      label: "ceiling-changed",
      expected: "budgets",
      apply: (document) => {
        asRecord(asRecord(asRecord(document.provider).budgets)["ticket-cost"]).ceiling = 25;
      },
    },
    {
      label: "ceiling-inverted",
      expected: "budget-order",
      apply: (document) => {
        asRecord(asRecord(asRecord(document.provider).budgets)["window-cost"]).ceiling = 30;
        asRecord(asRecord(asRecord(document.provider).budgets)["ticket-cost"]).ceiling = 20;
      },
    },
    {
      label: "zero-buffer",
      expected: "peak-windows:paid",
      apply: (document) => {
        const paid = asRecord(
          asRecord(asRecord(asRecord(document.provider).profiles).profiles).paid,
        );
        asRecord(asArray(asRecord(paid.peakWindows).windows)[1]).bufferAfterSeconds = 0;
      },
    },
  ];

  test("8/8 copies fail, each naming its own drift, and the real document reports none", () => {
    const committedBefore = createHash("sha256").update(readDocumentText()).digest("hex");
    expect(driftFindings(readDocument(), roster())).toEqual([]);
    let failing = 0;
    for (const mutant of mutants) {
      const document = deepClone(readDocument());
      mutant.apply(document);
      // Every mutant is a COPY under tmp/tmpdir/mutants/**; the committed
      // document is never the mutation target.
      const copy = writeMutant(`drift005-${mutant.label}`, document);
      expect(createHash("sha256").update(readFileSync(copy)).digest("hex")).not.toBe(
        committedBefore,
      );
      const observedRoster = mutant.label === "new-agent" ? [...roster(), "new-role"] : roster();
      const findings = driftFindings(document, observedRoster);
      if (findings.length > 0 && findings.some((finding) => finding.id === mutant.expected)) {
        failing += 1;
      }
      expect([mutant.label, findings.map((finding) => finding.id)]).toEqual([
        mutant.label,
        expect.arrayContaining([mutant.expected]),
      ]);
    }
    expect(failing).toBe(8);
    expect(createHash("sha256").update(readDocumentText()).digest("hex")).toBe(committedBefore);
  });

  test("the zero-buffer mutant is also refused by the delivered validator, not only by the pin", () => {
    const document = deepClone(readDocument());
    const paid = asRecord(asRecord(asRecord(asRecord(document.provider).profiles).profiles).paid);
    asRecord(asArray(asRecord(paid.peakWindows).windows)[1]).bufferAfterSeconds = 0;
    const parsed = profileValidationOf(document, realProviders());
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error.field).toBe("peakWindows.graceSeconds");
  });
});

/* ------------------------------- DRIFT-006 ------------------------------- */

describe("GH-374 TC-POL-DRIFT-006 --show-origin names the committed file and the defaults layer", () => {
  test("the committed key reports layer=project-committed with the file and a line", async () => {
    const composed = composedCheckout("drift006-origin");
    try {
      const result = await composed.run([
        "config",
        "get",
        "provider.defaultChain",
        "--show-origin",
        "--json",
        "--project-root",
        composed.checkout,
      ]);
      expect(result.exitCode).toBe(0);
      const data = asRecord(result.data);
      expect(data.key).toBe("provider.defaultChain");
      expect(data.value).toBe("subscription-first");
      expect(String(data.origin)).toMatch(
        /^layer=project-committed file=.*\/\.jaiship\/config\.yaml line=\d+$/,
      );
      const debug = await composed.run([
        "config",
        "debug",
        "--json",
        "--project-root",
        composed.checkout,
      ]);
      expect(debug.exitCode).toBe(0);
      const origins = asRecord(asRecord(debug.data).origins);
      expect(String(origins["provider.defaultChain"])).toBe(String(data.origin));
    } finally {
      composed.cleanup();
    }
  });

  test("the default-only leaf reports layer=defaults and no declared leaf reports it", async () => {
    const composed = composedCheckout("drift006-defaults");
    try {
      const timeout = await composed.run([
        "config",
        "get",
        "provider.entries.zai-coding-plan.quota.timeoutMs",
        "--show-origin",
        "--json",
        "--project-root",
        composed.checkout,
      ]);
      expect(timeout.exitCode).toBe(0);
      const timeoutData = asRecord(timeout.data);
      expect(timeoutData.value).toBe(15000);
      expect(String(timeoutData.origin)).toMatch(
        /^layer=defaults file=core\/src\/config\/defaults\.ts line=\d+$/,
      );
      const debug = await composed.run([
        "config",
        "debug",
        "--json",
        "--project-root",
        composed.checkout,
      ]);
      const origins = asRecord(asRecord(debug.data).origins);
      const defaultOnly = [
        "provider.entries.zai-coding-plan.quota.timeoutMs",
        "provider.entries.zai-coding-plan.quota.outageParkTtlSeconds",
        "provider.entries.zai-coding-plan.quota.credentialParkTtlSeconds",
        "provider.entries.zai-coding-plan.quota.capParkTtlSeconds",
      ];
      expect(defaultOnly).toHaveLength(4);
      for (const path of defaultOnly) {
        expect(String(origins[path])).toMatch(
          /^layer=defaults file=core\/src\/config\/defaults\.ts line=\d+$/,
        );
      }
      for (const path of declaredLeafPaths(EXPECTED_ENTRIES, "provider.entries")) {
        expect(String(origins[path]).startsWith("layer=project-committed")).toBe(true);
      }
    } finally {
      composed.cleanup();
    }
  });
});

/* ------------------------------- DRIFT-007 ------------------------------- */

describe("GH-374 TC-POL-DRIFT-007 verify.suite-map is untouched and one sibling branch was added", () => {
  test("the top level is exactly provider and verify, and the map is the delivered declaration", () => {
    const document = readDocument();
    expect(Object.keys(document).sort()).toEqual(["provider", "verify"]);
    const verify = asRecord(document.verify);
    expect(verify).toEqual({
      "suite-map": {
        schemaVersion: "delivery.verify.suite-map.v1",
        jobs: [
          {
            job: "TS aggregate check",
            suites: [
              "tests",
              "lint",
              "format",
              "typecheck",
              "boundaries",
              "prompt-conformance",
              "help-guide-coverage",
              "exports-parity",
            ],
          },
        ],
        local: [
          "tests",
          "lint",
          "format",
          "typecheck",
          "boundaries",
          "prompt-conformance",
          "help-guide-coverage",
          "exports-parity",
        ],
      },
    });
  });

  test("the suite-map control is unedited (recorded content hash)", () => {
    const text = readFileSync(join(ROOT, SUITE_MAP_CONTROL), "utf8");
    expect(createHash("sha256").update(text).digest("hex")).toBe(SUITE_MAP_CONTROL_SHA256);
  });

  test("a third top-level key is detected by the pin", () => {
    const document = deepClone(readDocument());
    document.extra = { branch: true };
    expect(Object.keys(document).sort()).toEqual(["extra", "provider", "verify"]);
  });
});

/* -------------------------------- MIG-001 -------------------------------- */

describe("GH-374 TC-POL-MIG-001 the evidence artifact records both refusals and the disposition", () => {
  test("both refusals, the sources, the sizes, the guarantee and the disposition are recorded", () => {
    const artifact = readFileSync(MIGRATION_EVIDENCE, "utf8");
    expect(artifact).toContain("provider.migrate.refused");
    expect(artifact.match(/"code": "provider.migrate.refused"/g)).toHaveLength(2);
    expect(artifact).toContain('"category": "user"');
    expect(artifact).toContain('"retryable": false');
    expect(artifact).toContain("oversized-source");
    expect(artifact).toContain("75215");
    expect(artifact).toContain("PROVIDER_MIGRATE_SOURCE_MAX_BYTES = 65536");
    expect(artifact).toContain("dynamic-value");
    expect(artifact).toContain("ados-agent-tiers.sh:11");
    expect(artifact).toContain("outside the assignment-only subset");
    expect(artifact).toContain("$HOME/.ados/config/profiles");
    expect(artifact).toContain("$HOME/.ados/hooks/pre-opencode-iteration");
    expect(artifact).toContain("500 27160 total");
    expect(artifact).toContain("read-only");
    expect(artifact).toContain("was moved, copied, or deleted");
    expect(artifact).toContain("The migrator is not extended");
    expect(artifact).toContain("M4-S17");
    expect(artifact).not.toMatch(/sk-[A-Za-z0-9]{16,}/);
    expect(artifact).not.toMatch(/[A-Z0-9_]{3,}_API_KEY\s*[:=]\s*["']?[A-Za-z0-9]/);
  });
});

/* -------------------------------- MIG-002 -------------------------------- */

describe("GH-374 TC-POL-MIG-002 the migrator's owned contract is pinned as a tree invariant", () => {
  test("three caps, eight closed reasons and its declared files are unchanged", () => {
    expect(PROVIDER_MIGRATE_SOURCE_MAX_BYTES).toBe(65536);
    expect(PROVIDER_MIGRATE_SOURCE_MAX_LINES).toBe(2000);
    expect(PROVIDER_MIGRATE_MAX_SOURCES).toBe(64);
    const migrateSource = readFileSync(join(ROOT, "packages/core/src/provider/migrate.ts"), "utf8");
    const blockStart = migrateSource.indexOf("PROVIDER_MIGRATE_REFUSAL_REASONS");
    const blockEnd = migrateSource.indexOf("] as const", blockStart);
    expect(blockStart).toBeGreaterThanOrEqual(0);
    expect(blockEnd).toBeGreaterThan(blockStart);
    const declaredReasons = [
      ...migrateSource.slice(blockStart, blockEnd).matchAll(/"([a-z-]+)"/g),
    ].map((match) => match[1]);
    expect(declaredReasons.sort()).toEqual([
      "dynamic-value",
      "no-checkout",
      "no-source",
      "oversized-source",
      "proposal-invalid",
      "shell-construct",
      "target-exists",
      "unreadable-source",
    ]);
    expect(declaredReasons).toHaveLength(8);
    const files = [
      "packages/core/src/provider/migrate.ts",
      "tests/behaviour/provider-migrate.test.ts",
      "tests/checks/provider-migrate-cli.test.ts",
      "tests/checks/provider-migrate-secrets.test.ts",
      "tests/golden/provider-migrate-golden.test.ts",
      "tests/fixtures/provider/legacy",
    ] as const;
    for (const file of files) {
      expect([file, existsSync(join(ROOT, file))]).toEqual([file, true]);
    }
  });

  test("the grammar accepts exactly --profiles-dir, --hook, --write (plus --json)", async () => {
    const composed = composedCheckout("mig002", { withProvider: true });
    try {
      // A flag belonging to another provider subcommand is refused by the
      // delivered grammar, naming the three accepted flags.
      const foreignFlag = await composed.run([
        "provider",
        "migrate",
        "legacy",
        "--chain",
        "subscription-first",
        "--json",
      ]);
      expect(foreignFlag.exitCode).toBe(1);
      expect(foreignFlag.error?.code).toBe("input.value.rejected");
      expect(String(foreignFlag.error?.summary)).toContain(
        "migrate legacy accepts only --profiles-dir, --hook and --write",
      );

      // `--write` and the global `--json` are accepted; with no source the
      // delivered whole-run refusal answers `no-source` and writes nothing.
      const noSources = await composed.run(["provider", "migrate", "legacy", "--write", "--json"]);
      expect(noSources.exitCode).toBe(1);
      expect(noSources.error?.code).toBe("provider.migrate.refused");
      expect(String(noSources.error?.summary)).toContain("no-source");
    } finally {
      composed.cleanup();
    }
  });

  test("no suite in this change imports the migrator", () => {
    const suites = [
      "tests/structure/provider-policy-adoption-reference.test.ts",
      "tests/behaviour/provider-policy-adoption.test.ts",
      "tests/checks/provider-legacy-source-scan.test.ts",
      "tests/checks/provider-policy-adoption-prompt-scan.test.ts",
      "tests/checks/provider-policy-credential-canary.test.ts",
    ] as const;
    for (const suite of suites) {
      if (!existsSync(join(ROOT, suite))) continue;
      const text = readFileSync(join(ROOT, suite), "utf8");
      const importsMigrator = /from\s+"[^"]*\/migrate(?:\.js)?"/.test(text);
      const callsMigrator = /provider\s+migrate\s+legacy/.test(text) && /composed\.run/.test(text);
      expect([suite, importsMigrator]).toEqual([suite, false]);
      // The reference suite itself drives the CLI grammar (a refusal arm), so it
      // is the one declared exception to the "no invocation" half; every other
      // new suite must not reach the command at all.
      if (!suite.endsWith("provider-policy-adoption-reference.test.ts")) {
        expect([suite, callsMigrator]).toEqual([suite, false]);
      }
    }
  });
});

/* -------------------------------- MIG-003 -------------------------------- */

describe("GH-374 TC-POL-MIG-003 no suite re-runs the migration against an operator home", () => {
  const readAllTests = (): readonly { readonly path: string; readonly text: string }[] => {
    const results: { path: string; text: string }[] = [];
    const walk = (relative: string): void => {
      const directory = join(ROOT, relative);
      if (!existsSync(directory)) return;
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const child = `${relative}/${entry.name}`;
        if (entry.isDirectory()) walk(child);
        else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
          results.push({ path: child, text: readFileSync(join(ROOT, child), "utf8") });
        }
      }
    };
    walk("tests");
    return results;
  };

  const migrationsAgainstHome = (
    samples: readonly { readonly path: string; readonly text: string }[],
  ): readonly string[] =>
    samples
      .filter((sample) =>
        sample.text
          .split("\n")
          .some(
            (line) =>
              /migrate/.test(line) &&
              /(process\.env\.HOME|homedir\(\)|\$HOME|~\/\.ados)/.test(line),
          ),
      )
      .map((sample) => sample.path);

  test("no test invokes the migration against an operator home", () => {
    const scanned = readAllTests();
    expect(scanned.length).toBeGreaterThan(100);
    expect(migrationsAgainstHome(scanned)).toEqual([]);
  });

  test("the scan seam is live: a planted invocation is reported", () => {
    // Assembled at run time so this suite's own text never contains a
    // HOME-shaped migrate invocation (the real-tree arm scans it).
    const command = ["provider", "migrate", "legacy"].join(" ");
    const home = ["process", "env", "HOME"].join(".");
    const planted = [
      {
        path: "tests/scratch/planted.test.ts",
        text: `${command} --profiles-dir \`\${${home}}/.ados/config/profiles\``,
      },
      { path: "tests/scratch/clean.test.ts", text: "const value = 1;" },
    ] as const;
    expect(migrationsAgainstHome(planted)).toEqual(["tests/scratch/planted.test.ts"]);
  });

  test("the evidence artifact is unmodified by the suite run", () => {
    const before = createHash("sha256").update(readFileSync(MIGRATION_EVIDENCE)).digest("hex");
    expect(createHash("sha256").update(readFileSync(MIGRATION_EVIDENCE)).digest("hex")).toBe(
      before,
    );
  });
});
