/**
 * TC-TRUTH-006 (phase-2 pure-domain slice) — an UNDECIDABLE truth derives
 * `state-unverified` at projection class platform-provider (exit 2), with the
 * classified identity and a remediation hint; it is never exit 0 and never
 * silently `failed`.
 *
 * DELIVERED EXPECTATION UPDATE (GH-347 AC-F4-3; §8.5 "a decisive artifact
 * survives an unreadable tracker"; the phase ledger's role narrows to the
 * resume position): an unreadable LEDGER no longer gates the token, and an
 * unreadable TRACKER does not degrade a decisive artifact. Only an undecidable
 * truth — an unreadable artifact read with no tracker verdict, or an unreadable
 * harness/state read — is `state-unverified`. The two decisive-artifact rows
 * are asserted below with their clause.
 */
import { describe, expect, test } from "bun:test";
import { deriveDispatchResult } from "../../packages/core/src/domain/dispatch-result";
import { ERROR_TABLE, type ErrorTableEntry } from "../../packages/core/src/contracts/index";
import { unreadableInputs } from "../fixtures/dispatch/truth";

const entries = ERROR_TABLE as readonly ErrorTableEntry[];

const UNDECIDABLE_SOURCES = new Set(["artifact", "state"]);

describe("TC-TRUTH-006 unreadable truth derives state-unverified", () => {
  test("an undecidable truth derives state-unverified at platform-provider", () => {
    for (const { source, input } of unreadableInputs()) {
      if (!UNDECIDABLE_SOURCES.has(source)) continue;
      const result = deriveDispatchResult(input);
      expect(result.token, source).toBe("state-unverified");
      expect(result.projectionClass, source).toBe("platform-provider");
      expect(result.outcome, source).toBe("failed");
      expect(result.errorCode, source).toBe("dispatch.state-unverified");
      expect(result.readFailure, source).toBe(source === "state" ? "state" : source);
      expect(result.lastMessage.length, source).toBeGreaterThan(0);
    }
  });

  test("a decisive artifact survives an unreadable tracker or ledger (AC-F4-3, §8.5)", () => {
    for (const { source, input } of unreadableInputs()) {
      if (UNDECIDABLE_SOURCES.has(source)) continue;
      const result = deriveDispatchResult(input);
      expect(result.token, source).toBe("pr-open");
      expect(result.projectionClass, source).toBe("success");
    }
  });

  test("the classified identity carries a remediation hint and platform category", () => {
    const row = entries.find((entry) => entry.code === "dispatch.state-unverified");
    expect(row).toBeDefined();
    expect(row?.category).toBe("platform");
    expect(row?.projectionClass).toBe("platform-provider");
    expect(row?.remediationHint.length).toBeGreaterThan(0);
  });

  test("an undecidable read never derives a success token or a projection class of success", () => {
    for (const { source, input } of unreadableInputs()) {
      if (!UNDECIDABLE_SOURCES.has(source)) continue;
      const result = deriveDispatchResult(input);
      expect(result.token, source).not.toBe("finished");
      expect(result.token, source).not.toBe("pr-open");
      expect(result.projectionClass, source).not.toBe("success");
    }
  });
});
