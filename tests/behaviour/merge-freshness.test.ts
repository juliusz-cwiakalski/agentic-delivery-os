/**
 * TC-MERGE-007..011 — the freshness envelope: fresh control, age refusal with
 * inline evidence, at-bound staleness, SHA/set voiding, and the exit-2
 * state-unverified split.
 */

import { describe, expect, test } from "bun:test";
import { chmodSync, writeFileSync } from "node:fs";
import {
  MERGE_GATE_VERIFICATION_RECORD_KIND,
  MERGE_GATE_VERIFICATION_SCHEMA,
  OWNER_GATE_SLA_POLICY,
} from "../../packages/core/src/contracts/index";
import { resolveMergeGateSet } from "../../packages/core/src/domain/merge-gate-set";
import {
  baseCheckRuns,
  createMergeHarness,
  MERGE_CLOCK_ISO,
  MERGE_CLOCK_MS,
  MERGE_HEAD,
  type MergeHarness,
  verificationRecord,
} from "../fixtures/merge/harness";
import { ledgerText, removeRoot } from "../fixtures/state/harness";

const MINUTE = 60_000;
const isoAt = (offsetMs: number): string => new Date(MERGE_CLOCK_MS + offsetMs).toISOString();

const withFreshRecord = (
  offsetMs: number,
  overrides: Parameters<typeof verificationRecord>[0] = {},
) => {
  const harness = createMergeHarness();
  harness.seedVerification(verificationRecord({ verifiedAt: isoAt(offsetMs), ...overrides }));
  return harness;
};

const errorCode = (run: { envelope?: Record<string, unknown> }): unknown =>
  (run.envelope?.error as { code?: unknown } | undefined)?.code;
const errorSummary = (run: { envelope?: Record<string, unknown> }): string =>
  String((run.envelope?.error as { summary?: unknown } | undefined)?.summary ?? "");

describe("TC-MERGE-007 fresh verification passes the envelope", () => {
  test("a four-minute-old verification with the same head and set lands", async () => {
    const harness = withFreshRecord(-4 * MINUTE);
    try {
      const result = await harness.run();
      expect(result.exitCode).toBe(0);
      expect(errorCode(result)).toBeUndefined();
      expect(harness.counts.verification).toBe(1);
      expect(harness.transactions()).toHaveLength(1);
      expect(errorSummary(result)).not.toContain("merge.gates-stale");
      expect(errorSummary(result)).not.toContain("merge.state-unverified");
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-MERGE-008 a stale verification refuses with age, bound, and the new red job", () => {
  test("31 minutes against the 30-minute bound refuses merge.gates-stale at exit 1", async () => {
    const harness = createMergeHarness();
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-31 * MINUTE) }));
      harness.setCheckRuns({
        items: [
          ...baseCheckRuns().items.map((run) =>
            run.pipelineName === "CI / test (18)"
              ? { ...run, jobs: [{ jobName: run.pipelineName, jobState: "failed" as const }] }
              : run,
          ),
        ],
        pageItemCount: 2,
        sha: MERGE_HEAD,
      });
      const result = await harness.run(undefined, { json: false });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("result=refused");
      expect(result.stderr).toContain("condition=merge.gates-stale");
      expect(result.stderr).toContain("31m");
      expect(result.stderr).toContain("30m");
      expect(result.stderr).toContain("CI / test (18)");
      expect(result.stderr).toContain("remediation=");
      expect(result.stderr).not.toContain("squash=");
      expect(harness.verifications()).toHaveLength(1);
      expect(harness.transactions()).toHaveLength(0);
      expect(harness.waivers()).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });

  test("the scripted envelope carries the same identity", async () => {
    const harness = withFreshRecord(-31 * MINUTE);
    try {
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      expect(errorCode(result)).toBe("merge.gates-stale");
      expect(errorSummary(result)).toContain("31m");
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-MERGE-009 the boundary belongs to refusal", () => {
  test("at-bound is stale; one millisecond under is fresh; one millisecond over is stale", async () => {
    const atBound = withFreshRecord(-30 * MINUTE);
    const under = withFreshRecord(-30 * MINUTE + 1);
    const over = withFreshRecord(-30 * MINUTE - 1);
    try {
      expect((await atBound.run()).exitCode).toBe(1);
      expect((await under.run()).exitCode).toBe(0);
      expect((await over.run()).exitCode).toBe(1);
    } finally {
      atBound.cleanup();
      under.cleanup();
      over.cleanup();
    }
  });

  test("the comparator is contract data: flipping it changes the at-bound outcome", async () => {
    const policy = { ...OWNER_GATE_SLA_POLICY, comparator: ">" as const };
    const harness = createMergeHarness({ policy });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-30 * MINUTE) }));
      expect((await harness.run()).exitCode).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  test("a clock jump of one hour makes a fresh record stale", async () => {
    const harness = createMergeHarness({ nowMs: () => MERGE_CLOCK_MS + 60 * MINUTE });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-4 * MINUTE) }));
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      expect(errorCode(result)).toBe("merge.gates-stale");
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-MERGE-010 head and gate-set bindings void the verification", () => {
  test("a head SHA mismatch refuses with both SHAs and the re-verify remediation", async () => {
    const harness = createMergeHarness();
    try {
      harness.seedVerification(
        verificationRecord({
          headSha: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
          verifiedAt: isoAt(-4 * MINUTE),
        }),
      );
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      expect(errorCode(result)).toBe("merge.gates-stale");
      expect(errorSummary(result)).toContain("a1b2c3d");
      expect(errorSummary(result)).toContain("9f21c0e");
      expect(errorSummary(result)).toContain("verify gates");
    } finally {
      harness.cleanup();
    }
  });

  test("a gate-set identity mismatch names the set delta", async () => {
    const set = resolveMergeGateSet(undefined);
    if (!set.ok) throw new Error("default set invalid");
    const harness = createMergeHarness({
      gateSet: {
        schemaVersion: "delivery.merge.gates.v1",
        entries: [
          ...set.value.entries,
          {
            id: "workspace-tests",
            recipe: "required-ci-job",
            surface: "both",
            job: "workspace-tests",
          },
        ],
      },
      checkRuns: {
        items: [
          ...baseCheckRuns().items,
          {
            identity: { systemName: "github", entityId: "44899" },
            pipelineName: "workspace-tests",
            jobs: [{ jobName: "workspace-tests", jobState: "succeeded" }],
            traceEvidence: [],
          },
        ],
        pageItemCount: 3,
        sha: MERGE_HEAD,
      },
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-4 * MINUTE) }));
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      expect(errorSummary(result)).toContain("gate-set-delta");
      expect(errorSummary(result)).toContain("workspace-tests");
    } finally {
      harness.cleanup();
    }
  });

  test("the identical control lands", async () => {
    const harness = withFreshRecord(-4 * MINUTE);
    try {
      expect((await harness.run()).exitCode).toBe(0);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-MERGE-011 missing or unreadable state is exit-2 state-unverified", () => {
  const stateUnverified = async (harness: MergeHarness, expected?: string) => {
    const result = await harness.run(undefined, { json: false });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("condition=merge.state-unverified");
    if (expected !== undefined) expect(result.stderr).toContain(expected);
    expect(result.stderr).not.toContain("result=merged");
    expect(harness.transactions()).toHaveLength(0);
    expect(harness.waivers()).toHaveLength(0);
  };

  test("an absent record refuses state-unverified", async () => {
    const harness = createMergeHarness();
    try {
      await stateUnverified(harness, "absent");
    } finally {
      harness.cleanup();
    }
  });

  test("a torn ledger refuses state-unverified", async () => {
    const harness = createMergeHarness();
    try {
      harness.seedVerification(verificationRecord());
      writeFileSync(
        `${harness.identity.stateDirectory}/ledger.${encodeURIComponent(harness.identity.workspaceId)}.jsonl`,
        "{ not json\n",
      );
      await stateUnverified(harness, "torn");
      expect(ledgerText(harness.identity)).not.toContain("merged");
    } finally {
      harness.cleanup();
    }
  });

  test("a schema-incompatible record refuses state-unverified", async () => {
    const harness = createMergeHarness();
    try {
      const acquired = harness.store.acquireFence("fixture-incompatible");
      if (!acquired.ok) throw new Error("fence failed");
      const appended = harness.store.append(acquired.value.handle, {
        kind: MERGE_GATE_VERIFICATION_RECORD_KIND,
        recordKey: `merge.gate-verification:${harness.ref}`,
        payload: {
          schema: "delivery.merge.gate-verification.v2",
          changeRef: harness.ref,
          headSha: MERGE_HEAD,
          verifiedAt: MERGE_CLOCK_ISO,
          gateSet: { schemaVersion: "delivery.merge.gates.v1", ids: [] },
          gates: [],
        },
      });
      harness.store.releaseFence(acquired.value.handle);
      expect(appended.ok).toBe(true);
      await stateUnverified(harness, "incompatible");
    } finally {
      harness.cleanup();
    }
  });

  test("a record for a different ref is not served as truth", async () => {
    const harness = createMergeHarness();
    try {
      harness.seedVerification(verificationRecord({ changeRef: "GH-999" }));
      await stateUnverified(harness, "absent");
    } finally {
      harness.cleanup();
    }
  });

  test("the stale case stays exit 1, proving the split is not over-applied", async () => {
    const harness = withFreshRecord(-31 * MINUTE);
    try {
      expect((await harness.run()).exitCode).toBe(1);
    } finally {
      harness.cleanup();
    }
  });

  test.skipIf(process.getuid?.() === 0)(
    "an unreadable ledger refuses state-unverified",
    async () => {
      const harness = createMergeHarness();
      try {
        harness.seedVerification(verificationRecord());
        const path = `${harness.identity.stateDirectory}/ledger.${encodeURIComponent(harness.identity.workspaceId)}.jsonl`;
        chmodSync(path, 0o000);
        try {
          await stateUnverified(harness);
        } finally {
          chmodSync(path, 0o600);
        }
      } finally {
        harness.cleanup();
      }
    },
  );
});
