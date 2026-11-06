/**
 * TC-GH223-005 (declaration half), TC-GH223-008 (structure half),
 * TC-GH223-013 (contract half), TC-GH223-035 (contract half) — the runtime-
 * neutral audit vocabulary and its validated artifact boundary.
 */
import { describe, expect, test } from "bun:test";
import {
  AUDIT_ATTRIBUTION_KINDS,
  AUDIT_BOUNDARY_DECLARATION,
  AUDIT_CHAIN_ANCHOR,
  AUDIT_CHAIN_KEY_ARTIFACT_PREFIX,
  AUDIT_CHAIN_KEY_ARTIFACT_SUFFIX,
  AUDIT_CHAIN_KEY_BYTES,
  AUDIT_CHAIN_KEY_PAYLOAD_SCHEMA,
  AUDIT_IDENTITY_VARIABLE_SUFFIX,
  AUDIT_INVOCATION_FIELDS,
  AUDIT_INVOCATION_PAYLOAD_SCHEMA,
  AUDIT_INVOCATION_RECORD_KIND,
  AUDIT_OUTCOME_CLASSES,
  AUDIT_RECORD_KEY,
  AUDIT_RESERVATION_FIELDS,
  AUDIT_RESERVATION_PAYLOAD_SCHEMA,
  AUDIT_RESERVATION_RECORD_KIND,
  auditChainKeyArtifactName,
  auditIdentityVariableName,
  isAuditRecordKind,
} from "../../packages/core/src/contracts/index";

const INVOCATION_FIELD_NAMES = [
  "runId",
  "command",
  "arguments",
  "exitCode",
  "timing",
  "resultSchemaVersion",
  "outcomeClass",
  "scope",
  "repo",
  "startedAt",
  "auditSeq",
  "agentIdentity",
  "chainValue",
] as const;

describe("TC-GH223-005 audit vocabulary and boundary declaration", () => {
  test("record kinds, payload schemas, and the store-scoped key are pinned", () => {
    expect(AUDIT_INVOCATION_RECORD_KIND).toBe("audit.invocation");
    expect(AUDIT_RESERVATION_RECORD_KIND).toBe("audit.reservation");
    expect(AUDIT_INVOCATION_PAYLOAD_SCHEMA).toBe("delivery.audit.invocation.v1");
    expect(AUDIT_RESERVATION_PAYLOAD_SCHEMA).toBe("delivery.audit.reservation.v1");
    expect(AUDIT_RECORD_KEY).toBe("audit.invocations");
    expect(isAuditRecordKind(AUDIT_INVOCATION_RECORD_KIND)).toBe(true);
    expect(isAuditRecordKind(AUDIT_RESERVATION_RECORD_KIND)).toBe(true);
    expect(isAuditRecordKind("phase.transition")).toBe(false);
  });

  test("the invocation field set is the 13 audited fields in v1.4 order", () => {
    expect([...AUDIT_INVOCATION_FIELDS]).toEqual([...INVOCATION_FIELD_NAMES]);
    expect(AUDIT_INVOCATION_FIELDS).toHaveLength(13);
    expect(AUDIT_RESERVATION_FIELDS).toEqual(["auditSeq", "runId", "chainValue"]);
  });

  test("resultSchemaVersion is distinct from the invocation payload schema id", () => {
    expect(AUDIT_INVOCATION_FIELDS).toContain("resultSchemaVersion");
    expect(AUDIT_INVOCATION_FIELDS).not.toContain("schemaId");
    expect(AUDIT_INVOCATION_PAYLOAD_SCHEMA).not.toBe("delivery.result.v1");
  });

  test("the outcome vocabulary matches the exit projection taxonomy", () => {
    expect([...AUDIT_OUTCOME_CLASSES]).toEqual(["success", "user-validation", "platform-provider"]);
  });

  test("the claimed attribution marker is the only attribution kind", () => {
    expect([...AUDIT_ATTRIBUTION_KINDS]).toEqual(["claimed"]);
  });

  test("the boundary declares both kinds with schema identities and closed vocabularies", () => {
    expect(AUDIT_BOUNDARY_DECLARATION.recordKeyPrefix).toBe(AUDIT_RECORD_KEY);
    expect(AUDIT_BOUNDARY_DECLARATION.kinds).toHaveLength(2);

    const invocation = AUDIT_BOUNDARY_DECLARATION.kinds.find(
      (kind) => kind.kind === AUDIT_INVOCATION_RECORD_KIND,
    );
    const reservation = AUDIT_BOUNDARY_DECLARATION.kinds.find(
      (kind) => kind.kind === AUDIT_RESERVATION_RECORD_KIND,
    );
    expect(invocation).toBeDefined();
    expect(reservation).toBeDefined();
    if (invocation === undefined || reservation === undefined) return;

    expect(invocation.payloadSchema).toBe(AUDIT_INVOCATION_PAYLOAD_SCHEMA);
    expect(invocation.identityField).toBe("runId");
    expect(invocation.fields.map((field) => field.name)).toEqual([
      "schemaId",
      ...INVOCATION_FIELD_NAMES,
    ]);
    expect(invocation.vocabularies).toEqual([
      { field: "outcomeClass", values: [...AUDIT_OUTCOME_CLASSES] },
    ]);
    const repo = invocation.fields.find((field) => field.name === "repo");
    expect(repo).toMatchObject({ required: false, type: "string" });

    expect(reservation.payloadSchema).toBe(AUDIT_RESERVATION_PAYLOAD_SCHEMA);
    expect(reservation.fields.map((field) => field.name)).toEqual([
      "schemaId",
      "auditSeq",
      "runId",
      "chainValue",
    ]);
    for (const forbidden of [
      "arguments",
      "command",
      "exitCode",
      "outcomeClass",
      "scope",
      "repo",
      "startedAt",
      "agentIdentity",
    ]) {
      expect(reservation.fields.map((field) => field.name)).not.toContain(forbidden);
    }
  });

  test("the chain anchor and key-artifact vocabulary are declared", () => {
    expect(AUDIT_CHAIN_ANCHOR.length).toBeGreaterThan(0);
    expect(AUDIT_CHAIN_KEY_PAYLOAD_SCHEMA).toBe("delivery.audit.chain-key.v1");
    expect(AUDIT_CHAIN_KEY_BYTES).toBe(32);
    expect(AUDIT_CHAIN_KEY_ARTIFACT_PREFIX).toBe("chain-key.");
    expect(AUDIT_CHAIN_KEY_ARTIFACT_SUFFIX).toBe(".json");
  });

  test("startedAt is a declared numeric field (integer epoch ms at the wire)", () => {
    const invocation = AUDIT_BOUNDARY_DECLARATION.kinds.find(
      (kind) => kind.kind === AUDIT_INVOCATION_RECORD_KIND,
    );
    const startedAt = invocation?.fields.find((field) => field.name === "startedAt");
    expect(startedAt).toMatchObject({ type: "number", required: true });
  });
});

describe("TC-GH223-008 audit kinds are additive vocabulary", () => {
  test("both kinds live beside the existing state vocabulary without a new schema", () => {
    expect(AUDIT_INVOCATION_PAYLOAD_SCHEMA.startsWith("delivery.audit.")).toBe(true);
    expect(AUDIT_RESERVATION_PAYLOAD_SCHEMA.startsWith("delivery.audit.")).toBe(true);
    expect(AUDIT_INVOCATION_RECORD_KIND).not.toBe(AUDIT_RESERVATION_RECORD_KIND);
  });
});

describe("TC-GH223-013 seam-named identity variable", () => {
  test("the variable name is derived from the brand prefix plus the declared suffix", () => {
    expect(AUDIT_IDENTITY_VARIABLE_SUFFIX).toBe("AGENT_IDENTITY");
    expect(auditIdentityVariableName("EXAMPLE_PRODUCT_")).toBe("EXAMPLE_PRODUCT_AGENT_IDENTITY");
    expect(auditIdentityVariableName("OTHER_")).toBe("OTHER_AGENT_IDENTITY");
    expect(auditIdentityVariableName("EXAMPLE_PRODUCT_")).not.toBe(
      auditIdentityVariableName("OTHER_"),
    );
  });

  test("the identity suffix carries no product token", () => {
    expect(AUDIT_IDENTITY_VARIABLE_SUFFIX).toBe(AUDIT_IDENTITY_VARIABLE_SUFFIX.toUpperCase());
    expect(AUDIT_IDENTITY_VARIABLE_SUFFIX.toLowerCase()).not.toContain("ados");
  });

  test("the key artifact is a store-layout member named after the workspace", () => {
    expect(auditChainKeyArtifactName("workspace-a")).toBe("chain-key.workspace-a.json");
    expect(auditChainKeyArtifactName("workspace a")).toBe("chain-key.workspace%20a.json");
  });
});
