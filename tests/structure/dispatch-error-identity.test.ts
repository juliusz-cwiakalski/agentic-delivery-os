/**
 * TC-ERR-003 (phase 1) — the dispatch kind carries exactly four identities: the
 * two delivered economics rows unchanged, plus `dispatch.session.spawn-failed`
 * and `dispatch.state-unverified`. Exact-code resolution is the only path; a
 * kind-only discriminant never silently picks one row.
 */
import { describe, expect, test } from "bun:test";
import { classifyDomainKind, resolveAppErrorCode } from "../../packages/cli/src/classify";
import {
  DOMAIN_KINDS,
  ERROR_TABLE,
  EXACT_CODE_DOMAIN_KINDS,
  type ErrorTableEntry,
  FALLBACK_INTERNAL_CODE,
} from "../../packages/core/src/contracts/index";

const entries = ERROR_TABLE as readonly ErrorTableEntry[];

const DELIVERED_ROWS = [
  {
    code: "dispatch.restart-budget-exceeded",
    domainKind: "dispatch",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Request a fresh restart budget through the coordinator or operator, then retry the resume.",
    projectionClass: "user-validation",
    summary: "The delivery's restart budget is exhausted.",
  },
  {
    code: "dispatch.resume-uneconomical",
    domainKind: "dispatch",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Change the harness capability to attach-and-continue, or re-evaluate and accept the prefill re-pay cost, then retry the resume.",
    projectionClass: "user-validation",
    summary: "The resume path would re-pay prefill and is uneconomical.",
  },
] as const;

const NEW_ROWS = [
  {
    code: "dispatch.session.spawn-failed",
    domainKind: "dispatch",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Inspect the harness selection and execution environment, then retry the dispatch; no session was created and the attempt stays recorded.",
    projectionClass: "user-validation",
    summary: "The harness or process failed before a session existed.",
  },
  {
    code: "dispatch.state-unverified",
    domainKind: "dispatch",
    category: "platform",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Repair the named unreadable ledger, tracker, artifact, or state read and re-run the dispatch; a verdict requires readable truth.",
    projectionClass: "platform-provider",
    summary: "Dispatch truth could not be read, so no verdict was derived.",
  },
] as const;

describe("TC-ERR-003 dispatch error identities", () => {
  test("dispatch declares exactly four rows in order after the queue kind", () => {
    expect(DOMAIN_KINDS).toContain("dispatch");
    const dispatch = entries.filter((entry) => entry.domainKind === "dispatch");
    expect(dispatch).toHaveLength(4);
    expect(dispatch.map((entry) => entry.code)).toEqual([
      ...DELIVERED_ROWS.map((row) => row.code),
      ...NEW_ROWS.map((row) => row.code),
    ]);
  });

  test("the two delivered economics rows are byte-identical to their prior declaration", () => {
    for (const expected of DELIVERED_ROWS) {
      expect(entries.find((entry) => entry.code === expected.code)).toEqual(expected);
    }
  });

  test("the two new rows carry their declared identity, category, consequence, and projection", () => {
    for (const expected of NEW_ROWS) {
      expect(resolveAppErrorCode(expected.code)).toEqual({ ok: true, entry: expected });
      expect(classifyDomainKind("dispatch", expected.code)).toEqual(expected);
    }
  });

  test("exact-code resolution returns exactly one row and rejects a wrong kind", () => {
    for (const row of [...DELIVERED_ROWS, ...NEW_ROWS]) {
      const resolved = resolveAppErrorCode(row.code);
      expect(resolved.ok).toBe(true);
      if (resolved.ok) expect(resolved.entry.code).toBe(row.code);
    }
    expect(() => classifyDomainKind("dispatch", "state.store.torn")).toThrow();
    expect(() => classifyDomainKind("dispatch", "dispatch.unknown")).toThrow();
  });

  test("kind-only dispatch resolution never picks one of four rows", () => {
    expect(() => classifyDomainKind("dispatch")).toThrow();
    expect(EXACT_CODE_DOMAIN_KINDS).not.toContain("dispatch");
    expect(FALLBACK_INTERNAL_CODE).toBe("fallback.internal");
  });

  test("the two new identities are the only dispatch additions", () => {
    const codes = entries
      .filter((entry) => entry.domainKind === "dispatch")
      .map((entry) => entry.code);
    expect(codes.filter((code) => !DELIVERED_ROWS.some((row) => row.code === code))).toEqual([
      "dispatch.session.spawn-failed",
      "dispatch.state-unverified",
    ]);
  });
});
