/**
 * TC-SPEND-032 — read-only execution: zero state writes, zero fences, zero
 * child processes, zero network and zero credential resolution on every path,
 * with the audit seam composed unchanged.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { A04 } from "../fixtures/spend/cases";
import {
  ledgerBytes,
  ledgerDigest,
  makeIdentity,
  makeSessionRecord,
  makeTempRoot,
  openStore,
  removeRoot,
  runSpendCli,
  SPEND_REF,
  seedSpend,
  spendRuntimeOver,
  tokens,
} from "../fixtures/spend/harness";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const seeded = (
  label: string,
  seed = { records: [makeSessionRecord({ runId: "run-R1", tokens: tokens({ input: 10 }) })] },
) => {
  const root = makeTempRoot(`gh236-readonly-${label}`);
  const identity = makeIdentity(root);
  const { store } = openStore(identity);
  seedSpend(store, seed);
  return { root, identity, store };
};

describe("TC-SPEND-032 read-only execution", () => {
  test("every success and failure path leaves the ledger bytes unchanged", async () => {
    const { root, identity, store } = seeded("paths", A04.seed);
    try {
      const before = ledgerBytes(identity);
      const digestBefore = ledgerDigest(identity);
      for (const argv of [
        ["spend", "--ref", SPEND_REF],
        ["--json", "spend", "--ref", SPEND_REF],
        ["spend", "--ref", SPEND_REF, "--amplification"],
        ["spend", "--ref", SPEND_REF, "--phase", "specification"],
        ["spend", "--ref", "GH-404"],
        ["spend", "--ref", "gh-236"],
      ]) {
        await runSpendCli(argv, spendRuntimeOver(store));
        expect(ledgerDigest(identity), argv.join(" ")).toBe(digestBefore);
        expect(ledgerBytes(identity).equals(before), argv.join(" ")).toBe(true);
      }
    } finally {
      removeRoot(root);
    }
  });

  test("the fence, append and salvage members are never reached", async () => {
    const { root, store } = seeded("members");
    try {
      const calls: string[] = [];
      const wrapped = {
        ...store,
        acquireFence: (token: string) => {
          calls.push("acquireFence");
          return store.acquireFence(token);
        },
        append: (...args: Parameters<typeof store.append>) => {
          calls.push("append");
          return store.append(...args);
        },
        salvage: (...args: Parameters<typeof store.salvage>) => {
          calls.push("salvage");
          return store.salvage(...args);
        },
      };
      const run = await runSpendCli(["spend", "--ref", SPEND_REF], spendRuntimeOver(wrapped));
      expect(run.exitCode).toBe(0);
      expect(calls).toEqual([]);
    } finally {
      removeRoot(root);
    }
  });

  test("no spawn, network or credential surface is reachable from the command path", () => {
    const command = readFileSync(join(process.cwd(), "packages/cli/src/commands/spend.ts"), "utf8");
    const edge = readFileSync(join(process.cwd(), "packages/cli/src/edge.ts"), "utf8");
    for (const forbidden of ["child_process", "spawnSync(", "fetch(", "resolveCredential"]) {
      expect(command, forbidden).not.toContain(forbidden);
    }
    const factory = edge.slice(edge.indexOf("export const createSpendCommandRuntime"));
    expect(factory).not.toContain("acquireFence");
    expect(factory).not.toContain("spawn");
    expect(factory).not.toContain("credential");
    expect(factory).toContain("readSpendLedger");
  });

  test("an injected audit seam receives its record unchanged", async () => {
    const { root, store } = seeded("audit");
    try {
      const records: unknown[] = [];
      const run = await runSpendCli(["spend", "--ref", SPEND_REF], spendRuntimeOver(store), {
        audit: {
          scope: "workspace-a",
          record: (facts) => {
            records.push(facts);
            return { ok: true };
          },
        },
      });
      expect(run.exitCode).toBe(0);
      expect(records).toHaveLength(1);
      const facts = records[0];
      if (!isRecord(facts)) throw new Error("audit facts missing");
      expect(facts.command).toBe("spend");
      expect(facts.exitCode).toBe(0);
    } finally {
      removeRoot(root);
    }
  });

  test("an audit write failure is a diagnostic that never changes the outcome", async () => {
    const { root, store } = seeded("audit-failure");
    try {
      const run = await runSpendCli(["spend", "--ref", SPEND_REF], spendRuntimeOver(store), {
        audit: { scope: "workspace-a", record: () => ({ ok: false, code: "state.write.failed" }) },
      });
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toContain("spend");
      expect(run.stderr).toContain("state.write.failed");
    } finally {
      removeRoot(root);
    }
  });
});
