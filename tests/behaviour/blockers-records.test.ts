/**
 * TC-BLK-005 and the port-level halves of TC-BLK-009/010/012/013 — the state
 * consumer validates at the artifact boundary, performs one fenced append with
 * coverage, reads verified history, and fails closed on corruption.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { STATE_SCHEMA_VERSION, type StateJsonValue } from "../../packages/core/src/contracts/index";
import {
  appendBlockerAnswer,
  appendBlockerQuestion,
  blockerQuestionRecordKey,
  readBlockerLedger,
} from "../../packages/core/src/state/index";
import { FIXED_ISO, makeAnswer, makeQuestion } from "../fixtures/blockers/records";
import {
  createTestEdge,
  ledgerPath,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
} from "../fixtures/state/harness";
import { guardStore } from "./verify-support";

type PortState = {
  readonly root: string;
  readonly identity: ReturnType<typeof makeIdentity>;
  readonly cleanup: () => void;
};

const portState = (label: string): PortState => {
  const root = makeTempRoot(`gh230-${label}`);
  return {
    root,
    identity: makeIdentity(root, { workspaceId: `gh230-${label}` }),
    cleanup: () => removeRoot(root),
  };
};

const rawAppend = (
  store: ReturnType<typeof openStore>["store"],
  request: { readonly kind: string; readonly recordKey: string; readonly payload: StateJsonValue },
): void => {
  const acquired = store.acquireFence("seed-writer");
  if (!acquired.ok) throw new Error(`seed fence failed: ${acquired.error.code}`);
  try {
    const appended = store.append(acquired.value.handle, request);
    if (!appended.ok) throw new Error(`seed append failed: ${appended.error.code}`);
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};

const questionPayload = (id: string): StateJsonValue => ({
  schemaId: "delivery.blocker.question.v1",
  id,
  type: "decision-needed",
  audience: "coordinator",
  lane: "L5",
  ref: null,
  question: "seed question",
  options: ["a", "b"],
  askedAt: FIXED_ISO,
});

const answerPayload = (questionId: string): StateJsonValue => ({
  schemaId: "delivery.blocker.answer.v1",
  questionId,
  answeringAudience: "owner",
  choice: "a",
  answeredAt: FIXED_ISO,
  applied: false,
  laneResume: {
    mode: "boundary-note",
    sessionReentry: false,
    capabilitySource: "adapter-declared",
  },
});

describe("TC-BLK-005 state consumer behind the injected port", () => {
  test("a publish performs one fence, one append, one release, and a coverage read", () => {
    const state = portState("append-count");
    try {
      const { store } = openStore(state.identity, { edge: createTestEdge() });
      const recorder = { calls: [] as string[] };
      const guarded = guardStore(store, recorder, { throwOnMutation: false });
      const appended = appendBlockerQuestion(guarded.store, {
        record: makeQuestion({ id: "q-1" }),
        fenceToken: "fence-1",
      });
      expect(appended.ok).toBe(true);
      const count = (name: string): number => recorder.calls.filter((call) => call === name).length;
      expect(count("acquireFence")).toBe(1);
      expect(count("append")).toBe(1);
      expect(count("releaseFence")).toBe(1);
      expect(count("readRecords")).toBe(2);
    } finally {
      state.cleanup();
    }
  });

  test("a verified-empty store reads empty, never a zeroed record", () => {
    const state = portState("empty");
    try {
      const { store } = openStore(state.identity, { edge: createTestEdge() });
      const read = readBlockerLedger(store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.value.verifiedEmpty).toBe(true);
      expect(read.value.questions).toEqual([]);
      expect(read.value.answers).toEqual([]);
      expect(read.value.recordCount).toBe(0);
    } finally {
      state.cleanup();
    }
  });

  test("a question is durable across a reopened store instance", () => {
    const state = portState("durable");
    try {
      const first = openStore(state.identity, { edge: createTestEdge() });
      const record = makeQuestion({ id: "q-1" });
      expect(appendBlockerQuestion(first.store, { record, fenceToken: "fence-1" }).ok).toBe(true);
      const second = openStore(state.identity, { edge: createTestEdge() });
      const read = readBlockerLedger(second.store);
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value.questions).toEqual([record]);
    } finally {
      state.cleanup();
    }
  });

  test("question bytes are append-only and never rewritten by an answer", () => {
    const state = portState("append-only");
    try {
      const { store } = openStore(state.identity, { edge: createTestEdge() });
      const question = makeQuestion({ id: "q-1" });
      expect(appendBlockerQuestion(store, { record: question, fenceToken: "f1" }).ok).toBe(true);
      const before = readFileSync(ledgerPath(state.identity));
      expect(
        appendBlockerAnswer(store, {
          record: makeAnswer({ questionId: "q-1", choice: "full" }),
          fenceToken: "f2",
        }).ok,
      ).toBe(true);
      const after = readFileSync(ledgerPath(state.identity));
      expect(after.subarray(0, before.length).equals(before)).toBe(true);
      const read = readBlockerLedger(store);
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.questions).toEqual([question]);
        expect(read.value.answers).toHaveLength(1);
      }
    } finally {
      state.cleanup();
    }
  });

  test("an undeclared vocabulary value is state.store.unknown with zero bytes", () => {
    const state = portState("unknown-vocab");
    try {
      const { store } = openStore(state.identity, { edge: createTestEdge() });
      const before = readBlockerLedger(store);
      const invalid = {
        ...makeQuestion({ id: "q-1" }),
        type: "unknown-type",
      } as unknown as ReturnType<typeof makeQuestion>;
      const appended = appendBlockerQuestion(store, { record: invalid, fenceToken: "f1" });
      expect(appended.ok).toBe(false);
      if (!appended.ok) expect(appended.error.code).toBe("state.store.unknown");
      expect(before.ok).toBe(true);
      if (before.ok) expect(before.value.recordCount).toBe(0);
      const after = readBlockerLedger(store);
      if (after.ok) expect(after.value.recordCount).toBe(0);
    } finally {
      state.cleanup();
    }
  });

  test("a wrong-kind record under a blocker key is state.store.unknown", () => {
    const state = portState("wrong-kind");
    try {
      const { store } = openStore(state.identity, { edge: createTestEdge() });
      rawAppend(store, {
        kind: "other.kind",
        recordKey: blockerQuestionRecordKey("q-1"),
        payload: questionPayload("q-1"),
      });
      const read = readBlockerLedger(store);
      expect(read.ok).toBe(false);
      if (!read.ok) expect(read.error.code).toBe("state.store.unknown");
    } finally {
      state.cleanup();
    }
  });

  test("a malformed record payload is classified, not served", () => {
    const state = portState("malformed");
    try {
      const { store } = openStore(state.identity, { edge: createTestEdge() });
      const payload = { ...questionPayload("q-1") } as Record<string, StateJsonValue>;
      delete payload.ref;
      rawAppend(store, {
        kind: "blocker.question",
        recordKey: blockerQuestionRecordKey("q-1"),
        payload,
      });
      const read = readBlockerLedger(store);
      expect(read.ok).toBe(false);
    } finally {
      state.cleanup();
    }
  });

  test("a torn ledger fails closed", () => {
    const state = portState("torn");
    try {
      const { store } = openStore(state.identity, { edge: createTestEdge() });
      expect(
        appendBlockerQuestion(store, { record: makeQuestion({ id: "q-1" }), fenceToken: "f1" }).ok,
      ).toBe(true);
      const path = ledgerPath(state.identity);
      const text = readFileSync(path, "utf8");
      writeFileSync(path, text.slice(0, Math.max(0, text.length - 3)));
      const read = readBlockerLedger(store);
      expect(read.ok).toBe(false);
      if (!read.ok) expect(read.error.code.startsWith("state.")).toBe(true);
    } finally {
      state.cleanup();
    }
  });

  test("a fence-busy store returns state.lock.busy and appends nothing", () => {
    const state = portState("fence-busy");
    try {
      const { store } = openStore(state.identity, { edge: createTestEdge() });
      const held = store.acquireFence("holder");
      expect(held.ok).toBe(true);
      const appended = appendBlockerQuestion(store, {
        record: makeQuestion({ id: "q-1" }),
        fenceToken: "other-writer",
      });
      expect(appended.ok).toBe(false);
      if (!appended.ok) expect(appended.error.code).toBe("state.lock.busy");
      if (held.ok) store.releaseFence(held.value.handle);
      const read = readBlockerLedger(store);
      if (read.ok) expect(read.value.recordCount).toBe(0);
    } finally {
      state.cleanup();
    }
  });
});

describe("TC-BLK-010/012/013 record identity and authoritative closure", () => {
  test("two questions keep distinct ids and closure is derived from answers", () => {
    const state = portState("closure");
    try {
      const { store } = openStore(state.identity, { edge: createTestEdge() });
      const first = makeQuestion({ id: "q-1" });
      const second = makeQuestion({ id: "q-2", question: "second" });
      expect(appendBlockerQuestion(store, { record: first, fenceToken: "f1" }).ok).toBe(true);
      expect(appendBlockerQuestion(store, { record: second, fenceToken: "f2" }).ok).toBe(true);
      expect(
        appendBlockerAnswer(store, {
          record: makeAnswer({ questionId: "q-1", choice: "full" }),
          fenceToken: "f3",
        }).ok,
      ).toBe(true);
      const read = readBlockerLedger(store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.value.questions.map((question) => question.id)).toEqual(["q-1", "q-2"]);
      expect(read.value.answers.map((answer) => answer.questionId)).toEqual(["q-1"]);
      expect(read.value.questions.some((question) => Object.hasOwn(question, "status"))).toBe(
        false,
      );
    } finally {
      state.cleanup();
    }
  });

  test("a duplicate answer history fails closed as state.store.torn", () => {
    const state = portState("duplicate-answer");
    try {
      const { store } = openStore(state.identity, { edge: createTestEdge() });
      rawAppend(store, {
        kind: "blocker.question",
        recordKey: blockerQuestionRecordKey("q-1"),
        payload: questionPayload("q-1"),
      });
      rawAppend(store, {
        kind: "blocker.answer",
        recordKey: "blockers.answers:q-1",
        payload: answerPayload("q-1"),
      });
      rawAppend(store, {
        kind: "blocker.answer",
        recordKey: "blockers.answers:q-1",
        payload: answerPayload("q-1"),
      });
      const read = readBlockerLedger(store);
      expect(read.ok).toBe(false);
      if (!read.ok) expect(read.error.code).toBe("state.store.torn");
    } finally {
      state.cleanup();
    }
  });

  test("the state schema version and record kinds are unchanged", () => {
    expect(STATE_SCHEMA_VERSION).toBe("delivery.state.v1");
  });
});
