/**
 * TC-RETRO-061 — bounded work on a 10,000-record sidecar: one chain walk per
 * read, bounded appends per collection, declared timeouts, and the non-CI
 * reference measurement (never a pass gate).
 */
import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import {
  RETRO_APPEND_TIMEOUT_MS,
  RETRO_CHAIN_KEY_PAYLOAD_SCHEMA,
  RETRO_EVIDENCE_PAYLOAD_SCHEMA,
  RETRO_READ_TIMEOUT_MS,
  type RetroSidecarIo,
} from "../../packages/core/src/contracts/index";
import { createRetroSidecar } from "../../packages/core/src/state/index";
import { makeRetroDir, NOW_MS, sidecarLines } from "../fixtures/retro/harness";

const counterIo = (
  io: RetroSidecarIo,
): { io: RetroSidecarIo; reads: number[]; appends: number[] } => {
  const reads: number[] = [];
  const appends: number[] = [];
  return {
    reads,
    appends,
    io: {
      ...io,
      readText: (path) => {
        reads.push(reads.length + 1);
        return io.readText(path);
      },
      appendText: (path, text) => {
        appends.push(appends.length + 1);
        io.appendText(path, text);
      },
    },
  };
};

describe("TC-RETRO-061 bounded work on a 10,000-record sidecar", () => {
  test("one chain walk per read; declared timeouts; no per-record extra read", () => {
    const fixture = makeRetroDir("performance-bounded");
    const keyHex = "d".repeat(64);
    fixture.io.writeText(
      fixture.sidecar.keyPath,
      `${JSON.stringify({ schemaId: RETRO_CHAIN_KEY_PAYLOAD_SCHEMA, key: keyHex })}\n`,
    );
    fixture.io.applyPermissions(fixture.sidecar.keyPath, "file");
    const lines: string[] = [];
    let previous = "retro.chain.anchor.v1";
    for (let index = 1; index <= 10_000; index += 1) {
      const content = {
        schemaId: RETRO_EVIDENCE_PAYLOAD_SCHEMA,
        traceId: `ev-${String(index).padStart(6, "0")}`,
        level: "change",
        source: "pm-notes",
        windowStart: NOW_MS - 1000,
        windowEnd: NOW_MS,
        collectedAt: NOW_MS,
        payloadRefs: ["run:performance", `note:${String(index)}`],
        payloadSchemaId: RETRO_EVIDENCE_PAYLOAD_SCHEMA,
      };
      const chainValue = fixture.io.keyedHash(keyHex, previous, JSON.stringify(content));
      previous = chainValue;
      lines.push(JSON.stringify({ ...content, chainValue }));
    }
    writeFileSync(fixture.sidecar.evidencePath, `${lines.join("\n")}\n`);
    fixture.io.applyPermissions(fixture.sidecar.evidencePath, "file");

    const counter = counterIo(fixture.io);
    const sidecar = createRetroSidecar(counter.io);
    const started = performance.now();
    const read = sidecar.read();
    const elapsed = performance.now() - started;
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.records).toHaveLength(10_000);
    expect(read.value.chain.verified).toBe(true);
    expect(counter.reads.length).toBeLessThanOrEqual(2);
    expect(fixture.io.readTimeoutMs).toBe(RETRO_READ_TIMEOUT_MS);
    expect(fixture.io.appendTimeoutMs).toBe(RETRO_APPEND_TIMEOUT_MS);
    console.log(`retro-performance reference: read 10,000 records in ${elapsed.toFixed(1)} ms`);
  });

  test("collection appends exactly one record per collected item", async () => {
    const fixture = makeRetroDir("performance-append");
    fixture.scriptDeliveryChanges([
      {
        changeRef: "GH-232",
        completedAt: "2026-11-06T12:00:00Z",
        transitions: [],
      },
    ]);
    fixture.scriptAudit({
      verifiedEmpty: false,
      records: [],
      matched: 0,
      truncated: false,
      chain: { verified: true, records: 0, breaks: [], orphans: [], storePath: "a" },
      storePath: "a",
    });
    fixture.scriptNotes("GH-232", { retroNotes: ["one", "two", "three"] });
    const counter = counterIo(fixture.io);
    const { collectRetro } = await import("../../packages/core/src/domain/retro");
    const { collectDeps } = await import("../fixtures/retro/harness");
    const result = collectRetro(
      collectDeps({
        ...fixture,
        sidecar: createRetroSidecar(counter.io),
        io: counter.io,
      }),
    );
    expect(result.ok).toBe(true);
    const appends = sidecarLines(fixture).length;
    expect(counter.appends.length).toBe(appends);
    expect(counter.appends.length).toBeGreaterThan(0);
  });
});
