/**
 * GH-350 TC-BUD-006 (CLI arm) — the terminal `provider.budget.exceeded` refusal
 * through the composed program: one envelope, exit 1, the facts in the summary,
 * and zero state writes.
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

/** The test-local catalog branch the configuration phase will ship. */
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
  entries:
    p0:
      class: subscription
    paid:
      class: pay-per-token
  chains:
    default:
      entries:
        - p0
      allowPaidFallback: true
    ticketOnly:
      entries:
        - p0
      allowPaidFallback: false
  budgets:
    ticketCap:
      enabled: true
      scope: ticket
      basis: cost
      ceiling: 200
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
  options: {
    readonly read: ProviderSpendTotalsRead;
    readonly contextFile?: string;
  },
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
  calls: ProviderSpendTotalsInput[];
}> => {
  const root = makeTempRoot("provider-budget-cli");
  try {
    const store: StateStorePort = openStore(makeIdentity(root)).store;
    const calls: ProviderSpendTotalsInput[] = [];
    const contextPath = "/repo/.ai/local/pm-context.yaml";
    const program = createConfigProgram({
      workingName: "synthetic",
      environment: {},
      cwd: "/repo",
      homeDirectory: "/home/synthetic",
      platform: "linux",
      catalog,
      fs: {
        exists: (path) => path === "/repo/.synthetic/config.yaml" || path === contextPath,
        readText: (path) => {
          if (path === "/repo/.synthetic/config.yaml") return CONFIG;
          if (path === contextPath) return options.contextFile ?? "";
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
        newFenceToken: () => "fence-budget",
        spendTotals: {
          read: async (input) => {
            calls.push(input);
            return options.read;
          },
        },
        resolveWorkItemRef: () => {
          if (options.contextFile === undefined) return { status: "unresolved" };
          const match = /workItemRef:\s*(\S+)/u.exec(options.contextFile);
          return match?.[1] === undefined
            ? { status: "unresolved" }
            : { status: "resolved", workItemRef: match[1] };
        },
        workItemContextPath: contextPath,
      },
    });
    if (!program.ok) throw new Error("program composition failed");
    const stdout = sink();
    const stderr = sink();
    const deps: CliDependencies = {
      brand: program.brand,
      clock: { now: () => NOW },
      newRunId: () => "run-provider-budget-cli",
      secrets: program.secrets,
      program: program.program,
    };
    const exitCode = await runCli(["provider", ...args], { stdout, stderr }, deps);
    return { exitCode, stdout: stdout.value, stderr: stderr.value, calls };
  } finally {
    removeRoot(root);
  }
};

describe("TC-BUD-006 the ticket refusal through the composed CLI", () => {
  test("provider.budget.exceeded at exit 1 with budget, scope, basis, measured and ceiling", async () => {
    const contextFile = "active_change:\n  workItemRef: GH-350\nparked_changes: []\n";
    const result = await run(["resolve", "--chain", "ticketOnly", "--json"], {
      read: {
        status: "measured",
        totals: [{ scopeKey: "ticketCap", cost: 200, tokens: 0, newestAtMs: NOW - 1000 }],
      },
      contextFile,
    });
    expect(result.exitCode).toBe(1);
    const envelope = JSON.parse(result.stdout) as {
      error: { code: string; summary: string };
    };
    expect(envelope.error.code).toBe("provider.budget.exceeded");
    for (const fact of ["ticketCap", "ticket", "cost", "200", "cannot reopen"]) {
      expect(envelope.error.summary).toContain(fact);
    }
    expect(result.stdout).not.toContain("CANARY-SECRET");
    expect(result.calls).toHaveLength(1);
  });

  test("a clear ticket budget is exit 0 with no condition", async () => {
    const result = await run(["resolve", "--chain", "default", "--json"], {
      read: {
        status: "measured",
        totals: [{ scopeKey: "ticketCap", cost: 1.25, tokens: 0, newestAtMs: NOW }],
      },
      contextFile: "active_change:\n  workItemRef: GH-350\nparked_changes: []\n",
    });
    expect(result.exitCode).toBe(0);
    const envelope = JSON.parse(result.stdout) as {
      data: { decision: { kind: string }; announcements: Array<{ code: string }> };
    };
    expect(envelope.data.decision.kind).toBe("selected");
    expect(envelope.data.announcements).toEqual([]);
  });

  test("a failed read refuses at exit 2 with the delivered state identity", async () => {
    const result = await run(["resolve", "--json"], {
      read: { status: "failed", code: "state.store.torn" },
      contextFile: "active_change:\n  workItemRef: GH-350\nparked_changes: []\n",
    });
    expect(result.exitCode).toBe(2);
    const envelope = JSON.parse(result.stdout) as { error: { code: string } };
    expect(envelope.error.code).toBe("state.store.torn");
  });
});
