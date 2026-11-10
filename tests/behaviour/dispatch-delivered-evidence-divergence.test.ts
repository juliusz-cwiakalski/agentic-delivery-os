/**
 * GH-279 delivered-evidence divergence (TC-DIVREC-001..011): a delivered but
 * unverifiable dispatch records at most one open divergence per (repository,
 * work-item) pair, appended before the attempt, counted by the summary, and
 * resolvable from local evidence — in both append-failure directions.
 */
import { describe, expect, test } from "bun:test";
import {
  appendDispatchDivergence,
  foldDispatchDivergences,
  readDispatchAttempts,
  readDispatchDivergences,
} from "../../packages/core/src/app/dispatch-ledger";
import {
  DISPATCH_ATTEMPT_RECORD_KIND,
  DISPATCH_DIVERGENCE_RECORD_KIND,
  DISPATCH_MAX_EVIDENCE_REFS,
  type StateStorePort,
} from "../../packages/core/src/contracts/index";
import { DISPATCH_READ_FAILURE_SOURCES } from "../../packages/core/src/domain/dispatch-result";
import { COMPLETED_EVIDENCE, SPAWN_REFUSED_EVIDENCE } from "../fixtures/dispatch/harness";
import { createCommandScenario, readsFrom } from "../fixtures/dispatch/golden/harness";
import { makeDivergence } from "../fixtures/dispatch/ledger";
import { ledger, readFail, readOk } from "../fixtures/dispatch/truth";

const REPOSITORY = "github.com/owner/repo";

const deliveredReads = () =>
  readsFrom({ tracker: readFail("tracker", "config.credential.missing") });

const onlyDivergence = (store: StateStorePort) => {
  const read = readDispatchDivergences(store);
  expect(read.ok).toBe(true);
  if (!read.ok) throw new Error("divergence read failed");
  return read;
};

/** A store wrapper that fails one record kind on append. */
const failAppendFor = (
  store: StateStorePort,
  predicate: (kind: string, times: number) => boolean,
): StateStorePort => {
  let attempts = 0;
  return {
    ...store,
    append: (handle, request) => {
      if (request.kind === DISPATCH_ATTEMPT_RECORD_KIND || request.kind === DISPATCH_DIVERGENCE_RECORD_KIND) {
        attempts += 1;
        if (predicate(request.kind, attempts)) {
          return {
            ok: false as const,
            error: { code: "state.write.failed", location: { path: "state/ledger.log" } },
          };
        }
      }
      return store.append(handle, request);
    },
  } as StateStorePort;
};

describe("TC-DIVREC-001 a delivered-but-unverifiable attempt opens one divergence", () => {
  test("the declared shape and the attempt correlation", async () => {
    const scenario = createCommandScenario({
      label: "gh279-divrec-001-",
      evidence: COMPLETED_EVIDENCE,
      reads: deliveredReads(),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.envelope?.data?.result).toBe("state-unverified");
      const divergences = onlyDivergence(scenario.state.store);
      expect(divergences.records).toHaveLength(1);
      const divergence = divergences.records[0];
      const attempts = readDispatchAttempts(scenario.state.store);
      expect(attempts.ok).toBe(true);
      if (!attempts.ok || divergence === undefined) return;
      expect(divergence.comparisonClass).toBe("not-applicable");
      expect(divergence.engineToken).toBe("state-unverified");
      expect(divergence.comparisonToken).toBeNull();
      expect(divergence.repository).toBe(REPOSITORY);
      expect(divergence.ref).toBe("GH-301");
      expect(divergence.attemptId).toBe(attempts.records[0]?.attemptId);
      expect(divergence.evidenceRefs).toEqual([
        `attempt:${attempts.records[0]?.attemptId}`,
        "truth:unreadable:tracker",
      ]);
      expect(attempts.records[0]?.divergenceRef).toBe(divergence.divergenceId);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-DIVREC-002 each delivered-evidence conjunct falsified opens nothing", () => {
  const cases = [
    { label: "non-completed", evidence: SPAWN_REFUSED_EVIDENCE, reads: deliveredReads() },
    {
      label: "unreadable-ledger",
      evidence: COMPLETED_EVIDENCE,
      reads: readsFrom({
        ledger: readFail("ledger", "ledger.read-unreadable"),
        tracker: readFail("tracker", "config.credential.missing"),
      }),
    },
    {
      label: "no-progress",
      evidence: COMPLETED_EVIDENCE,
      reads: readsFrom({
        ledger: readOk(ledger({ completed: 1, total: 5, progressed: false })),
        tracker: readFail("tracker", "config.credential.missing"),
      }),
    },
  ] as const;
  for (const entry of cases) {
    test(`${entry.label} opens no divergence`, async () => {
      const scenario = createCommandScenario({
        label: `gh279-divrec-002-${entry.label}-`,
        evidence: entry.evidence,
        reads: entry.reads,
      });
      try {
        await scenario.invoke(["dispatch", "GH-301", "--json"]);
        expect(onlyDivergence(scenario.state.store).records).toHaveLength(0);
      } finally {
        scenario.dispose();
      }
    });
  }

  test("a persisted failed outcome never substitutes for delivered evidence", async () => {
    const scenario = createCommandScenario({
      label: "gh279-divrec-002-control-",
      evidence: COMPLETED_EVIDENCE,
      reads: deliveredReads(),
    });
    try {
      await scenario.invoke(["dispatch", "GH-301", "--json"]);
      // The persisted attempt outcome is `failed`; delivery evidence still opened
      // the divergence, proving the outcome is not the predicate input.
      expect(onlyDivergence(scenario.state.store).records).toHaveLength(1);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-DIVREC-003 a resume reuses the open divergence", () => {
  test("no second record, the same reference, and an unchanged unresolved count", async () => {
    const scenario = createCommandScenario({
      label: "gh279-divrec-003-",
      evidence: COMPLETED_EVIDENCE,
      reads: deliveredReads(),
    });
    try {
      await scenario.invoke(["dispatch", "GH-301", "--json"]);
      const first = onlyDivergence(scenario.state.store).records[0];
      await scenario.invoke(["dispatch", "GH-301", "--json"]);
      const divergences = onlyDivergence(scenario.state.store);
      expect(divergences.records).toHaveLength(1);
      const attempts = readDispatchAttempts(scenario.state.store);
      expect(attempts.ok).toBe(true);
      if (!attempts.ok) return;
      expect(attempts.records).toHaveLength(2);
      expect(attempts.records[1]?.divergenceRef).toBe(first?.divergenceId);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-DIVREC-004 the summary lists and counts it; resolution decrements by one", () => {
  test("before and after the unresolved count moves by exactly one", async () => {
    const scenario = createCommandScenario({
      label: "gh279-divrec-004-",
      evidence: COMPLETED_EVIDENCE,
      reads: deliveredReads(),
      gate: { resolveRepository: (repo) => repo },
    });
    try {
      await scenario.invoke(["dispatch", "GH-301", "--json"]);
      const divergence = onlyDivergence(scenario.state.store).records[0];
      const before = await scenario.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        REPOSITORY,
        "--json",
      ]);
      expect(before.exit).toBe(0);
      const beforeData = before.envelope?.data as
        | { readonly divergences?: { readonly unresolved?: number; readonly unresolvedIds?: readonly string[] } }
        | undefined;
      expect(beforeData?.divergences?.unresolvedIds).toContain(divergence?.divergenceId);
      const beforeUnresolved = beforeData?.divergences?.unresolved ?? 0;

      const resolved = await scenario.invoke([
        "dispatch",
        "dual-run",
        "resolve",
        divergence?.divergenceId ?? "",
        "--note",
        "confirmed by local evidence",
        "--json",
      ]);
      expect(resolved.exit).toBe(0);

      const after = await scenario.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        REPOSITORY,
        "--json",
      ]);
      const afterData = after.envelope?.data as
        | { readonly divergences?: { readonly unresolved?: number } }
        | undefined;
      expect(afterData?.divergences?.unresolved).toBe(beforeUnresolved - 1);
      expect(readDispatchAttempts(scenario.state.store).ok).toBe(true);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-DIVREC-005 a new divergence opens only after the previous is resolved", () => {
  test("open suppresses a second; resolved permits a new one", async () => {
    const scenario = createCommandScenario({
      label: "gh279-divrec-005-",
      evidence: COMPLETED_EVIDENCE,
      reads: deliveredReads(),
      gate: { resolveRepository: (repo) => repo },
    });
    try {
      await scenario.invoke(["dispatch", "GH-301", "--json"]);
      const first = onlyDivergence(scenario.state.store).records[0];
      await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(onlyDivergence(scenario.state.store).records).toHaveLength(1);
      await scenario.invoke([
        "dispatch",
        "dual-run",
        "resolve",
        first?.divergenceId ?? "",
        "--note",
        "resolved",
        "--json",
      ]);
      await scenario.invoke(["dispatch", "GH-301", "--json"]);
      const folded = foldDispatchDivergences(onlyDivergence(scenario.state.store).records);
      expect(folded.filter((record) => record.state === "open")).toHaveLength(1);
      expect(folded).toHaveLength(2);
      expect(folded.at(-1)?.divergenceId).not.toBe(first?.divergenceId);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-DIVREC-006 record bounds and the closed read families", () => {
  test("no ci family; every emitted reason is in the closed set; bounds hold", async () => {
    expect([...DISPATCH_READ_FAILURE_SOURCES]).toEqual(["ledger", "tracker", "artifact", "state"]);
    const scenario = createCommandScenario({
      label: "gh279-divrec-006-",
      evidence: COMPLETED_EVIDENCE,
      reads: readsFrom({ artifacts: readFail("artifact", "artifact.read-unreadable"), tracker: readOk({ state: "in-progress", blocking: false }) }),
    });
    try {
      await scenario.invoke(["dispatch", "GH-301", "--json"]);
      const divergence = onlyDivergence(scenario.state.store).records[0];
      expect(divergence?.evidenceRefs.length).toBeLessThanOrEqual(DISPATCH_MAX_EVIDENCE_REFS);
      for (const ref of divergence?.evidenceRefs ?? []) {
        if (ref.startsWith("truth:unreadable:")) {
          expect(["ledger", "tracker", "artifact", "state"]).toContain(ref.slice(17));
          expect(ref).not.toBe("truth:unreadable:ci");
        }
      }
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-DIVREC-007 an unrelated open mismatch does not suppress recording", () => {
  test("the dedupe predicate is shape-based, not any open record", async () => {
    const scenario = createCommandScenario({
      label: "gh279-divrec-007-",
      evidence: COMPLETED_EVIDENCE,
      reads: deliveredReads(),
    });
    try {
      appendDispatchDivergence(
        scenario.state.store,
        scenario.state.fenceToken,
        makeDivergence({ divergenceId: "DIV-UNRELATED", state: "open" }),
      );
      await scenario.invoke(["dispatch", "GH-301", "--json"]);
      const records = onlyDivergence(scenario.state.store).records;
      expect(records).toHaveLength(2);
      expect(records.some((record) => record.divergenceId === "DIV-UNRELATED")).toBe(true);
      expect(records.some((record) => record.comparisonClass === "not-applicable")).toBe(true);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-DIVREC-008 a failed divergence append is declared and never referenced", () => {
  test("one attempt, no divergenceRef, divergence:append-failed, underlying state identity", async () => {
    const scenario = createCommandScenario({
      label: "gh279-divrec-008-",
      evidence: COMPLETED_EVIDENCE,
      reads: deliveredReads(),
      store: (store) => failAppendFor(store, (kind) => kind === DISPATCH_DIVERGENCE_RECORD_KIND),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(2);
      expect(run.envelope?.data?.result).toBe("state-unverified");
      const attempts = readDispatchAttempts(scenario.state.store);
      expect(attempts.ok).toBe(true);
      if (!attempts.ok) return;
      expect(attempts.records).toHaveLength(1);
      const attempt = attempts.records[0];
      expect(attempt?.divergenceRef).toBeUndefined();
      expect(attempt?.evidenceRefs).toContain("divergence:append-failed");
      expect(attempt?.evidenceRefs.some((ref) => ref.startsWith("attempt:"))).toBe(true);
      expect(attempt?.evidenceRefs.some((ref) => ref.startsWith("truth:unreadable:"))).toBe(true);
      expect(attempt?.evidenceRefs.length).toBeLessThanOrEqual(DISPATCH_MAX_EVIDENCE_REFS);
      expect(onlyDivergence(scenario.state.store).records).toHaveLength(0);
      const error = run.envelope?.data?.error;
      expect(error?.code).toBe("state.write.failed");
      expect(error?.category).toBeDefined();
      expect(error?.retryable).toBeDefined();
      expect(error?.consequence).toBeDefined();
      expect(error?.remediationHint).toBeDefined();
      expect(run.envelope?.data?.lastMessage.toLowerCase()).toContain("append failed");
      expect(run.envelope?.data?.lastMessage).toContain("state.write.failed");
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-DIVREC-009 a replayed attempt appends nothing, even after resolution", () => {
  test("same attempt id and a resolved divergence opens no second record", async () => {
    const attemptId = "attempt-replay";
    const divergenceId = "DIV-REPLAY";
    const scenario = createCommandScenario({
      label: "gh279-divrec-009-",
      evidence: COMPLETED_EVIDENCE,
      reads: deliveredReads(),
      newAttemptId: () => attemptId,
      newDivergenceId: () => divergenceId,
      gate: { resolveRepository: (repo) => repo },
    });
    try {
      await scenario.invoke(["dispatch", "GH-301", "--json"]);
      const first = onlyDivergence(scenario.state.store).records[0];
      await scenario.invoke([
        "dispatch",
        "dual-run",
        "resolve",
        first?.divergenceId ?? "",
        "--note",
        "resolved",
        "--json",
      ]);
      const before = onlyDivergence(scenario.state.store).records.length;
      await scenario.invoke(["dispatch", "GH-301", "--json"]);
      const after = onlyDivergence(scenario.state.store).records.length;
      expect(after).toBe(before);
      const attempts = readDispatchAttempts(scenario.state.store);
      expect(attempts.ok).toBe(true);
      if (attempts.ok) expect(attempts.records).toHaveLength(1);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-DIVREC-010 the attempt keeps the underlying failure identity", () => {
  test("last_message names the unreadable read without a credential", async () => {
    const scenario = createCommandScenario({
      label: "gh279-divrec-010-",
      evidence: COMPLETED_EVIDENCE,
      reads: deliveredReads(),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      const lastMessage = run.envelope?.data?.lastMessage ?? "";
      expect(lastMessage.length).toBeLessThanOrEqual(512);
      expect(lastMessage.toLowerCase()).toContain("unreadable");
      expect(lastMessage.toLowerCase()).toContain("config.credential.missing");
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-DIVREC-011 a failed attempt append leaves a standing open divergence", () => {
  test("the orphan is counted, resolvable, and reused by the next attempt", async () => {
    let attemptAppendCount = 0;
    const scenario = createCommandScenario({
      label: "gh279-divrec-011-",
      evidence: COMPLETED_EVIDENCE,
      reads: deliveredReads(),
      gate: { resolveRepository: (repo) => repo },
      store: (store) =>
        failAppendFor(store, (kind) => {
          if (kind !== DISPATCH_ATTEMPT_RECORD_KIND) return false;
          attemptAppendCount += 1;
          return attemptAppendCount === 1;
        }),
    });
    try {
      const failed = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(failed.exit).toBe(2);
      expect(failed.envelope?.error?.code).toBe("state.write.failed");

      const divergences = onlyDivergence(scenario.state.store);
      expect(divergences.records).toHaveLength(1);
      const orphan = divergences.records[0];
      expect(orphan?.comparisonClass).toBe("not-applicable");
      expect(orphan?.engineToken).toBe("state-unverified");
      expect(orphan?.comparisonToken).toBeNull();
      expect(orphan?.evidenceRefs.some((ref) => ref.startsWith("truth:unreadable:"))).toBe(true);
      expect(readDispatchAttempts(scenario.state.store).ok).toBe(true);
      const attemptsAfterFailure = readDispatchAttempts(scenario.state.store);
      if (attemptsAfterFailure.ok) expect(attemptsAfterFailure.records).toHaveLength(0);

      const summary = await scenario.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        REPOSITORY,
        "--json",
      ]);
      expect(summary.exit).toBe(0);
      const summaryData = summary.envelope?.data as
        | { readonly divergences?: { readonly unresolved?: number; readonly unresolvedIds?: readonly string[] } }
        | undefined;
      expect(summaryData?.divergences?.unresolvedIds).toContain(orphan?.divergenceId);

      const second = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(second.exit).toBe(2);
      const attempts = readDispatchAttempts(scenario.state.store);
      expect(attempts.ok).toBe(true);
      if (!attempts.ok) return;
      expect(attempts.records).toHaveLength(1);
      expect(attempts.records[0]?.divergenceRef).toBe(orphan?.divergenceId);
      expect(onlyDivergence(scenario.state.store).records).toHaveLength(1);

      const resolved = await scenario.invoke([
        "dispatch",
        "dual-run",
        "resolve",
        orphan?.divergenceId ?? "",
        "--note",
        "closed from local evidence",
        "--json",
      ]);
      expect(resolved.exit).toBe(0);
      const after = await scenario.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        REPOSITORY,
        "--json",
      ]);
      const afterData = after.envelope?.data as
        | { readonly divergences?: { readonly unresolved?: number } }
        | undefined;
      expect(afterData?.divergences?.unresolved).toBe(0);
    } finally {
      scenario.dispose();
    }
  });
});
