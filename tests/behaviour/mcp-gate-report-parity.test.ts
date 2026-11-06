/**
 * TC-MCP-007 — gate-report success and failure parity across all-pass,
 * definitive fail, unavailable evidence, and classified unknowns.
 *
 * The CLI `verify gates` runs in process and is the oracle. The success report
 * carries the five cited verdicts in the contract's fixed order.
 */
import { describe, expect, test } from "bun:test";
import { VERIFY_GATES_GATE_ORDER } from "../../packages/core/src/contracts/index";
import {
  assertFailurePair,
  assertMutationControl,
  assertSuccessPair,
} from "../fixtures/mcp/parity/assertions";
import { GATE_CASES } from "../fixtures/mcp/parity/cases";

const successCases = GATE_CASES.filter((entry) => entry.expectation.kind === "success");
const failureCases = GATE_CASES.filter((entry) => entry.expectation.kind === "failure");

describe("TC-MCP-007 gate-report parity", () => {
  test("the declared case floor is met before iterating", () => {
    expect(GATE_CASES.length).toBeGreaterThanOrEqual(4);
    expect(successCases.length).toBeGreaterThanOrEqual(1);
    expect(failureCases.length).toBeGreaterThanOrEqual(3);
  });

  for (const parityCase of successCases) {
    test(`${parityCase.id}: CLI, MCP, and golden agree`, async () => {
      await assertSuccessPair(parityCase);
      assertMutationControl(parityCase);
    });
  }

  test("the success report carries five cited verdicts in fixed order", async () => {
    for (const parityCase of successCases) {
      const mcp = await parityCase.runMcp();
      if (!mcp.ok) throw new Error(`${parityCase.id} unexpectedly failed`);
      const data = mcp.data as {
        schemaVersion?: string;
        target?: string;
        overall?: string;
        summary?: { gates?: number };
        gates?: Array<{ id?: string }>;
      };
      expect(data.schemaVersion).toBe("delivery.verify-gates.v1");
      expect(data.target).toBe("gates");
      expect(data.overall).toBe("pass");
      expect(data.summary?.gates).toBe(5);
      expect(data.gates?.map((gate) => gate.id)).toEqual([...VERIFY_GATES_GATE_ORDER]);
    }
  });

  for (const parityCase of failureCases) {
    test(`${parityCase.id}: deep-equals the CLI error and invents no pass verdict`, async () => {
      await assertFailurePair(parityCase);
      const mcp = await parityCase.runMcp();
      if (mcp.ok) throw new Error("expected a failure");
      expect(Object.hasOwn(mcp.error, "gates")).toBe(false);
      expect(Object.hasOwn(mcp.error, "overall")).toBe(false);
    });
  }
});
