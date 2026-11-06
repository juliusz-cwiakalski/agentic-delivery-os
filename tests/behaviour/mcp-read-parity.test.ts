/**
 * TC-MCP-008 — read parity, replay determinism, and interleaved-call identity.
 *
 * Both surfaces read exactly the same members in the same order; a fresh run
 * replays byte-identically; two independent calls run concurrently without
 * asserting an interleaving policy (GAP-T2).
 */
import { describe, expect, test } from "bun:test";
import { canonicalBytes, canonicalJson } from "../fixtures/mcp/parity/canonical";
import { ALL_CASES, GATE_CASES, STATUS_CASES, VERIFY_CASES } from "../fixtures/mcp/parity/cases";
import type { CaseOutcome } from "../fixtures/mcp/parity/harness";

const outcomeJson = (outcome: CaseOutcome): string =>
  canonicalJson(outcome.ok ? outcome.data : outcome.error);

describe("TC-MCP-008 read parity and determinism", () => {
  test("the case set is non-empty and covers all three tools", () => {
    expect(ALL_CASES.length).toBeGreaterThanOrEqual(17);
    expect(new Set(ALL_CASES.map((entry) => entry.tool))).toEqual(
      new Set(["status", "verify-artifact", "gate-report"]),
    );
  });

  for (const parityCase of ALL_CASES) {
    test(`${parityCase.id}: identical ordered read-member sequence`, async () => {
      const cliReads = await parityCase.readsCli();
      const mcpReads = await parityCase.readsMcp();
      expect(mcpReads).toEqual(cliReads);
      expect(mcpReads.filter((member) => !cliReads.includes(member))).toEqual([]);
    });

    test(`${parityCase.id}: replay is byte-identical and bounded by the CLI`, async () => {
      const cliFirst = await parityCase.runCli();
      const cliSecond = await parityCase.runCli();
      const mcpFirst = await parityCase.runMcp();
      const mcpSecond = await parityCase.runMcp();
      expect(outcomeJson(cliFirst)).toBe(outcomeJson(cliSecond));
      expect(outcomeJson(mcpFirst)).toBe(outcomeJson(mcpSecond));
      expect(outcomeJson(mcpFirst)).toBe(outcomeJson(cliFirst));
      const cliValue = cliFirst.ok ? cliFirst.data : cliFirst.error;
      const mcpValue = mcpFirst.ok ? mcpFirst.data : mcpFirst.error;
      expect(canonicalBytes(mcpValue)).toBeLessThanOrEqual(canonicalBytes(cliValue));
    });
  }

  test("two independent cases run concurrently equal their sequential baselines", async () => {
    const first = STATUS_CASES[0];
    const second = GATE_CASES[0];
    const third = VERIFY_CASES[0];
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error("missing parity cases");
    }
    const sequential = [await first.runMcp(), await second.runMcp(), await third.runMcp()].map(
      outcomeJson,
    );
    const concurrent = (await Promise.all([first.runMcp(), second.runMcp(), third.runMcp()])).map(
      outcomeJson,
    );
    expect(concurrent).toEqual(sequential);
  });
});
