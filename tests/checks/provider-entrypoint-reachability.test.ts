/**
 * GH-350 TC-MOUNT-001..003 — the family is reachable through the production
 * entrypoint, and the mount is load-bearing.
 *
 * The positive arm drives all seven member paths and all eight help surfaces
 * through `runEntrypoint` with the composer `packages/cli/src/production.ts`
 * builds, records exactly one production-composer construction per member
 * invocation, and fails structurally if this harness imports or calls the
 * command layer directly. The negative arm copies `entrypoint.ts` into a temp
 * module with every relative import rewritten, points its declarative-set
 * import at a provider-less copy, loads both with `?mutant=` cache-busting,
 * and proves the mutated member invocation answers `fallback.internal` at exit
 * `2` while the same-machinery control still resolves (AC-F8-5, MOUNT-TP-1).
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROVIDER_SIMULATE_SCHEMA_VERSION } from "@delivery-os/core/provider";
import {
  type EntrypointInvocationFact,
  type EntrypointOptions,
  runEntrypoint,
  type selectPromptRequiredProgram,
} from "../../packages/cli/src/entrypoint";
import type { CommandProgram } from "../../packages/cli/src/index";
import { createProductionComposer } from "../../packages/cli/src/production";
import { resolveBrandIdentity } from "../../packages/core/src/branding";
import type { BrandIdentity } from "../../packages/core/src/contracts/index";
import { bufferSink } from "../golden/helpers";

const ROOT = process.cwd();
const TMP = join(ROOT, "tmp", "tmpdir");
const M1_PAGE = "doc/planning/oss-tooling/milestones/m1/commands/provider.md";
const CONFIG = `provider:
  defaultChain: ch
  credentials:
    c:
      sourceKey:
        style: literal
        name: GH350_REACH_KEY
  entries:
    p:
      class: subscription
  chains:
    ch:
      entries:
        - p
  profiles:
    tiers:
      t:
        description: reach tier
    profiles:
      prof:
        tier: t
        providers: [p]
        seats:
          seat:
            model: reach-model
            pacingClass: judgment
            capability: text-only
    preferenceChain:
      base: prof
`;

const LEGACY_PROFILE = `${[
  "ADOS_ZAI_PEAK_START_UTC=21600",
  "ADOS_ZAI_PEAK_END_UTC=36000",
  "ZAI_API_KEY=sk-unused-canary",
].join("\n")}\n`;

type Scratch = {
  readonly root: string;
  readonly home: string;
  readonly checkout: string;
  readonly fixturePath: string;
  readonly profilesDir: string;
  readonly environment: Record<string, string>;
  dispose(): void;
};

const scratch = (label: string): Scratch => {
  mkdirSync(TMP, { recursive: true });
  const root = mkdtempSync(join(TMP, `gh350-reach-${label}-`));
  const home = join(root, "home");
  const checkout = join(root, "checkout");
  mkdirSync(join(home), { recursive: true });
  mkdirSync(join(checkout, ".git"), { recursive: true });
  mkdirSync(join(checkout, ".jaiship"), { recursive: true });
  writeFileSync(join(checkout, ".jaiship", "config.yaml"), CONFIG);
  const fixturePath = join(checkout, "simulate.json");
  writeFileSync(
    fixturePath,
    JSON.stringify({
      schemaVersion: PROVIDER_SIMULATE_SCHEMA_VERSION,
      now: "2026-01-01T12:00:00Z",
      spend: {
        telemetryState: "present",
        points: [{ atMs: Date.parse("2026-01-01T12:00:00Z") - 1_000, cost: 0, tokens: 0 }],
      },
    }),
  );
  const profilesDir = join(root, "legacy", "profiles");
  mkdirSync(profilesDir, { recursive: true });
  writeFileSync(join(profilesDir, "zai.sh"), LEGACY_PROFILE);
  return {
    root,
    home,
    checkout,
    fixturePath,
    profilesDir,
    environment: { HOME: home, PATH: "/usr/bin:/bin" },
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
};

type Harness = {
  readonly options: EntrypointOptions;
  readonly compositions: () => number;
  readonly handlerCalls: () => number;
};

const productionHarness = (facts: Scratch): Harness => {
  const composer = createProductionComposer({
    harnessVersionProbe: async () => ({ status: "answered" as const, stdout: "opencode v2.3.2" }),
    environment: facts.environment,
    cwd: facts.checkout,
    homeDirectory: facts.home,
    workingName: "jaiship",
  });
  let compositions = 0;
  let handlerCalls = 0;
  const composeProgram = async (
    brand: BrandIdentity,
    invocation?: EntrypointInvocationFact,
  ): Promise<CommandProgram> => {
    compositions += 1;
    const program = await composer(brand, invocation);
    const provider = program.commands.provider;
    if (provider === undefined) return program;
    return {
      commands: {
        ...program.commands,
        provider: {
          ...provider,
          handler: (context) => {
            handlerCalls += 1;
            return provider.handler(context);
          },
        },
      },
    };
  };
  return {
    options: {
      streams: { stdout: bufferSink(), stderr: bufferSink() },
      environment: facts.environment,
      configuredWorkingName: "jaiship",
      declaredWorkingName: "jaiship",
      composeProgram,
      clock: { now: () => Date.parse("2026-01-01T12:00:00Z") },
      newRunId: () => "run-gh350-reach",
    },
    compositions: () => compositions,
    handlerCalls: () => handlerCalls,
  };
};

type Run = {
  readonly exit: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string; readonly summary?: string };
};

const invoke = async (options: EntrypointOptions, argv: readonly string[]): Promise<Run> => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  const exit = await runEntrypoint(argv, { ...options, streams: { stdout, stderr } });
  const text = stdout.value;
  const parsed = text.trim().startsWith("{")
    ? (JSON.parse(text) as Record<string, unknown>)
    : undefined;
  return {
    exit,
    stdout: text,
    stderr: stderr.value,
    ...(parsed?.data === undefined ? {} : { data: parsed.data as Record<string, unknown> }),
    ...(parsed?.error === undefined ? {} : { error: parsed.error as Run["error"] }),
  };
};

const MEMBERS: readonly (readonly string[])[] = [
  ["provider", "resolve"],
  ["provider", "quota"],
  ["provider", "parks", "list"],
  ["provider", "profile", "resolve"],
  ["provider", "watch", "status"],
  ["provider", "simulate"],
  ["provider", "migrate", "legacy"],
];

const HELP_SURFACES: readonly (readonly string[])[] = [
  ["provider"],
  ["provider", "resolve"],
  ["provider", "quota"],
  ["provider", "parks", "list"],
  ["provider", "profile", "resolve"],
  ["provider", "watch", "status"],
  ["provider", "simulate"],
  ["provider", "migrate", "legacy"],
];

const memberArgv = (path: readonly string[], facts: Scratch): readonly string[] => {
  if (path.join(" ") === "provider simulate") {
    return [...path, "--fixture", facts.fixturePath, "--json"];
  }
  if (path.join(" ") === "provider migrate legacy") {
    return [...path, "--profiles-dir", facts.profilesDir, "--json"];
  }
  return [...path, "--json"];
};

const facts = scratch("positive");

afterAll(() => {
  facts.dispose();
});

describe("TC-MOUNT-001 seven member paths reach the family handler through the production composer", () => {
  test("7/7 answer their declared outcome, never fallback.internal or fallback.invocation", async () => {
    const harness = productionHarness(facts);
    for (const path of MEMBERS) {
      const before = harness.handlerCalls();
      const run = await invoke(harness.options, memberArgv(path, facts));
      expect({ member: path.join(" "), exit: run.exit }, path.join(" ")).toEqual({
        member: path.join(" "),
        exit: 0,
      });
      expect({ member: path.join(" "), code: run.error?.code }).not.toEqual({
        member: path.join(" "),
        code: "fallback.internal",
      });
      expect({ member: path.join(" "), code: run.error?.code }).not.toEqual({
        member: path.join(" "),
        code: "fallback.invocation",
      });
      expect({ member: path.join(" "), reached: harness.handlerCalls() - before }).toEqual({
        member: path.join(" "),
        reached: 1,
      });
      expect(run.data, path.join(" ")).toBeDefined();
    }
    expect(harness.compositions()).toBe(MEMBERS.length);
  });

  test("each member answers its declared payload key", async () => {
    const harness = productionHarness(facts);
    const resolve = await invoke(harness.options, ["provider", "resolve", "--json"]);
    expect(resolve.data?.decision).toBeDefined();
    const quota = await invoke(harness.options, ["provider", "quota", "--json"]);
    expect(Array.isArray(quota.data?.providers)).toBe(true);
    const parks = await invoke(harness.options, ["provider", "parks", "list", "--json"]);
    expect(parks.data?.parks).toEqual([]);
    const profile = await invoke(harness.options, ["provider", "profile", "resolve", "--json"]);
    expect(profile.data?.outcome).toBe("selected");
    const watch = await invoke(harness.options, ["provider", "watch", "status", "--json"]);
    expect(watch.data?.providers).toEqual([]);
    const simulate = await invoke(harness.options, memberArgv(["provider", "simulate"], facts));
    expect((simulate.data?.simulation as { stateWrites?: number } | undefined)?.stateWrites).toBe(
      0,
    );
    const migrate = await invoke(
      harness.options,
      memberArgv(["provider", "migrate", "legacy"], facts),
    );
    const report = migrate.data?.report as { sources?: readonly unknown[] } | undefined;
    expect(Array.isArray(report?.sources)).toBe(true);
  });
});

describe("TC-MOUNT-002 eight help surfaces resolve from the static inventory", () => {
  test("8/8 exit 0 with the five declared sections and the M1 see-also pointer", async () => {
    const harness = productionHarness(facts);
    for (const path of HELP_SURFACES) {
      const run = await invoke(harness.options, [...path, "--help"]);
      expect({ surface: path.join(" "), exit: run.exit }).toEqual({
        surface: path.join(" "),
        exit: 0,
      });
      for (const section of ["Usage:", "Options:", "Examples:", "Exit codes:", "See also:"]) {
        expect({ surface: path.join(" "), section, present: run.stdout.includes(section) }).toEqual(
          {
            surface: path.join(" "),
            section,
            present: true,
          },
        );
      }
      expect(run.stdout, path.join(" ")).toContain(M1_PAGE);
      expect(run.stdout, path.join(" ")).not.toContain("unknown flag");
      expect(run.stderr, path.join(" ")).not.toContain("fallback.internal");
    }
    // Help is read before composition: no program is composed and no handler runs.
    expect(harness.compositions()).toBe(0);
    expect(harness.handlerCalls()).toBe(0);
  });

  test("the family entry lists exactly the seven members in their declared order", async () => {
    const harness = productionHarness(facts);
    const run = await invoke(harness.options, ["provider", "--help"]);
    const order = MEMBERS.map((path) => path.slice(1).join(" "));
    const positions = order.map((member) => run.stdout.indexOf(`provider ${member}`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((left, right) => left - right)).toEqual(positions);
    expect(run.stdout).not.toContain("provider  --json");
  });
});

type MutantModule = {
  readonly PROMPT_REQUIRED_COMMANDS: readonly string[];
  readonly runEntrypoint: typeof runEntrypoint;
  readonly selectPromptRequiredProgram: typeof selectPromptRequiredProgram;
};

const rewriteEntrypoint = (source: string, setSpecifier: string): string => {
  const replacements: readonly (readonly [string, string])[] = [
    ['"./build-identity.js"', JSON.stringify(join(ROOT, "packages/cli/src/build-identity.ts"))],
    ['"./help/prompt-required-commands.js"', setSpecifier],
    ['"./help.js"', JSON.stringify(join(ROOT, "packages/cli/src/help.ts"))],
    ['"./index.js"', JSON.stringify(join(ROOT, "packages/cli/src/index.ts"))],
  ];
  let copy = source;
  for (const [from, to] of replacements) copy = copy.replaceAll(from, to);
  return copy;
};

const makeMutantModule = async (
  label: string,
  omitProvider: boolean,
): Promise<{ readonly module: MutantModule; readonly setSource: string; readonly dir: string }> => {
  const stamp = `${label}-${String(Date.now())}-${Math.random().toString(16).slice(2)}`;
  const dir = join(TMP, "mutants", `omit-provider-${stamp}`);
  mkdirSync(dir, { recursive: true });
  const setSourcePath = join(ROOT, "packages/cli/src/help/prompt-required-commands.ts");
  const originalSet = readFileSync(setSourcePath, "utf8");
  const setSource = omitProvider
    ? originalSet.replace(
        '  // GH-350 appends the provider family as the twenty-seventh and last.\n  "provider",\n',
        "",
      )
    : originalSet;
  const mutantSetPath = join(dir, "prompt-required-commands.ts");
  writeFileSync(mutantSetPath, setSource);
  const entrypointSource = readFileSync(join(ROOT, "packages/cli/src/entrypoint.ts"), "utf8");
  const setSpecifier = JSON.stringify(`${mutantSetPath}?mutant=${stamp}`);
  const copy = rewriteEntrypoint(entrypointSource, setSpecifier);
  if (/from "\.\//u.test(copy)) {
    throw new Error(`the entrypoint copy still carries a relative import: ${label}`);
  }
  const mutantEntrypointPath = join(dir, "entrypoint.ts");
  writeFileSync(mutantEntrypointPath, copy);
  const module = (await import(`${mutantEntrypointPath}?mutant=${stamp}`)) as MutantModule;
  return { module, setSource, dir };
};

describe("TC-MOUNT-003 the mount is load-bearing: the removal arm fails closed", () => {
  test("the harness never imports or calls the command layer directly", () => {
    const source = readFileSync(
      join(ROOT, "tests/checks/provider-entrypoint-reachability.test.ts"),
      "utf8",
    );
    const forbidden = ["create" + "ConfigProgram", "run" + "Cli("];
    for (const token of forbidden) {
      expect({ token, present: source.includes(token) }).toEqual({ token, present: false });
    }
    expect(source).toContain("createProductionComposer");
    expect(source).toContain("runEntrypoint");
  });

  test("the mutated copy loads, drops provider, and fails closed without reaching the handler", async () => {
    const { module, setSource, dir } = await makeMutantModule("mutant", true);
    try {
      expect(setSource.includes("provider")).toBe(false);
      expect(module.PROMPT_REQUIRED_COMMANDS).toHaveLength(26);
      expect(module.PROMPT_REQUIRED_COMMANDS).not.toContain("provider");

      const mutatedHarness = productionHarness(facts);
      let mutatedHandlerCalls = 0;
      const composeWithRecorder = async (
        brand: BrandIdentity,
        invocation?: EntrypointInvocationFact,
      ): Promise<CommandProgram> => {
        const program = await mutatedHarness.options.composeProgram(brand, invocation);
        const provider = program.commands.provider;
        if (provider === undefined) return program;
        return {
          commands: {
            ...program.commands,
            provider: {
              ...provider,
              handler: (context) => {
                mutatedHandlerCalls += 1;
                return provider.handler(context);
              },
            },
          },
        };
      };

      const familyStdout = bufferSink();
      const familyStderr = bufferSink();
      const familyExit = await module.runEntrypoint(["provider", "--json"], {
        ...mutatedHarness.options,
        streams: { stdout: familyStdout, stderr: familyStderr },
        composeProgram: composeWithRecorder,
      });
      expect(familyExit).toBe(2);
      const familyEnvelope = JSON.parse(familyStdout.value) as {
        readonly data?: unknown;
        readonly error?: { readonly code?: string; readonly summary?: string };
      };
      expect(familyEnvelope.data).toBeUndefined();
      expect(familyEnvelope.error?.code).toBe("fallback.internal");
      expect(familyEnvelope.error?.summary ?? "").toContain(
        "not part of the composed prompt-required set",
      );
      expect(familyStderr.value).toContain("fallback.internal");

      // A member token is a positional the containment definition refuses at
      // the grammar boundary: the delivered `fallback.invocation` answers at
      // exit 1 and the family handler is never called. The missing-composition
      // identity is asserted on the family token above, which has no positional.
      const memberStdout = bufferSink();
      const memberStderr = bufferSink();
      const memberExit = await module.runEntrypoint(["provider", "resolve", "--json"], {
        ...mutatedHarness.options,
        streams: { stdout: memberStdout, stderr: memberStderr },
        composeProgram: composeWithRecorder,
      });
      expect(memberExit).toBe(1);
      const memberEnvelope = JSON.parse(memberStdout.value) as {
        readonly data?: unknown;
        readonly error?: { readonly code?: string };
      };
      expect(memberEnvelope.data).toBeUndefined();
      expect(memberEnvelope.error?.code).toBe("fallback.invocation");
      expect(memberEnvelope.error?.code?.startsWith("provider.")).toBe(false);
      expect(mutatedHandlerCalls).toBe(0);

      // The extra-family arm against the same provider-less declarative set:
      // `provider` is mounted on the program but selected away.
      const brand = resolveBrandIdentity({ workingName: "jaiship" });
      if (!brand.ok) throw new Error("the resolver rejected jaiship");
      const harness = productionHarness(facts);
      const program = await harness.options.composeProgram(brand.value, {
        command: "provider",
        groupScoped: false,
      });
      const selected = module.selectPromptRequiredProgram(program);
      expect(Object.keys(selected.commands)).toEqual([...module.PROMPT_REQUIRED_COMMANDS]);
      expect(Object.keys(selected.commands)).not.toContain("provider");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the same-machinery control keeps provider and resolves the same invocation", async () => {
    const { module, setSource, dir } = await makeMutantModule("control", false);
    try {
      expect(setSource.includes("provider")).toBe(true);
      expect(module.PROMPT_REQUIRED_COMMANDS).toHaveLength(27);
      expect(module.PROMPT_REQUIRED_COMMANDS).toContain("provider");

      const harness = productionHarness(facts);
      const stdout = bufferSink();
      const stderr = bufferSink();
      const exit = await module.runEntrypoint(["provider", "resolve", "--json"], {
        ...harness.options,
        streams: { stdout, stderr },
      });
      expect(exit).toBe(0);
      const envelope = JSON.parse(stdout.value) as { readonly error?: { readonly code?: string } };
      expect(envelope.error?.code).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
