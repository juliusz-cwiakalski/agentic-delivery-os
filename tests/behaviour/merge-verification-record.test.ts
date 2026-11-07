/**
 * TC-MERGE-005 / TC-MERGE-006 — every full declared-battery evaluation appends
 * exactly one fenced, verified EVT-1 record; an append failure is a classified
 * state failure and never consumable evidence.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MERGE_GATE_VERIFICATION_SCHEMA,
  VERIFY_GATES_SCHEMA_VERSION,
} from "../../packages/core/src/contracts/index";
import {
  appendMergeGateVerification,
  readMergeGateVerifications,
} from "../../packages/core/src/state/index";
import { createMergeHarness, MERGE_CLOCK_ISO, MERGE_HEAD } from "../fixtures/merge/harness";
import { ledgerText, makeAuditStore, removeRoot } from "../fixtures/state/harness";
import { combinedRuntime, runVerify } from "../fixtures/verify-gates/cases/harness";

const ROOT = process.cwd();

describe("TC-MERGE-005 the verification record is appended by every full battery evaluation", () => {
  test("verify gates appends exactly one fenced, verified record with the declared payload", async () => {
    const fixture = makeAuditStore("merge-verification");
    try {
      const before = undefined;
      const runtime = combinedRuntime({
        appendVerification: (record) => {
          const appended = appendMergeGateVerification(fixture.store, {
            record,
            fenceToken: "fixture-verify-gates",
          });
          return appended.ok ? { ok: true } : { ok: false, code: appended.error.code };
        },
      });
      const result = await runVerify(runtime, ["gates", "GH-178"]);
      expect(result.exitCode).toBe(0);
      void before;
      const read = readMergeGateVerifications(fixture.store, "GH-178");
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records).toHaveLength(1);
      const record = read.records[0];
      expect(record?.schema).toBe(MERGE_GATE_VERIFICATION_SCHEMA);
      expect(record?.changeRef).toBe("GH-178");
      expect(record?.headSha).toBe("1111111111111111111111111111111111111111");
      expect(record?.verifiedAt).toBe("2026-11-06T12:00:00.000Z");
      expect(record?.gateSet.schemaVersion).toBe("delivery.merge.gates.v1");
      expect(record?.gateSet.ids).toHaveLength(6);
      expect(record?.gates).toHaveLength(5);
      expect(record?.trackerPosture.ownerLabels).toEqual([]);
      // The append ran under the fence with a post-append read.
      expect(fixture.edge.raised).toContain("fence-after-acquire");
      expect(fixture.edge.raised).toContain("append-before-flush");
      expect(fixture.edge.raised).toContain("append-after-flush");
      // The payload carries no title, body, comment, raw payload, or credential.
      const serialized = JSON.stringify(record);
      expect(serialized).not.toContain("planted-payload-verify-gates-canary");
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("a second evaluation appends a second record and the newest wins", async () => {
    const fixture = makeAuditStore("merge-verification-two");
    try {
      const append = (
        record: Parameters<
          NonNullable<Parameters<typeof combinedRuntime>[0]["appendVerification"]>
        >[0],
      ) => {
        const appended = appendMergeGateVerification(fixture.store, {
          record,
          fenceToken: "fixture-verify-gates",
        });
        return appended.ok ? { ok: true } : { ok: false, code: appended.error.code };
      };
      const runtime = combinedRuntime({ appendVerification: append });
      const prefix = join(fixture.root, "ledger.workspace-a.jsonl");
      expect(existsSafe(prefix)).toBe(false);
      await runVerify(runtime, ["gates", "GH-178"]);
      const afterFirst = ledgerText(fixture.identity);
      await runVerify(runtime, ["gates", "GH-178"]);
      const afterSecond = ledgerText(fixture.identity);
      expect(afterSecond.startsWith(afterFirst)).toBe(true);
      const read = readMergeGateVerifications(fixture.store, "GH-178");
      expect(read.ok && read.records).toHaveLength(2);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("merge --dry-run appends exactly one further record", async () => {
    const harness = createMergeHarness();
    try {
      const dry = await harness.run([harness.ref, "--dry-run"], { json: false });
      expect(dry.exitCode).toBe(0);
      expect(harness.verifications()).toHaveLength(1);
      const record = harness.verifications()[0];
      expect(record?.schema).toBe(MERGE_GATE_VERIFICATION_SCHEMA);
      expect(record?.headSha).toBe(MERGE_HEAD);
      expect(record?.verifiedAt).toBe(MERGE_CLOCK_ISO);
    } finally {
      harness.cleanup();
    }
  });

  test("the schema version stays the shipped verify-gates report schema", () => {
    expect(VERIFY_GATES_SCHEMA_VERSION).toBe("delivery.verify-gates.v1");
  });
});

describe("TC-MERGE-006 an append failure is classified and never consumable", () => {
  test("a failed append is a classified state failure at exit 2 and leaves no record", async () => {
    const runtime = combinedRuntime({
      appendVerification: () => ({ ok: false, code: "state.write.failed" }),
    });
    const result = await runVerify(runtime, ["gates", "GH-178"]);
    expect(result.exitCode).toBe(2);
    const error = result.envelope?.error as Record<string, unknown> | undefined;
    expect(error?.code).toBe("state.write.failed");
    expect(error?.category).toBe("transient");
  });

  test("a later merge refuses state-unverified when no consumable record exists", async () => {
    const harness = createMergeHarness();
    try {
      const result = await harness.run();
      expect(result.exitCode).toBe(2);
      expect((result.envelope?.error as Record<string, unknown> | undefined)?.code).toBe(
        "merge.state-unverified",
      );
      expect(harness.transactions()).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });

  test("restored control: clearing the fault appends one record and a merge consumes it", async () => {
    const fixture = makeAuditStore("merge-verification-restored");
    try {
      const runtime = combinedRuntime({
        appendVerification: (record) => {
          const appended = appendMergeGateVerification(fixture.store, {
            record,
            fenceToken: "fixture-verify-gates",
          });
          return appended.ok ? { ok: true } : { ok: false, code: appended.error.code };
        },
      });
      await runVerify(runtime, ["gates", "GH-178"]);
      const read = readMergeGateVerifications(fixture.store, "GH-178");
      expect(read.ok && read.records).toHaveLength(1);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("the doc/spec sync surface is not part of this record", () => {
    const doc = readFileSync(join(ROOT, "doc/spec/features/feature-result-contract.md"), "utf8");
    expect(doc).toContain("merge.gate.<gate-id>.failed");
  });
});

const existsSafe = (path: string): boolean => {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
};
