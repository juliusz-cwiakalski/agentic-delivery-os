/**
 * TC-RETRO-008 / TC-RETRO-009 / TC-RETRO-019 — the sidecar record shape,
 * append-only addenda, and the single collector fence.
 */
import { describe, expect, test } from "bun:test";
import { statSync } from "node:fs";
import { RETRO_CHAIN_VALUE_HEX_LENGTH } from "../../packages/core/src/contracts/index";
import {
  appendEvidence,
  makeRetroDir,
  NOW_MS,
  readSidecarBytes,
  sidecarLines,
} from "../fixtures/retro/harness";

describe("TC-RETRO-008 sidecar record shape", () => {
  test("one record per append with the full field set and unique ev- trace ids", () => {
    const fixture = makeRetroDir("append-shape");
    const first = appendEvidence(fixture);
    const second = appendEvidence(fixture, { source: "audit-ledger" });
    const read = fixture.sidecar.read();
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.records).toHaveLength(2);
    expect([first.traceId, second.traceId]).toEqual(["ev-0001", "ev-0002"]);
    expect(new Set(read.value.records.map((record) => record.traceId)).size).toBe(2);
    for (const record of read.value.records) {
      expect(record.schemaId).toBe("delivery.retro.evidence.v1");
      expect(record.traceId.startsWith("ev-")).toBe(true);
      expect(record.level).toBe("change");
      expect(record.windowStart).toBeLessThanOrEqual(record.windowEnd);
      expect(record.collectedAt).toBe(NOW_MS);
      expect(Array.isArray(record.payloadRefs)).toBe(true);
      expect(record.payloadSchemaId.length).toBeGreaterThan(0);
      expect(record.chainValue).toMatch(new RegExp(`^[0-9a-f]{${RETRO_CHAIN_VALUE_HEX_LENGTH}}$`));
    }
    expect(read.value.chain.verified).toBe(true);
    expect(read.value.chain.records).toBe(2);
    expect(read.value.chain.anchor).toBe("retro.chain.anchor.v1");
  });

  test("the sidecar surface exposes only collector append and verified reads", () => {
    const fixture = makeRetroDir("append-surface");
    expect(Object.keys(fixture.sidecar).sort()).toEqual([
      "append",
      "evidencePath",
      "keyPath",
      "lockPath",
      "read",
      "verify",
    ]);
    for (const forbidden of ["update", "delete", "reorder", "compact", "remove"]) {
      expect(forbidden in fixture.sidecar).toBe(false);
    }
  });
});

describe("TC-RETRO-009 append-only addenda", () => {
  test("a second append preserves the byte prefix and reads mutate nothing", () => {
    const fixture = makeRetroDir("append-addendum");
    appendEvidence(fixture);
    const before = readSidecarBytes(fixture);
    appendEvidence(fixture, { payloadRefs: ["note:addendum"] });
    const after = readSidecarBytes(fixture);
    expect(after.subarray(0, before.length).equals(before)).toBe(true);
    expect(after.length).toBeGreaterThan(before.length);
    const read = fixture.sidecar.read();
    const readMtime = statSync(fixture.sidecar.evidencePath).mtimeMs;
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.records).toHaveLength(2);
    expect(readSidecarBytes(fixture).equals(after)).toBe(true);
    expect(readMtime).toBe(statSync(fixture.sidecar.evidencePath).mtimeMs);
  });
});

describe("TC-RETRO-019 collector fence", () => {
  test("an armed fence makes a concurrent append busy without interleaving", () => {
    const fixture = makeRetroDir("append-fence");
    appendEvidence(fixture);
    const held = fixture.io.createExclusive(
      fixture.sidecar.lockPath,
      `${JSON.stringify({ token: "held" })}\n`,
    );
    expect(held).toBe(true);
    const blocked = fixture.sidecar.append({
      traceId: "ev-held",
      level: "change",
      source: "pm-notes",
      windowStart: NOW_MS - 10,
      windowEnd: NOW_MS,
      collectedAt: NOW_MS,
      payloadRefs: ["note:held"],
      payloadSchemaId: "delivery.retro.evidence.v1",
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.code).toBe("state.lock.busy");
    const read = fixture.sidecar.read();
    expect(read.ok && read.value.records).toHaveLength(1);
    fixture.io.removeFile(fixture.sidecar.lockPath);
    appendEvidence(fixture, { payloadRefs: ["note:after"] });
    const after = fixture.sidecar.read();
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.value.records).toHaveLength(2);
    expect(after.value.chain.verified).toBe(true);
    expect(sidecarLines(fixture)).toHaveLength(2);
  });

  test("reads never acquire the fence", () => {
    const fixture = makeRetroDir("append-fence-read");
    appendEvidence(fixture);
    fixture.io.createExclusive(fixture.sidecar.lockPath, `${JSON.stringify({ token: "x" })}\n`);
    try {
      const read = fixture.sidecar.read();
      expect(read.ok).toBe(true);
    } finally {
      fixture.io.removeFile(fixture.sidecar.lockPath);
    }
  });
});
