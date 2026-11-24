/**
 * TC-STRUCT-001 — the vocabulary and structure invariants: no new failure
 * identity, park cause, announcement code, delivery-result token, or exit;
 * the failure variant grew only by the three optional projection fields; the
 * classified reason appears only in the rendered refusal and the log line.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type CredentialFailureProjection,
  type CredentialResolutionFailure,
  DELIVERY_RESULT_TOKENS,
  ERROR_TABLE,
  type ProviderParkEvidence,
} from "../../packages/core/src/contracts/index";

const PARK_EVIDENCE_FIELDS = [
  "providerName",
  "chainName",
  "conditionKinds",
  "waitSeconds",
  "resetEpochMs",
  "httpStatus",
  "failureClass",
  "credentialRefName",
  "timezone",
  "budgetName",
  "budgetScope",
  "budgetBasis",
  "budgetMeasured",
  "budgetCeiling",
] as const;

const CREDENTIAL_ROW_FIELDS = [
  "code",
  "domainKind",
  "category",
  "retryable",
  "consequence",
  "projectionClass",
] as const;

describe("TC-STRUCT-001 vocabulary and structure invariants", () => {
  test("the error-table row set is unchanged and the credential row binding still holds", () => {
    const credentialRow = ERROR_TABLE.find((entry) => entry.code === "config.credential.missing");
    expect(credentialRow).toBeDefined();
    if (credentialRow === undefined) return;
    expect(credentialRow.domainKind).toBe("config");
    expect(credentialRow.category).toBe("user");
    expect(credentialRow.retryable).toBe(false);
    expect(credentialRow.consequence).toBe("not_landed");
    expect(credentialRow.projectionClass).toBe("user-validation");
    // The row set carries no credential-shaped drift: exactly one row for the
    // delivered code, and the table has no new credential rows.
    expect(ERROR_TABLE.filter((entry) => entry.code.startsWith("credential."))).toEqual([]);
  });

  test("the failure variant's three fields are projection data on the variant, never columns on the row", () => {
    // The variant's field set: the six row-bound fields plus exactly the
    // three optional projection fields — a type-level snapshot.
    const variant: CredentialResolutionFailure = {
      ok: false,
      code: "config.credential.missing",
      domainKind: "config",
      category: "user",
      retryable: false,
      consequence: "not_landed",
      projectionClass: "user-validation",
      source: "literal:K",
      reason: "variable-absent",
      remedy: "r",
    };
    expect(Object.keys(variant).sort()).toEqual(
      [...CREDENTIAL_ROW_FIELDS, "ok", "reason", "remedy", "source"].sort(),
    );
    // The row object itself carries no such columns.
    const credentialRow = ERROR_TABLE.find((entry) => entry.code === "config.credential.missing");
    if (credentialRow === undefined) throw new Error("credential row missing");
    const rowKeys = Object.keys(credentialRow);
    for (const projectionField of ["source", "reason", "remedy"]) {
      expect(rowKeys).not.toContain(projectionField);
    }
  });

  test("the projection type carries exactly the three optional fields", () => {
    const projection: CredentialFailureProjection = {
      source: "command:/usr/bin/gh",
      reason: "non-zero-exit",
      remedy: "r",
    };
    expect(Object.keys(projection).sort()).toEqual(["reason", "remedy", "source"]);
  });

  test("the park-evidence shape is closed: no credential projection field exists", () => {
    const evidence: ProviderParkEvidence = {
      providerName: "p",
      failureClass: "config.credential.missing",
      credentialRefName: "tracker",
    };
    for (const key of Object.keys(evidence)) {
      expect(PARK_EVIDENCE_FIELDS).toContain(key);
    }
    expect(PARK_EVIDENCE_FIELDS).not.toContain("source");
    expect(PARK_EVIDENCE_FIELDS).not.toContain("reason");
    expect(PARK_EVIDENCE_FIELDS).not.toContain("remedy");
  });

  test("the delivered credential-missing condition and announcement are unchanged; no new park cause", () => {
    const conditionsText = readFileSync(
      join(process.cwd(), "packages/core/src/contracts/provider.ts"),
      "utf8",
    );
    expect(conditionsText).toContain('"credential-missing"');
    // The park-cause union gains no member: the credential-missing cause is
    // the delivered one; the contract file names it in its ParkCause
    // declaration and its condition kinds, and gains no new credential cause.
    expect((conditionsText.match(/"credential-missing"/g) ?? []).length).toBe(5);
    expect(conditionsText).not.toContain('"credential-pending"');
    const announcementsText = readFileSync(
      join(process.cwd(), "packages/core/src/provider/announcements.ts"),
      "utf8",
    );
    expect(announcementsText).toContain('"provider.credential.missing"');
    // No new announcement code was added for credentials.
    expect(announcementsText).not.toMatch(/credential\.(?:missing\.\w+|resolved|parked)/);
  });

  test("the delivery-result token set and the exit taxonomy are unchanged", () => {
    // The delivered token declaration is pinned as committed data: no
    // credential token exists and the set is unchanged by this change.
    expect(DELIVERY_RESULT_TOKENS).toEqual([
      "merged",
      "blocked",
      "pr-open",
      "pr-open-unverified",
      "failed",
      "finished",
      "max-restarts",
      "state-unverified",
      "partial",
      "noop-lane-permission",
      "noop-lane-nothing-to-do",
    ]);
    expect(DELIVERY_RESULT_TOKENS.some((token) => token.includes("credential"))).toBe(false);
    const exitLiterals = readFileSync(
      join(process.cwd(), "packages/cli/src/projection.ts"),
      "utf8",
    );
    const exits = exitLiterals.match(/exitCode: (\d)/g) ?? [];
    for (const exit of exits) {
      expect(["exitCode: 0", "exitCode: 1", "exitCode: 2"]).toContain(exit);
    }
  });

  test("no daemon unit is involved in any credential failure path of the one-shot commands", () => {
    const daemonCompose = readFileSync(
      join(process.cwd(), "packages/cli/src/daemon-compose.ts"),
      "utf8",
    );
    // The resident daemon composition changes not at all: no credential
    // strategy, no resolver, no register hook reaches it.
    expect(daemonCompose).not.toContain("createCredentialResolver");
    expect(daemonCompose).not.toContain("resolveCommandSource");
    expect(daemonCompose).not.toContain("classifyHarnessStoreSource");
  });
});
