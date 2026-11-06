/**
 * TC-MCP-002 / TC-MCP-004 / TC-MCP-006 / TC-MCP-007 / TC-MCP-010 — the error
 * payload contract: exactly the CLI error fields, the CLI-identical code, no
 * envelope leakage, and no protocol-invented field.
 */
import { describe, expect, test } from "bun:test";
import { assertFailurePair, assertSuccessPair } from "../fixtures/mcp/parity/assertions";
import { ALL_CASES } from "../fixtures/mcp/parity/cases";
import { envelopeLeaks } from "../fixtures/mcp/parity/harness";

const failureCases = ALL_CASES.filter((entry) => entry.expectation.kind === "failure");
const successCases = ALL_CASES.filter((entry) => entry.expectation.kind === "success");

describe("TC-MCP-002/004/006/007 failure payload contract", () => {
  test("the failure matrix is non-empty and covers all three tools", () => {
    expect(failureCases.length).toBeGreaterThanOrEqual(6);
    const tools = new Set(failureCases.map((entry) => entry.tool));
    expect(tools).toEqual(new Set(["status", "verify-artifact", "gate-report"]));
  });

  for (const parityCase of failureCases) {
    test(`${parityCase.id}: exact CLI error object and field set`, async () => {
      await assertFailurePair(parityCase);
      const mcp = await parityCase.runMcp();
      if (mcp.ok) throw new Error("expected a failure");
      for (const forbidden of ["message", "details", "data", "error"]) {
        expect(Object.hasOwn(mcp.error, forbidden)).toBe(false);
      }
      expect(envelopeLeaks(mcp.error)).toEqual([]);
    });
  }
});

describe("TC-MCP-010 no envelope leakage on success", () => {
  for (const parityCase of successCases) {
    test(`${parityCase.id}: no exitCode, runId, timing, or envelope wrapper`, async () => {
      await assertSuccessPair(parityCase);
      const mcp = await parityCase.runMcp();
      if (!mcp.ok) throw new Error("expected a success");
      expect(envelopeLeaks(mcp.data)).toEqual([]);
      expect(Object.hasOwn(mcp.data as object, "data")).toBe(false);
      expect(Object.hasOwn(mcp.data as object, "error")).toBe(false);
      expect((mcp.data as { schemaVersion?: string }).schemaVersion).not.toBe("delivery.result.v1");
    });
  }
});

describe("review F-1 thrown-runtime containment parity", () => {
  const containmentCases = ALL_CASES.filter((entry) => entry.id.endsWith("-containment"));

  test("every tool has a throwing-runtime parity case", () => {
    expect(new Set(containmentCases.map((entry) => entry.tool))).toEqual(
      new Set(["status", "verify-artifact", "gate-report"]),
    );
  });

  for (const parityCase of containmentCases) {
    test(`${parityCase.id}: a thrown read resolves to the CLI containment error`, async () => {
      // `callTool` must resolve, not reject: a rejection would reach the serve
      // loop as an unhandled crash (the review's empirical symptom).
      await expect(parityCase.runMcp()).resolves.toBeDefined();
      await assertFailurePair(parityCase);
      const mcp = await parityCase.runMcp();
      if (mcp.ok) throw new Error("expected a failure");
      expect(mcp.error.code).toBe("fallback.internal");
      expect(mcp.error.code).not.toBe("input.value.rejected");
    });
  }
});
