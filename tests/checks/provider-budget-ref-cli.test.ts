/**
 * GH-350 TC-REF-001/TC-REF-003 (CLI arms) — the composed program's ref refusal
 * and the read-only members' exemption. No case reads the live tree or network.
 */
import { describe, expect, test } from "bun:test";
import type {
  ProviderSpendTotalsInput,
  ProviderSpendTotalsRead,
  StateStorePort,
} from "@delivery-os/core/contracts";
import { PRODUCTION_CATALOG } from "../../packages/core/src/config/catalog";
import { createConfigProgram } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
const CONTEXT_PATH = "/repo/.ai/local/pm-context.yaml";

const BUDGETS_BRANCH = {
  type: "record",
  value: {
    type: "object",
    required: true,
    fields: {
      enabled: { type: "boolean", default: true },
      scope: { type: "string", required: true },
      basis: { type: "string", required: true },
      ceiling: { type: "number", required: true },
      windowSeconds: { type: "number" },
      entries: { type: "array", items: { type: "string" } },
    },
  },
} as const;

const catalog = {
  ...PRODUCTION_CATALOG,
  provider: {
    ...PRODUCTION_CATALOG.provider,
    fields: { ...PRODUCTION_CATALOG.provider.fields, budgets: BUDGETS_BRANCH },
  },
} as typeof PRODUCTION_CATALOG;

const CONFIG = `provider:
  defaultChain: default
  credentials:
    zai:
      sourceKey:
        style: literal
        name: ZAI_API_KEY
    watchkey:
      sourceKey:
        style: literal
        name: WATCH_KEY
  entries:
    p0:
      class: subscription
      quota:
        endpoint: https://p0.test/quota
        credentialRef: zai
  chains:
    default:
      entries:
        - p0
      allowPaidFallback: false
  profiles:
    tiers:
      regular: {}
    profiles:
      mixed:
        tier: regular
        providers: [p0]
        seats:
          pm:
            model: synthetic-model
            pacingClass: judgment
            capability: text-only
    preferenceChain:
      base: mixed
    watch:
      p0:
        mapping: coding-plan-windows
        endpoint: https://cp.test/quota
        credentialRef: watchkey
        thresholdPercent: 100
  budgets:
    cap:
      enabled: true
      scope: ticket
      basis: cost
      ceiling: 100
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

const run = async (
  args: readonly string[],
  options: { readonly ref?: string; readonly read?: ProviderSpendTotalsRead } = {},
): Promise<{
  exitCode: number;
  stdout: string;
  seamCalls: () => number;
  spendCalls: ProviderSpendTotalsInput[];
}> => {
  const root = makeTempRoot("provider-budget-ref-cli");
  try {
    const store: StateStorePort = openStore(makeIdentity(root)).store;
    const spendCalls: ProviderSpendTotalsInput[] = [];
    let seamCalls = 0;
    const contextText =
      options.ref === undefined
        ? ""
        : `active_change:\n  workItemRef: ${options.ref}\n  branch: feat/${options.ref}/x\n  change_folder: doc/changes/x\nparked_changes: []\n`;
    const program = createConfigProgram({
      workingName: "synthetic",
      environment: {},
      cwd: "/repo",
      homeDirectory: "/home/synthetic",
      platform: "linux",
      catalog,
      fs: {
        exists: (path) =>
          path === "/repo/.synthetic/config.yaml" ||
          (options.ref !== undefined && path === CONTEXT_PATH),
        readText: (path) => {
          if (path === "/repo/.synthetic/config.yaml") return CONFIG;
          if (path === CONTEXT_PATH) return contextText;
          throw new Error("missing file");
        },
      },
      repositoryIo: {
        exists: (path) => path === "/repo/.git",
        isFile: () => false,
        readText: () => "",
      },
      provider: {
        clock: { nowMs: () => NOW },
        credentialPort: { resolve: () => ({ ok: true, material: { value: "CANARY-SECRET" } }) },
        transport: {
          send: async () => ({
            status: 200,
            bodyText: JSON.stringify({ code: 200, success: true, data: { limits: [] } }),
          }),
        },
        sleep: { sleep: async () => undefined },
        stateStore: store,
        newFenceToken: () => "fence-ref",
        spendTotals: {
          read: async (input) => {
            spendCalls.push(input);
            return (
              options.read ?? {
                status: "measured",
                totals: input.scopes.map((scope) => ({
                  scopeKey: scope.scopeKey,
                  cost: 0,
                  tokens: 0,
                  newestAtMs: null,
                })),
              }
            );
          },
        },
        resolveWorkItemRef: () => {
          seamCalls += 1;
          return options.ref === undefined
            ? { status: "unresolved" }
            : { status: "resolved", workItemRef: options.ref };
        },
        workItemContextPath: CONTEXT_PATH,
      },
    });
    if (!program.ok) throw new Error("program composition failed");
    const stdout = sink();
    const stderr = sink();
    const deps: CliDependencies = {
      brand: program.brand,
      clock: { now: () => NOW },
      newRunId: () => "run-provider-budget-ref-cli",
      secrets: program.secrets,
      program: program.program,
    };
    const exitCode = await runCli(["provider", ...args], { stdout, stderr }, deps);
    return { exitCode, stdout: stdout.value, seamCalls: () => seamCalls, spendCalls };
  } finally {
    removeRoot(root);
  }
};

describe("TC-REF-001 the ref refusal through the composed CLI", () => {
  test("no context file: one input.value.rejected at exit 1 naming budget, path and remedy", async () => {
    const result = await run(["resolve", "--json"]);
    expect(result.exitCode).toBe(1);
    const envelope = JSON.parse(result.stdout) as { error: { code: string; summary: string } };
    expect(envelope.error.code).toBe("input.value.rejected");
    expect(envelope.error.summary).toContain("cap");
    expect(envelope.error.summary).toContain(CONTEXT_PATH);
    expect(envelope.error.summary).toContain("disable the budget");
    expect(result.spendCalls).toHaveLength(0);
    expect(result.seamCalls()).toBe(1);
    expect(result.stdout).not.toContain("CANARY-SECRET");
  });

  test("a context with an active ref resolves and reads exactly once", async () => {
    const result = await run(["resolve", "--json"], { ref: "GH-350" });
    expect(result.exitCode).toBe(0);
    expect(result.spendCalls).toHaveLength(1);
    expect(result.spendCalls[0]?.workItemRef).toBe("GH-350");
    expect(result.seamCalls()).toBe(1);
  });
});

describe("TC-REF-003 the four read-only members never resolve a ref", () => {
  test("quota, parks list, profile resolve and watch status keep their normal outcome", async () => {
    const cases: readonly { readonly args: readonly string[]; readonly exit: number }[] = [
      { args: ["quota", "--json"], exit: 0 },
      { args: ["parks", "list", "--json"], exit: 0 },
      { args: ["profile", "resolve", "--json"], exit: 0 },
      { args: ["watch", "status", "--json"], exit: 0 },
    ];
    for (const entry of cases) {
      const result = await run(entry.args);
      expect(result.exitCode, entry.args.join(" ")).toBe(entry.exit);
      expect(result.seamCalls(), entry.args.join(" ")).toBe(0);
      expect(result.spendCalls, entry.args.join(" ")).toHaveLength(0);
      expect(result.stdout, entry.args.join(" ")).not.toContain("input.value.rejected");
    }
  });
});
