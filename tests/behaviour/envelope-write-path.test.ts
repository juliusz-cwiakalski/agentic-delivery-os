/**
 * TC-META-005 behaviour half — agents construct primitive views; only adapters
 * select a declared carrier and write the envelope.
 */
import { describe, expect, test } from "bun:test";
import { parseEnvelope } from "../../packages/adapters/src/io/envelope-codec";
import {
  type CommentWriteRequest,
  ENVELOPE_KINDS,
  ENVELOPE_SCHEMA_ID,
} from "../../packages/core/src/contracts/index";
import {
  commentBlockOnlyAdapter,
  customFieldOnlyAdapter,
  envelopeForRequest,
  writeMetadata,
} from "../fixtures/ports/capabilities";
import { readComment } from "../fixtures/ports/comment-adapter";

const request: CommentWriteRequest = {
  body: "Agent-authored comment",
  provenance: { producingAgent: "claude-code", operatorAuthority: "operator:juliusz" },
  delivery: { workItemRef: "GH-181", runId: "run-1" },
};

describe("TC-META-005 adapter-only write path", () => {
  test("the agent-facing request has no carrier, marker, or serializer field", () => {
    expect(Object.keys(request).sort()).toEqual(["body", "delivery", "provenance"]);
    const text = JSON.stringify(request);
    expect(text).not.toContain(ENVELOPE_SCHEMA_ID);
    expect(text).not.toContain("carrier");
    expect(text).not.toContain("marker");
  });

  test("the adapter writes through a declared carrier", () => {
    const written = writeMetadata(
      commentBlockOnlyAdapter.capabilities,
      request,
      "invisible-comment-block",
    );
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    expect(written.serialized.carrier).toBe("invisible-comment-block");
    if (written.serialized.carrier === "provider-custom-field") return;
    expect(written.serialized.text).toContain(request.body);
    const parsed = parseEnvelope({
      carrier: "invisible-comment-block",
      text: written.serialized.text,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.envelope.schema).toBe(ENVELOPE_SCHEMA_ID);
      expect(parsed.envelope.kind).toBe(ENVELOPE_KINDS[0]);
      expect(parsed.humanContent).toBe(request.body);
    }
  });

  test("an undeclared carrier is rejected as a declared gap", () => {
    const written = writeMetadata(
      customFieldOnlyAdapter.capabilities,
      request,
      "invisible-comment-block",
    );
    expect(written.ok).toBe(false);
    if (!written.ok) {
      expect(written.gap.operation).toBe("write-comment");
      expect(written.gap.reason).toBe("plan-restriction");
    }
  });

  test("the read view never exposes the raw carrier on the normal path", () => {
    const envelope = envelopeForRequest(request);
    const parsed = parseEnvelope({
      carrier: "provider-custom-field",
      fieldValue: JSON.stringify(envelope),
    });
    expect(parsed).not.toHaveProperty("raw");
    const view = readComment({
      carrier: "provider-custom-field",
      fieldValue: JSON.stringify(envelope),
      account: "operator:fixture",
    });
    expect(Object.keys(view).sort()).toEqual(["body", "provenance"]);
  });
});
