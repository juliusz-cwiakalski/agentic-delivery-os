/**
 * TC-SNARR-002 / TC-SPAR-002 / TC-SWRITE-001 — the write-surface matrix over the
 * real state module: one record and one capsule event on a non-refused
 * evaluation, zero on a narrowed or configuration refusal, and no file writes.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { MergeGateVerificationRecord } from "../../packages/core/src/contracts/index";
import { resolveVerifySuiteMap } from "../../packages/core/src/domain/index";
import {
  appendMergeGateVerification,
  readMergeGateVerifications,
} from "../../packages/core/src/state/index";
import {
  baseFacts,
  clone,
  EXPECTED_JOBS,
  run as pipelineRun,
} from "../fixtures/verify-gates/cases/facts";
import { combinedRuntime, runVerify } from "../fixtures/verify-gates/cases/harness";
import {
  declaredRead,
  invalidRead,
  mirrorAbsentMap,
  narrowedMap,
  REFERENCE_JOB,
  validEqualityMap,
  widerMap,
} from "../fixtures/verify-gates/suite-map/cases";
import { createVerifyState } from "./verify-support";

const REF = "GH-300";
const ROOT = process.cwd();

const greenFacts = () => {
  const facts = clone(baseFacts());
  const names = [...EXPECTED_JOBS, REFERENCE_JOB];
  facts.workflow = { outcome: "read", names };
  facts.checkRuns = {
    ok: true,
    value: {
      items: names.map((name) => pipelineRun(name, "succeeded")),
      pageItemCount: names.length,
    },
  };
  return facts;
};

const failingFacts = () => {
  const facts = greenFacts();
  facts.checkRuns = {
    ok: true,
    value: {
      items: facts.workflow.names.map((name) =>
        pipelineRun(name, name === EXPECTED_JOBS[0] ? "failed" : "succeeded"),
      ),
      pageItemCount: facts.workflow.names.length,
    },
  };
  return facts;
};

const treeSnapshot = (): readonly string[] => {
  const entries: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(ROOT, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else entries.push(next);
    }
  };
  walk("tests/fixtures/verify-gates");
  return entries.sort();
};

const world = () => {
  const state = createVerifyState();
  const appends: MergeGateVerificationRecord[] = [];
  const capsuleEvents: string[] = [];
  let fence = 0;
  const runtimeFor = (read: Parameters<typeof combinedRuntime>[0]) =>
    combinedRuntime({
      ...read,
      appendVerification: (record) => {
        appends.push(record);
        fence += 1;
        const appended = appendMergeGateVerification(state.store, {
          record,
          fenceToken: `write-posture-${fence}`,
        });
        return appended.ok
          ? { ok: true as const }
          : { ok: false as const, code: appended.error.code };
      },
      capsule: {
        append: (event: { readonly kind: string }) => {
          capsuleEvents.push(event.kind);
          return { ok: true as const, appended: true };
        },
      },
    });
  return {
    state,
    appends,
    capsuleEvents,
    runtimeFor,
    history: () => readMergeGateVerifications(state.store, REF),
    cleanup: () => state.cleanup(),
  };
};

describe("TC-SPAR-002 a declared-map passing evaluation appends one delivered-shape record", () => {
  test("one record, not torn, closed record shape, no breadth key", async () => {
    const app = world();
    try {
      const result = await runVerify(
        app.runtimeFor({ facts: greenFacts(), suiteMap: declaredRead(validEqualityMap()) }),
        ["gates", REF],
      );
      expect(result.exitCode).toBe(0);
      const history = app.history();
      if (!history.ok) throw new Error(`history read failed: ${history.reason}`);
      expect(history.records).toHaveLength(1);
      const record = history.records[0] as Record<string, unknown>;
      expect(Object.keys(record).sort()).toEqual(
        [
          "changeRef",
          "gateSet",
          "gates",
          "headSha",
          "schema",
          "trackerPosture",
          "verifiedAt",
        ].sort(),
      );
      expect(record.schema).toBe("delivery.merge.gate-verification.v1");
      expect(record.changeRef).toBe(REF);
      const gateSet = record.gateSet as Record<string, unknown>;
      expect(Array.isArray(gateSet.ids)).toBe(true);
      expect((record.gates as readonly unknown[]).length).toBe(5);
      for (const gate of record.gates as readonly Record<string, unknown>[]) {
        expect(gateSet.ids).toContain(gate.id);
      }
      for (const gate of record.gates as readonly Record<string, unknown>[]) {
        expect(Object.keys(gate).sort()).toEqual(["citation", "id", "reason", "verdict"]);
      }
      expect(JSON.stringify(record)).not.toContain("suiteBreadth");
      expect(JSON.stringify(record)).not.toContain("mirrorsJob");
      expect(app.capsuleEvents).toEqual(["gate.outcome"]);
      expect(app.appends).toHaveLength(1);
    } finally {
      app.cleanup();
    }
  });
});

describe("TC-SNARR-002 a narrowed refusal appends neither the record nor the capsule event", () => {
  test("a prior record stays newest and the history is not torn", async () => {
    const app = world();
    try {
      const prior = await runVerify(
        app.runtimeFor({ facts: greenFacts(), suiteMap: declaredRead(validEqualityMap()) }),
        ["gates", REF],
      );
      expect(prior.exitCode).toBe(0);
      const before = app.history();
      if (!before.ok) throw new Error("history read failed");
      expect(before.records).toHaveLength(1);
      const priorRecord = before.records[0] as Record<string, unknown>;

      const narrowedResult = await runVerify(
        app.runtimeFor({ facts: greenFacts(), suiteMap: declaredRead(narrowedMap()) }),
        ["gates", REF],
      );
      expect(narrowedResult.exitCode).toBe(1);
      expect(narrowedResult.envelope?.error?.code).toBe("verify.narrowed-scope");

      const after = app.history();
      if (!after.ok) throw new Error("history read failed after the refusal");
      expect(after.records).toHaveLength(1);
      expect(after.records[0]).toEqual(priorRecord);
      expect(app.capsuleEvents).toEqual(["gate.outcome"]);

      const second = await runVerify(
        app.runtimeFor({ facts: greenFacts(), suiteMap: declaredRead(narrowedMap()) }),
        ["gates", REF],
      );
      expect(second.exitCode).toBe(1);
      expect(app.appends).toHaveLength(1);
      expect(app.capsuleEvents).toEqual(["gate.outcome"]);
    } finally {
      app.cleanup();
    }
  });

  test("an empty history stays empty on a narrowed refusal", async () => {
    const app = world();
    try {
      await runVerify(
        app.runtimeFor({ facts: greenFacts(), suiteMap: declaredRead(narrowedMap()) }),
        ["gates", REF],
      );
      const history = app.history();
      if (!history.ok) throw new Error("history read failed");
      expect(history.records).toEqual([]);
      expect(app.appends).toEqual([]);
      expect(app.capsuleEvents).toEqual([]);
    } finally {
      app.cleanup();
    }
  });
});

describe("TC-SWRITE-001 the write-surface matrix", () => {
  test("a gate failure is a non-refused full evaluation: one record and one capsule event", async () => {
    const app = world();
    try {
      const result = await runVerify(
        app.runtimeFor({ facts: failingFacts(), suiteMap: declaredRead(validEqualityMap()) }),
        ["gates", REF],
      );
      expect(result.exitCode).toBe(1);
      expect(result.envelope?.error?.code).toBe("verify.gates.failed");
      expect(app.appends).toHaveLength(1);
      expect(app.capsuleEvents).toEqual(["gate.outcome"]);
    } finally {
      app.cleanup();
    }
  });

  test("unmirrored, uncorroborated, and structural refusals append nothing", async () => {
    const refusals = [
      () => declaredRead(widerMap()),
      () => declaredRead(mirrorAbsentMap()),
      () => () => invalidRead("defective-node"),
    ];
    for (const read of refusals) {
      const app = world();
      try {
        const result = await runVerify(app.runtimeFor({ facts: greenFacts(), suiteMap: read() }), [
          "gates",
          REF,
        ]);
        expect(result.exitCode).toBe(1);
        expect(result.envelope?.error?.code).toBe("config.value.invalid");
        expect(app.appends).toEqual([]);
        expect(app.capsuleEvents).toEqual([]);
      } finally {
        app.cleanup();
      }
    }
  });

  test("the fixture tree is unchanged and no configuration document is written", async () => {
    const app = world();
    const before = treeSnapshot();
    try {
      await runVerify(
        app.runtimeFor({ facts: greenFacts(), suiteMap: declaredRead(validEqualityMap()) }),
        ["gates", REF],
      );
      await runVerify(
        app.runtimeFor({ facts: greenFacts(), suiteMap: declaredRead(narrowedMap()) }),
        ["gates", REF],
      );
      expect(treeSnapshot()).toEqual(before);
    } finally {
      app.cleanup();
    }
  });

  test("the structural defect table appends nothing", async () => {
    const raw = { schemaVersion: "delivery.verify.suite-map.v1", jobs: [], local: ["tests"] };
    expect(resolveVerifySuiteMap(raw).ok).toBe(false);
  });
});
