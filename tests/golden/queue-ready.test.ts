/**
 * TC-QREADY-029 — byte-for-byte golden payload and human digest, plus the
 * DM-1/DM-2 validity contract over evaluator-produced payloads.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  QUEUE_READY_ASSOCIATED_COUNT_RANGE,
  QUEUE_READY_CONDITION_ORDER,
  QUEUE_READY_CONDITION_STATES,
  QUEUE_READY_EVIDENCE_REASONS,
  QUEUE_READY_EVIDENCE_SOURCES,
  QUEUE_READY_RANK_CLASS_ORDER,
  QUEUE_READY_REASON_ORDER,
  QUEUE_READY_SCHEMA_VERSION,
  type QueueReadyCandidate,
  type QueueReadyPayload,
} from "../../packages/core/src/contracts/index";
import { renderQueueReadyHuman } from "../../packages/core/src/domain/queue-ready";
import {
  canonicalPayload,
  canonicalUnknownClosePayload,
} from "../fixtures/queue-ready/golden/canonical";
import { SYNTHETIC_BRAND } from "./helpers";

const ROOT = process.cwd();
const PAYLOAD = join(ROOT, "tests/fixtures/queue-ready/golden/payload.json");
const HUMAN = join(ROOT, "tests/fixtures/queue-ready/golden/human.txt");

const asRecord = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;

const expectKeys = (
  failures: string[],
  label: string,
  value: unknown,
  expected: readonly string[],
): void => {
  const actual = Object.keys(asRecord(value));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label} keys: ${actual.join(",")} != ${expected.join(",")}`);
  }
};

const refSuffix = (ref: string): string | undefined => /([0-9]+)$/.exec(ref)?.[1];

const compareRef = (left: string, right: string): number => {
  const a = refSuffix(left);
  const b = refSuffix(right);
  if (a !== undefined && b !== undefined) {
    const x = BigInt(a);
    const y = BigInt(b);
    if (x !== y) return x < y ? -1 : 1;
  }
  return left === right ? 0 : left < right ? -1 : 1;
};

/** Validate the DM-1/DM-2 payload contract on an evaluator-produced payload. */
const validatePayload = (payload: QueueReadyPayload): string[] => {
  const failures: string[] = [];
  const fail = (message: string): void => {
    failures.push(message);
  };
  const text = JSON.stringify(payload);
  if (payload.schemaVersion !== QUEUE_READY_SCHEMA_VERSION) {
    fail(`schemaVersion ${payload.schemaVersion}`);
  }
  expectKeys(failures, "payload", payload, [
    "schemaVersion",
    "generatedAt",
    "repository",
    "head",
    "candidates",
    "summary",
    "reasons",
    "truncated",
  ]);
  if (/"title"/.test(text)) fail("title key");
  if (text.includes("systemName")) fail("systemName key");

  if (payload.repository.state === "observed") {
    expectKeys(failures, "repository", payload.repository, [
      "state",
      "host",
      "owner",
      "name",
      "remoteName",
    ]);
  } else {
    expectKeys(failures, "repository", payload.repository, ["state", "reason"]);
  }
  const headKeys: string[] = [];
  if (payload.head.branch !== undefined) headKeys.push("branch");
  if (payload.head.sha !== undefined) headKeys.push("sha");
  expectKeys(failures, "head", payload.head, headKeys);

  const ranks = new Set<number>();
  for (const [index, candidate] of payload.candidates.entries()) {
    const prefix = `candidate ${candidate.workItemRef}`;
    expectKeys(failures, `${prefix}`, candidate, [
      "workItemRef",
      "rank",
      "ready",
      "closeClass",
      "workItem",
      "close",
      "conditions",
      "blockingConditions",
      "truncated",
    ]);
    if (ranks.has(candidate.rank)) fail(`${prefix}: duplicate rank ${candidate.rank}`);
    ranks.add(candidate.rank);
    if (candidate.rank !== index + 1) fail(`${prefix}: rank ${candidate.rank} != ${index + 1}`);

    if (candidate.workItem.state === "unknown") {
      expectKeys(failures, `${prefix} workItem`, candidate.workItem, ["state", "reason"]);
      for (const id of ["deps-satisfied", "tier-known", "no-owner-gate"]) {
        const condition = candidate.conditions.find((entry) => entry.id === id);
        if (condition?.state === "satisfied") {
          fail(`${prefix}: unknown work item with satisfied ${id}`);
        }
      }
      if (candidate.ready) fail(`${prefix}: unknown work item with ready true`);
    } else {
      const workItemKeys = ["state", "itemState"];
      if (candidate.workItem.labels !== undefined) workItemKeys.push("labels");
      if (candidate.workItem.updatedAt !== undefined) workItemKeys.push("updatedAt");
      if (candidate.workItem.relations !== undefined) workItemKeys.push("relations");
      expectKeys(failures, `${prefix} workItem`, candidate.workItem, workItemKeys);
    }

    if (candidate.conditions.length !== QUEUE_READY_CONDITION_ORDER.length) {
      fail(`${prefix}: condition count ${candidate.conditions.length}`);
    }
    for (const [conditionIndex, condition] of candidate.conditions.entries()) {
      if (condition.id !== QUEUE_READY_CONDITION_ORDER[conditionIndex]) {
        fail(`${prefix}: condition order ${conditionIndex}`);
      }
      if (!QUEUE_READY_CONDITION_STATES.includes(condition.state)) {
        fail(`${prefix}: ${condition.id} state ${condition.state}`);
      }
      if (condition.evidence.length < 1 || condition.evidence.length > 2) {
        fail(`${prefix}: ${condition.id} evidence count ${condition.evidence.length}`);
      }
      for (const record of condition.evidence) {
        expectKeys(failures, `${prefix} ${condition.id} evidence`, record, [
          "source",
          "reason",
          ...(record.detail === undefined ? [] : ["detail"]),
        ]);
        if (!QUEUE_READY_EVIDENCE_SOURCES.includes(record.source)) {
          fail(`${prefix}: ${condition.id} evidence source ${record.source}`);
        }
        if (!QUEUE_READY_EVIDENCE_REASONS.includes(record.reason)) {
          fail(`${prefix}: ${condition.id} evidence reason ${record.reason}`);
        }
      }
    }
    const provider = candidate.conditions.find((entry) => entry.id === "provider-available");
    if (provider?.evidence.length !== 2) {
      fail(`${prefix}: provider evidence count ${provider?.evidence.length ?? 0}`);
    }

    const allSatisfied = candidate.conditions.every((entry) => entry.state === "satisfied");
    if (candidate.ready !== allSatisfied) fail(`${prefix}: ready equivalence`);
    const expectedBlocking = candidate.conditions
      .filter((entry) => entry.state !== "satisfied")
      .map((entry) => ({ id: entry.id, state: entry.state }));
    if (JSON.stringify(candidate.blockingConditions) !== JSON.stringify(expectedBlocking)) {
      fail(`${prefix}: blockingConditions`);
    }

    const pullRequest = candidate.close.pullRequest;
    expectKeys(failures, `${prefix} close`, candidate.close, [
      "association",
      "associatedCount",
      ...(pullRequest === undefined ? [] : ["pullRequest"]),
      "reason",
    ]);
    if (pullRequest !== undefined) {
      expectKeys(failures, `${prefix} pullRequest`, pullRequest, [
        "entityId",
        "sourceRef",
        "targetRef",
        "draft",
        "reviewStateObserved",
        ...(pullRequest.reviewState === undefined ? [] : ["reviewState"]),
      ]);
    }
    if (
      candidate.close.associatedCount < QUEUE_READY_ASSOCIATED_COUNT_RANGE.min ||
      candidate.close.associatedCount > QUEUE_READY_ASSOCIATED_COUNT_RANGE.max
    ) {
      fail(`${prefix}: associatedCount ${candidate.close.associatedCount}`);
    }

    const association = candidate.close.association;
    if (candidate.closeClass === "not-ready" && candidate.ready) {
      fail(`${prefix}: close class not-ready with ready true`);
    }
    if (candidate.ready && candidate.closeClass === "not-ready") {
      fail(`${prefix}: ready with close class not-ready`);
    }
    if (
      candidate.closeClass === "new-start" &&
      (candidate.ready !== true || association !== "not-associated")
    ) {
      fail(`${prefix}: close class new-start`);
    }
    if (
      candidate.closeClass === "unknown" &&
      (candidate.ready !== true || association !== "unknown")
    ) {
      fail(`${prefix}: close class unknown`);
    }
    if (candidate.closeClass === "merge-ready") {
      const mergeReady =
        association === "associated" &&
        pullRequest !== undefined &&
        pullRequest.reviewStateObserved === true &&
        pullRequest.reviewState === "approved" &&
        pullRequest.draft === false;
      if (!mergeReady) fail(`${prefix}: close class merge-ready`);
    }
    if (candidate.closeClass === "review-pending" && association !== "associated") {
      fail(`${prefix}: close class review-pending`);
    }
    if (association === "unknown" && candidate.ready && candidate.closeClass === "new-start") {
      fail(`${prefix}: unknown association rendered as new-start`);
    }
  }

  for (let index = 1; index < payload.candidates.length; index += 1) {
    const previous = payload.candidates[index - 1];
    const current = payload.candidates[index];
    if (previous === undefined || current === undefined) continue;
    const previousClass = QUEUE_READY_RANK_CLASS_ORDER.indexOf(previous.closeClass);
    const currentClass = QUEUE_READY_RANK_CLASS_ORDER.indexOf(current.closeClass);
    if (previousClass > currentClass) {
      fail(`rank order class at ${index}`);
    } else if (
      previousClass === currentClass &&
      compareRef(previous.workItemRef, current.workItemRef) > 0
    ) {
      fail(`rank order ref at ${index}`);
    }
  }

  const expectedSummary = {
    candidates: payload.candidates.length,
    ready: payload.candidates.filter((entry) => entry.ready).length,
    notReady: payload.candidates.filter((entry) => !entry.ready).length,
    mergeReady: payload.candidates.filter((entry) => entry.closeClass === "merge-ready").length,
    reviewPending: payload.candidates.filter((entry) => entry.closeClass === "review-pending")
      .length,
    newStart: payload.candidates.filter((entry) => entry.closeClass === "new-start").length,
    unknownClose: payload.candidates.filter((entry) => entry.closeClass === "unknown").length,
  };
  if (JSON.stringify(payload.summary) !== JSON.stringify(expectedSummary)) fail("summary");

  const flatOrder = QUEUE_READY_REASON_ORDER.flatMap((group) => group.reasons);
  const seen = new Set<string>();
  let lastIndex = -1;
  for (const reason of payload.reasons) {
    if (seen.has(reason)) fail(`reasons dedup ${reason}`);
    seen.add(reason);
    const orderIndex = flatOrder.indexOf(reason);
    if (orderIndex === -1) fail(`reasons unknown ${reason}`);
    if (orderIndex < lastIndex) fail(`reasons order ${reason}`);
    lastIndex = orderIndex;
  }
  const hasUnknownAssociation = payload.candidates.some(
    (entry) => entry.close.association === "unknown",
  );
  const group6 = payload.reasons.filter((reason) => reason === "pr-association-unknown");
  if (hasUnknownAssociation) {
    if (group6.length !== 1) fail("group 6 missing pr-association-unknown");
    else if (payload.reasons[payload.reasons.length - 1] !== "pr-association-unknown") {
      fail("group 6 not last");
    }
  } else if (group6.length !== 0) {
    fail("group 6 unexpected pr-association-unknown");
  }

  const truncatedMarker = payload.reasons.some(
    (reason) => reason === "value-clamped" || reason === "source-truncated",
  );
  if (payload.truncated !== truncatedMarker) fail("truncated flag");

  return failures;
};

type Mutator = (payload: QueueReadyPayload) => QueueReadyPayload;

const mutate = (payload: QueueReadyPayload, mutator: Mutator): QueueReadyPayload =>
  mutator(JSON.parse(JSON.stringify(payload)) as QueueReadyPayload);

const withCandidate = (
  payload: QueueReadyPayload,
  index: number,
  update: (candidate: QueueReadyCandidate) => QueueReadyCandidate,
): QueueReadyPayload => {
  const copy = JSON.parse(JSON.stringify(payload)) as QueueReadyPayload;
  const candidates = [...copy.candidates];
  const current = candidates[index];
  if (current === undefined) throw new Error(`candidate ${index} missing`);
  candidates[index] = update(current);
  return { ...copy, candidates };
};

describe("TC-QREADY-029 golden payload and human bytes", () => {
  test("the payload golden is byte-for-byte", () => {
    const expected = readFileSync(PAYLOAD, "utf8");
    const actual = `${JSON.stringify(canonicalPayload(), null, 2)}\n`;
    expect(actual).toBe(expected);
    expect(Buffer.byteLength(actual)).toBeLessThanOrEqual(65536);
  });

  test("the canonical payload passes every DM-1/DM-2 validity assertion", () => {
    expect(validatePayload(canonicalPayload())).toEqual([]);
  });

  test("the unknown-close evaluator payload is valid and observed", () => {
    const payload = canonicalUnknownClosePayload();
    expect(validatePayload(payload)).toEqual([]);
    expect(payload.candidates.every((entry) => entry.workItem.state === "observed")).toBe(true);
    expect(payload.candidates.every((entry) => entry.ready)).toBe(true);
    expect(payload.candidates.every((entry) => entry.close.association === "unknown")).toBe(true);
    expect(payload.candidates.every((entry) => entry.closeClass === "unknown")).toBe(true);
    expect(payload.reasons[payload.reasons.length - 1]).toBe("pr-association-unknown");
    expect(payload.truncated).toBe(false);
  });

  test("corrupted twins fail by name", () => {
    const canonical = canonicalPayload();
    const unknown = canonicalUnknownClosePayload();
    const controls: readonly [string, QueueReadyPayload][] = [
      [
        "unknown work item with satisfied conditions or ready true",
        withCandidate(unknown, 0, (candidate) => ({
          ...candidate,
          workItem: { state: "unknown", reason: "work-item-unobserved" },
        })),
      ],
      [
        "unknown association with reasons missing pr-association-unknown",
        mutate(unknown, (payload) => ({
          ...payload,
          reasons: payload.reasons.filter((reason) => reason !== "pr-association-unknown"),
        })),
      ],
      [
        "ready true with one unsatisfied condition",
        withCandidate(canonical, 0, (candidate) => ({
          ...candidate,
          conditions: candidate.conditions.map((condition, index) =>
            index === 0 ? { ...condition, state: "unsatisfied" } : condition,
          ),
        })),
      ],
      [
        "blockingConditions missing a non-satisfied id",
        withCandidate(canonical, 3, (candidate) => ({ ...candidate, blockingConditions: [] })),
      ],
      [
        "summary count off by one",
        mutate(canonical, (payload) => ({
          ...payload,
          summary: { ...payload.summary, ready: payload.summary.ready + 1 },
        })),
      ],
      [
        "rank gap or duplicate",
        withCandidate(canonical, 3, (candidate) => ({ ...candidate, rank: 10 })),
      ],
      [
        "systemName key in a projected identity",
        withCandidate(canonical, 0, (candidate) => ({
          ...candidate,
          close: {
            ...candidate.close,
            pullRequest:
              candidate.close.pullRequest === undefined
                ? undefined
                : {
                    ...candidate.close.pullRequest,
                    systemName: "github",
                  },
          },
        })),
      ],
      [
        "value-clamped outside group 2",
        mutate(canonical, (payload) => ({
          ...payload,
          reasons: ["config-invalid", "value-clamped"],
        })),
      ],
    ];
    const messages: readonly string[] = [
      "unknown work item",
      "group 6",
      "ready equivalence",
      "blockingConditions",
      "summary",
      "rank",
      "systemName",
      "reasons order",
    ];
    for (const [index, [label, payload]] of controls.entries()) {
      const violations = validatePayload(payload);
      expect(violations.length, label).toBeGreaterThan(0);
      expect(violations.join("\n"), label).toContain(messages[index] ?? "");
    }
  });

  test("the human golden is byte-for-byte and derived from the payload", () => {
    const payload = canonicalPayload();
    const expected = readFileSync(HUMAN, "utf8");
    const actual = renderQueueReadyHuman(payload, SYNTHETIC_BRAND);
    expect(actual).toBe(expected);
    expect(expected.trimEnd().split("\n").length).toBeLessThanOrEqual(16);
    expect(Buffer.byteLength(expected)).toBeLessThanOrEqual(4096);
    for (const candidate of payload.candidates) {
      expect(actual).toContain(`${candidate.rank}. ${candidate.workItemRef}`);
    }
    for (const line of actual.trimEnd().split("\n").slice(2)) {
      expect(line.endsWith("[repo:local-context; tier:priority-label]")).toBe(true);
    }
  });

  test("the golden carries capped provider values and value-clamped", () => {
    const payload = canonicalPayload();
    expect(payload.truncated).toBe(true);
    expect(payload.reasons).toContain("value-clamped");
    const text = readFileSync(PAYLOAD, "utf8");
    expect(text.includes('"title"')).toBe(false);
    expect(text.includes("systemName")).toBe(false);
    expect(text.includes("planted")).toBe(false);
    const human = readFileSync(HUMAN, "utf8");
    expect(human).toContain("+more");
    expect(human).toContain("+ ");
    for (const token of ["PR #", "feat/GH-175"]) {
      expect(human.includes(token)).toBe(true);
    }
  });

  test("provider segments are at most 32 UTF-8 bytes and shortened with +", () => {
    const human = readFileSync(HUMAN, "utf8");
    for (const segment of human.split(/[\s|]+/)) {
      if (segment.startsWith("PR") || segment.startsWith("#") || segment.startsWith("feat/")) {
        expect(Buffer.byteLength(segment)).toBeLessThanOrEqual(32);
      }
    }
    expect(human).toContain("+");
  });

  test("a changed fact changes the bytes and a stale golden fails", () => {
    const payload = canonicalPayload();
    const changed: QueueReadyPayload = {
      ...payload,
      candidates: payload.candidates.map((candidate, index) =>
        index === 1
          ? {
              ...candidate,
              conditions: candidate.conditions.map((condition) =>
                condition.id === "deps-satisfied"
                  ? { ...condition, state: "unsatisfied" }
                  : condition,
              ),
            }
          : candidate,
      ),
    };
    expect(JSON.stringify(changed)).not.toBe(JSON.stringify(payload));
    const mutatedGolden = `${JSON.stringify(payload, null, 2)}\n`.replace(
      '"schemaVersion": "delivery.queue-ready.v1"',
      '"schemaVersion": "delivery.queue-ready.v0"',
    );
    expect(mutatedGolden).not.toBe(readFileSync(PAYLOAD, "utf8"));
  });

  test("the golden files are read-only at test time", () => {
    const beforePayload = statSync(PAYLOAD).mtimeMs;
    const beforeHuman = statSync(HUMAN).mtimeMs;
    canonicalPayload();
    expect(statSync(PAYLOAD).mtimeMs).toBe(beforePayload);
    expect(statSync(HUMAN).mtimeMs).toBe(beforeHuman);
  });
});
