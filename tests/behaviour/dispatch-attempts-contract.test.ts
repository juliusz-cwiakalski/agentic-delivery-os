/**
 * GH-289 pure projection and page-shape cells (TC-ATTEMPT-006, 007, 008, 005 and
 * the ordering half of TC-ATTEMPT-004), asserted over the domain helper before
 * the command surface exists.
 *
 * The sixteen-field exact set, the singular `divergenceRef` (present and
 * explicitly `null`), the `endedAt` mapping, the comparison projection with its
 * `not-applicable` null token, the total order, and the `matched`/`hasMore`
 * relation are the phase-1 obligations; their command-level cells complete with
 * the `attempts` branch.
 */
import { describe, expect, test } from "bun:test";
import { DISPATCH_ATTEMPT_PAYLOAD_SCHEMA } from "../../packages/core/src/contracts/index";
import {
  orderAttempts,
  projectAttempt,
  selectAttemptsPage,
} from "../../packages/core/src/domain/dispatch-attempts";
import { DISPATCH_NOW } from "../fixtures/dispatch/harness";
import { ATTEMPTS_REF, ledgerOf } from "../fixtures/dispatch/attempt-records";
import { comparisonForToken, makeAttempt, REPOSITORY } from "../fixtures/dispatch/ledger";

const DECLARED_FIELDS = [
  "attemptId",
  "repository",
  "ref",
  "harness",
  "evidenceClass",
  "outcome",
  "token",
  "startedAt",
  "endedAt",
  "divergenceRef",
  "corroboration",
  "falseSuccess",
  "comparison",
  "resumeMode",
  "evidenceRefs",
  "recordedAt",
] as const;

describe("TC-ATTEMPT-006 sixteen-field projection", () => {
  test("a projected attempt carries exactly the declared fields and nothing wider", () => {
    const view = projectAttempt(
      makeAttempt({
        token: "merged",
        attemptId: "A-1",
        divergenceRef: "DIV-1",
        resumeMode: "attach-continue",
      }),
    );
    expect(Object.keys(view).sort()).toEqual([...DECLARED_FIELDS].sort());
    for (const absent of [
      "schema",
      "handoverState",
      "prefillCostAcknowledged",
      "divergenceRefs",
      "finishedAt",
    ]) {
      expect(Object.hasOwn(view, absent)).toBe(false);
    }
    expect(view.divergenceRef).toBe("DIV-1");
  });

  test("a record without a divergence reference projects an explicit null", () => {
    const view = projectAttempt(makeAttempt({ token: "merged" }));
    expect(Object.hasOwn(view, "divergenceRef")).toBe(true);
    expect(view.divergenceRef).toBeNull();
    expect(view.resumeMode).toBeNull();
  });

  test("the projection maps the stored record one-to-one", () => {
    const record = makeAttempt({
      token: "merged",
      attemptId: "A-9",
      repository: REPOSITORY,
      ref: ATTEMPTS_REF,
      harness: "claude-code",
      evidenceClass: "smoke",
      startedAt: DISPATCH_NOW,
      finishedAt: "2026-11-08T10:05:00.000Z",
      recordedAt: "2026-11-08T10:06:00.000Z",
      evidenceRefs: ["evid:one", "evid:two"],
    });
    const view = projectAttempt(record);
    expect(view.endedAt).toBe(record.finishedAt);
    expect(view.startedAt).toBe(record.startedAt);
    expect(view.recordedAt).toBe(record.recordedAt);
    expect(view.token).toBe("merged");
    expect(view.harness).toBe("claude-code");
    expect(view.evidenceClass).toBe("smoke");
    expect(view.evidenceRefs).toEqual(["evid:one", "evid:two"]);
    expect(view.corroboration).toEqual(record.corroboration);
    expect(view.corroboration.pmNotes).toBeDefined();
    expect(view.corroboration.tracker).toBeDefined();
    expect(view.corroboration.ci).toBeDefined();
  });

  test("a not-applicable comparison projects a null token and outcome", () => {
    const view = projectAttempt(
      makeAttempt({
        token: "max-restarts",
        attemptId: "A-10",
        comparison: comparisonForToken("max-restarts"),
      }),
    );
    expect(view.comparison).toEqual({
      class: "not-applicable",
      token: null,
      outcome: "not-applicable",
    });
  });

  test("a comparing attempt keeps the stored class, token and outcome", () => {
    const comparison = comparisonForToken("pr-open");
    const view = projectAttempt(makeAttempt({ token: "pr-open", attemptId: "A-11", comparison }));
    expect(view.comparison.class).toBe(comparison.class);
    expect(view.comparison.token).toBe(comparison.token);
    expect(view.comparison.outcome).toBe(comparison.outcome);
  });
});

describe("TC-ATTEMPT-004 total order across identical start instants", () => {
  const at = (attemptId: string, recordedAt: string): ReturnType<typeof makeAttempt> =>
    makeAttempt({
      token: "merged",
      attemptId,
      startedAt: DISPATCH_NOW,
      recordedAt,
      schema: DISPATCH_ATTEMPT_PAYLOAD_SCHEMA,
    });

  test("recordedAt descending then attemptId ascending is a total order", () => {
    const rows = [
      at("A-2", "2026-11-08T10:02:00.000Z"),
      at("A-3", "2026-11-08T10:01:00.000Z"),
      at("A-1", "2026-11-08T10:02:00.000Z"),
    ];
    expect(orderAttempts(rows).map((row) => row.attemptId)).toEqual(["A-1", "A-2", "A-3"]);
  });

  test("the order is independent of insertion order and stable across runs", () => {
    const ascending = [
      at("A-1", "2026-11-08T10:01:00.000Z"),
      at("A-2", "2026-11-08T10:02:00.000Z"),
    ];
    const descending = [...ascending].reverse();
    const first = orderAttempts(ascending).map((row) => row.attemptId);
    const second = orderAttempts(descending).map((row) => row.attemptId);
    expect(first).toEqual(second);
    expect(orderAttempts(ascending).map((row) => row.attemptId)).toEqual(first);
  });
});

describe("TC-ATTEMPT-005 matched and hasMore", () => {
  const page = (count: number, limit: number) =>
    selectAttemptsPage({
      records: ledgerOf(count, { evidenceRefs: ["evid:one"] }),
      repository: REPOSITORY,
      ref: ATTEMPTS_REF,
      refSource: "flag",
      limit,
    });

  test("three of three reports matched 3 and no more", () => {
    const data = page(3, 3);
    expect(data.matched).toBe(3);
    expect(data.hasMore).toBe(false);
    expect(data.attempts).toHaveLength(3);
  });

  test("a shortened page reports hasMore true and matched unchanged", () => {
    const data = page(3, 2);
    expect(data.matched).toBe(3);
    expect(data.hasMore).toBe(true);
    expect(data.attempts).toHaveLength(2);
  });

  test("no match reports matched 0, hasMore false and an empty page", () => {
    const data = selectAttemptsPage({
      records: ledgerOf(3),
      repository: REPOSITORY,
      ref: "GH-999",
      refSource: "flag",
      limit: 20,
    });
    expect(data.matched).toBe(0);
    expect(data.hasMore).toBe(false);
    expect(data.attempts).toEqual([]);
    expect(data.truncation).toBeUndefined();
  });
});
