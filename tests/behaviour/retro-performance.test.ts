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
import {
  auditOutcome,
  auditRecord,
  collectDeps,
  makeRetroDir,
  NOW_MS,
  sidecarLines,
  transitionRecord,
} from "../fixtures/retro/harness";

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

type PathCounter = {
  readonly io: RetroSidecarIo;
  readonly reads: string[];
  readonly appends: string[];
};

const pathCounter = (io: RetroSidecarIo): PathCounter => {
  const reads: string[] = [];
  const appends: string[] = [];
  return {
    reads,
    appends,
    io: {
      ...io,
      readText: (path) => {
        reads.push(path);
        return io.readText(path);
      },
      appendText: (path, text) => {
        appends.push(path);
        io.appendText(path, text);
      },
    },
  };
};

const seedSidecar = (
  fixture: ReturnType<typeof makeRetroDir>,
  count: number,
  keyHex = "d".repeat(64),
): void => {
  fixture.io.writeText(
    fixture.sidecar.keyPath,
    `${JSON.stringify({ schemaId: RETRO_CHAIN_KEY_PAYLOAD_SCHEMA, key: keyHex })}\n`,
  );
  fixture.io.applyPermissions(fixture.sidecar.keyPath, "file");
  const lines: string[] = [];
  let previous = "retro.chain.anchor.v1";
  for (let index = 1; index <= count; index += 1) {
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
};

const seedCollection = (fixture: ReturnType<typeof makeRetroDir>, auditCount: number): void => {
  fixture.scriptDeliveryChanges([
    {
      changeRef: "GH-232",
      completedAt: "2026-11-06T12:00:00Z",
      transitions: [transitionRecord({ changeRef: "GH-232" })],
    },
  ]);
  fixture.scriptAudit(
    auditOutcome({
      records: Array.from({ length: auditCount }, (_, index) =>
        auditRecord({ runId: `audit-${String(index)}`, auditSeq: index + 1 }),
      ),
    }),
  );
  fixture.scriptStateFamilies("GH-232", {
    transitions: [transitionRecord({ changeRef: "GH-232" })],
    closeouts: [{ outcome: "complete" }],
    telemetry: [],
  });
  fixture.scriptNotes("GH-232", { retroNotes: ["note"] });
};

describe("TC-RETRO-061 bounded work on a 10,000-record sidecar", () => {
  test("one chain walk per read; declared timeouts; no per-record extra read", () => {
    const fixture = makeRetroDir("performance-bounded");
    seedSidecar(fixture, 10_000);

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
    seedCollection(fixture, 0);
    fixture.scriptNotes("GH-232", { retroNotes: ["one", "two", "three"] });
    const counter = counterIo(fixture.io);
    const { collectRetro } = await import("../../packages/core/src/domain/retro");
    const result = collectRetro(
      collectDeps({
        ...fixture,
        sidecar: createRetroSidecar(counter.io),
        io: counter.io,
      }),
    );
    expect(result.ok).toBe(true);
    const appended = sidecarLines(fixture).length;
    expect(counter.appends.length).toBe(1);
    expect(appended).toBeGreaterThan(0);
  });

  test("batched collection keeps ONE verified sidecar read and ONE append at 10 and 10,000 records", async () => {
    const { collectRetro } = await import("../../packages/core/src/domain/retro");
    const observations: Array<{
      count: number;
      reads: number;
      appends: number;
      elapsedMs: number;
    }> = [];
    for (const count of [10, 10_000]) {
      const fixture = makeRetroDir(`performance-collect-${String(count)}`);
      seedSidecar(fixture, count);
      seedCollection(fixture, 1000);
      const counter = pathCounter(fixture.io);
      const started = performance.now();
      const result = collectRetro(
        collectDeps(fixture, { sidecar: createRetroSidecar(counter.io) }),
      );
      const elapsed = performance.now() - started;
      expect(result.ok).toBe(true);
      const evidenceReads = counter.reads.filter(
        (path) => path === fixture.sidecar.evidencePath,
      ).length;
      const evidenceAppends = counter.appends.filter(
        (path) => path === fixture.sidecar.evidencePath,
      ).length;
      expect(evidenceReads).toBe(1);
      expect(evidenceAppends).toBe(1);
      expect(sidecarLines(fixture).length).toBeGreaterThan(count);
      observations.push({
        count,
        reads: evidenceReads,
        appends: evidenceAppends,
        elapsedMs: elapsed,
      });
      console.log(
        `retro-performance reference: collect on ${String(count)} records in ${elapsed.toFixed(1)} ms (reads=${String(evidenceReads)}, appends=${String(evidenceAppends)})`,
      );
    }
    expect(observations.map((entry) => entry.reads)).toEqual([1, 1]);
    expect(observations.map((entry) => entry.appends)).toEqual([1, 1]);
  });
});
