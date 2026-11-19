/**
 * GH-354 F-5/F-6 — the closed contract surface is unchanged against a pinned
 * baseline (TC-CONTRACT-001, TC-NFR-002).
 *
 * Every surface is re-derived from the live modules and compared with the
 * literal pin, so an addition is a failure rather than a silent capture. The
 * change's own additions (the four payload shapes, the four discriminators, the
 * log-specific bounds) are asserted to be ADDITIVE and to appear nowhere in the
 * baselined lists.
 */
import { describe, expect, test } from "bun:test";
import {
  DISPATCH_LOG_MAX_HUMAN_BYTES,
  DISPATCH_LOG_MAX_HUMAN_LINES,
  DISPATCH_MAX_HUMAN_BYTES,
  DISPATCH_MAX_HUMAN_LINES,
  DISPATCH_OPERATOR_QUERIES,
  ERROR_TABLE,
  DELIVERY_RESULT_TAXONOMY,
} from "../../packages/core/src/contracts/index";
import {
  CONTRACT_BASELINE,
  captureLiveContract,
} from "../fixtures/dispatch/operator/contract-baseline";
import { BOUND_VALUES, DECLARED_BOUNDS } from "../fixtures/dispatch/operator/bounds";

describe("TC-CONTRACT the closed contract surface", () => {
  test("TC-CONTRACT-001 the closed surface is unchanged against the pinned baseline", () => {
    expect(captureLiveContract()).toEqual(CONTRACT_BASELINE);
  });

  test("TC-CONTRACT-001 the query answers project through the delivered rows", () => {
    const projectionOf = (code: string): string | undefined =>
      ERROR_TABLE.find((row) => row.code === code)?.projectionClass;
    // The two reused state rows keep their own projections.
    expect(projectionOf("state.store.torn")).toBe("platform-provider");
    expect(projectionOf("state.permission.denied")).toBe("user-validation");
    // The delivered token projections are untouched (state-unverified stays 2).
    const tokenProjection = (token: string): string | undefined =>
      DELIVERY_RESULT_TAXONOMY.find((row) => row.token === token)?.projectionClass;
    expect(tokenProjection("state-unverified")).toBe("platform-provider");
    expect(tokenProjection("pr-open")).toBe("success");
  });

  test("TC-CONTRACT-001 the change adds only payload shapes and log-specific bounds", () => {
    // The four discriminators are additive: no baseline list names one.
    expect([...DISPATCH_OPERATOR_QUERIES]).toEqual([
      "status",
      "log",
      "is-delivering",
      "last-message",
    ]);
    for (const query of DISPATCH_OPERATOR_QUERIES) {
      // A query is neither a harness operation nor a delivery-result token; the
      // domain-kind set is compared whole above, so no kind was added either.
      expect(CONTRACT_BASELINE.operations).not.toContain(query);
      expect(CONTRACT_BASELINE.tokens.map(([token]) => token)).not.toContain(query);
    }
    // No error-table row was added for a closed negative answer.
    for (const code of ["no-log", "capability-gap", "no-message", "session-unknown"]) {
      expect(ERROR_TABLE.some((row) => row.code === code)).toBe(false);
    }
    // The log bounds are their own constants, never the attempts bounds.
    expect(DISPATCH_LOG_MAX_HUMAN_LINES).toBe(200);
    expect(DISPATCH_LOG_MAX_HUMAN_BYTES).toBe(32768);
    expect(DISPATCH_MAX_HUMAN_LINES).toBe(40);
    expect(DISPATCH_MAX_HUMAN_BYTES).toBe(8192);
  });

  test("TC-NFR-002 every declared bound has exactly one home and no configuration key tunes it", () => {
    // The family bound is derived from the retained count, not a second literal.
    expect(BOUND_VALUES.familyBound).toBe(BOUND_VALUES.perFileCap * BOUND_VALUES.retainedFiles);
    for (const bound of DECLARED_BOUNDS) {
      expect(bound.home.startsWith("contracts/"), bound.name).toBe(true);
      expect(typeof bound.value, bound.name).toBe("number");
    }
    // The configuration key set contains no log, probe, or tail key.
    const keys = captureLiveContract().configurationKeyCount;
    expect(keys).toBe(CONTRACT_BASELINE.configurationKeyCount);
  });

  test("TC-NFR-002 the message bound reuses the delivered 512 constant", () => {
    expect(BOUND_VALUES.messageChars).toBe(512);
    // Its one home is the delivered dispatch contract, not a second 512.
    expect(DECLARED_BOUNDS.find((bound) => bound.name === "messageChars")?.home).toBe(
      "contracts/dispatch",
    );
  });
});
