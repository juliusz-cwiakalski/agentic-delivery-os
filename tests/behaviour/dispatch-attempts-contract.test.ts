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
import {
  DISPATCH_ATTEMPT_PAYLOAD_SCHEMA,
  type DispatchAttemptsData,
} from "../../packages/core/src/contracts/index";
import {
  orderAttempts,
  projectAttempt,
  selectAttemptsPage,
} from "../../packages/core/src/domain/dispatch-attempts";
import {
  ATTEMPTS_REF,
  ledgerOf,
  maximalAttempt,
  maximalEvidenceRefs,
} from "../fixtures/dispatch/attempt-records";
import { createAttemptsHarness } from "../fixtures/dispatch/attempts-harness";
import { DISPATCH_NOW } from "../fixtures/dispatch/harness";
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

describe("TC-ATTEMPT-006..008 command-level projection", () => {
  test("every returned row carries exactly the sixteen declared fields", async () => {
    const harness = createAttemptsHarness({ label: "contract-command", records: ledgerOf(3) });
    try {
      const result = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--json",
      ]);
      expect(result.exit).toBe(0);
      const data = result.data as DispatchAttemptsData;
      for (const row of data.attempts) {
        expect(Object.keys(row).sort()).toEqual([...DECLARED_FIELDS].sort());
        for (const absent of [
          "schema",
          "handoverState",
          "prefillCostAcknowledged",
          "divergenceRefs",
        ]) {
          expect(Object.hasOwn(row, absent)).toBe(false);
        }
        expect(typeof row.divergenceRef === "string" || row.divergenceRef === null).toBe(true);
      }
    } finally {
      harness.dispose();
    }
  });

  test("stored instants are projected and printed unmodified", async () => {
    const record = maximalAttempt({
      attemptId: "A-INSTANT",
      startedAt: "2026-11-08T10:00:00.123Z",
      finishedAt: "2026-11-08T10:05:00.456Z",
      recordedAt: "2026-11-08T10:06:00.789Z",
    });
    const harness = createAttemptsHarness({ label: "contract-instants", records: [record] });
    try {
      const machine = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--json",
      ]);
      const row = (machine.data as DispatchAttemptsData).attempts[0];
      expect(row?.endedAt).toBe(record.finishedAt);
      expect(row?.startedAt).toBe(record.startedAt);
      expect(row?.recordedAt).toBe(record.recordedAt);
      expect(row?.corroboration).toEqual(record.corroboration);
      const human = await harness.invoke(["dispatch", "attempts", "--ref", ATTEMPTS_REF]);
      expect(human.stdout).toContain("2026-11-08T10:00:00.123Z");
    } finally {
      harness.dispose();
    }
  });

  test("the comparison projection carries the null token only when not applicable", async () => {
    const harness = createAttemptsHarness({
      label: "contract-comparison",
      records: [
        maximalAttempt({ attemptId: "A-COMPARE", comparison: comparisonForToken("merged") }),
        maximalAttempt({
          attemptId: "A-NOT-APPLICABLE",
          token: "max-restarts",
          comparison: comparisonForToken("max-restarts"),
        }),
      ],
    });
    try {
      const result = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--json",
      ]);
      const rows = (result.data as DispatchAttemptsData).attempts;
      const notApplicable = rows.find((row) => row.attemptId === "A-NOT-APPLICABLE");
      expect(notApplicable?.comparison).toEqual({
        class: "not-applicable",
        token: null,
        outcome: "not-applicable",
      });
      const comparing = rows.find((row) => row.attemptId === "A-COMPARE");
      expect(comparing?.comparison.class).toBe("tracker-truth");
      expect(comparing?.comparison.token).toBe("merged");
    } finally {
      harness.dispose();
    }
  });

  test("matched and hasMore describe the page's relation to the match set", async () => {
    const harness = createAttemptsHarness({ label: "contract-page", records: ledgerOf(3) });
    try {
      const full = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--limit",
        "3",
        "--json",
      ]);
      expect((full.data as DispatchAttemptsData).matched).toBe(3);
      expect((full.data as DispatchAttemptsData).hasMore).toBe(false);
      const short = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--limit",
        "2",
        "--json",
      ]);
      expect((short.data as DispatchAttemptsData).matched).toBe(3);
      expect((short.data as DispatchAttemptsData).hasMore).toBe(true);
      const none = await harness.invoke(["dispatch", "attempts", "--ref", "GH-999", "--json"]);
      expect(none.exit).toBe(0);
      expect((none.data as DispatchAttemptsData).matched).toBe(0);
      expect((none.data as DispatchAttemptsData).hasMore).toBe(false);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-ATTEMPT-028 cells 1-3 the read side carries no gate key", () => {
  /** The eight always-present envelope keys; `truncation` joins only when a bound binds. */
  const ENVELOPE_FIELDS = [
    "attempts",
    "excluded",
    "hasMore",
    "limit",
    "matched",
    "ref",
    "refSource",
    "repository",
  ] as const;

  test("a page with no bound binding carries exactly the eight envelope keys", async () => {
    const harness = createAttemptsHarness({ label: "envelope-plain", records: ledgerOf(5) });
    try {
      const result = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--limit",
        "3",
        "--json",
      ]);
      expect(result.exit).toBe(0);
      const data = result.data as DispatchAttemptsData;
      expect(Object.keys(data).sort()).toEqual([...ENVELOPE_FIELDS].sort());
      expect(Object.hasOwn(data, "truncation")).toBe(false);
    } finally {
      harness.dispose();
    }
  });

  test("a bound-binding read adds exactly `truncation` and no other key", async () => {
    const harness = createAttemptsHarness({
      label: "envelope-bound",
      records: ledgerOf(100, { evidenceRefs: maximalEvidenceRefs() }),
    });
    try {
      const result = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--limit",
        "100",
        "--json",
      ]);
      expect(result.exit).toBe(0);
      const data = result.data as DispatchAttemptsData & {
        readonly truncation: { readonly scope: string };
      };
      expect(Object.keys(data).sort()).toEqual([...ENVELOPE_FIELDS, "truncation"].sort());
      expect(data.truncation.scope).toBe("page");
    } finally {
      harness.dispose();
    }
  });

  test("no coverage, floor, verdict, eligibility or unmetConditions key at any depth", async () => {
    const harness = createAttemptsHarness({ label: "contract-gate-keys", records: ledgerOf(4) });
    try {
      const result = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--json",
      ]);
      const forbidden = ["coverage", "floor", "verdict", "eligibility", "unmetConditions"];
      const walk = (value: unknown): void => {
        if (Array.isArray(value)) {
          for (const entry of value) walk(entry);
          return;
        }
        if (typeof value !== "object" || value === null) return;
        for (const [key, nested] of Object.entries(value)) {
          expect(forbidden, key).not.toContain(key);
          walk(nested);
        }
      };
      walk(result.data);
      // The read performs one ledger read and never touches the gate surfaces.
      expect(result.readCount).toBe(1);
    } finally {
      harness.dispose();
    }
  });
});
