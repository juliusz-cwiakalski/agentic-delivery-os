/**
 * TC-CEREMONY-021 (resume after step k never re-executes a verified step) and
 * the behaviour half of TC-CEREMONY-022 (a contradicted record sequence refuses
 * `state.store.torn` with zero writes).
 */
import { describe, expect, test } from "bun:test";
import type { CeremonyStepRecord } from "../../packages/core/src/contracts/index";
import { resumeCeremony, validateCeremonyStepSequence } from "../../packages/core/src/domain/index";
import {
  appendCeremonyRun,
  appendCeremonyStep,
  readCeremonySteps,
} from "../../packages/core/src/state/index";
import {
  type EngineHarness,
  makeEngineHarness,
  threeStepDeclaration,
} from "../fixtures/ceremony/engine";
import { runRecord, stepRecord } from "../fixtures/ceremony/state";
import { withinFence } from "../fixtures/state/harness";

const seed = (harness: EngineHarness, steps: readonly CeremonyStepRecord[]): void => {
  withinFence(harness.store, "resume-seed", (handle) => {
    const run = appendCeremonyRun(
      harness.store,
      handle,
      runRecord({ runId: "run-1", phaseCount: 2 }),
      1,
    );
    if (!run.ok) throw new Error(run.error.code);
    for (const [position, step] of steps.entries()) {
      const appended = appendCeremonyStep(harness.store, handle, step, position + 1);
      if (!appended.ok) throw new Error(appended.error.code);
    }
  });
};

const verifiedSteps = (): CeremonyStepRecord[] => [
  stepRecord({ runId: "run-1", index: 1, phaseIndex: 0, endedAtMs: 1, durationMs: 1 }),
  stepRecord({
    runId: "run-1",
    index: 2,
    phaseIndex: 1,
    kind: "fold",
    startedAtMs: 10,
    endedAtMs: 11,
    durationMs: 1,
  }),
];

describe("TC-CEREMONY-021 resume starts at the first unverified index", () => {
  test("an interrupted run after step 2 resumes at step 3 and re-executes nothing", () => {
    const harness = makeEngineHarness();
    try {
      seed(harness, verifiedSteps());
      const resumed = resumeCeremony({
        runId: "run-1",
        declaration: threeStepDeclaration(),
        env: harness.env,
        apply: false,
      });
      expect(resumed.ok).toBe(true);
      if (!resumed.ok) return;
      expect(resumed.data.verdict).toBe("verified");
      const steps = readCeremonySteps(harness.store, "run-1");
      expect(steps.ok).toBe(true);
      if (!steps.ok) return;
      expect(steps.value.records.map((step) => step.index)).toEqual([1, 2, 3]);
      expect(steps.value.records.filter((step) => step.index <= 2)).toHaveLength(2);
    } finally {
      harness.dispose();
    }
  });

  test("an unverified step is re-attempted and only that index appends again", () => {
    const harness = makeEngineHarness();
    try {
      seed(harness, [
        stepRecord({ runId: "run-1", index: 1, phaseIndex: 0, endedAtMs: 1, durationMs: 1 }),
        stepRecord({
          runId: "run-1",
          index: 2,
          phaseIndex: 1,
          kind: "fold",
          outcome: "unverified",
          verification: "unverified",
          reason: "artifact does not conform",
        }),
      ]);
      // The re-attempted step writes the ceremony-artifact slot; the corrupted
      // bytes fail its read-back so the attempt stays unverified.
      const declaration = JSON.parse(JSON.stringify(threeStepDeclaration())) as unknown as {
        agenda: { steps: { outputs: { slot: string }[] }[] }[];
      };
      declaration.agenda[1]?.steps[0]?.outputs.forEach((output) => {
        output.slot = "ceremony-artifact";
      });
      harness.corruptArtifact("ceremony-artifact:run-1.s2.json", "not-json");
      const resumed = resumeCeremony({
        runId: "run-1",
        declaration: declaration as unknown as ReturnType<typeof threeStepDeclaration>,
        env: harness.env,
        apply: false,
      });
      expect(resumed.ok).toBe(true);
      if (!resumed.ok) return;
      expect(resumed.data.verdict).toBe("unverified");
      const steps = readCeremonySteps(harness.store, "run-1");
      expect(steps.ok).toBe(true);
      if (!steps.ok) return;
      expect(steps.value.records.map((step) => step.index)).toEqual([1, 2, 2]);
      expect(steps.value.records.filter((step) => step.index === 1)).toHaveLength(1);
      expect(steps.value.records.filter((step) => step.index === 3)).toHaveLength(0);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-CEREMONY-022 a contradicted sequence refuses torn with zero writes", () => {
  const cases: readonly {
    readonly name: string;
    readonly steps: () => readonly CeremonyStepRecord[];
  }[] = [
    {
      name: "a missing middle step",
      steps: () => [
        stepRecord({ runId: "run-1", index: 1, phaseIndex: 0 }),
        stepRecord({ runId: "run-1", index: 3, phaseIndex: 1, kind: "record" }),
      ],
    },
    {
      name: "a record for an undeclared index",
      steps: () => [
        stepRecord({ runId: "run-1", index: 1, phaseIndex: 0 }),
        stepRecord({ runId: "run-1", index: 4, phaseIndex: 1, kind: "record" }),
      ],
    },
    {
      name: "two records for one verified index",
      steps: () => [
        stepRecord({ runId: "run-1", index: 1, phaseIndex: 0 }),
        stepRecord({ runId: "run-1", index: 1, phaseIndex: 0 }),
      ],
    },
  ];

  test.each(cases)("$name refuses state.store.torn with zero writes", ({ steps }) => {
    const harness = makeEngineHarness();
    try {
      seed(harness, steps());
      const before = harness.store.readRecords();
      const resumed = resumeCeremony({
        runId: "run-1",
        declaration: threeStepDeclaration(),
        env: harness.env,
        apply: false,
      });
      expect(resumed.ok).toBe(false);
      if (!resumed.ok) {
        expect(resumed.error.code).toBe("state.store.torn");
      }
      const after = harness.store.readRecords();
      if (before.ok && after.ok) {
        expect(after.value.records.length).toBe(before.value.records.length);
      }
    } finally {
      harness.dispose();
    }
  });

  test("a healthy sequence is the paired accepting control", () => {
    const sequence = validateCeremonyStepSequence(threeStepDeclaration(), verifiedSteps());
    expect(sequence.ok).toBe(true);
    if (sequence.ok) expect(sequence.startIndex).toBe(3);
  });

  test("an unknown run id is refused as input.value.rejected", () => {
    const harness = makeEngineHarness();
    try {
      const resumed = resumeCeremony({
        runId: "run-missing",
        declaration: threeStepDeclaration(),
        env: harness.env,
        apply: false,
      });
      expect(resumed.ok).toBe(false);
      if (!resumed.ok) expect(resumed.error.code).toBe("input.value.rejected");
    } finally {
      harness.dispose();
    }
  });
});
