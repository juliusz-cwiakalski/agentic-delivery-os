/**
 * GH-289 TC-ATTEMPT-034 cells 1, 4, 5 and 7 — the delivered dispatch shapes are
 * unchanged, the attempts payload is a plain success discriminated by its
 * `attempts` array, and the four delivered forms still refuse an undeclared flag
 * at `fallback.invocation` now that the definition accepts any flag.
 *
 * Cell 7 runs over a store seam whose `read`/`readRecords` throw, so an
 * invocation that reaches the store fails the cell instead of returning an empty
 * store. Cell 6 is the additive-only diff inspection and is review-verified, so
 * it is not asserted here.
 */
import { describe, expect, test } from "bun:test";
import { appendDispatchAttempt } from "../../packages/core/src/app/dispatch-ledger";
import type { StateStorePort } from "../../packages/core/src/contracts/index";
import { ATTEMPTS_REF, ledgerOf } from "../fixtures/dispatch/attempt-records";
import { createAttemptsHarness } from "../fixtures/dispatch/attempts-harness";
import { buildAttempts, eligibleSpecs } from "../fixtures/dispatch/evidence-windows";
import { createOperatorHarness, OPERATOR_REF } from "../fixtures/dispatch/operator/harness";
import { createTranscriptDouble } from "../fixtures/dispatch/operator/transcript";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import { makeDivergence } from "../fixtures/dispatch/ledger";

const throwingStore = (store: StateStorePort): StateStorePort => ({
  ...store,
  read: () => {
    throw new Error("the store must not be read");
  },
  readRecords: () => {
    throw new Error("the store must not be read");
  },
});

describe("TC-ATTEMPT-034 cell 1 delivered data shapes and order", () => {
  test("the run envelope keeps its declared leading key order", () => {
    const scenario = createCommandScenario();
    return scenario
      .invoke(["dispatch", "GH-301", "--json"])
      .then((result) => {
        const data = result.envelope?.data as Record<string, unknown> | undefined;
        expect(data).toBeDefined();
        expect(Object.keys(data ?? {})).toEqual([
          "result",
          "prUrl",
          "phaseLedger",
          "restarts",
          "resumeAmplification",
          "harness",
          "handoverState",
          "outcome",
          "lastMessage",
        ]);
      })
      .finally(() => scenario.dispose());
  });

  test("the summary keeps its declared key order", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      const result = await scenario.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        "github.com/owner/repo",
        "--json",
      ]);
      const data = result.envelope?.data as Record<string, unknown> | undefined;
      expect(Object.keys(data ?? {})).toEqual([
        "repository",
        "windowStart",
        "windowStartReason",
        "windowEnd",
        "dayCount",
        "countedDeliveries",
        "countedEvidenceClass",
        "excludedEvidenceClasses",
        "incidents",
        "divergences",
        "coverage",
        "corroboration",
        "eligibility",
        "verdict",
        "unmetConditions",
        "floor",
        "cleanDispatches",
        "consecutiveCleanDispatches",
        "conditions",
      ]);
      // The delivered sixteen-key literal stays a prefix: nothing moved.
      expect(Object.keys(data ?? {}).slice(0, 16)).toEqual([
        "repository",
        "windowStart",
        "windowStartReason",
        "windowEnd",
        "dayCount",
        "countedDeliveries",
        "countedEvidenceClass",
        "excludedEvidenceClasses",
        "incidents",
        "divergences",
        "coverage",
        "corroboration",
        "eligibility",
        "verdict",
        "unmetConditions",
        "floor",
      ]);
      expect(Object.hasOwn(data ?? {}, "truncation")).toBe(false);
      expect(Array.isArray((data as { readonly unmetConditions?: unknown }).unmetConditions)).toBe(
        true,
      );
      expect(typeof (data as { readonly countedDeliveries?: unknown }).countedDeliveries).toBe(
        "number",
      );
      expect(typeof (data as { readonly floor?: unknown }).floor).toBe("object");
    } finally {
      scenario.dispose();
    }
  });

  test("the summary appends only, keeping truncation last when it binds", async () => {
    const scenario = createCommandScenario({ gate: { max: 5 } });
    try {
      for (const attempt of buildAttempts(eligibleSpecs())) {
        const appended = appendDispatchAttempt(
          scenario.state.store,
          scenario.state.fenceToken,
          attempt,
        );
        if (!appended.ok) throw new Error(`seed failed: ${appended.code}`);
      }
      const result = await scenario.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        "github.com/owner/repo",
        "--json",
      ]);
      const data = result.envelope?.data as Record<string, unknown> | undefined;
      const keys = Object.keys(data ?? {});
      expect(keys.at(-1)).toBe("truncation");
      expect(keys.slice(0, 19)).toEqual([
        "repository",
        "windowStart",
        "windowStartReason",
        "windowEnd",
        "dayCount",
        "countedDeliveries",
        "countedEvidenceClass",
        "excludedEvidenceClasses",
        "incidents",
        "divergences",
        "coverage",
        "corroboration",
        "eligibility",
        "verdict",
        "unmetConditions",
        "floor",
        "cleanDispatches",
        "consecutiveCleanDispatches",
        "conditions",
      ]);
      const truncation = (data as { readonly truncation?: Record<string, unknown> }).truncation;
      expect(Object.keys(truncation ?? {})).toEqual(["bound", "omittedRecords"]);
    } finally {
      scenario.dispose();
    }
  });

  test("the resolve payload keeps the five delivered keys first", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      const seeded = await scenario.invoke([
        "dispatch",
        "dual-run",
        "resolve",
        "DIV-1",
        "--note",
        "note",
        "--json",
      ]);
      // An unknown identifier is the delivered refusal; the shape assertion
      // therefore builds the payload from the domain helper directly.
      expect(seeded.exit).toBe(1);
      const { resolveDispatchDivergenceEvidence } = await import(
        "../../packages/core/src/app/dispatch-gate"
      );
      const { appendDispatchDivergence } = await import(
        "../../packages/core/src/app/dispatch-ledger"
      );
      const appended = appendDispatchDivergence(
        scenario.state.store,
        scenario.state.fenceToken,
        makeDivergence({ divergenceId: "DIV-1" }),
      );
      expect(appended.ok).toBe(true);
      const resolved = resolveDispatchDivergenceEvidence({
        store: scenario.state.store,
        fenceToken: scenario.state.fenceToken,
        divergenceId: "DIV-1",
        note: "tracker was stale",
        principal: "coder@local",
        nowIso: "2026-11-08T10:00:00.000Z",
      });
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) throw new Error("resolve failed");
      expect(Object.keys(resolved.data).slice(0, 5)).toEqual([
        "divergenceId",
        "state",
        "resolved",
        "note",
        "principal",
      ]);
    } finally {
      scenario.dispose();
    }
  });

  test("the handover result keeps its declared key order", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      const result = await scenario.invoke([
        "dispatch",
        "handover",
        "github.com/owner/repo",
        "--json",
      ]);
      const data = result.envelope?.data as Record<string, unknown> | undefined;
      expect(Object.keys(data ?? {})).toEqual([
        "repository",
        "operation",
        "recorded",
        "noop",
        "verdict",
        "unmetConditions",
        "conditions",
        "reversible",
      ]);
      expect(result.exit).toBe(1);
    } finally {
      scenario.dispose();
    }
  });

  test("the handover appends conditions and reversible after the delivered order", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      for (const attempt of buildAttempts(eligibleSpecs())) {
        const appended = appendDispatchAttempt(
          scenario.state.store,
          scenario.state.fenceToken,
          attempt,
        );
        if (!appended.ok) throw new Error(`seed failed: ${appended.code}`);
      }
      const flip = await scenario.invoke([
        "dispatch",
        "handover",
        "github.com/owner/repo",
        "--json",
      ]);
      expect(flip.exit, flip.stderr).toBe(0);
      const flipKeys = Object.keys((flip.envelope?.data as Record<string, unknown>) ?? {});
      expect(flipKeys).toEqual([
        "repository",
        "operation",
        "recorded",
        "noop",
        "verdict",
        "conditions",
        "reversible",
      ]);
      expect(Object.hasOwn(flip.envelope?.data ?? {}, "unmetConditions")).toBe(false);

      const replay = await scenario.invoke([
        "dispatch",
        "handover",
        "github.com/owner/repo",
        "--json",
      ]);
      expect(replay.exit).toBe(0);
      expect(Object.keys((replay.envelope?.data as Record<string, unknown>) ?? {})).toEqual([
        "repository",
        "operation",
        "recorded",
        "noop",
        "verdict",
        "conditions",
        "reversible",
      ]);

      const revert = await scenario.invoke([
        "dispatch",
        "handover",
        "github.com/owner/repo",
        "--revert",
        "--json",
      ]);
      expect(revert.exit).toBe(0);
      const revertData = revert.envelope?.data as Record<string, unknown> | undefined;
      // The recorded revert now carries `verdict`, so nothing moves and
      // `reversible` still follows `conditions`.
      expect(Object.keys(revertData ?? {})).toEqual([
        "repository",
        "operation",
        "recorded",
        "noop",
        "verdict",
        "conditions",
        "reversible",
      ]);
      expect(revertData?.verdict).toBeDefined();

      const noop = await scenario.invoke([
        "dispatch",
        "handover",
        "github.com/owner/repo",
        "--revert",
        "--json",
      ]);
      expect(noop.exit).toBe(0);
      expect(Object.keys((noop.envelope?.data as Record<string, unknown>) ?? {})).toEqual([
        "repository",
        "operation",
        "recorded",
        "noop",
        "reversible",
      ]);
      expect(Object.hasOwn(noop.envelope?.data ?? {}, "truncation")).toBe(false);
    } finally {
      scenario.dispose();
    }
  });

  test("a truncated handover keeps truncation last after reversible", async () => {
    const scenario = createCommandScenario({ gate: { max: 5 } });
    try {
      for (const attempt of buildAttempts(eligibleSpecs())) {
        const appended = appendDispatchAttempt(
          scenario.state.store,
          scenario.state.fenceToken,
          attempt,
        );
        if (!appended.ok) throw new Error(`seed failed: ${appended.code}`);
      }
      const result = await scenario.invoke([
        "dispatch",
        "handover",
        "github.com/owner/repo",
        "--json",
      ]);
      const data = result.envelope?.data as Record<string, unknown> | undefined;
      expect(Object.keys(data ?? {})).toEqual([
        "repository",
        "operation",
        "recorded",
        "noop",
        "verdict",
        "unmetConditions",
        "conditions",
        "reversible",
        "truncation",
      ]);
      expect(data?.verdict).toBe("unverifiable");
      expect(Object.keys((data?.truncation as Record<string, unknown>) ?? {})).toEqual([
        "bound",
        "omittedRecords",
      ]);
      expect(result.exit).toBe(1);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-ATTEMPT-034 cells 4 and 5 the attempts payload", () => {
  test("projects as a plain success at exit 0 with no run-form key", async () => {
    const harness = createAttemptsHarness({ label: "stability-plain", records: ledgerOf(2) });
    try {
      const result = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--json",
      ]);
      expect(result.exit).toBe(0);
      const data = result.data as Record<string, unknown>;
      for (const absent of ["result", "verdict", "operation", "prUrl", "lastMessage"]) {
        expect(Object.hasOwn(data, absent)).toBe(false);
      }
      expect(result.envelope?.error).toBeUndefined();
    } finally {
      harness.dispose();
    }
  });

  test("is discriminated by its attempts array against every text selector", async () => {
    const harness = createAttemptsHarness({ label: "stability-text", records: ledgerOf(2) });
    try {
      const result = await harness.invoke(["dispatch", "attempts", "--ref", ATTEMPTS_REF]);
      expect(result.exit).toBe(0);
      const lines = result.stdout.trimEnd().split("\n");
      expect(lines[0]).toStartWith("attempts=2;");
      for (const selector of ["result=", "repository=", "operation=", "window_start="]) {
        expect(result.stdout).not.toContain(`\n${selector}`);
      }
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-ATTEMPT-034 cell 7 delivered forms keep fallback.invocation", () => {
  const forms: readonly { readonly label: string; readonly argv: readonly string[] }[] = [
    { label: "dispatch <ref>", argv: ["dispatch", "GH-301", "--undeclared"] },
    {
      label: "dual-run summary",
      argv: ["dispatch", "dual-run", "summary", "--repo", "github.com/owner/repo", "--undeclared"],
    },
    {
      label: "dual-run resolve",
      argv: ["dispatch", "dual-run", "resolve", "DIV-1", "--note", "note", "--undeclared"],
    },
    {
      label: "handover",
      argv: ["dispatch", "handover", "github.com/owner/repo", "--undeclared"],
    },
  ];

  for (const form of forms) {
    test(`${form.label} refuses an undeclared flag without touching the store`, async () => {
      const scenario = createCommandScenario({ gate: {}, store: throwingStore });
      try {
        const result = await scenario.invoke([...form.argv, "--json"]);
        expect(result.exit).toBe(1);
        expect(result.envelope?.error?.code).toBe("fallback.invocation");
        expect(result.envelope?.data).toBeUndefined();
      } finally {
        scenario.dispose();
      }
    });
  }
});

describe("TC-ATTEMPT-034 cells 2-3 resolve additions and both blocks", () => {
  test("the resolve payload adds mode, repository and the block after the five keys", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      const { appendDispatchDivergence } = await import(
        "../../packages/core/src/app/dispatch-ledger"
      );
      appendDispatchDivergence(
        scenario.state.store,
        scenario.state.fenceToken,
        makeDivergence({ divergenceId: "DIV-ADD" }),
      );
      const result = await scenario.invoke([
        "dispatch",
        "dual-run",
        "resolve",
        "DIV-ADD",
        "--note",
        "reason",
        "--json",
      ]);
      expect(result.exit).toBe(0);
      const data = result.envelope?.data as Record<string, unknown>;
      expect(Object.keys(data)).toEqual([
        "divergenceId",
        "state",
        "resolved",
        "note",
        "principal",
        "mode",
        "repository",
        "divergences",
      ]);
      expect(data.mode).toBe("local-evidence");
      const block = data.divergences as Record<string, unknown>;
      expect(Object.keys(block)).toEqual([
        "reported",
        "resolved",
        "unresolved",
        "unresolvedIds",
        "idsTruncated",
      ]);
      expect(block.idsTruncated).toBe(false);
      expect(block.unresolvedIds).toEqual([]);
    } finally {
      scenario.dispose();
    }
  });

  test("both blocks carry idsTruncated, true exactly when identifiers were dropped", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      const { appendDispatchDivergence } = await import(
        "../../packages/core/src/app/dispatch-ledger"
      );
      for (let index = 1; index <= 21; index += 1) {
        appendDispatchDivergence(
          scenario.state.store,
          scenario.state.fenceToken,
          makeDivergence({
            divergenceId: `DIV-${String(index).padStart(2, "0")}`,
            recordedAt: `2026-11-08T10:${String(index).padStart(2, "0")}:00.000Z`,
          }),
        );
      }
      const summary = await scenario.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        "github.com/owner/repo",
        "--json",
      ]);
      const summaryBlock = (
        (summary.envelope?.data ?? {}) as { readonly divergences: Record<string, unknown> }
      ).divergences;
      expect(Object.keys(summaryBlock)).toEqual([
        "reported",
        "resolved",
        "unresolved",
        "unresolvedIds",
        "idsTruncated",
      ]);
      expect(summaryBlock.unresolved).toBe(21);
      expect((summaryBlock.unresolvedIds as readonly string[]).length).toBe(20);
      expect(summaryBlock.idsTruncated).toBe(true);
    } finally {
      scenario.dispose();
    }
  });
});

/* ------------------------------------------------------------------------- */
/* GH-347 CONTRACT-001 — exactly one new record kind, and no token moved.     */
/* ------------------------------------------------------------------------- */

describe("GH-347 the dispatch record-kind surface gains exactly the lane kind", () => {
  test("the dispatch-owned kinds are the four declared ones", () => {
    const contracts = require("../../packages/core/src/contracts/index") as Record<string, unknown>;
    expect(contracts.DISPATCH_ATTEMPT_RECORD_KIND).toBe("dispatch.attempt");
    expect(contracts.DISPATCH_DIVERGENCE_RECORD_KIND).toBe("dispatch.divergence");
    expect(contracts.DISPATCH_HANDOVER_RECORD_KIND).toBe("dispatch.handover");
    expect(contracts.DISPATCH_LANE_RECORD_KIND).toBe("dispatch.lane");
    expect(contracts.DISPATCH_LANE_PAYLOAD_SCHEMA).toBe("delivery.dispatch.lane.v1");
    // The daemon lane is a DISTINCT kind and is unchanged.
    expect(contracts.DAEMON_LANE_RECORD_KIND).toBe("daemon.lane");
    expect(contracts.DAEMON_LANE_PAYLOAD_SCHEMA).toBe("delivery.daemon.lane.v1");
  });
});

/* ------------------------------------------------------------------------- */
/* GH-354 TC-CONTRACT-003 — pre-change records read unchanged, and a pre-change */
/* ref answers honestly (clause §8.5, §20, AC-F2-3).                           */
/* ------------------------------------------------------------------------- */

describe("TC-CONTRACT-003 the operator surface is additive over pre-change records", () => {
  test("a pre-change lane decodes with its delivered key set and answers honestly", async () => {
    const h = createOperatorHarness({
      label: "contract-003",
      transcriptRead: createTranscriptDouble({
        messages: { "ses-pre": "the pre-change final message" },
      }).read,
    });
    try {
      // The delivered key set exactly: no field this change adds.
      const seeded = h.seedLane({
        ref: OPERATOR_REF,
        state: "terminal",
        sessionId: "ses-pre",
        attemptId: "attempt-pre",
        lastToken: "pr-open",
        lastOutcome: "completed",
      });
      expect(Object.keys(seeded).sort()).toEqual(
        [
          "attemptId",
          "harnessKind",
          "iterationOrdinal",
          "lastOutcome",
          "lastToken",
          "owner",
          "recordedAt",
          "ref",
          "repository",
          "restartsConsumed",
          "schema",
          "sessionId",
          "state",
        ].sort(),
      );
      const before = h.ledgerBytes();
      const status = await h.run(["dispatch", "status", OPERATOR_REF, "--json"]);
      expect(status.exit).toBe(0);
      expect((status.data as { readonly marker?: string }).marker).toBe("terminal");
      const delivering = await h.run(["dispatch", "is-delivering", OPERATOR_REF, "--json"]);
      expect(delivering.exit).toBe(1);
      const log = await h.run(["dispatch", "log", OPERATOR_REF, "--json"]);
      // A pre-change lane has no artifact directory: the classified absence.
      expect((log.data as { readonly reason?: string }).reason).toBe("no-log");
      expect(log.exit).toBe(0);
      const message = await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
      expect(message.exit).toBe(0);
      expect((message.data as { readonly message?: string }).message).toBe(
        "the pre-change final message",
      );
      // Nothing was migrated, backfilled, or rewritten.
      expect(h.ledgerBytes()).toBe(before);
      expect(h.counters.append).toBe(0);
    } finally {
      h.dispose();
    }
  });
});
