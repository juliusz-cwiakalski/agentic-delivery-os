/**
 * TC-ENGINE-010..017 — the handover condition contract, the declared
 * evidence-read-free revert noop, and per-repository reversibility.
 *
 * The declared outcome table (TDR-0031 D2, spec Appendix E.1) is asserted cell
 * for cell: four evidence-reading outcomes carry the four ordered conditions
 * and `reversible`; the recorded revert also carries `verdict`; the idempotent
 * revert noop carries none of the three and answers at exit `0` even over a torn
 * attempts or divergences ledger, while an unreadable or torn **handover** ledger
 * still refuses it `dispatch.state-unverified` at exit `2` with no data and no
 * record. Reversibility is compared against the delivered authority document, so
 * one rule has two readers.
 */
import { describe, expect, test } from "bun:test";
import { readDispatchAuthority } from "../../packages/adapters/src/file/dispatch-authority";
import {
  appendDispatchAttempt,
  appendDispatchDivergence,
  readDispatchHandover,
} from "../../packages/core/src/app/dispatch-ledger";
import {
  DISPATCH_HANDOVER_CONDITIONS,
  ERROR_TABLE,
  type DispatchHandoverData,
  type StateStorePort,
} from "../../packages/core/src/contracts/index";
import { projectExitCode } from "../../packages/cli/src/projection";
import {
  buildAttempts,
  eligibleSpecs,
  missingClassSpecs,
} from "../fixtures/dispatch/evidence-windows";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import { makeHandover, REPOSITORY, REPOSITORY_BETA } from "../fixtures/dispatch/ledger";
import { renderDispatchHandoverText } from "../../packages/cli/src/output/dispatch-text";

type Scenario = ReturnType<typeof createCommandScenario>;

const seed = (scenario: Scenario, specs: ReturnType<typeof eligibleSpecs>): void => {
  for (const attempt of buildAttempts(specs)) {
    const appended = appendDispatchAttempt(
      scenario.state.store,
      scenario.state.fenceToken,
      attempt,
    );
    if (!appended.ok) throw new Error(`seed failed: ${appended.code}`);
  }
};

/** Seed one malformed record of a kind through the store itself. */
const tear = (store: StateStorePort, fenceToken: string, kind: string, key: string): void => {
  const handle = store.acquireFence(fenceToken);
  if (!handle.ok) throw new Error("fence");
  store.append(handle.value.handle, {
    kind,
    recordKey: key,
    payload: { schema: "torn" } as never,
  });
  store.releaseFence(handle.value.handle);
};

const handover = (scenario: Scenario, repository: string, revert = false) =>
  scenario.invoke([
    "dispatch",
    "handover",
    repository,
    ...(revert ? ["--revert"] : []),
    "--json",
  ]);

const dataOf = (run: Awaited<ReturnType<Scenario["invoke"]>>): DispatchHandoverData => {
  const data = run.envelope?.data;
  if (data === undefined) throw new Error(`no data: ${run.stdout}${run.stderr}`);
  return data as unknown as DispatchHandoverData;
};

const conditionKeys = (data: DispatchHandoverData): readonly string[] =>
  (data.conditions ?? []).map((entry) => entry.condition);

describe("TC-ENGINE-010 conditions on every evidence-reading outcome", () => {
  test("four outcomes carry four conditions; the noop carries the declared absences", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario, eligibleSpecs());
      seed(scenario, missingClassSpecs("merged", { prefix: "beta" }));
      const outcomes: { readonly name: string; readonly data: DispatchHandoverData }[] = [];

      const flip = await handover(scenario, REPOSITORY);
      expect(flip.exit).toBe(0);
      outcomes.push({ name: "recorded-flip", data: dataOf(flip) });

      const replay = await handover(scenario, REPOSITORY);
      expect(replay.exit).toBe(0);
      outcomes.push({ name: "idempotent-flip-noop", data: dataOf(replay) });

      const refusal = await handover(scenario, REPOSITORY_BETA);
      expect(refusal.exit).toBe(1);
      outcomes.push({ name: "clean-refusal", data: dataOf(refusal) });

      const revert = await handover(scenario, REPOSITORY, true);
      expect(revert.exit).toBe(0);
      outcomes.push({ name: "recorded-revert", data: dataOf(revert) });

      for (const outcome of outcomes) {
        expect(outcome.data.conditions, outcome.name).toHaveLength(4);
        expect(conditionKeys(outcome.data), outcome.name).toEqual([
          ...DISPATCH_HANDOVER_CONDITIONS,
        ]);
        for (const entry of outcome.data.conditions ?? []) {
          expect(Object.keys(entry), outcome.name).toEqual(["condition", "status"]);
          expect(["met", "open"]).toContain(entry.status);
          expect(Object.values(entry)).not.toContain("unverifiable");
        }
        expect(typeof outcome.data.reversible, outcome.name).toBe("boolean");
      }

      // `unmetConditions` is present iff the outcome is a refusal.
      const refusalData = outcomes[2]?.data;
      expect(Object.hasOwn(refusalData ?? {}, "unmetConditions")).toBe(true);
      for (const data of [outcomes[0]?.data, outcomes[1]?.data, outcomes[3]?.data]) {
        expect(Object.hasOwn(data ?? {}, "unmetConditions")).toBe(false);
      }

      const noop = await handover(scenario, REPOSITORY, true);
      expect(noop.exit).toBe(0);
      const noopData = dataOf(noop);
      expect(noopData).toMatchObject({
        recorded: false,
        noop: true,
        operation: "dual-run",
        reversible: false,
      });
      for (const absent of ["conditions", "verdict", "truncation"]) {
        expect(Object.hasOwn(noopData, absent), absent).toBe(false);
      }

      const omissions = [...outcomes.map((entry) => entry.data), noopData].filter(
        (data) => !Object.hasOwn(data, "conditions"),
      );
      expect(omissions).toHaveLength(1);
    } finally {
      scenario.dispose();
    }
  });

  test("a repository with no handover record answers the same exemption", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario, eligibleSpecs());
      const noop = await handover(scenario, REPOSITORY, true);
      expect(noop.exit).toBe(0);
      const data = dataOf(noop);
      expect(data).toMatchObject({
        operation: "dual-run",
        recorded: false,
        noop: true,
        reversible: false,
      });
      expect(Object.hasOwn(data, "conditions")).toBe(false);
      expect(Object.hasOwn(data, "verdict")).toBe(false);
      expect(Object.hasOwn(data, "truncation")).toBe(false);
      const ledger = readDispatchHandover(scenario.state.store);
      expect(ledger.ok && ledger.records).toEqual([]);
    } finally {
      scenario.dispose();
    }
  });

  test("a torn attempts ledger and an unreadable divergences ledger never refuse the noop", async () => {
    const tornAttempts = createCommandScenario({ gate: {} });
    try {
      seed(tornAttempts, eligibleSpecs());
      expect((await handover(tornAttempts, REPOSITORY)).exit).toBe(0);
      expect((await handover(tornAttempts, REPOSITORY, true)).exit).toBe(0);
      tear(
        tornAttempts.state.store,
        tornAttempts.state.fenceToken,
        "dispatch.attempt",
        "dispatch.attempt.torn",
      );
      const noop = await handover(tornAttempts, REPOSITORY, true);
      expect(noop.exit).toBe(0);
      const data = dataOf(noop);
      expect(data).toMatchObject({ operation: "dual-run", noop: true, reversible: false });
      expect(Object.hasOwn(data, "conditions")).toBe(false);
    } finally {
      tornAttempts.dispose();
    }

    const tornDivergences = createCommandScenario({ gate: {} });
    try {
      seed(tornDivergences, eligibleSpecs());
      expect((await handover(tornDivergences, REPOSITORY)).exit).toBe(0);
      expect((await handover(tornDivergences, REPOSITORY, true)).exit).toBe(0);
      tear(
        tornDivergences.state.store,
        tornDivergences.state.fenceToken,
        "dispatch.divergence",
        "dispatch.divergence.torn",
      );
      const noop = await handover(tornDivergences, REPOSITORY, true);
      expect(noop.exit).toBe(0);
      expect(Object.hasOwn(dataOf(noop), "conditions")).toBe(false);
    } finally {
      tornDivergences.dispose();
    }
  });
});

describe("TC-ENGINE-011 reversible truth table", () => {
  test("flip true, flip noop true, refusal false, revert false, revert noop false", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario, eligibleSpecs());
      seed(scenario, missingClassSpecs("merged", { prefix: "beta" }));
      const document = (repository: string) =>
        readDispatchAuthority(scenario.state.root, repository);

      const flip = await handover(scenario, REPOSITORY);
      expect(dataOf(flip)).toMatchObject({
        recorded: true,
        operation: "authoritative",
        reversible: true,
      });
      expect(document(REPOSITORY)).toMatchObject({
        authority: "authoritative",
        reversalAvailable: true,
      });

      const replay = await handover(scenario, REPOSITORY);
      expect(dataOf(replay)).toMatchObject({ noop: true, recorded: false, reversible: true });
      expect(document(REPOSITORY).reversalAvailable).toBe(true);

      const refusal = await handover(scenario, REPOSITORY_BETA);
      expect(dataOf(refusal)).toMatchObject({ recorded: false, noop: false, reversible: false });
      expect((dataOf(refusal).unmetConditions ?? []).length).toBeGreaterThan(0);
      expect(document(REPOSITORY_BETA)).toMatchObject({
        authority: "dual-run",
        reversalAvailable: false,
      });

      const revert = await handover(scenario, REPOSITORY, true);
      expect(dataOf(revert)).toMatchObject({
        recorded: true,
        operation: "dual-run",
        reversible: false,
      });
      expect(document(REPOSITORY)).toMatchObject({
        authority: "dual-run",
        reversalAvailable: false,
      });

      const noop = await handover(scenario, REPOSITORY, true);
      expect(dataOf(noop)).toMatchObject({ noop: true, recorded: false, reversible: false });
      expect(Object.hasOwn(dataOf(noop), "conditions")).toBe(false);
    } finally {
      scenario.dispose();
    }
  });

  test("the recorded revert refuses under a torn attempts ledger while the noop answers", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario, eligibleSpecs());
      expect((await handover(scenario, REPOSITORY)).exit).toBe(0);
      tear(
        scenario.state.store,
        scenario.state.fenceToken,
        "dispatch.attempt",
        "dispatch.attempt.torn",
      );
      const recorded = await handover(scenario, REPOSITORY, true);
      expect(recorded.exit).toBe(2);
      expect(recorded.envelope?.error?.code).toBe("dispatch.state-unverified");
      expect(Object.hasOwn(recorded.envelope ?? {}, "data")).toBe(false);
      expect(readDispatchAuthority(scenario.state.root, REPOSITORY)).toMatchObject({
        authority: "authoritative",
        reversalAvailable: true,
      });
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-ENGINE-012 the record shape did not grow", () => {
  test("flip and revert records keep the delivered key set; replay appends nothing", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario, eligibleSpecs());
      expect((await handover(scenario, REPOSITORY)).exit).toBe(0);
      expect((await handover(scenario, REPOSITORY, true)).exit).toBe(0);
      const ledger = readDispatchHandover(scenario.state.store);
      if (!ledger.ok) throw new Error(`ledger read failed: ${ledger.code}`);
      expect(ledger.records.map((record) => record.operation)).toEqual([
        "authoritative",
        "dual-run",
      ]);
      for (const record of ledger.records) {
        expect(Object.keys(record).sort()).toEqual([
          "conditions",
          "evidenceRefs",
          "operation",
          "principal",
          "recordedAt",
          "repository",
          "schema",
        ]);
        expect(Object.hasOwn(record, "reversible")).toBe(false);
        expect(Object.keys(record.conditions).sort()).toEqual([
          "corroborationSatisfied",
          "countedDeliveries",
          "coverageMissing",
          "coveragePresent",
          "floorMet",
          "incidents",
          "unresolvedDivergences",
          "verdict",
          "windowStart",
          "windowStartReason",
        ]);
      }
      const replay = await handover(scenario, REPOSITORY, true);
      expect(dataOf(replay)).toMatchObject({ noop: true, recorded: false });
      const after = readDispatchHandover(scenario.state.store);
      expect(after.ok && after.records).toHaveLength(2);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-ENGINE-013 per-repository isolation", () => {
  test("flipping alpha leaves beta's gate data, authority, and record count untouched", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario, eligibleSpecs());
      seed(scenario, missingClassSpecs("merged", { prefix: "beta" }));
      const summaryOf = async (repository: string) => {
        const run = await scenario.invoke([
          "dispatch",
          "dual-run",
          "summary",
          "--repo",
          repository,
          "--json",
        ]);
        return run.envelope?.data as Record<string, unknown> | undefined;
      };
      const betaBefore = await summaryOf(REPOSITORY_BETA);
      const betaDocumentBefore = readDispatchAuthority(scenario.state.root, REPOSITORY_BETA);
      const betaRefusalBefore = dataOf(await handover(scenario, REPOSITORY_BETA));
      const countBefore = readDispatchHandover(scenario.state.store);

      expect((await handover(scenario, REPOSITORY)).exit).toBe(0);
      expect(readDispatchAuthority(scenario.state.root, REPOSITORY).authority).toBe(
        "authoritative",
      );

      const betaAfterFlip = await summaryOf(REPOSITORY_BETA);
      expect(betaAfterFlip?.conditions).toEqual(betaBefore?.conditions);
      expect(betaAfterFlip?.cleanDispatches).toBe(betaBefore?.cleanDispatches);
      expect(betaAfterFlip?.verdict).toBe(betaBefore?.verdict);
      expect(dataOf(await handover(scenario, REPOSITORY_BETA))).toEqual(betaRefusalBefore);
      expect(readDispatchAuthority(scenario.state.root, REPOSITORY_BETA)).toEqual(
        betaDocumentBefore,
      );

      expect((await handover(scenario, REPOSITORY, true)).exit).toBe(0);
      expect((await handover(scenario, REPOSITORY, true)).exit).toBe(0);
      const betaAfterRevert = await summaryOf(REPOSITORY_BETA);
      expect(betaAfterRevert?.conditions).toEqual(betaBefore?.conditions);
      expect(readDispatchAuthority(scenario.state.root, REPOSITORY_BETA)).toEqual(
        betaDocumentBefore,
      );

      const countAfter = readDispatchHandover(scenario.state.store);
      if (!countBefore.ok || !countAfter.ok) throw new Error("ledger read failed");
      const betaRecords = (records: readonly { readonly repository: string }[]) =>
        records.filter((record) => record.repository === REPOSITORY_BETA).length;
      expect(betaRecords(countAfter.records)).toBe(betaRecords(countBefore.records));
      expect(betaDocumentBefore.repository).toBe(REPOSITORY_BETA);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-ENGINE-014 truncation iff unverifiable", () => {
  test("the biconditional holds and the recorded revert carries a verdict", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario, eligibleSpecs());
      const flip = dataOf(await handover(scenario, REPOSITORY));
      expect(Object.hasOwn(flip, "truncation")).toBe(false);
      expect(flip.verdict).toBe("eligible");
      const revert = dataOf(await handover(scenario, REPOSITORY, true));
      expect(revert.verdict).toBeDefined();
      expect(revert.verdict).not.toBe("unverifiable");
      expect(Object.hasOwn(revert, "truncation")).toBe(false);
      expect(revert.reversible).toBe(false);
      const noop = dataOf(await handover(scenario, REPOSITORY, true));
      expect(Object.hasOwn(noop, "verdict")).toBe(false);
      expect(Object.hasOwn(noop, "truncation")).toBe(false);
    } finally {
      scenario.dispose();
    }

    const truncated = createCommandScenario({ gate: { max: 5 } });
    try {
      seed(truncated, eligibleSpecs());
      const run = await handover(truncated, REPOSITORY);
      expect(run.exit).toBe(1);
      const data = dataOf(run);
      expect(data.verdict).toBe("unverifiable");
      expect(data.truncation).toBeDefined();
      expect(Object.keys(data.truncation ?? {})).toEqual(["bound", "omittedRecords"]);
      expect(data.conditions).toHaveLength(4);
      expect((data as { readonly eligibility?: unknown }).eligibility ?? undefined).toBeUndefined();
      for (const entry of data.conditions ?? []) {
        expect(["met", "open"]).toContain(entry.status);
      }
    } finally {
      truncated.dispose();
    }
  });
});

describe("TC-ENGINE-015 handover text is unchanged", () => {
  test("text output equals the delivered renderer and carries no new line", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario, eligibleSpecs());
      const textFlip = await scenario.invoke(["dispatch", "handover", REPOSITORY]);
      expect(textFlip.exit).toBe(0);
      expect(textFlip.stdout).toBe(
        renderDispatchHandoverText({
          repository: REPOSITORY,
          operation: "authoritative",
          recorded: true,
          noop: false,
        }),
      );
      for (const marker of ["conditions=", "reversible=", "clean_dispatches="]) {
        expect(textFlip.stdout).not.toContain(marker);
      }
      const jsonFlip = await handover(scenario, REPOSITORY);
      expect(textFlip.exit).toBe(jsonFlip.exit);

      const textNoop = await scenario.invoke([
        "dispatch",
        "handover",
        REPOSITORY,
        "--revert",
      ]);
      expect(textNoop.exit).toBe(0);
      const noopJson = await handover(scenario, REPOSITORY, true);
      expect(textNoop.exit).toBe(noopJson.exit);
      expect(textNoop.stdout).not.toContain("condition");
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-ENGINE-017 the noop over a corrupt handover ledger is refused", () => {
  test("torn and unreadable handover reads refuse at exit 2 with no data and no record", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario, eligibleSpecs());
      expect((await handover(scenario, REPOSITORY)).exit).toBe(0);
      expect((await handover(scenario, REPOSITORY, true)).exit).toBe(0);
      const control = await handover(scenario, REPOSITORY, true);
      expect(control.exit).toBe(0);
      expect(Object.hasOwn(dataOf(control), "conditions")).toBe(false);

      const ledgerBefore = readDispatchHandover(scenario.state.store);
      if (!ledgerBefore.ok) throw new Error("ledger read failed");
      const documentBefore = readDispatchAuthority(scenario.state.root, REPOSITORY);

      tear(
        scenario.state.store,
        scenario.state.fenceToken,
        "dispatch.handover",
        "dispatch.handover.torn",
      );
      // The attempts and divergences ledgers stay readable: the summary is the
      // readability witness for the refusal's attribution.
      const witness = await scenario.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        REPOSITORY,
        "--json",
      ]);

      const refused = await handover(scenario, REPOSITORY, true);
      const row = ERROR_TABLE.find((entry) => entry.code === "dispatch.state-unverified");
      expect(row).toBeDefined();
      expect(refused.exit).toBe(projectExitCode(row?.projectionClass ?? "platform-provider"));
      expect(refused.envelope?.error?.code).toBe("dispatch.state-unverified");
      expect(Object.hasOwn(refused.envelope ?? {}, "data")).toBe(false);
      expect(readDispatchAuthority(scenario.state.root, REPOSITORY)).toEqual(documentBefore);
      const ledgerAfter = readDispatchHandover(scenario.state.store);
      expect(ledgerAfter.ok).toBe(false);
      expect(witness.exit).toBe(0);
    } finally {
      scenario.dispose();
    }
  });

  test("a failing store read refuses the noop without appending", async () => {
    let failReads = false;
    const scenario = createCommandScenario({
      gate: {},
      store: (base) => ({
        ...base,
        readRecords: () =>
          failReads
            ? {
                ok: false as const,
                error: {
                  code: "state.store.unreadable" as const,
                  location: { path: "synthetic-store" },
                },
              }
            : base.readRecords(),
      }),
    });
    try {
      seed(scenario, eligibleSpecs());
      expect((await handover(scenario, REPOSITORY)).exit).toBe(0);
      expect((await handover(scenario, REPOSITORY, true)).exit).toBe(0);
      expect((await handover(scenario, REPOSITORY, true)).exit).toBe(0);
      failReads = true;
      const refused = await handover(scenario, REPOSITORY, true);
      expect(refused.exit).toBe(2);
      expect(refused.envelope?.error?.code).toBe("dispatch.state-unverified");
      expect(Object.hasOwn(refused.envelope ?? {}, "data")).toBe(false);
      failReads = false;
      const ledger = readDispatchHandover(scenario.state.store);
      expect(ledger.ok && ledger.records).toHaveLength(2);
      expect(ledger.ok && ledger.records).toEqual([
        expect.objectContaining({ operation: "authoritative" }),
        expect.objectContaining({ operation: "dual-run" }),
      ]);
    } finally {
      scenario.dispose();
    }
  });

  test("the delivered handover record shape accepts the seeded reversal", () => {
    const record = makeHandover({ operation: "dual-run" });
    expect(record.operation).toBe("dual-run");
    expect(Object.hasOwn(record, "reversible")).toBe(false);
  });
});

describe("TC-ENGINE-010 conditions under a controlled composition", () => {
  test("a divergence opens truth on the handover and summary alike", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      seed(scenario, eligibleSpecs());
      appendDispatchDivergence(
        scenario.state.store,
        scenario.state.fenceToken,
        {
          schema: "delivery.dispatch.divergence.v1",
          divergenceId: "DIV-1",
          repository: REPOSITORY,
          ref: "GH-239",
          attemptId: "all11-0",
          state: "open",
          comparisonClass: "tracker-truth",
          engineToken: "pr-open",
          comparisonToken: "blocked",
          evidenceRefs: ["attempt:all11-0"],
          recordedAt: "2026-11-08T10:00:00.000Z",
        },
      );
      const refusal = await handover(scenario, REPOSITORY);
      expect(refusal.exit).toBe(1);
      const data = dataOf(refusal);
      expect(
        (data.conditions ?? []).filter((entry) => entry.status === "open").map((e) => e.condition),
      ).toEqual((data.unmetConditions ?? []).map((entry) => entry.condition));
    } finally {
      scenario.dispose();
    }
  });
});
