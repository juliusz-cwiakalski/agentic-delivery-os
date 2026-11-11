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
import type { StateStorePort } from "../../packages/core/src/contracts/index";
import { ATTEMPTS_REF, ledgerOf } from "../fixtures/dispatch/attempt-records";
import { createAttemptsHarness } from "../fixtures/dispatch/attempts-harness";
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
      ]);
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
      ]);
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
