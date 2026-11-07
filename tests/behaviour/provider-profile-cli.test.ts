/**
 * TC-PROFILE-043..046 — the provider profile resolve, watch status, and
 * `resolve --profile` command surface: envelopes, exits, filters, human output,
 * and classified invalid grammar with no side effects.
 */
import { describe, expect, test } from "bun:test";
import type {
  ProfileSelectionResult,
  ProviderResolveResult,
  ProviderWatchConditionView,
} from "../../packages/core/src/contracts/index";
import {
  createProviderCommandDefinition,
  type ProviderCommandRuntime,
} from "../../packages/cli/src/commands/provider";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { SYNTHETIC_BRAND } from "../golden/helpers";
import {
  envRecord,
  refusedResult,
  selectedResult,
  watchProviders,
} from "../fixtures/provider/profile/golden/data";

const NOW = 1_700_000_000_000;

const providerResolve = (input: { readonly profile?: string }): ProviderResolveResult => ({
  ok: true,
  chainName: "default",
  decision: {
    kind: "selected",
    chainName: "default",
    providerName: input.profile === "deepseek" ? "deepseek" : "coding-plan",
    costClass: "subscription",
  },
  skipped: [],
  parks: [],
  announcements: [],
});

type Calls = { profileResolve: number; watchStatus: number; resolve: number };

const runtime = (
  overrides: Partial<ProviderCommandRuntime> = {},
): { runtime: ProviderCommandRuntime; calls: Calls } => {
  const calls: Calls = { profileResolve: 0, watchStatus: 0, resolve: 0 };
  const base: ProviderCommandRuntime = {
    resolve: async (input) => {
      calls.resolve += 1;
      if (input.profile === "ghost") {
        return { ok: false, code: "provider.profile.invalid", summary: "unknown profile ghost" };
      }
      return providerResolve(input);
    },
    quota: async () => ({ ok: false, code: "provider.chain.empty", summary: "no chain" }),
    parks: () => ({ ok: true, value: [] }),
    profileResolve: async (input) => {
      calls.profileResolve += 1;
      return input.forSpawn
        ? {
            ...selectedResult(),
            decision: { ...selectedResult().decision, envRecord },
          } as ProfileSelectionResult
        : selectedResult();
    },
    watchStatus: async (input) => {
      calls.watchStatus += 1;
      const providers: readonly ProviderWatchConditionView[] =
        input.providerName === undefined
          ? watchProviders
          : watchProviders.filter((entry) => entry.name === input.providerName);
      if (input.providerName !== undefined && providers.length === 0) {
        return { ok: false, code: "input.value.rejected", summary: "no such provider" };
      }
      return { ok: true, providers };
    },
  };
  return { runtime: { ...base, ...overrides }, calls };
};

const run = async (
  args: readonly string[],
  providerRuntime: ProviderCommandRuntime = runtime().runtime,
): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
  let stdout = "";
  let stderr = "";
  const deps: CliDependencies = {
    brand: SYNTHETIC_BRAND,
    clock: { now: () => NOW },
    newRunId: () => "run-provider-profile",
    secrets: [],
    program: { commands: { provider: createProviderCommandDefinition(providerRuntime) } },
  };
  const exitCode = await runCli(
    ["provider", ...args],
    {
      stdout: { write: (chunk) => (stdout += chunk) },
      stderr: { write: (chunk) => (stderr += chunk) },
    },
    deps,
  );
  return { exitCode, stdout, stderr };
};

const parse = (stdout: string): Record<string, unknown> =>
  JSON.parse(stdout) as Record<string, unknown>;

describe("TC-PROFILE-043 provider resolve --profile scopes the context", () => {
  test("a named profile keeps the delivered resolve envelope shape", async () => {
    const result = await run(["resolve", "--profile", "deepseek", "--json"]);
    expect(result.exitCode).toBe(0);
    const envelope = parse(result.stdout);
    const data = envelope.data as Record<string, unknown>;
    expect(data.profile).toBe("deepseek");
    expect(data.decision).toMatchObject({ kind: "selected", providerName: "deepseek" });
    expect(data.chain).toBe("default");
    expect(data.parks).toBeDefined();
    expect(data.skipped).toBeDefined();
  });

  test("resolve without the flag is unchanged", async () => {
    const result = await run(["resolve", "--json"]);
    expect(result.exitCode).toBe(0);
    const data = parse(result.stdout).data as Record<string, unknown>;
    expect(data.profile).toBeUndefined();
    expect(data.decision).toMatchObject({ kind: "selected", providerName: "coding-plan" });
  });

  test("an unknown profile is a classified configuration error", async () => {
    const result = await run(["resolve", "--profile", "ghost", "--json"]);
    expect(result.exitCode).toBe(1);
    const error = parse(result.stdout).error as Record<string, unknown>;
    expect(error.code).toBe("provider.profile.invalid");
  });
});

describe("TC-PROFILE-044 provider profile resolve envelope and exits", () => {
  test("the envelope carries profile, eligibility, rung, and agentOverrides", async () => {
    const result = await run(["profile", "resolve", "--json"]);
    expect(result.exitCode).toBe(0);
    const data = parse(result.stdout).data as Record<string, unknown>;
    expect(data.profile).toBe("deepseek");
    expect(data.rung).toBe("conserve");
    expect(data.agentOverrides).toEqual({ reviewer: "coder" });
    expect(Array.isArray(data.eligibility)).toBe(true);
  });

  test("--agent is accepted and the override is visible", async () => {
    const { runtime: commandRuntime } = runtime({
      profileResolve: async () => selectedResult(),
    });
    const result = await run(["profile", "resolve", "--agent", "reviewer", "--json"], commandRuntime);
    expect(result.exitCode).toBe(0);
    const data = parse(result.stdout).data as Record<string, unknown>;
    expect(data.agentOverrides).toEqual({ reviewer: "coder" });
  });

  test("exit 1 for classified misconfiguration", async () => {
    const { runtime: commandRuntime } = runtime({
      profileResolve: async () => ({
        ok: false,
        code: "provider.profile.absent",
        summary: "no profile chain declared",
        eligibility: [],
        events: [],
      }),
    });
    const result = await run(["profile", "resolve", "--json"], commandRuntime);
    expect(result.exitCode).toBe(1);
    const error = parse(result.stdout).error as Record<string, unknown>;
    expect(error.code).toBe("provider.profile.absent");
  });

  test("exit 2 when all candidates are skipped or exhausted", async () => {
    const { runtime: commandRuntime } = runtime({ profileResolve: async () => refusedResult() });
    const result = await run(["profile", "resolve", "--json"], commandRuntime);
    expect(result.exitCode).toBe(2);
    const data = parse(result.stdout).data as Record<string, unknown>;
    expect(data.outcome).toBe("refused");
    expect((data.eligibility as unknown[]).length).toBe(2);
  });

  test("--for-spawn adds the structured data-v1 env record", async () => {
    const result = await run(["profile", "resolve", "--for-spawn", "--json"]);
    expect(result.exitCode).toBe(0);
    const data = parse(result.stdout).data as {
      envRecord?: { recordFormat?: string; entries?: unknown[]; serialized?: string };
    };
    expect(data.envRecord?.recordFormat).toBe("data-v1");
    expect(data.envRecord?.entries).toHaveLength(2);
    expect(data.envRecord?.serialized).toContain("set ");
  });

  test("human output prints the equivalent continuity keys", async () => {
    const result = await run(["profile", "resolve"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("profile deepseek");
    expect(result.stdout).toContain("tier powerful");
    expect(result.stdout).toContain("rung conserve");
  });
});

describe("TC-PROFILE-045 provider watch status envelope and filter", () => {
  test("the envelope carries name, condition, source, and checkedAt", async () => {
    const result = await run(["watch", "status", "--json"]);
    expect(result.exitCode).toBe(0);
    const data = parse(result.stdout).data as {
      providers: Array<Record<string, unknown>>;
    };
    expect(data.providers).toHaveLength(3);
    for (const provider of data.providers) {
      expect(typeof provider.name).toBe("string");
      expect(typeof provider.condition).toBe("string");
      expect(typeof provider.source).toBe("string");
      expect(typeof provider.checkedAt).toBe("string");
    }
  });

  test("--provider filters to exactly that provider", async () => {
    const result = await run(["watch", "status", "--provider", "deepseek", "--json"]);
    expect(result.exitCode).toBe(0);
    const data = parse(result.stdout).data as { providers: Array<{ name: string }> };
    expect(data.providers.map((entry) => entry.name)).toEqual(["deepseek"]);
  });

  test("an unknown provider is a classified error with exit 1", async () => {
    const result = await run(["watch", "status", "--provider", "ghost", "--json"]);
    expect(result.exitCode).toBe(1);
    const error = parse(result.stdout).error as Record<string, unknown>;
    expect(error.code).toBe("input.value.rejected");
  });

  test("human output prints the provider condition lines", async () => {
    const result = await run(["watch", "status"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("coding-plan: clear");
    expect(result.stdout).toContain("openai: quota-exhausted");
  });
});

describe("TC-PROFILE-046 invalid grammar fails classified with no side effects", () => {
  const invalids = [
    ["profile"],
    ["watch"],
    ["profile", "status"],
    ["watch", "resolve"],
    ["profile", "resolve", "extra"],
    ["profile", "resolve", "--agent"],
    ["profile", "resolve", "--bogus"],
    ["resolve", "--for-spawn"],
    ["unknown-subcommand"],
  ] as const;

  for (const args of invalids) {
    test(`${args.join(" ")} is a classified invocation error`, async () => {
      const { runtime: commandRuntime, calls } = runtime();
      const result = await run([...args, "--json"], commandRuntime);
      expect(result.exitCode).toBe(1);
      const error = parse(result.stdout).error as Record<string, unknown>;
      expect(["input.value.rejected", "fallback.invocation"]).toContain(String(error.code));
      expect(calls).toEqual({ profileResolve: 0, watchStatus: 0, resolve: 0 });
    });
  }

  test("the valid control grammar succeeds", async () => {
    const result = await run(["watch", "status", "--json"]);
    expect(result.exitCode).toBe(0);
  });
});
