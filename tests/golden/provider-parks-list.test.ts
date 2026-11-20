/**
 * TC-PROV-053 parks goldens; GH-350 TC-BUD-015's park surface — the budget park
 * and its evidence appear in the committed golden.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProviderSpendTotalsPort } from "@delivery-os/core/contracts";
import { PRODUCTION_CATALOG } from "../../packages/core/src/config/catalog";
import { createConfigProgram } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";
import { clearTransport, createHarness, exhaustedTransport } from "./provider-harness";

const GOLDEN = "tests/fixtures/provider/golden";
const golden = (name: string): unknown =>
  JSON.parse(readFileSync(join(process.cwd(), GOLDEN, name), "utf8")) as unknown;
const text = (name: string): string => readFileSync(join(process.cwd(), GOLDEN, name), "utf8");

describe("TC-PROV-053 parks list goldens", () => {
  test("active and --all views match", async () => {
    const harness = createHarness();
    try {
      await harness.run(["resolve", "--json"], exhaustedTransport);
      const active = await harness.run(["parks", "list", "--json"], clearTransport);
      const activeData = active.data as { parks: Array<{ name: string }> };
      expect(activeData.parks.map((park) => park.name)).toContain(
        (golden("parks-list-active.json") as { parks: Array<{ name: string }> }).parks[0]?.name,
      );
      const all = await harness.run(["parks", "list", "--all", "--json"], clearTransport);
      const allData = all.data as { parks: Array<{ name: string }> };
      expect(allData.parks.map((park) => park.name)).toContain(
        (golden("parks-list-all.json") as { parks: Array<{ name: string }> }).parks[0]?.name,
      );
      const human = await harness.run(["parks", "list"], clearTransport);
      expect(human.stdout).toContain(text("parks-list-active.txt").trim());
      expect(human.stdout).toContain(text("parks-list-all.txt").trim());
    } finally {
      harness.dispose();
    }
  });
});

describe("GH-350 the budget park and its evidence appear in the parks golden", () => {
  const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
  const CONFIG = `provider:
  defaultChain: default
  entries:
    sub:
      class: subscription
    paid:
      class: pay-per-token
  chains:
    default:
      entries:
        - sub
      allowPaidFallback: true
  budgets:
    daily:
      enabled: true
      scope: window
      basis: cost
      ceiling: 40
      windowSeconds: 3600
      entries:
        - sub
`;

  test("the emitted park view equals the committed golden, evidence and state included", async () => {
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
    const root = makeTempRoot("provider-golden-budget");
    try {
      const store = openStore(makeIdentity(root)).store;
      const spendTotals: ProviderSpendTotalsPort = {
        read: async (input) => ({
          status: "measured",
          totals: input.scopes.map((scope) => ({
            scopeKey: scope.scopeKey,
            cost: 40,
            tokens: 0,
            newestAtMs: NOW - 60_000,
          })),
        }),
      };
      const program = createConfigProgram({
        workingName: "synthetic",
        environment: {},
        cwd: "/repo",
        homeDirectory: "/home/synthetic",
        platform: "linux",
        catalog,
        fs: {
          exists: (path) => path === "/repo/.synthetic/config.yaml",
          readText: (path) => {
            if (path !== "/repo/.synthetic/config.yaml") throw new Error("missing file");
            return CONFIG;
          },
        },
        repositoryIo: {
          exists: (path) => path === "/repo/.git",
          isFile: () => false,
          readText: () => "",
        },
        provider: {
          clock: { nowMs: () => NOW },
          credentialPort: { resolve: () => ({ ok: true, material: { value: "CANARY" } }) },
          transport: clearTransport,
          sleep: { sleep: async () => undefined },
          stateStore: store,
          newFenceToken: () => "fence-golden-budget",
          spendTotals,
          resolveWorkItemRef: () => ({ status: "resolved", workItemRef: "GH-350" }),
          workItemContextPath: "/repo/.ai/local/pm-context.yaml",
        },
      });
      if (!program.ok) throw new Error("provider golden program failed");
      const execute = async (args: readonly string[]) => {
        let stdout = "";
        let stderr = "";
        const deps: CliDependencies = {
          brand: program.brand,
          clock: { now: () => NOW },
          newRunId: () => "run-provider-golden-budget",
          secrets: program.secrets,
          program: program.program,
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
      const resolved = await execute(["resolve", "--json"]);
      expect(resolved.exitCode).toBe(0);
      const listed = await execute(["parks", "list", "--json"]);
      expect(listed.exitCode).toBe(0);
      const envelope = JSON.parse(listed.stdout) as { data: { parks: unknown[] } };
      expect(envelope.data.parks).toEqual(
        (golden("parks-list-budget.json") as { parks: unknown[] }).parks,
      );
      const human = await execute(["parks", "list"]);
      expect(human.stdout).toContain("budget-exhausted");
      expect(human.stdout).toContain("daily");
    } finally {
      removeRoot(root);
    }
  });
});
