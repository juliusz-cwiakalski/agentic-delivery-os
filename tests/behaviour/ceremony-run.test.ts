/**
 * TC-CEREMONY-020 (a failed read-back stops the agenda and leaves records plus
 * artifact durable), TC-CEREMONY-023 (compaction at declared boundaries with an
 * explicit omitted count), TC-CEREMONY-025 (idempotent re-run returns
 * `data.reused: true` with zero appends), and the engine half of TC-CEREMONY-005
 * (`--apply` is inert without a `sync` step).
 */
import { describe, expect, test } from "bun:test";
import type { CeremonyDeclaration } from "../../packages/core/src/contracts/index";
import { runCeremony } from "../../packages/core/src/domain/index";
import { readCeremonySteps } from "../../packages/core/src/state/index";
import { readFixture, withPath } from "../fixtures/ceremony/declarations";
import {
  declarationWith,
  makeEngineHarness,
  threeStepDeclaration,
} from "../fixtures/ceremony/engine";
import { conformingNote } from "../fixtures/ceremony/notes";

describe("TC-CEREMONY-020 a failed read-back stops the agenda", () => {
  test("the step is unverified, no later step executes, and records plus artifact stay durable", () => {
    const harness = makeEngineHarness();
    try {
      const declaration = threeStepDeclaration();
      const run = runCeremony({
        declaration,
        env: harness.env,
        noteSupplied: false,
        apply: false,
      });
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      expect(run.data.verdict).toBe("verified");
      expect(run.data.steps).toHaveLength(3);

      // Paired control: the same declaration without corruption verifies.
      const failing = makeEngineHarness();
      failing.corruptArtifact("ceremony-artifact:run-1.s1.json", "not-json");
      try {
        const failed = runCeremony({
          declaration,
          env: failing.env,
          noteSupplied: false,
          apply: false,
        });
        expect(failed.ok).toBe(true);
        if (!failed.ok) return;
        expect(failed.data.verdict).toBe("unverified");
        expect(failed.data.steps).toHaveLength(1);
        const steps = readCeremonySteps(failing.store, "run-1");
        expect(steps.ok).toBe(true);
        if (steps.ok) {
          expect(steps.value.records).toHaveLength(1);
          expect(steps.value.records[0]?.outcome).toBe("unverified");
        }
        expect(failing.artifactContents.size).toBe(1);
      } finally {
        failing.dispose();
      }
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-CEREMONY-025 an identical run identity reuses the recorded verdict", () => {
  test("the second invocation appends zero run records, step records, or artifacts", () => {
    const harness = makeEngineHarness();
    try {
      const declaration = readFixture("valid-note.json") as unknown as CeremonyDeclaration;
      const note = conformingNote("project-note-pass");
      const first = runCeremony({
        declaration,
        env: harness.env,
        note,
        noteSupplied: true,
        apply: false,
      });
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      expect(first.data.reused).toBe(false);
      const recordsBefore = harness.store.readRecords();
      const artifactsBefore = harness.artifactContents.size;
      const second = runCeremony({
        declaration,
        env: harness.env,
        note,
        noteSupplied: true,
        apply: false,
      });
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.data.reused).toBe(true);
      expect(second.data.runId).toBe(first.data.runId);
      expect(second.data.verdict).toBe(first.data.verdict);
      const recordsAfter = harness.store.readRecords();
      if (recordsBefore.ok && recordsAfter.ok) {
        expect(recordsAfter.value.records.length).toBe(recordsBefore.value.records.length);
      }
      expect(harness.artifactContents.size).toBe(artifactsBefore);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-CEREMONY-023 compaction is bounded with an explicit omitted count", () => {
  const manyStepDeclaration = () =>
    withPath(readFixture("valid-repository.json"), "agenda", [
      {
        id: "bulk",
        steps: Array.from({ length: 30 }, () => ({
          kind: "fold",
          inputs: ["audit-ledger"],
          outputs: [{ slot: "state-record", schema: "delivery.ceremony.fold.v1" }],
          verify: "artifact-conforms",
        })),
      },
      {
        id: "final",
        steps: [
          {
            kind: "record",
            outputs: [{ slot: "state-record", schema: "delivery.ceremony.record.v1" }],
            verify: "artifact-conforms",
          },
        ],
      },
    ]);

  test("an over-bound summary is truncated with an explicit omitted count", () => {
    const harness = makeEngineHarness();
    try {
      harness.scriptInput("audit-ledger", {
        state: "present",
        facts: { text: "x".repeat(400) },
      });
      const run = runCeremony({
        declaration: manyStepDeclaration() as unknown as CeremonyDeclaration,
        env: harness.env,
        noteSupplied: false,
        apply: false,
      });
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      expect(run.data.carried).toHaveLength(1);
      const carried = run.data.carried[0];
      expect(carried).toBeDefined();
      if (carried === undefined) return;
      expect(carried.bytes).toBeLessThanOrEqual(4096);
      expect(carried.lines).toBeLessThanOrEqual(40);
      expect(carried.omitted).toBeGreaterThan(0);
      expect(carried.summary).toContain(`omitted: ${String(carried.omitted)}`);
    } finally {
      harness.dispose();
    }
  });

  test("an under-bound summary is untruncated with omitted 0 (paired control)", () => {
    const harness = makeEngineHarness();
    try {
      harness.scriptInput("audit-ledger", { state: "present", facts: { text: "short" } });
      const run = runCeremony({
        declaration: threeStepDeclaration(),
        env: harness.env,
        noteSupplied: false,
        apply: false,
      });
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      const carried = run.data.carried[0];
      expect(carried?.omitted).toBe(0);
      expect(carried?.bytes).toBeLessThanOrEqual(4096);
    } finally {
      harness.dispose();
    }
  });

  test("the two-phase declaration carries a summary at each declared boundary", () => {
    const harness = makeEngineHarness();
    try {
      const declaration = declarationWith((base) =>
        withPath(base, "compaction", { atPhases: [0, 1], maxBytes: 4096, maxLines: 40 }),
      );
      const run = runCeremony({
        declaration,
        env: harness.env,
        noteSupplied: false,
        apply: false,
      });
      expect(run.ok).toBe(true);
      if (run.ok) expect(run.data.carried.map((entry) => entry.phaseIndex)).toEqual([0, 1]);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-CEREMONY-005 --apply is inert without a sync step", () => {
  test("both runs produce the same verdict and byte-identical artifacts", () => {
    const withoutApply = makeEngineHarness();
    const withApply = makeEngineHarness();
    try {
      const declaration = threeStepDeclaration();
      const first = runCeremony({
        declaration,
        env: withoutApply.env,
        noteSupplied: false,
        apply: false,
      });
      const second = runCeremony({
        declaration,
        env: withApply.env,
        noteSupplied: false,
        apply: true,
      });
      expect(first.ok && second.ok).toBe(true);
      if (!first.ok || !second.ok) return;
      expect(second.data.verdict).toBe(first.data.verdict);
      expect([...withApply.artifactContents.values()]).toEqual([
        ...withoutApply.artifactContents.values(),
      ]);
    } finally {
      withoutApply.dispose();
      withApply.dispose();
    }
  });
});
