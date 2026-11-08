/**
 * TC-TRUTH-006 (phase-2 pure-domain slice) — every unreadable ledger, tracker,
 * artifact, or state read derives `state-unverified` at projection class
 * platform-provider (exit 2), with the classified identity and a remediation
 * hint; it is never exit 0 and never silently `failed`.
 *
 * The record-level and window-level slices land with phases 3 and 6.
 */
import { describe, expect, test } from "bun:test";
import { deriveDispatchResult } from "../../packages/core/src/domain/dispatch-result";
import { ERROR_TABLE, type ErrorTableEntry } from "../../packages/core/src/contracts/index";
import { unreadableInputs } from "../fixtures/dispatch/truth";

const entries = ERROR_TABLE as readonly ErrorTableEntry[];

describe("TC-TRUTH-006 unreadable truth derives state-unverified", () => {
  test("each unreadable source derives state-unverified at platform-provider", () => {
    for (const { source, input } of unreadableInputs()) {
      const result = deriveDispatchResult(input);
      expect(result.token, source).toBe("state-unverified");
      expect(result.projectionClass, source).toBe("platform-provider");
      expect(result.outcome, source).toBe("failed");
      expect(result.errorCode, source).toBe("dispatch.state-unverified");
      expect(result.readFailure, source).toBe(source === "state" ? "state" : source);
      expect(result.lastMessage.length, source).toBeGreaterThan(0);
    }
  });

  test("the classified identity carries a remediation hint and platform category", () => {
    const row = entries.find((entry) => entry.code === "dispatch.state-unverified");
    expect(row).toBeDefined();
    expect(row?.category).toBe("platform");
    expect(row?.projectionClass).toBe("platform-provider");
    expect(row?.remediationHint.length).toBeGreaterThan(0);
  });

  test("an unreadable read never derives a success token or a projection class of success", () => {
    for (const { input } of unreadableInputs()) {
      const result = deriveDispatchResult(input);
      expect(result.token).not.toBe("finished");
      expect(result.token).not.toBe("pr-open");
      expect(result.projectionClass).not.toBe("success");
    }
  });
});
