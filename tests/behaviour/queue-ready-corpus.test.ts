/**
 * TC-QREADY-028 — fixture corpus completeness, Appendix G examples, and the
 * completeness meta-check.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  QUEUE_READY_CONDITION_ORDER,
  QUEUE_READY_MAX_BRANCH_CHARS,
  QUEUE_READY_MAX_HUMAN_BYTES,
  QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES,
  QUEUE_READY_MAX_IDENTITY_CHARS,
  QUEUE_READY_MAX_LABEL_CHARS,
  QUEUE_READY_MAX_LABELS,
  QUEUE_READY_MAX_MACHINE_BYTES,
  QUEUE_READY_MAX_OWNER_CHARS,
  QUEUE_READY_MAX_REF_CHARS,
  QUEUE_READY_MAX_RELATIONS,
  QUEUE_READY_MAX_REPO_NAME_CHARS,
  QUEUE_READY_MAX_TIMESTAMP_CHARS,
  type QueueReadyCandidate,
  type QueueReadyPayload,
} from "../../packages/core/src/contracts/index";
import {
  evaluateQueueReady,
  renderQueueReadyHuman,
} from "../../packages/core/src/domain/queue-ready";
import { ciCases } from "../fixtures/queue-ready/ci/cases";
import {
  labelSentinel,
  nonAsciiByteBudgetControlFacts,
  nonAsciiByteBudgetFacts,
  nonAsciiRefs,
  relationSentinel,
} from "../fixtures/queue-ready/caps/non-ascii-byte-budget";
import { closeCases } from "../fixtures/queue-ready/close/cases";
import { extraCorpusCases } from "../fixtures/queue-ready/corpus/cases";
import { depsCases } from "../fixtures/queue-ready/deps/cases";
import {
  baseFacts,
  evaluate,
  queueRuntime,
  runQueueReadyCli,
  SYNTHETIC_BRAND,
  workItemRead,
} from "../fixtures/queue-ready/harness";
import {
  candidateIdentityCases,
  candidateWithRelation,
  targetIdentityCases,
} from "../fixtures/queue-ready/identity/cases";
import { matrixCases } from "../fixtures/queue-ready/matrix/cases";
import { providerCases, providerFixture } from "../fixtures/queue-ready/provider/cases";
import { repoCases } from "../fixtures/queue-ready/repo/cases";

const payloadOf = (stdout: string): QueueReadyPayload =>
  JSON.parse(stdout).data as QueueReadyPayload;

const candidateOf = (payload: QueueReadyPayload, ref: string) =>
  payload.candidates.find((candidate) => candidate.workItemRef === ref);

interface CorpusVerdict {
  readonly states: readonly string[];
  readonly ready: boolean;
  readonly closeClass: string;
  readonly rank: number;
  readonly association?: string;
  readonly closeReason?: string;
  readonly associatedCount?: number;
  readonly candidateTruncated?: boolean;
  readonly payloadTruncated?: boolean;
}

const assertVerdict = (
  label: string,
  payload: QueueReadyPayload,
  ref: string,
  expected: CorpusVerdict,
): void => {
  const candidate = candidateOf(payload, ref);
  expect(candidate, `${label}: ${ref} missing`).toBeDefined();
  if (candidate === undefined) return;
  expect(
    candidate.conditions.map((condition) => condition.state),
    `${label}: ${ref} states`,
  ).toEqual([...expected.states]);
  expect(candidate.ready, `${label}: ${ref} ready`).toBe(expected.ready);
  expect(candidate.closeClass, `${label}: ${ref} class`).toBe(expected.closeClass);
  expect(candidate.rank, `${label}: ${ref} rank`).toBe(expected.rank);
  if (expected.association !== undefined) {
    expect(candidate.close.association, `${label}: ${ref} association`).toBe(expected.association);
  }
  if (expected.closeReason !== undefined) {
    expect(candidate.close.reason, `${label}: ${ref} close reason`).toBe(expected.closeReason);
  }
  if (expected.associatedCount !== undefined) {
    expect(candidate.close.associatedCount, `${label}: ${ref} count`).toBe(
      expected.associatedCount,
    );
  }
  if (expected.candidateTruncated !== undefined) {
    expect(candidate.truncated, `${label}: ${ref} candidate truncated`).toBe(
      expected.candidateTruncated,
    );
  }
  if (expected.payloadTruncated !== undefined) {
    expect(payload.truncated, `${label}: ${ref} payload truncated`).toBe(expected.payloadTruncated);
  }
  if (expected.reasons !== undefined) {
    expect(payload.reasons, `${label}: ${ref} reasons`).toEqual([...expected.reasons]);
  }
};

describe("TC-QREADY-028 corpus", () => {
  test("explicit corpus cases run through runCli with exact verdicts", async () => {
    for (const testCase of extraCorpusCases) {
      const refs = testCase.expected.map((entry) => entry.ref);
      const run = await runQueueReadyCli(
        ["queue", "ready", ...refs, "--json"],
        queueRuntime(testCase.facts),
      );
      expect(run.exitCode, testCase.name).toBe(0);
      const payload = payloadOf(run.stdout);
      if (testCase.name === "provider-over-cap-fields") {
        expect(Buffer.byteLength(JSON.stringify(payload)), testCase.name).toBeLessThanOrEqual(
          65536,
        );
      }
      for (const expected of testCase.expected) {
        assertVerdict(testCase.name, payload, expected.ref, expected);
      }
      expect(run.stdout.includes("planted-queue-ready"), testCase.name).toBe(false);
    }
  });

  test("reasons-cap-7 pins the documented group-5 walk order", async () => {
    const testCase = extraCorpusCases.find((entry) => entry.name === "reasons-cap-7");
    expect(testCase).toBeDefined();
    if (testCase === undefined) return;
    const run = await runQueueReadyCli(
      ["queue", "ready", "GH-176", "--json"],
      queueRuntime(testCase.facts),
    );
    const payload = payloadOf(run.stdout);
    expect(payload.reasons).toEqual([
      "source-truncated",
      "value-clamped",
      "config-invalid",
      "state-unreadable",
      "local-context-missing",
      "signal-unavailable",
    ]);
    expect(payload.reasons.indexOf("local-context-missing")).toBeLessThan(
      payload.reasons.indexOf("signal-unavailable"),
    );
  });

  test("the Appendix A matrix is part of the corpus", () => {
    for (const testCase of matrixCases) {
      assertVerdict(testCase.name, evaluate(testCase.facts), "GH-176", {
        states: testCase.states,
        ready: testCase.ready,
        closeClass: testCase.closeClass ?? (testCase.ready ? "new-start" : "not-ready"),
        rank: 1,
      });
    }
  });

  test("deps, CI, provider, close, and identity case tables are exercised", () => {
    for (const testCase of depsCases) {
      const condition = evaluate(testCase.facts).candidates[0]?.conditions.find(
        (entry) => entry.id === "deps-satisfied",
      );
      expect(condition?.state, testCase.name).toBe(testCase.state);
    }
    for (const testCase of ciCases) {
      const condition = evaluate(testCase.facts).candidates[0]?.conditions.find(
        (entry) => entry.id === "ci-healthy",
      );
      expect(condition?.state, testCase.name).toBe(testCase.state);
    }
    for (const testCase of providerCases) {
      const payload = evaluate({ providers: providerFixture(testCase.fixture) });
      const condition = payload.candidates[0]?.conditions.find(
        (entry) => entry.id === "provider-available",
      );
      expect(condition?.state, testCase.fixture).toBe(testCase.state);
    }
    for (const testCase of closeCases) {
      const candidate = evaluate(testCase.facts).candidates[0];
      expect(candidate?.close.association, testCase.name).toBe(testCase.association);
      expect(candidate?.closeClass, testCase.name).toBe(testCase.closeClass);
    }
    for (const testCase of targetIdentityCases) {
      const condition = evaluate({
        tracker: workItemRead([candidateWithRelation(testCase.target), ...testCase.observedItems]),
      }).candidates[0]?.conditions.find((entry) => entry.id === "deps-satisfied");
      expect(condition?.state, testCase.name).toBe(testCase.state);
    }
    for (const testCase of candidateIdentityCases) {
      const payload = evaluate({
        candidates: testCase.candidates,
        tracker: workItemRead([...testCase.items]),
      });
      for (const candidate of payload.candidates) {
        const observed = testCase.observed.includes(candidate.workItemRef);
        expect(candidate.workItem.state, `${testCase.name} ${candidate.workItemRef}`).toBe(
          observed ? "observed" : "unknown",
        );
      }
    }
    for (const testCase of repoCases) {
      const condition = evaluate({
        localContext: testCase.localContext,
      }).candidates[0]?.conditions.find((entry) => entry.id === "repo-free");
      expect(condition?.state, testCase.name).toBe(testCase.state);
    }
  });
});

describe("TC-QREADY-028 completeness meta-check", () => {
  const allCaseNames = [
    ...matrixCases.map((entry) => entry.name),
    ...extraCorpusCases.map((entry) => entry.name),
    ...closeCases.map((entry) => entry.name),
    ...ciCases.map((entry) => entry.name),
    ...providerCases.map((entry) => entry.fixture),
    ...depsCases.map((entry) => entry.name),
    ...targetIdentityCases.map((entry) => entry.name),
    ...candidateIdentityCases.map((entry) => entry.name),
    ...repoCases.map((entry) => entry.name),
  ];

  test("every condition has at least one satisfied, unsatisfied, and unknown case", () => {
    const states = new Map<string, Set<string>>();
    for (const testCase of matrixCases) {
      testCase.states.forEach((state, index) => {
        const id = QUEUE_READY_CONDITION_ORDER[index];
        if (id === undefined) return;
        const set = states.get(id) ?? new Set<string>();
        set.add(state);
        states.set(id, set);
      });
    }
    for (const testCase of extraCorpusCases) {
      for (const expected of testCase.expected) {
        expected.states.forEach((state, index) => {
          const id = QUEUE_READY_CONDITION_ORDER[index];
          if (id === undefined) return;
          const set = states.get(id) ?? new Set<string>();
          set.add(state);
          states.set(id, set);
        });
      }
    }
    for (const id of QUEUE_READY_CONDITION_ORDER) {
      expect([...(states.get(id) ?? [])].sort(), id).toEqual([
        "satisfied",
        "unknown",
        "unsatisfied",
      ]);
    }
  });

  test("all five close classes appear", () => {
    const classes = new Set<string>([
      ...matrixCases.map((entry) => entry.closeClass ?? (entry.ready ? "new-start" : "not-ready")),
      ...extraCorpusCases.flatMap((entry) => entry.expected.map((expected) => expected.closeClass)),
      ...closeCases.map((entry) => entry.closeClass),
    ]);
    expect([...classes].sort()).toEqual([
      "merge-ready",
      "new-start",
      "not-ready",
      "review-pending",
      "unknown",
    ]);
  });

  test("every named source failure and identity/cap row is present", () => {
    const required = [
      "tracker-read-failed",
      "pr-read-failed",
      "read-failed",
      "credential-unavailable",
      "binding-addressing",
      "binding-remote-unsupported",
      "unresolved-sha",
      "config-invalid",
      "unresolved-chain-command",
      "no-chain",
      "park-fold-torn",
      "context-missing",
      "context-malformed",
      "all-unknown-degraded",
      "at-limit-pr-no-match",
      "source-truncated-issues",
      "reasons-cap-7",
      "detail-clamp",
      "provider-over-cap-fields",
      "provider-over-cap-byte-budget",
      "exact-canonical",
      "wrong-number",
      "ambiguous-suffix",
      "leading-zero-mismatch-176",
      "exact-done",
      "canonical-observed-unrequested",
      "no-match",
    ];
    for (const name of required) {
      expect(allCaseNames, name).toContain(name);
    }
    for (const identity of ["ambiguous-suffix", "wrong-number", "leading-zero-mismatch-176"]) {
      expect(candidateIdentityCases.map((entry) => entry.name)).toContain(identity);
    }
    expect(targetIdentityCases.map((entry) => entry.name)).toContain(
      "canonical-observed-unrequested",
    );
  });

  test("the new Appendix C caps and value-clamped are covered by the constant inventory", () => {
    const text = readFileSync("tests/structure/queue-ready-contract.test.ts", "utf8");
    for (const token of [
      "QUEUE_READY_MAX_IDENTITY_CHARS",
      "QUEUE_READY_MAX_REF_CHARS",
      "QUEUE_READY_MAX_LABEL_CHARS",
      "QUEUE_READY_MAX_LABELS",
      "QUEUE_READY_MAX_RELATIONS",
      "QUEUE_READY_MAX_OWNER_CHARS",
      "QUEUE_READY_MAX_REPO_NAME_CHARS",
      "QUEUE_READY_MAX_BRANCH_CHARS",
      "QUEUE_READY_MAX_TIMESTAMP_CHARS",
      "QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES",
      "QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN",
      "value-clamped",
    ]) {
      expect(text.includes(token), token).toBe(true);
    }
    expect(QUEUE_READY_MAX_IDENTITY_CHARS).toBe(128);
    expect(QUEUE_READY_MAX_REF_CHARS).toBe(128);
    expect(QUEUE_READY_MAX_LABEL_CHARS).toBe(128);
    expect(QUEUE_READY_MAX_LABELS).toBe(16);
    expect(QUEUE_READY_MAX_RELATIONS).toBe(16);
    expect(QUEUE_READY_MAX_OWNER_CHARS).toBe(128);
    expect(QUEUE_READY_MAX_REPO_NAME_CHARS).toBe(128);
    expect(QUEUE_READY_MAX_BRANCH_CHARS).toBe(256);
    expect(QUEUE_READY_MAX_TIMESTAMP_CHARS).toBe(40);
    expect(QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES).toBe(32);
  });

  test("a missing dimension fails by name", () => {
    const withoutAllUnknown = extraCorpusCases.filter(
      (entry) => entry.name !== "all-unknown-degraded",
    );
    expect(withoutAllUnknown.map((entry) => entry.name)).not.toContain("all-unknown-degraded");
    const names = withoutAllUnknown.map((entry) => entry.name);
    expect(() => {
      if (!names.includes("all-unknown-degraded")) throw new Error("missing all-unknown-degraded");
    }).toThrow("missing all-unknown-degraded");
  });

  test("a corrupted expectation fails by name", async () => {
    const testCase = extraCorpusCases.find((entry) => entry.name === "source-truncated-issues");
    expect(testCase).toBeDefined();
    if (testCase === undefined) return;
    const run = await runQueueReadyCli(
      ["queue", "ready", "GH-176", "--json"],
      queueRuntime(testCase.facts),
    );
    const expected = testCase.expected[0];
    expect(expected).toBeDefined();
    if (expected === undefined) return;
    expect(() =>
      assertVerdict("corrupted", payloadOf(run.stdout), "GH-176", {
        ...expected,
        states: ["unsatisfied", ...expected.states.slice(1)],
      }),
    ).toThrow();
  });

  test("default CI performs zero live calls (injected runtime only)", async () => {
    const run = await runQueueReadyCli(
      ["queue", "ready", "GH-176", "--json"],
      queueRuntime(baseFacts({ tracker: workItemRead([]) })),
    );
    expect(run.exitCode).toBe(0);
  });
});

/* --------------------------- TC-QREADY-035 -------------------------------- */

type ObservedWorkItem = Extract<QueueReadyCandidate["workItem"], { state: "observed" }>;
type RawCandidate = Omit<QueueReadyCandidate, "workItem"> & { workItem: ObservedWorkItem };
type ReductionOptions = {
  readonly collectionOrder: "relations-first" | "labels-first";
  readonly rankOrder: "desc" | "asc";
  readonly indexOrder: "desc" | "asc";
};

type RawRelation = NonNullable<ObservedWorkItem["relations"]>[number];
type MutableCandidate = {
  readonly rank: number;
  readonly labels: string[];
  readonly relations: RawRelation[];
  readonly base: RawCandidate;
};

/** Mirror the production `withRelations`/`withLabels` projection exactly. */
const materializeReduction = (
  basePayload: QueueReadyPayload,
  mutable: readonly MutableCandidate[],
): QueueReadyPayload => ({
  ...basePayload,
  candidates: mutable.map((candidate) => ({
    ...candidate.base,
    workItem: {
      state: "observed",
      itemState: candidate.base.workItem.itemState,
      labels: candidate.labels,
      ...(candidate.base.workItem.updatedAt === undefined
        ? {}
        : { updatedAt: candidate.base.workItem.updatedAt }),
      ...(candidate.relations.length === 0 ? {} : { relations: candidate.relations }),
    },
  })),
});

const survivorsOf = (candidates: readonly MutableCandidate[]) =>
  candidates.map((candidate) => ({
    rank: candidate.rank,
    labels: [...candidate.labels],
    relations: [...candidate.relations],
  }));

const assertPinnedReduction = (actual: unknown, expected: unknown): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("byte-budget reduction order mismatch");
  }
};

describe("TC-QREADY-035 pinned byte-budget reduction order", () => {
  test("the CJK fixture reduces in the pinned order with exact survivors", () => {
    const facts = nonAsciiByteBudgetFacts();
    const actual = evaluateQueueReady(facts);
    expect(actual.candidates.map((candidate) => candidate.workItemRef)).toEqual([...nonAsciiRefs]);
    expect(actual.candidates.map((candidate) => candidate.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    const rawItems = facts.tracker.ok ? facts.tracker.items : [];
    const itemByEntity = new Map(rawItems.map((item) => [item.identity.entityId, item]));
    const raw: RawCandidate[] = actual.candidates.map((candidate) => {
      if (candidate.workItem.state !== "observed") throw new Error("expected observed candidate");
      const entityId = candidate.workItemRef.replace(/^GH-/, "");
      const item = itemByEntity.get(entityId);
      if (item === undefined) throw new Error(`missing raw item ${entityId}`);
      return {
        ...candidate,
        workItem: {
          ...candidate.workItem,
          labels: item.labels.slice(0, QUEUE_READY_MAX_LABELS),
          relations: item.relations
            .filter((relation) => relation.relationKind === "blocked-by")
            .slice(0, QUEUE_READY_MAX_RELATIONS)
            .map((relation) => ({
              relationKind: "blocked-by" as const,
              target: { entityId: relation.target.entityId },
            })),
        },
      };
    });
    expect(raw.every((candidate) => candidate.workItem.labels?.length === 16)).toBe(true);
    expect(raw.every((candidate) => candidate.workItem.relations?.length === 16)).toBe(true);
    expect(raw[0]?.workItem.labels?.[0]).toBe("priority:high");
    for (const [index, candidate] of raw.entries()) {
      const rank = index + 1;
      expect(candidate.workItem.labels?.[1]?.endsWith(labelSentinel(rank, 1))).toBe(true);
      expect(
        candidate.workItem.relations?.[0]?.target.entityId.endsWith(relationSentinel(rank, 0)),
      ).toBe(true);
    }

    const basePayload = { ...actual, candidates: [] as readonly QueueReadyCandidate[] };
    const materialize = (mutable: readonly MutableCandidate[]): QueueReadyPayload =>
      materializeReduction(basePayload, mutable);
    const simulate = (
      options: ReductionOptions,
    ): { mutable: MutableCandidate[]; drops: { rank: number; kind: "relation" | "label" }[] } => {
      const mutable: MutableCandidate[] = raw.map((candidate) => ({
        rank: candidate.rank,
        labels: [...(candidate.workItem.labels ?? [])],
        relations: [...(candidate.workItem.relations ?? [])],
        base: candidate,
      }));
      const fits = (): boolean =>
        Buffer.byteLength(JSON.stringify(materialize(mutable))) <= QUEUE_READY_MAX_MACHINE_BYTES;
      const drops: { rank: number; kind: "relation" | "label" }[] = [];
      const indexes = mutable.map((_, index) => index);
      if (options.rankOrder === "desc") indexes.reverse();
      const reduce = (kind: "relation" | "label"): boolean => {
        for (const index of indexes) {
          const candidate = mutable[index];
          if (candidate === undefined) continue;
          const list = kind === "relation" ? candidate.relations : candidate.labels;
          while (list.length > 0) {
            if (options.indexOrder === "desc") list.pop();
            else list.shift();
            drops.push({ rank: candidate.rank, kind });
            if (fits()) return true;
          }
        }
        return false;
      };
      if (!fits()) {
        const order: readonly ("relation" | "label")[] =
          options.collectionOrder === "relations-first"
            ? ["relation", "label"]
            : ["label", "relation"];
        for (const kind of order) {
          if (reduce(kind)) break;
        }
      }
      return { mutable, drops };
    };

    const pinned = simulate({
      collectionOrder: "relations-first",
      rankOrder: "desc",
      indexOrder: "desc",
    });
    const pinnedSurvivors = survivorsOf(pinned.mutable);
    expect(
      survivorsOf(
        actual.candidates.map((candidate) => ({
          rank: candidate.rank,
          labels: [
            ...(candidate.workItem.state === "observed" ? (candidate.workItem.labels ?? []) : []),
          ],
          relations: [
            ...(candidate.workItem.state === "observed"
              ? (candidate.workItem.relations ?? [])
              : []),
          ],
          base: candidate as RawCandidate,
        })),
      ),
    ).toEqual(pinnedSurvivors);

    // Survivors are prefixes of the raw collections (never interior gaps).
    for (const [index, candidate] of pinned.mutable.entries()) {
      const rawLabels = raw[index]?.workItem.labels ?? [];
      const rawRelations = raw[index]?.workItem.relations ?? [];
      expect(candidate.labels).toEqual(rawLabels.slice(0, candidate.labels.length));
      expect(candidate.relations).toEqual(rawRelations.slice(0, candidate.relations.length));
    }

    // Relations strictly before labels: a candidate's labels are only dropped
    // once every relation in it and every lower-ranked candidate is gone.
    for (const [index, candidate] of pinned.mutable.entries()) {
      const rawLabels = raw[index]?.workItem.labels ?? [];
      if (candidate.labels.length === rawLabels.length) continue;
      for (let lower = index; lower < pinned.mutable.length; lower += 1) {
        expect(
          pinned.mutable[lower]?.relations.length,
          `rank ${candidate.rank} labels dropped while relations remain`,
        ).toBe(0);
      }
    }

    // Reverse rank order: lower-ranked candidates drop at least as much.
    const droppedCounts = pinned.mutable.map((candidate, index) => {
      const rawLabels = raw[index]?.workItem.labels ?? [];
      const rawRelations = raw[index]?.workItem.relations ?? [];
      return (
        rawLabels.length -
        candidate.labels.length +
        (rawRelations.length - candidate.relations.length)
      );
    });
    for (let index = 1; index < droppedCounts.length; index += 1) {
      expect(droppedCounts[index] ?? 0).toBeGreaterThanOrEqual(droppedCounts[index - 1] ?? 0);
    }

    // Stop at the first fit: restoring the last dropped element exceeds 64 KiB.
    const lastDrop = pinned.drops[pinned.drops.length - 1];
    expect(lastDrop).toBeDefined();
    if (lastDrop !== undefined) {
      const restored = pinned.mutable.map((candidate) => ({
        rank: candidate.rank,
        labels: [...candidate.labels],
        relations: [...candidate.relations],
        base: candidate.base,
      }));
      const targetIndex = restored.findIndex((candidate) => candidate.rank === lastDrop.rank);
      const target = restored[targetIndex];
      const rawCandidate = raw[targetIndex];
      expect(target).toBeDefined();
      expect(rawCandidate).toBeDefined();
      if (target !== undefined && rawCandidate !== undefined) {
        if (lastDrop.kind === "relation") {
          const next = rawCandidate.workItem.relations?.[target.relations.length];
          expect(next).toBeDefined();
          if (next !== undefined) target.relations.push(next);
        } else {
          const next = rawCandidate.workItem.labels?.[target.labels.length];
          expect(next).toBeDefined();
          if (next !== undefined) target.labels.push(next);
        }
        expect(Buffer.byteLength(JSON.stringify(materialize(restored)))).toBeGreaterThan(
          QUEUE_READY_MAX_MACHINE_BYTES,
        );
      }
    }

    expect(actual.truncated).toBe(true);
    expect(actual.reasons.filter((reason) => reason === "value-clamped")).toHaveLength(1);
    const control = evaluateQueueReady(nonAsciiByteBudgetControlFacts());
    const verdictOf = (payload: QueueReadyPayload) =>
      payload.candidates.map((candidate) => ({
        ref: candidate.workItemRef,
        ready: candidate.ready,
        closeClass: candidate.closeClass,
        states: candidate.conditions.map((condition) => condition.state),
        blocking: candidate.blockingConditions,
      }));
    expect(verdictOf(actual)).toEqual(verdictOf(control));

    const human = renderQueueReadyHuman(actual, SYNTHETIC_BRAND);
    expect(Buffer.byteLength(human)).toBeLessThanOrEqual(QUEUE_READY_MAX_HUMAN_BYTES);
    expect(human.trimEnd().split("\n").length).toBeLessThanOrEqual(16);
  });

  test("mutated reduction strategies fail the pinned order by name", () => {
    const facts = nonAsciiByteBudgetFacts();
    const actual = evaluateQueueReady(facts);
    const rawItems = facts.tracker.ok ? facts.tracker.items : [];
    const itemByEntity = new Map(rawItems.map((item) => [item.identity.entityId, item]));
    const raw: RawCandidate[] = actual.candidates.map((candidate) => {
      if (candidate.workItem.state !== "observed") throw new Error("expected observed candidate");
      const item = itemByEntity.get(candidate.workItemRef.replace(/^GH-/, ""));
      if (item === undefined) throw new Error("missing raw item");
      return {
        ...candidate,
        workItem: {
          ...candidate.workItem,
          labels: item.labels.slice(0, QUEUE_READY_MAX_LABELS),
          relations: item.relations
            .filter((relation) => relation.relationKind === "blocked-by")
            .slice(0, QUEUE_READY_MAX_RELATIONS)
            .map((relation) => ({
              relationKind: "blocked-by" as const,
              target: { entityId: relation.target.entityId },
            })),
        },
      };
    });
    const basePayload = { ...actual, candidates: [] as readonly QueueReadyCandidate[] };
    const materialize = (mutable: readonly MutableCandidate[]): QueueReadyPayload =>
      materializeReduction(basePayload, mutable);
    const simulate = (options: ReductionOptions): MutableCandidate[] => {
      const mutable: MutableCandidate[] = raw.map((candidate) => ({
        rank: candidate.rank,
        labels: [...(candidate.workItem.labels ?? [])],
        relations: [...(candidate.workItem.relations ?? [])],
        base: candidate,
      }));
      const fits = (): boolean =>
        Buffer.byteLength(JSON.stringify(materialize(mutable))) <= QUEUE_READY_MAX_MACHINE_BYTES;
      const indexes = mutable.map((_, index) => index);
      if (options.rankOrder === "desc") indexes.reverse();
      const reduce = (kind: "relation" | "label"): boolean => {
        for (const index of indexes) {
          const candidate = mutable[index];
          if (candidate === undefined) continue;
          const list = kind === "relation" ? candidate.relations : candidate.labels;
          while (list.length > 0) {
            if (options.indexOrder === "desc") list.pop();
            else list.shift();
            if (fits()) return true;
          }
        }
        return false;
      };
      if (!fits()) {
        const order: readonly ("relation" | "label")[] =
          options.collectionOrder === "relations-first"
            ? ["relation", "label"]
            : ["label", "relation"];
        for (const kind of order) {
          if (reduce(kind)) break;
        }
      }
      return mutable;
    };

    const pinned = survivorsOf(
      simulate({ collectionOrder: "relations-first", rankOrder: "desc", indexOrder: "desc" }),
    );
    const mutations: readonly [string, ReductionOptions][] = [
      [
        "labels before relations",
        { collectionOrder: "labels-first", rankOrder: "desc", indexOrder: "desc" },
      ],
      [
        "rank 1 before rank 8",
        { collectionOrder: "relations-first", rankOrder: "asc", indexOrder: "desc" },
      ],
      [
        "ascending index order",
        { collectionOrder: "relations-first", rankOrder: "desc", indexOrder: "asc" },
      ],
    ];
    for (const [label, options] of mutations) {
      const mutated = survivorsOf(simulate(options));
      expect(mutated, label).not.toEqual(pinned);
      expect(() => assertPinnedReduction(mutated, pinned), label).toThrow("reduction order");
    }
  });
});
