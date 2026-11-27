/**
 * TC-TRACKER-004 (no-key half) and the start of TC-CONTRACT-001 — the closed
 * dispatch contract surface (GH-347 AC-F4-4, NFR-3, NFR-11).
 *
 * The ladder is declared policy: no configuration key is added for it, and the
 * four consumed defaults are unchanged. The taxonomy, projections, exits, the
 * dispatch/queue error rows, and the attempt-record schema version are pinned
 * against the delivered baseline. Phase 7 extends the same file with
 * CONTRACT-001's full closed-surface pin.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DELIVERY_RESULT_TAXONOMY,
  DELIVERY_RESULT_TOKENS,
  DISPATCH_ATTEMPT_PAYLOAD_SCHEMA,
  DISPATCH_COMPARISON_REASONS,
  DISPATCH_CORROBORATION_SOURCES,
  DISPATCH_LANE_PUSH_VERDICTS,
  DISPATCH_PUSH_CAUSES,
  DISPATCH_PUSH_GUARD_ONLY_CAUSES,
  DISPATCH_PUSH_RECORDABLE_CAUSES,
  DISPATCH_PUSH_VERDICTS,
  dispatchLanePushCauseEvidenceRef,
  dispatchLanePushEvidenceRef,
  dispatchPushEvidenceRef,
  ERROR_TABLE,
} from "../../packages/core/src/contracts/index";
import {
  classifyDispatchFailure,
  DISPATCH_FAILURE_KINDS,
  DISPATCH_READ_FAILURE_SOURCES,
  type DispatchFailureKind,
} from "../../packages/core/src/domain/dispatch-result";
import { LANE_BRANCH, PRODUCTION_CATALOG, resolveConfig } from "../../packages/core/src/index";

const ROOT = process.cwd();

const exitOf = (token: string): number | undefined => {
  const row = DELIVERY_RESULT_TAXONOMY.find((entry) => entry.token === token);
  if (row === undefined) return undefined;
  return row.projectionClass === "success" ? 0 : row.projectionClass === "user-validation" ? 1 : 2;
};

describe("TC-TRACKER-004 the ladder adds no configuration key", () => {
  test("the lane branch carries the delivered keys plus the GH-404 worktree settings and the GH-413 peak-pausing setting", () => {
    expect(Object.keys(LANE_BRANCH.fields)).toEqual([
      "liveness-interval",
      "restart-budget",
      "worktree-root",
      "disable-worktrees",
      "disable-peak-pausing",
    ]);
    for (const forbidden of ["tracker", "ladder", "attempts", "base-ms", "cap-ms"]) {
      expect(Object.keys(LANE_BRANCH.fields)).not.toContain(forbidden);
    }
  });

  test("no terminate-grace or ladder key enters the production catalog", () => {
    const serialized = JSON.stringify(PRODUCTION_CATALOG);
    for (const forbidden of [
      "terminate-grace",
      "tracker-ladder",
      "claim-fence",
      "ladder-attempts",
    ]) {
      expect(serialized, forbidden).not.toContain(forbidden);
    }
  });

  test("the four consumed defaults are unchanged", () => {
    const resolved = resolveConfig({ sources: [] });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const values = resolved.value.values as Readonly<Record<string, unknown>>;
    const branch = (name: string): Readonly<Record<string, unknown>> =>
      (values[name] ?? {}) as Readonly<Record<string, unknown>>;
    expect(branch("lane")["liveness-interval"]).toBe(30000);
    expect(branch("lane")["restart-budget"]).toBe(3);
    expect(branch("coordinator")["kill-grace"]).toBe(20000);
    expect(branch("queue")["lease-ttl"]).toBe(90000);
  });

  test("the ladder module resolves no ambient timer", () => {
    const source = readFileSync(join(ROOT, "packages/core/src/domain/dispatch-tracker.ts"), "utf8");
    for (const marker of ["setTimeout", "setInterval", "node:timers", "Bun.sleep"]) {
      expect(source).not.toContain(marker);
    }
  });
});

describe("TC-CONTRACT-001 the closed dispatch surface is unchanged", () => {
  test("the eleven tokens and their order are the delivered baseline", () => {
    expect([...DELIVERY_RESULT_TOKENS]).toEqual([
      "merged",
      "blocked",
      "pr-open",
      "pr-open-unverified",
      "failed",
      "finished",
      "max-restarts",
      "state-unverified",
      "partial",
      "noop-lane-permission",
      "noop-lane-nothing-to-do",
    ]);
    expect(DELIVERY_RESULT_TAXONOMY).toHaveLength(11);
  });

  test("state-unverified is exit 2 and partial is exit 1", () => {
    expect(exitOf("state-unverified")).toBe(2);
    expect(exitOf("partial")).toBe(1);
    expect(exitOf("max-restarts")).toBe(1);
    expect(exitOf("blocked")).toBe(0);
    expect(exitOf("pr-open")).toBe(0);
  });

  test("the dispatch and queue error rows are the delivered closed sets", () => {
    const codes = (prefix: string): readonly string[] =>
      ERROR_TABLE.filter((row) => row.code.startsWith(prefix))
        .map((row) => row.code)
        .sort();
    expect(codes("dispatch.")).toEqual([
      "dispatch.restart-budget-exceeded",
      "dispatch.resume-parked",
      "dispatch.resume-uneconomical",
      "dispatch.session.spawn-failed",
      "dispatch.state-unverified",
    ]);
    expect(codes("queue.")).toEqual([
      "queue.dependency-cycle",
      "queue.entry.unobserved",
      "queue.lease-conflict",
      "queue.park-condition-stuck",
      "queue.precondition.unmet",
      "queue.reason-missing",
      "queue.single-flight",
    ]);
  });

  test("the attempt-record schema version is unchanged", () => {
    expect(DISPATCH_ATTEMPT_PAYLOAD_SCHEMA).toBe("delivery.dispatch.attempt.v1");
  });

  test("the configuration branches are exactly the ten declared ones", () => {
    const resolved = resolveConfig({ sources: [] });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(Object.keys(resolved.value.values).sort()).toEqual([
      "commit",
      "coordinator",
      "daemon",
      "github",
      "harness",
      "lane",
      "merge",
      "poll",
      "provider",
      "queue",
    ]);
    // No terminate-grace, tracker, ladder, or attempt key exists anywhere.
    const serialized = JSON.stringify(resolved.value.values);
    for (const forbidden of ["terminate-grace", "tracker-ladder", "ladder-attempts"]) {
      expect(serialized, forbidden).not.toContain(forbidden);
    }
  });

  test("the projection of each dispatch/queue row is unchanged", () => {
    const projections = (prefix: string): Record<string, string> =>
      Object.fromEntries(
        ERROR_TABLE.filter((row) => row.code.startsWith(prefix)).map((row) => [
          row.code,
          row.projectionClass,
        ]),
      );
    expect(projections("dispatch.")).toEqual({
      "dispatch.restart-budget-exceeded": "user-validation",
      "dispatch.resume-uneconomical": "user-validation",
      "dispatch.session.spawn-failed": "user-validation",
      "dispatch.state-unverified": "platform-provider",
      "dispatch.resume-parked": "platform-provider",
    });
    expect(projections("queue.single-flight")).toEqual({
      "queue.single-flight": "user-validation",
    });
    expect(projections("queue.lease-conflict")).toEqual({
      "queue.lease-conflict": "user-validation",
    });
  });
});

/* ------------------------------------------------------------------------- */
/* TC-FAIL-003 (GH-386) — vocabulary closure: the whole change is exactly one */
/* failure-mapping row and one comparison-reason literal; no token, error     */
/* identity, error-table row, record kind, derivation arm, or corroboration   */
/* source exists anywhere.                                                    */
/* ------------------------------------------------------------------------- */

describe("GH-386 the closed vocabulary stays closed (TC-FAIL-003)", () => {
  test("the failure-classification table gained exactly one row and every delivered row is byte-identical", () => {
    expect([...DISPATCH_FAILURE_KINDS]).toEqual([
      "spawn-failed",
      "state-unreadable",
      "restart-budget-exceeded",
      "resume-uneconomical",
      "lifecycle-push-failure",
    ]);
    const row = classifyDispatchFailure({ kind: "lifecycle-push-failure" });
    // The pinned row of spec Appendix B, verbatim, in the delivered table shape.
    expect(row).toEqual({
      kind: "lifecycle-push-failure",
      code: null,
      token: "failed",
      outcome: "failed",
      projectionClass: "user-validation",
      attemptRecords: 1,
      comparisonReason: "push-parity-unmet",
    });
    // Exit 1 arrives only through the delivered user-validation projection.
    expect(exitOf(row.token)).toBe(1);
  });

  test("every delivered failure row keeps its identity; the new row carries none", () => {
    const codes = (kind: DispatchFailureKind): string | null =>
      classifyDispatchFailure({ kind }).code;
    expect(codes("spawn-failed")).toBe("dispatch.session.spawn-failed");
    expect(codes("state-unreadable")).toBe("dispatch.state-unverified");
    expect(codes("restart-budget-exceeded")).toBe("dispatch.restart-budget-exceeded");
    expect(codes("resume-uneconomical")).toBe("dispatch.resume-uneconomical");
    expect(codes("lifecycle-push-failure")).toBeNull();
  });

  test("the comparison-reason vocabulary gained exactly the one declared literal", () => {
    expect([...DISPATCH_COMPARISON_REASONS]).toEqual([
      "dispatch-session-family",
      "comparison-source-unavailable",
      "push-parity-unmet",
    ]);
  });

  test("the push-verdict union is closed and has exactly its three members", () => {
    expect([...DISPATCH_PUSH_VERDICTS]).toEqual(["clean", "pushed", "failed"]);
    expect(dispatchPushEvidenceRef("clean")).toBe("push:clean");
    expect(dispatchPushEvidenceRef("pushed")).toBe("push:pushed");
    expect(dispatchPushEvidenceRef("failed")).toBe("push:failed");
  });

  test("no error-table row, token, attempt schema, or corroboration source grew", () => {
    // The delivered dispatch identity set is unchanged (no new error identity).
    const codes = (prefix: string): readonly string[] =>
      ERROR_TABLE.filter((row) => row.code.startsWith(prefix))
        .map((row) => row.code)
        .sort();
    expect(codes("dispatch.")).toEqual([
      "dispatch.restart-budget-exceeded",
      "dispatch.resume-parked",
      "dispatch.resume-uneconomical",
      "dispatch.session.spawn-failed",
      "dispatch.state-unverified",
    ]);
    expect(DELIVERY_RESULT_TAXONOMY).toHaveLength(11);
    expect(DISPATCH_ATTEMPT_PAYLOAD_SCHEMA).toBe("delivery.dispatch.attempt.v1");
    expect([...DISPATCH_CORROBORATION_SOURCES]).toEqual(["pm-notes", "tracker", "ci"]);
    expect([...DISPATCH_READ_FAILURE_SOURCES]).toEqual(["ledger", "tracker", "artifact", "state"]);
  });
});

/* ------------------------------------------------------------------------- */
/* GH-416 — the lane-push refusal-cause vocabulary is closed (TC-LCAUSE-001's */
/* vocabulary pin and TC-LCAUSE-002's cause-set pin). The eight-token set is   */
/* unchanged; the split is one guard-only token and seven recordable causes.   */
/* ------------------------------------------------------------------------- */

describe("GH-416 the lane-push cause set is closed", () => {
  test("the closed set is exactly the eight declared members, in declared order", () => {
    expect([...DISPATCH_PUSH_CAUSES]).toEqual([
      "protected-ref",
      "non-fast-forward",
      "auth-rejected",
      "remote-unavailable",
      "spawn-failed",
      "timed-out",
      "unsafe-branch",
      "unclassified",
    ]);
  });

  test("one guard-only token: `unsafe-branch` and nothing else", () => {
    expect([...DISPATCH_PUSH_GUARD_ONLY_CAUSES]).toEqual(["unsafe-branch"]);
  });

  test("seven recordable causes, with `protected-ref` as the delivered literal", () => {
    expect([...DISPATCH_PUSH_RECORDABLE_CAUSES]).toEqual([
      "non-fast-forward",
      "auth-rejected",
      "remote-unavailable",
      "spawn-failed",
      "timed-out",
      "protected-ref",
      "unclassified",
    ]);
    expect(DISPATCH_PUSH_RECORDABLE_CAUSES).toContain("protected-ref");
  });

  test("the two segments partition the closed set: disjoint and complete", () => {
    const guardOnly: readonly string[] = DISPATCH_PUSH_GUARD_ONLY_CAUSES;
    const recordable: readonly string[] = DISPATCH_PUSH_RECORDABLE_CAUSES;
    expect(guardOnly.some((token) => recordable.includes(token))).toBe(false);
    expect(new Set([...guardOnly, ...recordable]).size).toBe(DISPATCH_PUSH_CAUSES.length);
    expect([...DISPATCH_PUSH_CAUSES].sort()).toEqual([...guardOnly, ...recordable].sort());
  });

  test("the lane-push verdicts are the closed pair and the evidence builders are distinct", () => {
    expect([...DISPATCH_LANE_PUSH_VERDICTS]).toEqual(["pushed", "failed"]);
    expect(dispatchLanePushEvidenceRef("pushed")).toBe("lane-push:pushed");
    expect(dispatchLanePushEvidenceRef("failed")).toBe("lane-push:failed");
    expect(dispatchLanePushCauseEvidenceRef("non-fast-forward")).toBe(
      "lane-push-cause:non-fast-forward",
    );
    // The two prefix families never collapse.
    expect(dispatchLanePushEvidenceRef("failed").startsWith("push:")).toBe(false);
    expect(dispatchPushEvidenceRef("failed").startsWith("lane-push:")).toBe(false);
  });

  test("the old spelling `protected-branch` is not a token", () => {
    expect(DISPATCH_PUSH_CAUSES).not.toContain("protected-branch");
  });
});
