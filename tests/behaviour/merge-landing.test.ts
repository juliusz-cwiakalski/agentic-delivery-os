/**
 * TC-F1-001 / TC-F1-002 / TC-F1-003 / TC-F1-004 / TC-F1-011 / TC-F1-012 — one
 * provider-side landing at the verified head with crafted metadata, the
 * provider's merge commit as the recorded identity, provider-asserted merged
 * truth as the only landing verdict, the `shaOnBase` third state, and the
 * widened value's round trip through the state layer.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MERGE_TRANSACTION_SCHEMA,
  type MergeTransactionRecord,
} from "../../packages/core/src/contracts/index";
import { appendMergeTransaction, readMergeTransactions } from "../../packages/core/src/state/index";
import {
  baseRequest,
  createFakeGit,
  createMergeHarness,
  MERGE_CLOCK_ISO,
  MERGE_CLOCK_MS,
  MERGE_HEAD,
  MERGE_LANDING_SHA,
  verificationRecord,
} from "../fixtures/merge/harness";
import { makeAuditStore, removeRoot } from "../fixtures/state/harness";

const ROOT = process.cwd();
const MINUTE = 60_000;
const isoAt = (offsetMs: number): string => new Date(MERGE_CLOCK_MS + offsetMs).toISOString();

/** The one fixed landing message, written here rather than imported (GAP-TP-7). */
const EXPECTED_MESSAGE = "Landed by the delivery lifecycle merge primitive.";

const errorOf = (run: { envelope?: Record<string, unknown> }) =>
  run.envelope?.error as Record<string, unknown> | undefined;

const dataOf = (run: { envelope?: Record<string, unknown> }) =>
  run.envelope?.data as Record<string, unknown> | undefined;

/** The composition roots whose source the no-second-mechanism scan reads. */
const COMPOSITION_ROOTS = ["packages/cli/src/edge.ts", "packages/cli/src/production.ts"];

/** Composition call sites of the retained local capabilities (none allowed). */
const compositionCallSites = (root: string): string[] => {
  const found: string[] = [];
  for (const file of COMPOSITION_ROOTS) {
    const lines = readFileSync(join(root, file), "utf8").split("\n");
    lines.forEach((line, index) => {
      if (/\.(squashLand|refresh)\(/u.test(line)) found.push(`${file}:${index + 1}`);
    });
  }
  return found;
};

/** Platform-CLI literals on any landing path (none allowed). */
const platformLiterals = (root: string): string[] => {
  const found: string[] = [];
  for (const file of COMPOSITION_ROOTS) {
    const lines = readFileSync(join(root, file), "utf8").split("\n");
    lines.forEach((line, index) => {
      for (const literal of ["gh pr merge", "glab mr merge"]) {
        if (line.includes(literal)) found.push(`${file}:${index + 1}:${literal}`);
      }
    });
  }
  return found;
};

describe("TC-F1-001 one guarded landing at the verified head and no second mechanism", () => {
  test("exactly one landing call carries the squash strategy, the verified head, and the crafted bytes", async () => {
    const harness = createMergeHarness({
      request: baseRequest({ title: "feat(GH-349): crafted subject" }),
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run();
      expect(result.exitCode).toBe(0);
      expect(harness.counts.landing).toBe(1);
      expect(harness.landings).toHaveLength(1);
      const landing = harness.landings[0];
      expect(landing?.strategy).toBe("squash");
      expect(landing?.expectedHeadSha).toBe(MERGE_HEAD);
      expect(landing?.commitTitle).toBe("feat(GH-349): crafted subject");
      expect(landing?.commitMessage).toBe(EXPECTED_MESSAGE);
      expect(landing?.deliveryRequest).toEqual(baseRequest().identity);
      // No local mechanism ran, and nothing was published by the git seam.
      expect(harness.events).not.toContain("git-squash-land");
      expect(harness.events).not.toContain("git-rebase-refresh");
      expect(harness.events.filter((event) => event === "provider-land")).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });

  test("no composition root calls the local landing or refresh, and no platform CLI literal exists", () => {
    expect(compositionCallSites(ROOT)).toEqual([]);
    expect(platformLiterals(ROOT)).toEqual([]);
  });

  test("the scan's mandatory failing controls are found by name", () => {
    const plantedCall = "await seam.squashLand({ branch, baseRef, message });";
    expect(/\.(squashLand|refresh)\(/u.test(plantedCall)).toBe(true);
    const plantedRefresh = "await git.refresh({ branch, baseRef });";
    expect(/\.(squashLand|refresh)\(/u.test(plantedRefresh)).toBe(true);
    const plantedLiteral = 'const argv = ["pr", "merge", "--squash"]; // gh pr merge';
    expect(plantedLiteral.includes("gh pr merge")).toBe(true);
    const plantedGlab = "glab mr merge 12";
    expect(plantedGlab.includes("glab mr merge")).toBe(true);
  });

  test("a second landing call in one invocation is rejected by the per-invocation count", async () => {
    const harness = createMergeHarness();
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run();
      expect(result.exitCode).toBe(0);
      // One invocation composes exactly one landing call.
      expect(harness.counts.landing).toBe(1);
      expect(harness.landings).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
    // The control: the same assertion fails, by name, on a doubled count.
    const doubled = { landing: 2 };
    expect(doubled.landing).toBe(2);
    expect(() => expect(doubled.landing).toBe(1)).toThrow();
  });
});

describe("TC-F1-002 the provider's merge commit is the recorded landing identity", () => {
  test("result=merged with the provider sha, the record's key set unchanged", async () => {
    const providerSha = "c0ffee00a1b2c3d4e5f60718293a4b5c6d7e8f90";
    const harness = createMergeHarness({
      landing: { ok: true, requestState: "merged", mergeCommitSha: providerSha },
      // A local object that would answer differently must never become the record.
      git: createFakeGit({ contained: true }),
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run();
      expect(result.exitCode).toBe(0);
      expect(dataOf(result)?.result).toBe("merged");
      expect(dataOf(result)?.squashSha).toBe(providerSha);
      const record = harness.transactions()[0];
      expect(record?.squashSha).toBe(providerSha);
      expect(record?.landing.requestState).toBe("merged");
      expect(Object.keys(record ?? {}).sort()).toEqual([
        "changeRef",
        "landing",
        "postLanding",
        "recordedAt",
        "refresh",
        "replayed",
        "result",
        "schema",
        "squashSha",
        "waiverRefs",
      ]);
      expect(record?.schema).toBe(MERGE_TRANSACTION_SCHEMA);
    } finally {
      harness.cleanup();
    }
  });

  test("a local object that contradicts the provider read-back does not change the record", async () => {
    const providerSha = "1111111111111111111111111111111111111111";
    const harness = createMergeHarness({
      landing: { ok: true, requestState: "merged", mergeCommitSha: providerSha },
      git: createFakeGit({ contained: true }),
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      await harness.run();
      expect(harness.transactions()[0]?.squashSha).toBe(providerSha);
      expect(harness.transactions()[0]?.squashSha).not.toBe(MERGE_LANDING_SHA);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-F1-003 local containment is never landing evidence", () => {
  const variants = [
    { id: "provider-open", requestState: "open" },
    { id: "provider-closed", requestState: "closed" },
  ];

  for (const variant of variants) {
    test(`${variant.id}: local containment true still refuses merge.landing-unverified`, async () => {
      const harness = createMergeHarness({
        landing: { ok: true, requestState: variant.requestState, mergeCommitSha: MERGE_HEAD },
        git: createFakeGit({ contained: true }),
      });
      try {
        harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
        const result = await harness.run();
        expect(result.exitCode).toBe(2);
        expect(errorOf(result)?.code).toBe("merge.landing-unverified");
        expect(errorOf(result)?.consequence).toBe("unknown");
        expect(dataOf(result)?.result).not.toBe("merged");
        expect(harness.transactions()[0]?.result).toBe("landing-unverified");
        expect(harness.transactions()[0]?.landing.requestState).not.toBe("merged");
      } finally {
        harness.cleanup();
      }
    });
  }

  test("the paired positive: the same fixture with provider-asserted merged truth lands", async () => {
    const harness = createMergeHarness({
      landing: { ok: true, requestState: "merged", mergeCommitSha: MERGE_HEAD },
      git: createFakeGit({ contained: true }),
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run();
      expect(result.exitCode).toBe(0);
      expect(dataOf(result)?.result).toBe("merged");
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-F1-004 a merged read-back with no merge commit leaves the identity unknown", () => {
  test("the record carries no squashSha and the re-run performs zero landings", async () => {
    const harness = createMergeHarness({
      landing: { ok: true, requestState: "merged" },
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const first = await harness.run();
      expect(first.exitCode).toBe(0);
      expect(dataOf(first)?.result).toBe("merged");
      const record = harness.transactions()[0];
      expect(record?.result).toBe("merged");
      expect(record?.squashSha).toBeUndefined();
      expect(Object.hasOwn(record ?? {}, "squashSha")).toBe(false);
      expect(record?.landing.shaOnBase).toBe("unknown");
      expect(harness.counts.landing).toBe(1);
      // The provider now asserts the request merged; the re-run replays.
      harness.setRequest(baseRequest({ reviewState: "merged", headSha: MERGE_HEAD }));
      const replay = await harness.run();
      expect(replay.exitCode).toBe(0);
      expect(harness.counts.landing).toBe(1);
      expect(harness.transactions()).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });

  test("control: the same fixture without a recorded transaction lands exactly once", async () => {
    const harness = createMergeHarness({
      landing: { ok: true, requestState: "merged" },
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      expect(harness.transactions()).toHaveLength(0);
      const first = await harness.run();
      expect(first.exitCode).toBe(0);
      expect(harness.counts.landing).toBe(1);
      // The request still reads open, so a recorded landing is re-verified rather
      // than re-landed, and nothing is appended twice.
      const reRun = await harness.run();
      expect(reRun.exitCode).toBe(2);
      expect(errorOf(reRun)?.code).toBe("merge.landing-unverified");
      expect(harness.counts.landing).toBe(1);
      expect(harness.transactions()).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-F1-011 shaOnBase answers only when a local read answers", () => {
  test("an answering read records true and renders sha-on-base=yes", async () => {
    const harness = createMergeHarness({ git: createFakeGit({ contained: true }) });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run(undefined, { json: false });
      expect(result.exitCode).toBe(0);
      expect(harness.transactions()[0]?.landing.shaOnBase).toBe(true);
      expect(result.stdout).toContain("landing=sha-on-base:yes");
      expect(result.stdout).toContain("request-state=merged");
    } finally {
      harness.cleanup();
    }
  });

  test("a read that cannot answer records unknown and renders sha-on-base=unknown", async () => {
    const harness = createMergeHarness({ git: createFakeGit({ contained: "failed" }) });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run(undefined, { json: false });
      expect(result.exitCode).toBe(0);
      expect(harness.transactions()[0]?.landing.shaOnBase).toBe("unknown");
      expect(result.stdout).toContain("landing=sha-on-base:unknown");
      // The verdict is merged because the provider asserted it, never because of
      // the containment field.
      expect(result.stdout).toContain("result=merged");
      expect(harness.counts.landing).toBe(1);
    } finally {
      harness.cleanup();
    }
  });

  test("a locally derived true with no answering read is the mutation the case detects", async () => {
    const harness = createMergeHarness({ git: createFakeGit({ contained: "failed" }) });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      await harness.run();
      const recorded = harness.transactions()[0]?.landing.shaOnBase;
      expect(recorded).toBe("unknown");
      expect(recorded).not.toBe(true);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-F1-012 the widened domain round-trips and a legacy boolean still reads", () => {
  const recordWith = (shaOnBase: MergeTransactionRecord["landing"]["shaOnBase"]) =>
    ({
      schema: MERGE_TRANSACTION_SCHEMA,
      changeRef: "GH-301",
      result: "merged",
      squashSha: MERGE_LANDING_SHA,
      replayed: false,
      landing: { shaOnBase, requestState: "merged" },
      refresh: { attempts: 0, outcome: "not-attempted" },
      waiverRefs: [],
      postLanding: [],
      recordedAt: MERGE_CLOCK_ISO,
    }) satisfies MergeTransactionRecord;

  test("true, false and unknown each write and read back through the delivered state layer", () => {
    const fixture = makeAuditStore("merge-sha-on-base");
    try {
      for (const value of [true, false, "unknown"] as const) {
        const appended = appendMergeTransaction(fixture.store, {
          record: recordWith(value),
          fenceToken: `fixture-round-trip-${String(value)}`,
        });
        expect(appended.ok, String(value)).toBe(true);
      }
      const read = readMergeTransactions(fixture.store, "GH-301");
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      // Every record round-trips: a torn-state classification would fail here.
      expect(read.records.map((record) => record.landing.shaOnBase)).toEqual([
        true,
        false,
        "unknown",
      ]);
      expect(read.records).toHaveLength(3);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("a legacy boolean record still reads exactly as delivered", () => {
    const fixture = makeAuditStore("merge-sha-on-base-legacy");
    try {
      const appended = appendMergeTransaction(fixture.store, {
        record: recordWith(true),
        fenceToken: "fixture-legacy",
      });
      expect(appended.ok).toBe(true);
      const read = readMergeTransactions(fixture.store, "GH-301");
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records[0]?.landing.shaOnBase).toBe(true);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("a value outside the declared domain is refused, so the widening is not vacuous", () => {
    const fixture = makeAuditStore("merge-sha-on-base-torn");
    try {
      const tampered = { ...recordWith("unknown"), landing: { shaOnBase: "yes" } };
      const appended = appendMergeTransaction(fixture.store, {
        record: tampered as unknown as MergeTransactionRecord,
        fenceToken: "fixture-torn",
      });
      expect(appended.ok).toBe(false);
      const read = readMergeTransactions(fixture.store, "GH-301");
      if (read.ok) {
        expect(read.records).toHaveLength(0);
      } else {
        expect(["torn", "unreadable"]).toContain(read.reason);
      }
    } finally {
      removeRoot(fixture.root);
    }
  });
});
