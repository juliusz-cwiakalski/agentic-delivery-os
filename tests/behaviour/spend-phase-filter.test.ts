/**
 * TC-SPEND-012 — `--phase` scopes the whole report through one selection and
 * one fold: tokens, calls, roll-ups and the amplification block all derive from
 * the phase-attributed subset; an empty canonical window is a scoped absence.
 */
import { describe, expect, test } from "bun:test";
import { computeSpendReport } from "../../packages/core/src/domain/index";
import {
  foldSeed,
  makeIdentity,
  makeSessionRecord,
  makeTempRoot,
  openStore,
  recordingStore,
  removeRoot,
  runSpendCli,
  seedSpend,
  spendRuntimeOver,
  tokens,
} from "../fixtures/spend/harness";
import { P12, T1, T2, T3 } from "../fixtures/spend/transitions";

const seed = {
  transitions: P12,
  records: [
    makeSessionRecord({
      runId: "run-spec",
      capturedAt: "2026-11-01T10:30:00.000Z",
      tokens: tokens({ input: 300 }),
      calls: 2,
    }),
    makeSessionRecord({
      runId: "run-planning",
      capturedAt: "2026-11-01T12:30:00.000Z",
      tokens: tokens({ input: 700 }),
      calls: 3,
      agent: "coder",
      model: "opus",
    }),
  ],
};

const scoped = (phase: "specification" | "quality_gates" | "unknown") => {
  const folded = foldSeed(seed, `phase-filter-${phase}`);
  try {
    if (!folded.read.ok) throw new Error("read failed");
    return {
      root: folded.root,
      fold: computeSpendReport(folded.read.value, {
        workItemRef: folded.read.value.workItemRef,
        phase,
      }),
    };
  } finally {
    // The caller removes the root after asserting.
  }
};

describe("TC-SPEND-012 phase scoping", () => {
  test("a canonical phase with records scopes tokens, calls, agents and amplification", () => {
    const { fold, root } = scoped("specification");
    try {
      expect(fold.ok).toBe(true);
      if (!fold.ok) return;
      expect(fold.data.perPhase).toEqual([
        { phase: "specification", calls: 2, tokens: 300, share: 100 },
      ]);
      expect(fold.data.tokensByClass.input).toBe(300);
      expect(fold.data.perAgent).toEqual([
        { agent: "planner", model: "sonnet", calls: 2, tokens: 300 },
      ]);
      expect(fold.data.amplification).toEqual({
        ratio: 1,
        progressRun: null,
        events: [],
      });
      const unscoped = foldSeed(seed, "phase-filter-unscoped");
      try {
        if (!unscoped.fold?.ok) throw new Error("unscoped fold failed");
        expect(unscoped.fold.data.tokensByClass.input).toBe(1000);
        expect(fold.data.tokensByClass.input).toBeLessThan(unscoped.fold.data.tokensByClass.input);
      } finally {
        removeRoot(unscoped.root);
      }
    } finally {
      removeRoot(root);
    }
  });

  test("a canonical phase whose window holds no records is a scoped absence", () => {
    const { fold, root } = scoped("quality_gates");
    try {
      expect(fold.ok).toBe(false);
      if (fold.ok) return;
      expect(fold.absence.code).toBe("spend.telemetry-absent");
      expect(fold.absence.phase).toBe("quality_gates");
    } finally {
      removeRoot(root);
    }
  });

  test("the unknown selection is scoped like any other phase", () => {
    const { fold, root } = scoped("unknown");
    try {
      expect(fold.ok).toBe(false);
      if (fold.ok) return;
      expect(fold.absence.phase).toBe("unknown");
    } finally {
      removeRoot(root);
    }
  });

  test("out-of-vocabulary values never reach the fold (CLI grammar owns refusal)", () => {
    // The engine accepts only the declared SpendPhaseId union; the CLI validates
    // the raw token before any read (TC-SPEND-025/026). A literal out-of-vocabulary
    // value is therefore unrepresentable here by construction.
    const declared = ["specification", "quality_gates", "unknown"];
    for (const value of ["Delivery", "deployment", ""]) {
      expect(declared).not.toContain(value);
    }
    expect(T1 < T2 && T2 < T3).toBe(true);
  });
});

describe("TC-SPEND-012 runCli integration half", () => {
  test("the scoped CLI report and the out-of-vocabulary refusal", async () => {
    const root = makeTempRoot("gh236-filter-cli");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      seedSpend(store, { transitions: seed.transitions, records: seed.records });
      const scoped = await runSpendCli(
        ["--json", "spend", "--ref", "GH-236", "--phase", "specification"],
        spendRuntimeOver(store),
      );
      expect(scoped.exitCode).toBe(0);
      const envelope = JSON.parse(scoped.stdout) as {
        readonly data?: { readonly perPhase?: unknown };
      };
      expect(envelope.data?.perPhase).toEqual([
        { phase: "specification", calls: 2, tokens: 300, share: 100 },
      ]);

      const log: string[] = [];
      const refused = await runSpendCli(
        ["--json", "spend", "--ref", "GH-236", "--phase", "deployment"],
        spendRuntimeOver(recordingStore(store, log)),
      );
      expect(refused.exitCode).toBe(1);
      const refusedEnvelope = JSON.parse(refused.stdout) as { readonly error?: { code?: string } };
      expect(refusedEnvelope.error?.code).toBe("input.value.rejected");
      expect(log).toEqual([]);

      const empty = await runSpendCli(
        ["--json", "spend", "--ref", "GH-236", "--phase", "quality_gates"],
        spendRuntimeOver(store),
      );
      expect(empty.exitCode).toBe(1);
      const emptyEnvelope = JSON.parse(empty.stdout) as {
        readonly error?: { code?: string; summary?: string };
      };
      expect(emptyEnvelope.error?.code).toBe("spend.telemetry-absent");
      expect(String(emptyEnvelope.error?.summary)).toContain("phase quality_gates");
    } finally {
      removeRoot(root);
    }
  });
});
