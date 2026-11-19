/**
 * TC-F1-005 — the exact-head guard binds the landing to the evidence: the
 * expected head is the head the freshness envelope verified, a head that moved
 * refuses `merge.gates-stale` with zero landing calls, and a provider-side head
 * rejection is a classified refusal that is never retried.
 */
import { describe, expect, test } from "bun:test";
import {
  baseRequest,
  createFakeGit,
  createMergeHarness,
  MERGE_CLOCK_MS,
  MERGE_HEAD,
  verificationRecord,
} from "../fixtures/merge/harness";

const MINUTE = 60_000;
const isoAt = (offsetMs: number): string => new Date(MERGE_CLOCK_MS + offsetMs).toISOString();

const MOVED_HEAD = "a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1";

const errorOf = (run: { envelope?: Record<string, unknown> }) =>
  run.envelope?.error as Record<string, unknown> | undefined;

describe("TC-F1-005 a moved head refuses with exactly zero landing calls", () => {
  test("exit 1 with both SHAs and an empty landing log", async () => {
    const harness = createMergeHarness({
      git: createFakeGit({ head: MOVED_HEAD }),
      request: baseRequest({ headSha: MOVED_HEAD }),
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run(undefined, { json: false });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("merge.gates-stale");
      const error = errorOf(result);
      const summary = String(error?.summary ?? result.stderr);
      expect(summary).toContain(MERGE_HEAD.slice(0, 7));
      expect(summary).toContain(MOVED_HEAD.slice(0, 7));
      expect(harness.counts.landing).toBe(0);
      expect(harness.landings).toHaveLength(0);
      expect(harness.events).not.toContain("git-squash-land");
      expect(harness.transactions()).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });

  test("the control: the same fixture with an unmoved head lands exactly once", async () => {
    const harness = createMergeHarness({ git: createFakeGit({ head: MERGE_HEAD }) });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run();
      expect(result.exitCode).toBe(0);
      expect(harness.counts.landing).toBe(1);
      // The landing carried the verified head, which is the unmoved head.
      expect(harness.landings[0]?.expectedHeadSha).toBe(MERGE_HEAD);
    } finally {
      harness.cleanup();
    }
  });

  test("a provider-side head rejection is classified and never retried", async () => {
    const harness = createMergeHarness({
      landing: { ok: false, code: "head-mismatch" },
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      expect(errorOf(result)?.code).toBe("merge.transaction-aborted");
      expect(String(errorOf(result)?.summary)).toContain("head-mismatch");
      // Exactly one attempt: a rejected landing is never re-issued.
      expect(harness.counts.landing).toBe(1);
      expect(harness.transactions()).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });

  test("the mutation control: a landing composed at a stale head is rejected by the assertion", () => {
    const stale = "b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2";
    const landing = { expectedHeadSha: MERGE_HEAD };
    expect(landing.expectedHeadSha).not.toBe(stale);
    expect(() => expect({ expectedHeadSha: stale }.expectedHeadSha).toBe(MERGE_HEAD)).toThrow();
  });
});
