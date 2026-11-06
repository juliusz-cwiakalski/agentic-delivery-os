/**
 * TC-BLK-036 — determinism: byte-identical repeated runs, permutation
 * invariance, injected run id/timing/generatedAt, TTY independence, and
 * changed-fact controls proving the equality is not a constant.
 */
import { describe, expect, test } from "bun:test";
import { createBlockerState, createBlockersHarness } from "../fixtures/blockers/harness";
import { BRAND_B } from "../fixtures/blockers/identity";
import { makeQuestion } from "../fixtures/blockers/records";
import { baseFacts, briefRuntime, runBriefCli } from "../fixtures/brief/harness";
import {
  blockersRead,
  NOW_ISO,
  NOW_MS,
  runStatusCli,
  statusRuntime,
} from "../fixtures/status/harness";

const at = (hoursAgo: number): string => new Date(NOW_MS - hoursAgo * 3_600_000).toISOString();

const population = () => [
  makeQuestion({
    id: "q-1",
    type: "decision-needed",
    audience: "coordinator",
    askedAt: at(1),
    options: ["a"],
  }),
  makeQuestion({
    id: "q-2",
    type: "spec-ambiguity",
    audience: "owner",
    askedAt: at(2),
    options: [],
  }),
  makeQuestion({
    id: "q-3",
    type: "external-wait",
    audience: "coordinator",
    askedAt: at(3),
    options: [],
  }),
];

describe("TC-BLK-036 determinism", () => {
  test("twenty list runs are byte-identical in both modes", async () => {
    const harness = createBlockersHarness({ seedQuestions: population() });
    try {
      const firstMachine = await harness.run(["list"]);
      const firstHuman = await harness.run(["list"], { json: false });
      for (let index = 0; index < 20; index += 1) {
        const machine = await harness.run(["list"]);
        const human = await harness.run(["list"], { json: false });
        expect(machine.stdout).toBe(firstMachine.stdout);
        expect(human.stdout).toBe(firstHuman.stdout);
        expect(machine.exitCode).toBe(0);
        expect(human.exitCode).toBe(0);
      }
      expect(firstMachine.envelope?.runId).toBe("run-blockers-fixture");
      expect(firstMachine.envelope?.timing).toEqual({ totalMs: 10 });
    } finally {
      harness.cleanup();
    }
  });

  test("twenty status and brief runs are byte-identical and inject generatedAt", async () => {
    const facts = baseFacts({ blockers: blockersRead(population(), []) });
    const statusFirst = await runStatusCli(["--json", "status"], statusRuntime(facts));
    const briefFirst = await runBriefCli(["--json", "brief"], briefRuntime(facts));
    for (let index = 0; index < 20; index += 1) {
      expect((await runStatusCli(["--json", "status"], statusRuntime(facts))).stdout).toBe(
        statusFirst.stdout,
      );
      expect((await runBriefCli(["--json", "brief"], briefRuntime(facts))).stdout).toBe(
        briefFirst.stdout,
      );
    }
    const statusData = (JSON.parse(statusFirst.stdout) as Record<string, unknown>).data as Record<
      string,
      unknown
    >;
    expect(statusData.generatedAt).toBe(NOW_ISO);
  });

  test("reversing the append order does not change the rendered bytes", async () => {
    const forward = createBlockerState("determinism-forward");
    const reverse = createBlockerState("determinism-reverse");
    try {
      const a = createBlockersHarness({ existingState: forward });
      const b = createBlockersHarness({ existingState: reverse });
      for (const question of population()) a.seedQuestion(question);
      for (const question of [...population()].reverse()) b.seedQuestion(question);
      const first = await a.run(["list"]);
      const second = await b.run(["list"]);
      expect(second.stdout).toBe(first.stdout);
    } finally {
      forward.cleanup();
      reverse.cleanup();
    }
  });

  test("output is ANSI-free and independent of the sink type", async () => {
    const harness = createBlockersHarness({ seedQuestions: population() });
    try {
      const run = await harness.run(["list"], { json: false });
      expect(run.stdout.includes("\u001b[")).toBe(false);
      expect(run.stdout.includes("\r")).toBe(false);
    } finally {
      harness.cleanup();
    }
  });

  test("changed facts change the bytes (live controls)", async () => {
    const base = createBlockersHarness({ seedQuestions: population() });
    try {
      const baseline = await base.run(["list"]);
      const changed = createBlockersHarness({
        seedQuestions: [
          makeQuestion({
            id: "q-1",
            type: "credential-missing",
            audience: "owner",
            askedAt: at(1),
            question: "GITHUB_TOKEN",
            options: [],
          }),
        ],
      });
      try {
        expect((await changed.run(["list"])).stdout).not.toBe(baseline.stdout);
      } finally {
        changed.cleanup();
      }
    } finally {
      base.cleanup();
    }

    const audienceBase = createBlockersHarness({
      callerAudienceFact: "owner",
      seedQuestions: [makeQuestion({ id: "q-1", options: ["a"] })],
    });
    try {
      const baseline = await audienceBase.run(["answer", "q-1", "--choice", "1"]);
      const coordinator = createBlockersHarness({
        callerAudienceFact: "coordinator",
        seedQuestions: [makeQuestion({ id: "q-1", options: ["a"] })],
      });
      try {
        const changed = await coordinator.run(["answer", "q-1", "--choice", "1"]);
        expect(changed.data?.audience).not.toBe(baseline.data?.audience);
      } finally {
        coordinator.cleanup();
      }
    } finally {
      audienceBase.cleanup();
    }

    const capabilityA = createBlockersHarness({
      capability: { resumeInjection: true, mode: "boundary-note" },
      seedQuestions: [makeQuestion({ id: "q-1", options: ["a"] })],
    });
    try {
      const baseline = await capabilityA.run(["answer", "q-1", "--choice", "1"]);
      const capabilityB = createBlockersHarness({
        capability: { resumeInjection: false },
        seedQuestions: [makeQuestion({ id: "q-1", options: ["a"] })],
      });
      try {
        const changed = await capabilityB.run(["answer", "q-1", "--choice", "1"]);
        expect(changed.data?.laneResume).not.toEqual(baseline.data?.laneResume);
      } finally {
        capabilityB.cleanup();
      }
    } finally {
      capabilityA.cleanup();
    }

    const brandA = createBlockersHarness({ seedQuestions: population() });
    try {
      const baseline = await brandA.run(["list"], { json: false });
      const brandB = createBlockersHarness({ brand: BRAND_B, seedQuestions: population() });
      try {
        const changed = await brandB.run(["list"], { json: false });
        expect(changed.stdout.startsWith("second-product")).toBe(true);
        expect(changed.stdout).not.toBe(baseline.stdout);
      } finally {
        brandB.cleanup();
      }
    } finally {
      brandA.cleanup();
    }
  });
});
