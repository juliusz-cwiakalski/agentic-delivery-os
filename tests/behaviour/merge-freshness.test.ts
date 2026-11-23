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
  type MergeGateVerificationRecord,
  OWNER_GATE_SLA_POLICY,
} from "../../packages/core/src/contracts/index";
import { resolveMergeGateSet } from "../../packages/core/src/domain/merge-gate-set";
import {
  appendMergeGateVerification,
  readMergeGateVerifications,
} from "../../packages/core/src/state/index";
import {
  baseCheckRuns,
  baseRequest,
  createMergeHarness,
  MERGE_CLOCK_ISO,
  MERGE_CLOCK_MS,
  MERGE_HEAD,
  type MergeHarness,
  verificationRecord,
} from "../fixtures/merge/harness";
import { ledgerText, removeRoot } from "../fixtures/state/harness";
import { baseFacts, clone, request } from "../fixtures/verify-gates/cases/facts";
import { combinedRuntime, runVerify } from "../fixtures/verify-gates/cases/harness";

const MINUTE = 60_000;
const isoAt = (offsetMs: number): string => new Date(MERGE_CLOCK_MS + offsetMs).toISOString();
const OTHER_HEAD = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
const MERGE_BRANCH = "feat/GH-301/merge";

/**
 * Seed one SHIPPED-produced record: the verify-gates handler constructs it
 * (facts overridden to the merge harness's ref, branch, head H, and provider
 * parity posture) and the delivered real append lands it over the harness's
 * store — never the fixture record builder TC-MERGE-007 seeds with.
 */
const seedShippedVerification = async (
  harness: MergeHarness,
  mutate?: (facts: ReturnType<typeof baseFacts>) => void,
): Promise<MergeGateVerificationRecord> => {
  const facts = clone(baseFacts());
  facts.repository = {
    binding: "resolved",
    head: { branch: MERGE_BRANCH, sha: MERGE_HEAD, detached: false },
  };
  // The provider parity posture matches the overridden head: the same full
  // SHA on the same branch, open and mergeable, so the shipped battery passes
  // and the record carries five green verdicts unless a mutate arm reddens one.
  const mergeRequest = request({
    sourceRef: MERGE_BRANCH,
    sourceHeadSha: MERGE_HEAD,
    targetRef: "main-tools",
  });
  facts.deliveryRequestDetail = { ok: true, value: { request: mergeRequest } };
  facts.openPullRequests = { ok: true, value: { items: [mergeRequest], pageItemCount: 1 } };
  mutate?.(facts);
  const runtime = combinedRuntime({
    facts,
    appendVerification: (record) => {
      const appended = appendMergeGateVerification(harness.store, {
        record,
        fenceToken: "fixture-shipped-verification",
      });
      return appended.ok ? { ok: true } : { ok: false, code: appended.error.code };
    },
  });
  const result = await runVerify(runtime, ["gates", harness.ref]);
  if (result.exitCode !== 0) {
    throw new Error(`the seeding verify run refused: ${String(result.exitCode)}`);
  }
  const read = readMergeGateVerifications(harness.store, harness.ref);
  if (!read.ok || read.records.length !== 1) {
    throw new Error("the shipped seed did not land exactly one record");
  }
  const record = read.records[0];
  if (record === undefined) throw new Error("no seeded record");
  return record;
};

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

describe("TC-MERGE-043 the shipped record is resolved by its persisted identity and accepted", () => {
  test("the verify-gates-produced record passes the envelope under total identity equality and lands", async () => {
    const harness = createMergeHarness();
    try {
      const record = await seedShippedVerification(harness);
      // Resolved by its persisted identity: the ledger key and the payload
      // identity members (EVT-1; ticket AC-4's fixture half).
      expect(ledgerText(harness.identity)).toContain(`merge.gate-verification:${harness.ref}`);
      expect(record.schema).toBe(MERGE_GATE_VERIFICATION_SCHEMA);
      expect(record.changeRef).toBe(harness.ref);
      expect(record.headSha).toBe(MERGE_HEAD);
      // Total identity equality: schema version plus the full shipped-default
      // id sequence, order included — array equality, never set equality.
      const set = resolveMergeGateSet(undefined);
      if (!set.ok) throw new Error("default set invalid");
      expect(record.gateSet).toEqual({
        schemaVersion: set.value.schemaVersion,
        ids: [...set.value.ids],
      });
      // The envelope accepted and the landing proceeded at H.
      const result = await harness.run();
      expect(result.exitCode).toBe(0);
      expect(errorCode(result)).toBeUndefined();
      expect(harness.counts.verification).toBe(1);
      expect(harness.transactions()).toHaveLength(1);
      expect(harness.landings).toHaveLength(1);
      const landing = harness.landings[0];
      if (landing !== undefined && "expectedHeadSha" in landing) {
        expect(landing.expectedHeadSha).toBe(MERGE_HEAD);
      }
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-MERGE-044 the three refusal mutations refuse and never consume the shipped record", () => {
  test("arm (a) a different resolved head refuses naming both SHAs", async () => {
    // The envelope binds the record to the provider-asserted request head: the
    // resolution resolves H' from the open page and the request detail.
    const otherRequest = baseRequest({ headSha: OTHER_HEAD, sourceHeadSha: OTHER_HEAD });
    const harness = createMergeHarness({ request: otherRequest });
    try {
      const record = await seedShippedVerification(harness);
      expect(record.headSha).toBe(MERGE_HEAD);
      const result = await harness.run(undefined, { json: false });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("condition=merge.gates-stale");
      expect(result.stderr).toContain(MERGE_HEAD.slice(0, 7));
      expect(result.stderr).toContain(OTHER_HEAD.slice(0, 7));
      expect(harness.landings).toHaveLength(0);
      expect(harness.transactions()).toHaveLength(0);
      expect(harness.waivers()).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });

  test("arm (b) the at-bound and over-bound ages refuse with the age and the bound", async () => {
    for (const offset of [30 * MINUTE, 31 * MINUTE]) {
      const harness = createMergeHarness({ nowMs: () => MERGE_CLOCK_MS + offset });
      try {
        await seedShippedVerification(harness);
        const result = await harness.run();
        expect(result.exitCode).toBe(1);
        expect(errorCode(result)).toBe("merge.gates-stale");
        expect(errorSummary(result)).toContain(`${String(offset / MINUTE)}m`);
        // Zero consumption on both sides of the boundary.
        expect(harness.landings).toHaveLength(0);
        expect(harness.transactions()).toHaveLength(0);
        expect(harness.waivers()).toHaveLength(0);
      } finally {
        harness.cleanup();
      }
    }
  });

  test("arm (c) a one-id identity delta on the newest record refuses with the set delta inline", async () => {
    const harness = createMergeHarness();
    try {
      const record = await seedShippedVerification(harness);
      // The minimal identity delta: one built-in id dropped from the sequence,
      // appended through the delivered append so the mutated record is newest.
      const mutated: MergeGateVerificationRecord = {
        ...record,
        verifiedAt: isoAt(-4 * MINUTE),
        gateSet: {
          schemaVersion: record.gateSet.schemaVersion,
          ids: record.gateSet.ids.filter((id) => id !== "push-parity"),
        },
      };
      const appended = appendMergeGateVerification(harness.store, {
        record: mutated,
        fenceToken: "fixture-identity-delta",
      });
      expect(appended.ok).toBe(true);
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      expect(errorCode(result)).toBe("merge.gates-stale");
      expect(errorSummary(result)).toContain("gate-set-delta");
      expect(errorSummary(result)).toContain("push-parity");
      expect(harness.landings).toHaveLength(0);
      expect(harness.transactions()).toHaveLength(0);
      expect(harness.waivers()).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });
});
