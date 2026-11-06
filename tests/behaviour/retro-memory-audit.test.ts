/**
 * TC-RETRO-060 — the periodic memory-audit trigger is registered as a
 * `retro.trigger` entry, its runs are recorded as evidence, and no memory-audit
 * command or procedure body exists.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RETRO_MEMORY_AUDIT_TRIGGER_CADENCE,
  RETRO_MEMORY_AUDIT_TRIGGER_NAME,
  type RetroRunRecord,
} from "../../packages/core/src/contracts/index";
import { recordMemoryAuditRun, reportRetro } from "../../packages/core/src/domain/retro";
import {
  readRetroRegistry,
  readRetroTriggers,
  recordRetroRun,
  seedRetroRegistry,
} from "../../packages/core/src/state/index";
import {
  makeRetroDir,
  NOW_MS,
  newTraceId,
  type RetroFixture,
  reportDeps,
} from "../fixtures/retro/harness";

const auditRun = (runId: string): RetroRunRecord => ({
  schemaId: "delivery.retro.run.v1",
  runId,
  level: "change",
  mode: "report",
  scope: "GH-232",
  counts: { collected: 0, malformed: 0, skippedSource: 0 },
  consumed: [],
  truth: { clean: true, blocking: null, checks: [] },
});

const seed = (fixture: RetroFixture, runId: string): void => {
  fixture.scriptDeliveryChanges([
    {
      changeRef: "GH-232",
      completedAt: "2026-11-06T12:00:00Z",
      transitions: [],
    },
  ]);
  expect(seedRetroRegistry(fixture.store, "seed").ok).toBe(true);
  expect(recordRetroRun(fixture.store, auditRun(runId), "run-writer").ok).toBe(true);
};

describe("TC-RETRO-060 memory-audit trigger and run evidence", () => {
  test("the trigger is a registered retro.trigger entry with the declared cadence", () => {
    const fixture = makeRetroDir("memory-trigger");
    seed(fixture, "run-memory-1");
    const registry = readRetroRegistry(fixture.store);
    expect(registry.ok).toBe(true);
    if (!registry.ok) return;
    const trigger = readRetroTriggers(registry.value).find(
      (entry) => entry.name === RETRO_MEMORY_AUDIT_TRIGGER_NAME,
    );
    expect(trigger).toMatchObject({
      kind: "schedule",
      cadence: RETRO_MEMORY_AUDIT_TRIGGER_CADENCE,
    });
  });

  test("a recorded run carries trigger identity, window, outcome refs and trace ids and is queryable through report", () => {
    const fixture = makeRetroDir("memory-run");
    seed(fixture, "run-memory-2");
    const records = recordMemoryAuditRun(
      {
        sidecar: fixture.sidecar,
        newTraceId,
        newFenceToken: () => "memory-fence",
        clock: { nowMs: () => NOW_MS },
        level: "change",
      },
      {
        triggerIdentity: RETRO_MEMORY_AUDIT_TRIGGER_NAME,
        windowStart: NOW_MS - 1000,
        windowEnd: NOW_MS,
        outcomeRefs: ["outcome-1", "outcome-2"],
        runId: "run-memory-2",
      },
    );
    expect(records).toHaveLength(2);
    expect(records.map((record) => record.traceId)).toEqual(["ev-0001", "ev-0002"]);
    for (const record of records) {
      expect(record.payloadSchemaId).toBe("delivery.retro.memory-audit.v1");
      expect(record.payloadRefs).toContain("trigger:memory-audit");
      expect(record.payloadRefs).toContain("run:run-memory-2");
    }
    const report = reportRetro(reportDeps(fixture));
    expect(report.ok).toBe(true);
    if (report.ok && "evidenceRefs" in report.data) {
      for (const record of records) expect(report.data.evidenceRefs).toContain(record.traceId);
    }
  });

  test("no memory-audit command and no procedure body exist", () => {
    const commandFiles = readdirSync(join(process.cwd(), "packages/cli/src/commands"));
    expect(commandFiles.includes("memory-audit.ts")).toBe(false);
    const index = readFileSync(join(process.cwd(), "packages/cli/src/commands/index.ts"), "utf8");
    expect(index).not.toContain("memory-audit");
    const sourceFiles = readdirSync(join(process.cwd(), "packages/core/src/domain")).filter(
      (name) => name.endsWith(".ts"),
    );
    for (const name of sourceFiles) {
      const text = readFileSync(join(process.cwd(), "packages/core/src/domain", name), "utf8");
      expect(text).not.toContain("memory consolidation procedure");
      expect(text).not.toContain("promote lessons");
    }
  });
});
