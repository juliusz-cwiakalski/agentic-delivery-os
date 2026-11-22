/**
 * GH-346 TC-INST-105 — the source table declares the `install` kind and its
 * ten rows, each bound to a registered identity, with the kind closed at ten
 * and no family or wildcard. The documented and corpus halves live in the
 * extended delivered sync suites.
 */
import { describe, expect, test } from "bun:test";
import { classifyThrown, resolveAppErrorCode } from "../../packages/cli/src/classify";
import {
  DOMAIN_KINDS,
  ERROR_TABLE,
  EXACT_CODE_DOMAIN_KINDS,
} from "../../packages/core/src/contracts/error-table";
import { INSTALL_DOMAIN_CODES } from "../../packages/core/src/contracts/install";
import { RESERVED_TWO_SEGMENT_CODES } from "../../scripts/checks/error-table-sync";

const installRows = (ERROR_TABLE as readonly { domainKind: string; code: string }[]).filter(
  (entry) => entry.domainKind === "install",
) as readonly {
  readonly code: string;
  readonly category: string;
  readonly retryable: boolean;
  readonly consequence: string;
  readonly projectionClass: string;
  readonly remediationHint: string;
  readonly summary?: string;
}[];

describe("TC-INST-105 the source table declares the install kind and ten rows", () => {
  test("install is the last domain kind and requires an exact code", () => {
    expect(DOMAIN_KINDS.at(-1)).toBe("install");
    expect((EXACT_CODE_DOMAIN_KINDS as readonly string[]).includes("install")).toBe(true);
  });

  test("exactly the ten declared identities, in declaration order", () => {
    expect(installRows.map((row) => row.code)).toEqual([...INSTALL_DOMAIN_CODES]);
    expect(installRows).toHaveLength(10);
  });

  test("every row is user, non-retryable, not_landed, and user-validation", () => {
    for (const row of installRows) {
      expect({ code: row.code, category: row.category }).toEqual({
        code: row.code,
        category: "user",
      });
      expect({ code: row.code, retryable: row.retryable }).toEqual({
        code: row.code,
        retryable: false,
      });
      expect({ code: row.code, consequence: row.consequence }).toEqual({
        code: row.code,
        consequence: "not_landed",
      });
      expect({ code: row.code, projection: row.projectionClass }).toEqual({
        code: row.code,
        projection: "user-validation",
      });
      expect(row.remediationHint.length).toBeGreaterThan(0);
      expect((row.summary ?? "").length).toBeGreaterThan(0);
    }
  });

  test("the allowlist widens by exactly install.dev-build", () => {
    const installTwoSegment = installRows
      .map((row) => row.code)
      .filter((code) => code.split(".").length === 2);
    expect(installTwoSegment).toEqual(["install.dev-build"]);
    for (const code of installTwoSegment) {
      expect(RESERVED_TWO_SEGMENT_CODES.has(code)).toBe(true);
    }
  });

  test("every code resolves by exact code, and a kind-only install is contained", () => {
    for (const code of INSTALL_DOMAIN_CODES) {
      expect(resolveAppErrorCode(code).ok, code).toBe(true);
      expect(classifyThrown({ kind: "install", code }).code, code).toBe(code);
    }
    expect(classifyThrown({ kind: "install" }).code).toBe("fallback.internal");
    expect(classifyThrown({ kind: "install", code: "install.undeclared" }).code).toBe(
      "fallback.internal",
    );
  });

  test("the kind is closed: an eleventh row or a family widening fails the exact-set comparison", () => {
    const compare = (codes: readonly string[]): string[] =>
      codes.length === INSTALL_DOMAIN_CODES.length &&
      codes.every((code, index) => code === INSTALL_DOMAIN_CODES[index])
        ? []
        : ["the install kind is not exactly the ten declared rows"];
    expect(compare(installRows.map((row) => row.code))).toEqual([]);
    expect(compare([...INSTALL_DOMAIN_CODES, "install.extra"])).not.toEqual([]);
    expect(compare([...INSTALL_DOMAIN_CODES].slice(0, 9))).not.toEqual([]);
    expect(INSTALL_DOMAIN_CODES.some((code) => code.includes("*"))).toBe(false);
  });
});
