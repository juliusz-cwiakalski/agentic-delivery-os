/**
 * TC-PORT-003 / TC-PORT-004 runtime half — capability flags, explicit gaps,
 * declared-carrier selection, and the adapter-only metadata write path.
 */
import { describe, expect, test } from "bun:test";
import {
  ADAPTER_OPERATIONS,
  type AdapterCapabilityDeclaration,
  CARRIER_KINDS,
  type CommentWriteRequest,
} from "../../packages/core/src/contracts/index";
import {
  commentBlockOnlyAdapter,
  compactMarkerOnlyAdapter,
  customFieldOnlyAdapter,
  explicitGapOperations,
  fullAdapter,
  gappedAdapter,
  resolveOperation,
  selectDeclaredCarrier,
  UNSUPPORTED_OPERATION,
  validateCapabilityDeclaration,
  writeMetadata,
} from "../fixtures/ports/capabilities";

const writeRequest: CommentWriteRequest = {
  body: "A comment body",
  provenance: { producingAgent: "claude-code", operatorAuthority: "operator:juliusz" },
  delivery: { workItemRef: "GH-181", runId: "run-1" },
};

const partialWithoutGap: AdapterCapabilityDeclaration = {
  supportedOperations: ["read-work-item"],
  declaredGaps: [],
  writableCarriers: ["invisible-comment-block"],
  readableCarriers: ["invisible-comment-block"],
};

describe("TC-PORT-003 capability flags and explicit gaps", () => {
  test("fixture declarations are typed data with no prose-only capability", () => {
    for (const adapter of [
      fullAdapter,
      gappedAdapter,
      commentBlockOnlyAdapter,
      customFieldOnlyAdapter,
      compactMarkerOnlyAdapter,
    ]) {
      expect(validateCapabilityDeclaration(adapter.capabilities)).toEqual([]);
      for (const gap of adapter.capabilities.declaredGaps) {
        expect(typeof gap.operation).toBe("string");
        expect(typeof gap.reason).toBe("string");
      }
    }
  });

  test("an undeclared operation is an explicit gap, never a success", () => {
    const resolution = resolveOperation(partialWithoutGap, "write-work-item");
    expect(resolution.supported).toBe(false);
    if (!resolution.supported) {
      expect(resolution.gap).toEqual({
        operation: "write-work-item",
        reason: "undeclared-operation",
      });
    }
  });

  test("the gapped fixture records its declared gap explicitly", () => {
    const resolution = resolveOperation(gappedAdapter.capabilities, UNSUPPORTED_OPERATION);
    expect(resolution.supported).toBe(false);
    if (!resolution.supported) {
      expect("reason" in resolution.gap ? resolution.gap.reason : undefined).toBe(
        "adapter-not-implemented",
      );
    }
    expect(explicitGapOperations(gappedAdapter.capabilities)).toContain(UNSUPPORTED_OPERATION);
  });

  test("no declaration implies parity beyond its flags", () => {
    for (const adapter of [fullAdapter, gappedAdapter]) {
      const declared = new Set(adapter.capabilities.supportedOperations);
      for (const operation of ADAPTER_OPERATIONS) {
        const resolution = resolveOperation(adapter.capabilities, operation);
        expect(resolution.supported, operation).toBe(declared.has(operation));
      }
    }
  });

  test("removing a gap record removes the explicit representation", () => {
    const mutated: AdapterCapabilityDeclaration = {
      ...gappedAdapter.capabilities,
      declaredGaps: gappedAdapter.capabilities.declaredGaps.filter(
        (gap) => gap.operation !== UNSUPPORTED_OPERATION,
      ),
    };
    expect(explicitGapOperations(mutated)).not.toContain(UNSUPPORTED_OPERATION);
  });

  test("the fully declared positive control reports no gaps for declared operations", () => {
    expect(explicitGapOperations(fullAdapter.capabilities)).toEqual([]);
    for (const operation of fullAdapter.capabilities.supportedOperations) {
      expect(resolveOperation(fullAdapter.capabilities, operation).supported).toBe(true);
    }
  });
});

describe("TC-PORT-004 declared-carrier typing (runtime)", () => {
  test("every declared carrier is selectable and every undeclared one is a gap", () => {
    for (const adapter of [
      commentBlockOnlyAdapter,
      customFieldOnlyAdapter,
      compactMarkerOnlyAdapter,
    ]) {
      for (const carrier of CARRIER_KINDS) {
        const selection = selectDeclaredCarrier(adapter.capabilities.writableCarriers, carrier);
        if (adapter.capabilities.writableCarriers.includes(carrier)) {
          expect(selection.ok, `${adapter.adapterName} should select ${carrier}`).toBe(true);
          if (selection.ok) expect(selection.carrier).toBe(carrier);
        } else {
          expect(selection.ok, `${adapter.adapterName} must reject ${carrier}`).toBe(false);
        }
      }
    }
  });

  test("the write path uses only a declared carrier", () => {
    const declared = writeMetadata(
      commentBlockOnlyAdapter.capabilities,
      writeRequest,
      "invisible-comment-block",
    );
    expect(declared.ok).toBe(true);
    if (declared.ok) expect(declared.serialized.carrier).toBe("invisible-comment-block");

    const undeclared = writeMetadata(
      commentBlockOnlyAdapter.capabilities,
      writeRequest,
      "compact-marker",
    );
    expect(undeclared.ok).toBe(false);
    if (!undeclared.ok) expect(undeclared.gap.operation).toBe("write-comment");
  });
});
