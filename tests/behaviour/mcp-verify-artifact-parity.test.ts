/**
 * TC-MCP-005 / TC-MCP-006 — verify-artifact success parity across full, LITE,
 * and partial ledgers; failure parity across every dominant identity.
 *
 * The CLI `verify change` runs in process and is the oracle. Every failure
 * deep-equals the CLI error object, not just the code.
 */
import { describe, expect, test } from "bun:test";
import {
  assertFailurePair,
  assertMutationControl,
  assertSuccessPair,
} from "../fixtures/mcp/parity/assertions";
import { VERIFY_CASES } from "../fixtures/mcp/parity/cases";

const successCases = VERIFY_CASES.filter((entry) => entry.expectation.kind === "success");
const failureCases = VERIFY_CASES.filter((entry) => entry.expectation.kind === "failure");

const expectedCodes = (): string[] =>
  failureCases.map((entry) => (entry.expectation.kind === "failure" ? entry.expectation.code : ""));

describe("TC-MCP-005 verify-artifact success parity", () => {
  test("the declared case floor is met before iterating", () => {
    expect(VERIFY_CASES.length).toBeGreaterThanOrEqual(8);
    expect(successCases.length).toBeGreaterThanOrEqual(4);
  });

  for (const parityCase of successCases) {
    test(`${parityCase.id}: CLI, MCP, and golden agree`, async () => {
      await assertSuccessPair(parityCase);
      assertMutationControl(parityCase);
    });
  }

  test("success data carries the verify-change shape", async () => {
    for (const parityCase of successCases) {
      const mcp = await parityCase.runMcp();
      if (!mcp.ok) throw new Error(`${parityCase.id} unexpectedly failed`);
      const data = mcp.data as Record<string, unknown>;
      expect(data.target).toBe("change");
      expect(data.result).toBe("finished");
      expect(Array.isArray(data.requiredPhases)).toBe(true);
      expect(Array.isArray(data.completedPhases)).toBe(true);
      expect(data.schemaVersion).toBeUndefined();
    }
  });
});

describe("TC-MCP-006 verify-artifact failure parity", () => {
  test("the dominant identities are all represented", () => {
    const codes = new Set(expectedCodes());
    for (const code of [
      "lint.target.missing",
      "lint.notes.malformed",
      "lint.variant.unknown",
      "lint.phases.incomplete",
      "verify.ledger.incomplete",
    ]) {
      expect(codes.has(code)).toBe(true);
    }
    expect([...codes].some((code) => code.startsWith("state."))).toBe(true);
    expect(codes.size).toBeGreaterThanOrEqual(6);
  });

  for (const parityCase of failureCases) {
    test(`${parityCase.id}: deep-equals the CLI error`, async () => {
      await assertFailurePair(parityCase);
    });
  }
});
