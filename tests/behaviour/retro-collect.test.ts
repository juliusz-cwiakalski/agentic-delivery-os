/**
 * TC-RETRO-015 / TC-RETRO-016 / TC-RETRO-017 / TC-RETRO-018 — automatic target
 * selection, the explicit no-target outcome, GET-only bounded collection,
 * verbatim audit findings, and additive run records.
 */
import { describe, expect, test } from "bun:test";
import {
  RETRO_AUDIT_READ_LIMIT,
  RETRO_TARGET_ORDER,
  type RetroChangeFacts,
  type RetroRunRecord,
} from "../../packages/core/src/contracts/index";
import { collectRetro } from "../../packages/core/src/domain/retro";
import {
  readRetroRegistry,
  readRetroRuns,
  recordRetroRun,
} from "../../packages/core/src/state/index";
import {
  auditOutcome,
  auditRecord,
  collectDeps,
  makeRetroDir,
  type RetroFixture,
  readSidecarBytes,
  sidecarLines,
  transitionRecord,
} from "../fixtures/retro/harness";

const change = (changeRef: string, completedAt?: string): RetroChangeFacts => ({
  changeRef,
  ...(completedAt === undefined ? {} : { completedAt }),
  transitions: [
    transitionRecord({
      changeRef,
      ...(completedAt === undefined ? {} : { timestamp: completedAt }),
    }),
  ],
});

const run = (scope: string): RetroRunRecord => ({
  schemaId: "delivery.retro.run.v1",
  runId: `run-seed-${scope}`,
  level: "change",
  mode: "collect",
  scope,
  counts: { collected: 1, malformed: 0, skippedSource: 0 },
  consumed: [],
  truth: { clean: true, blocking: null, checks: [] },
});

const seedSources = (fixture: RetroFixture, ref: string): void => {
  fixture.scriptAudit(auditOutcome({ records: [auditRecord({ runId: `audit-${ref}` })] }));
  fixture.scriptStateFamilies(ref, {
    transitions: [transitionRecord({ changeRef: ref })],
    closeouts: [{ outcome: "complete" }],
    telemetry: [{ commitSha: "a".repeat(40) }],
  });
  fixture.scriptNotes(ref, { retroNotes: [`retro note for ${ref}`] });
};

describe("TC-RETRO-015 target selection and no-target", () => {
  test("omitted level selects the most recent completed change not yet collected", () => {
    const fixture = makeRetroDir("collect-target");
    fixture.scriptDeliveryChanges([
      change("GH-1", "2026-11-06T10:00:00Z"),
      change("GH-2", "2026-11-06T11:00:00Z"),
      change("GH-3", "2026-11-06T12:00:00Z"),
      change("GH-4"),
    ]);
    expect(recordRetroRun(fixture.store, run("GH-1"), "seed-run").ok).toBe(true);
    seedSources(fixture, "GH-3");
    const result = collectRetro(collectDeps(fixture));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      level: "change",
      outcome: "collected",
      selection: { state: "selected", changeRef: "GH-3" },
    });
    const registry = readRetroRegistry(fixture.store);
    expect(registry.ok).toBe(true);
    if (registry.ok) {
      expect(readRetroRuns(registry.value).map((entry) => entry.scope)).toEqual(["GH-1", "GH-3"]);
    }
  });

  test("the deterministic tiebreak is completion DESC then ref ASC", () => {
    const fixture = makeRetroDir("collect-tie");
    fixture.scriptDeliveryChanges([
      change("GH-2", "2026-11-06T12:00:00Z"),
      change("GH-1", "2026-11-06T12:00:00Z"),
    ]);
    seedSources(fixture, "GH-1");
    const result = collectRetro(collectDeps(fixture));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({ selection: { changeRef: "GH-1" } });
    }
    expect(RETRO_TARGET_ORDER).toBe("completion-desc-ref-asc");
  });

  test("all-collected is an explicit no-target success with zero sidecar appends and no run record", () => {
    const fixture = makeRetroDir("collect-no-target");
    fixture.scriptDeliveryChanges([change("GH-1", "2026-11-06T12:00:00Z")]);
    expect(recordRetroRun(fixture.store, run("GH-1"), "seed-run").ok).toBe(true);
    const beforeBytes = readSidecarBytes(fixture);
    const beforeRuns = (() => {
      const registry = readRetroRegistry(fixture.store);
      return registry.ok ? readRetroRuns(registry.value).length : -1;
    })();
    const result = collectRetro(collectDeps(fixture));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      outcome: "no-target",
      selection: { state: "empty" },
      counts: { collected: 0, malformed: 0, skippedSource: 0 },
    });
    expect(readSidecarBytes(fixture).equals(beforeBytes)).toBe(true);
    const registry = readRetroRegistry(fixture.store);
    if (registry.ok) expect(readRetroRuns(registry.value).length).toBe(beforeRuns);
  });

  test("re-collecting an already-collected scope appends an addendum without rewriting", () => {
    const fixture = makeRetroDir("collect-addendum");
    fixture.scriptDeliveryChanges([change("GH-3", "2026-11-06T12:00:00Z")]);
    seedSources(fixture, "GH-3");
    const first = collectRetro(collectDeps(fixture));
    expect(first.ok).toBe(true);
    const prefix = readSidecarBytes(fixture);
    const second = collectRetro(collectDeps(fixture, { target: "GH-3" }));
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.data).toMatchObject({ outcome: "collected" });
    const after = readSidecarBytes(fixture);
    expect(after.subarray(0, prefix.length).equals(prefix)).toBe(true);
    expect(after.length).toBeGreaterThan(prefix.length);
  });
});

describe("TC-RETRO-016 GET-only bounded collection", () => {
  test("the audit read is bounded with recorded filters and each source read once", () => {
    const fixture = makeRetroDir("collect-get-only");
    fixture.scriptDeliveryChanges([change("GH-3", "2026-11-06T12:00:00Z")]);
    seedSources(fixture, "GH-3");
    const familyReadsBefore = fixture.stateFamilyReads.length;
    const noteReadsBefore = fixture.noteReads.length;
    const result = collectRetro(collectDeps(fixture));
    expect(result.ok).toBe(true);
    expect(fixture.auditQueries).toHaveLength(1);
    expect(fixture.auditQueries[0]?.limit).toBe(RETRO_AUDIT_READ_LIMIT);
    expect(fixture.auditQueries[0]?.limit).toBeGreaterThan(0);
    expect(fixture.auditQueries[0]?.from).toBeLessThanOrEqual(fixture.auditQueries[0]?.to ?? 0);
    expect(fixture.stateFamilyReads.length - familyReadsBefore).toBe(1);
    expect(fixture.noteReads.length - noteReadsBefore).toBe(1);
  });
});

describe("TC-RETRO-017 audit findings and chain verdict carried verbatim", () => {
  test("orphans and the full chain verdict travel into evidence and the run record", () => {
    const fixture = makeRetroDir("collect-audit-verdict");
    fixture.scriptDeliveryChanges([change("GH-3", "2026-11-06T12:00:00Z")]);
    fixture.scriptAudit(
      auditOutcome({
        records: [auditRecord({ runId: "audit-a", auditSeq: 1 })],
        orphans: [
          { auditSeq: 7, runId: "orphan-a", position: 2 },
          { auditSeq: 9, runId: "orphan-b", position: 3 },
        ],
        verified: false,
        truncated: true,
      }),
    );
    fixture.scriptStateFamilies("GH-3", {
      transitions: [transitionRecord({ changeRef: "GH-3" })],
      closeouts: [{ outcome: "complete" }],
      telemetry: [],
    });
    fixture.scriptNotes("GH-3", { retroNotes: ["note"] });
    const result = collectRetro(collectDeps(fixture));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("retro.evidence.tamper-flagged");
    const registry = readRetroRegistry(fixture.store);
    expect(registry.ok).toBe(true);
    if (!registry.ok) return;
    const recorded = readRetroRuns(registry.value);
    const auditRun = recorded[recorded.length - 1];
    expect(auditRun).toBeDefined();
    if (auditRun === undefined) return;
    expect(auditRun.truth.clean).toBe(false);
    expect(auditRun.truth.blocking).toBe("retro.evidence.tamper-flagged");
    const auditConsumed = auditRun.consumed.find((entry) => entry.source === "audit-ledger");
    expect(auditConsumed).toMatchObject({ verified: false, truncated: true, records: 1 });
    const lines = sidecarLines(fixture);
    const orphanRefs = lines
      .map((line) => JSON.parse(line) as { payloadRefs?: readonly string[] })
      .flatMap((record) => record.payloadRefs ?? []);
    expect(orphanRefs).toContain("audit-seq:7");
    expect(orphanRefs).toContain("audit-seq:9");
    expect(orphanRefs).toContain("orphan-run:orphan-a");
    expect(orphanRefs).toContain("verified:false");
  });

  test("the clean control carries a verified verdict and exits success", () => {
    const fixture = makeRetroDir("collect-audit-clean");
    fixture.scriptDeliveryChanges([change("GH-3", "2026-11-06T12:00:00Z")]);
    seedSources(fixture, "GH-3");
    const result = collectRetro(collectDeps(fixture));
    expect(result.ok).toBe(true);
    if (result.ok && result.data.outcome === "collected") {
      const audit = result.data.truth?.checks.find((check) => check.id === "C-02");
      expect(audit?.outcome).toBe("passed");
    }
  });
});

describe("TC-RETRO-018 additive validated run records", () => {
  test("two runs append two validated records with counts, verdicts, and truth", () => {
    const fixture = makeRetroDir("collect-runs");
    fixture.scriptDeliveryChanges([
      change("GH-2", "2026-11-06T11:00:00Z"),
      change("GH-3", "2026-11-06T12:00:00Z"),
    ]);
    seedSources(fixture, "GH-3");
    expect(collectRetro(collectDeps(fixture)).ok).toBe(true);
    seedSources(fixture, "GH-2");
    expect(collectRetro(collectDeps(fixture)).ok).toBe(true);
    const registry = readRetroRegistry(fixture.store);
    expect(registry.ok).toBe(true);
    if (!registry.ok) return;
    const runs = readRetroRuns(registry.value);
    expect(runs).toHaveLength(2);
    expect(runs.map((entry) => entry.scope)).toEqual(["GH-3", "GH-2"]);
    for (const entry of runs) {
      expect(entry.mode).toBe("collect");
      expect(entry.counts.collected).toBeGreaterThan(0);
      expect(entry.consumed.length).toBeGreaterThan(0);
      expect(Array.isArray(entry.truth.checks)).toBe(true);
    }
  });
});
