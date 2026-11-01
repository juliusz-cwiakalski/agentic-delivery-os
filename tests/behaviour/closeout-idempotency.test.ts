/**
 * TC-CLOSE-018 (identity/SHA-256 half; ledger half is Phase 3) — the pure
 * SHA-256 implementation, the fixed canonical closeout tuple, known-answer
 * vectors, capability-context sensitivity, and first-terminal folding.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  type CloseoutOperationIdentityInputs,
  type CloseoutOperationRecord,
} from "../../packages/core/src/contracts/index";
import {
  canonicalCloseoutJson,
  deriveCloseoutOperationId,
  foldCloseoutOutcomes,
} from "../../packages/core/src/domain/closeout";
import { sha256Hex } from "../../packages/core/src/domain/sha256";

/** The committed fixed canonical identity tuple (regeneration note in the plan). */
const FIXED_INPUTS: CloseoutOperationIdentityInputs = {
  workspaceId: "workspace-a",
  workItemRef: "GH-183",
  engine: "github",
  capabilityContext: "supported",
  operation: "write-work-item",
  arguments: { add: ["delivered"] },
  target: { systemName: "github", entityId: "183" },
};

const FIXED_CANONICAL_JSON =
  '{"arguments":{"add":["delivered"]},"capabilityContext":"supported","engine":"github","operation":"write-work-item","target":{"entityId":"183","systemName":"github"},"workItemRef":"GH-183","workspaceId":"workspace-a"}';

/** Independently reproduced with `node:crypto` over FIXED_CANONICAL_JSON. */
const FIXED_DIGEST = "cf914e3a077d61ae936467baaa5a59fa26b41d5370928d8c8ff2cedf80dc00b7";

const KAT_EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const KAT_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

const recordFor = (
  inputs: CloseoutOperationIdentityInputs,
  outcome: CloseoutOperationRecord["outcome"],
): CloseoutOperationRecord => ({
  schemaId: "delivery.closeout.operation.v1",
  operationId: deriveCloseoutOperationId(inputs),
  workItemRef: inputs.workItemRef,
  engine: inputs.engine,
  capabilityContext: inputs.capabilityContext,
  operation: inputs.operation,
  arguments: inputs.arguments,
  target: inputs.target,
  outcome,
  evidence: [],
  timestamp: "2026-11-01T00:00:00Z",
});

describe("TC-CLOSE-018 SHA-256 algorithm evidence", () => {
  test("known-answer vectors pass", () => {
    expect(sha256Hex("")).toBe(KAT_EMPTY);
    expect(sha256Hex("abc")).toBe(KAT_ABC);
  });

  test("the fixed canonical tuple matches the committed digest and node:crypto", () => {
    expect(canonicalCloseoutJson(FIXED_INPUTS)).toBe(FIXED_CANONICAL_JSON);
    expect(deriveCloseoutOperationId(FIXED_INPUTS)).toBe(FIXED_DIGEST);
    expect(
      createHash("sha256").update(FIXED_CANONICAL_JSON).digest("hex"),
    ).toBe(FIXED_DIGEST);
  });

  test("randomized inputs agree with node:crypto", () => {
    for (const input of ["", "a", "abc", "GH-183", "closeout", "x".repeat(1000), "żółć"]) {
      expect(sha256Hex(input)).toBe(createHash("sha256").update(input).digest("hex"));
    }
  });

  test("the identity is 64 lowercase hex and changes with every input", () => {
    const base = deriveCloseoutOperationId(FIXED_INPUTS);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    const variants: CloseoutOperationIdentityInputs[] = [
      { ...FIXED_INPUTS, workspaceId: "workspace-b" },
      { ...FIXED_INPUTS, workItemRef: "GH-184" },
      { ...FIXED_INPUTS, engine: "jira" },
      { ...FIXED_INPUTS, operation: "transition-work-item" },
      { ...FIXED_INPUTS, arguments: { add: ["change"] } },
      { ...FIXED_INPUTS, target: { systemName: "github", entityId: "184" } },
      { ...FIXED_INPUTS, capabilityContext: "adapter-not-implemented" },
    ];
    for (const variant of variants) {
      expect(deriveCloseoutOperationId(variant)).not.toBe(base);
    }
    expect(deriveCloseoutOperationId(FIXED_INPUTS)).toBe(base);
  });
});

describe("TC-CLOSE-018 first-terminal folding", () => {
  test("the first terminal outcome per operationId is authoritative", () => {
    const applied = recordFor(FIXED_INPUTS, "applied");
    const satisfied = recordFor(FIXED_INPUTS, "satisfied");
    const folded = foldCloseoutOutcomes([applied, satisfied]);
    expect(folded[applied.operationId]?.outcome).toBe("applied");
  });

  test("a failed outcome is retained as evidence only until a terminal outcome lands", () => {
    const failed = recordFor(FIXED_INPUTS, "failed");
    const foldedFailed = foldCloseoutOutcomes([failed]);
    expect(foldedFailed[failed.operationId]?.outcome).toBe("failed");
    const applied = recordFor(FIXED_INPUTS, "applied");
    const folded = foldCloseoutOutcomes([failed, applied]);
    expect(folded[failed.operationId]?.outcome).toBe("applied");
  });
});
