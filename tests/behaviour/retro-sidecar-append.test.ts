/**
 * TC-RETRO-008 / TC-RETRO-009 / TC-RETRO-019 — the sidecar record shape,
 * append-only addenda, and the single collector fence.
 */
import { describe, expect, test } from "bun:test";
import { statSync } from "node:fs";
import { RETRO_CHAIN_VALUE_HEX_LENGTH } from "../../packages/core/src/contracts/index";
import { createRetroSidecar } from "../../packages/core/src/state/index";
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
      "appendBatch",
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

type Draft = {
  readonly traceId: string;
  readonly level: "change";
  readonly source: "pm-notes";
  readonly windowStart: number;
  readonly windowEnd: number;
  readonly collectedAt: number;
  readonly payloadRefs: readonly string[];
  readonly payloadSchemaId: string;
};

const batchDraft = (traceId: string, note: string): Draft => ({
  traceId,
  level: "change",
  source: "pm-notes",
  windowStart: NOW_MS - 1000,
  windowEnd: NOW_MS,
  collectedAt: NOW_MS,
  payloadRefs: [`note:${note}`],
  payloadSchemaId: "delivery.retro.evidence.v1",
});

describe("TC-RETRO-019 batched collector append", () => {
  test("one fence, one verified read, and one append land a whole run", () => {
    const fixture = makeRetroDir("append-batch");
    appendEvidence(fixture);
    const before = readSidecarBytes(fixture);
    const evidenceReads: string[] = [];
    const evidenceAppends: string[] = [];
    const lockCreates: string[] = [];
    const sidecar = createRetroSidecar({
      ...fixture.io,
      readText: (path) => {
        evidenceReads.push(path);
        return fixture.io.readText(path);
      },
      appendText: (path, text) => {
        evidenceAppends.push(path);
        fixture.io.appendText(path, text);
      },
      createExclusive: (path, text) => {
        if (path === fixture.sidecar.lockPath) lockCreates.push(path);
        return fixture.io.createExclusive(path, text);
      },
    });
    const result = sidecar.appendBatch(
      [batchDraft("ev-b1", "a"), batchDraft("ev-b2", "b"), batchDraft("ev-b3", "c")],
      { fenceToken: "batch-1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(3);
    expect(evidenceReads.filter((path) => path === fixture.sidecar.evidencePath)).toHaveLength(1);
    expect(evidenceAppends.filter((path) => path === fixture.sidecar.evidencePath)).toHaveLength(1);
    expect(lockCreates).toHaveLength(1);
    const after = readSidecarBytes(fixture);
    expect(after.subarray(0, before.length).equals(before)).toBe(true);
    const read = sidecar.read();
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.records).toHaveLength(4);
    expect(read.value.chain.verified).toBe(true);
  });

  test("a duplicate trace id refuses before any write", () => {
    const fixture = makeRetroDir("append-batch-duplicate");
    const before = readSidecarBytes(fixture);
    const duplicated = fixture.sidecar.appendBatch(
      [batchDraft("ev-dup", "a"), batchDraft("ev-dup", "b")],
      { fenceToken: "batch-dup" },
    );
    expect(duplicated.ok).toBe(false);
    if (!duplicated.ok) expect(duplicated.error.code).toBe("input.value.rejected");
    expect(readSidecarBytes(fixture).equals(before)).toBe(true);
    expect(sidecarLines(fixture)).toEqual([]);

    expect(fixture.sidecar.append(batchDraft("ev-first", "a")).ok).toBe(true);
    const existing = fixture.sidecar.appendBatch([batchDraft("ev-first", "b")], {
      fenceToken: "batch-existing",
    });
    expect(existing.ok).toBe(false);
    if (!existing.ok) expect(existing.error.code).toBe("input.value.rejected");
  });

  test("an existing malformed entry refuses the batch without appending", () => {
    const fixture = makeRetroDir("append-batch-malformed");
    appendEvidence(fixture);
    const lines = sidecarLines(fixture);
    const record = JSON.parse(lines[0] as string) as Record<string, unknown>;
    delete record.traceId;
    lines[0] = JSON.stringify(record);
    fixture.io.writeText(fixture.sidecar.evidencePath, `${lines.join("\n")}\n`);
    const before = readSidecarBytes(fixture);
    const result = fixture.sidecar.appendBatch([batchDraft("ev-b1", "a")], {
      fenceToken: "batch-malformed",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("retro.evidence.malformed-entry");
    expect(readSidecarBytes(fixture).equals(before)).toBe(true);
  });

  test("a held fence refuses the batch", () => {
    const fixture = makeRetroDir("append-batch-fence");
    expect(
      fixture.io.createExclusive(
        fixture.sidecar.lockPath,
        `${JSON.stringify({ token: "held" })}\n`,
      ),
    ).toBe(true);
    try {
      const result = fixture.sidecar.appendBatch([batchDraft("ev-b1", "a")], {
        fenceToken: "batch-busy",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("state.lock.busy");
    } finally {
      fixture.io.removeFile(fixture.sidecar.lockPath);
    }
  });
});
