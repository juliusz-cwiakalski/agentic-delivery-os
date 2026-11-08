/**
 * TC-EFFECT-001..006 / TC-RECON-007/008 (effect halves) — the legal state
 * machine, unknown + one bounded query, the commit path-set match, the four
 * fail-closed outcomes, three mechanism controls, and the owner restoration.
 */
import { describe, expect, test } from "bun:test";
import {
  appendOutboxEffect,
  beginCommitEffect,
  detectDaemonEffects,
  readCommandReceipts,
  readOutboxEffects,
  recordRedriveRequest,
  recoverCommitEffect,
} from "../../packages/core/src/app/index";
import {
  type CommitLogPort,
  OUTBOX_EFFECT_PAYLOAD_SCHEMA,
  type OutboxEffectRecord,
  type StateStorePort,
} from "../../packages/core/src/contracts/index";
import {
  resolveCommitEffect,
  resolveTrackerEffect,
  transitionEffect,
} from "../../packages/core/src/domain/effect-protocol";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const NOW = "2026-11-08T10:00:00Z";
const PATHS = ["src/a.ts", "src/b.ts"];

const storeFixture = () => {
  const root = makeTempRoot("gh238-effects");
  const { store } = openStore(makeIdentity(root));
  return { root, store };
};

const logOf = (
  commits: readonly { readonly sha: string; readonly changedPaths: readonly string[] }[],
  ok = true,
): CommitLogPort => ({
  logSince: async () =>
    ok ? { ok: true, commits, capped: false } : { ok: false, detail: "unreadable" },
});

const seed = (store: ReturnType<typeof storeFixture>["store"], paths = PATHS) =>
  beginCommitEffect({
    store,
    fenceToken: "fence-effect",
    effectId: "effect-1",
    intentId: "intent-1",
    ref: "GH-238",
    changeRef: "GH-238",
    phase: "delivery",
    baselineHead: "a".repeat(40),
    stagedPaths: paths,
    payloadDigest: "digest",
    nowIso: NOW,
  });

describe("GH-238 external effects", () => {
  test("only legal transitions are accepted", () => {
    expect(transitionEffect("accepted", "in-flight")).toEqual({ ok: true, state: "in-flight" });
    expect(transitionEffect("in-flight", "applied")).toEqual({ ok: true, state: "applied" });
    expect(transitionEffect("applied", "in-flight")).toMatchObject({ ok: false });
    expect(transitionEffect("unknown", "applied")).toEqual({ ok: true, state: "applied" });
  });

  test("a commit intent carries a message-independent identity only", () => {
    const { root, store } = storeFixture();
    try {
      const appended = seed(store);
      expect(appended.ok).toBe(true);
      if (!appended.ok) return;
      const record = appended.record;
      expect(record.effectKind).toBe("commit");
      expect(record.checkStrategy).toBe("query-by-log-since");
      expect(record.baselineHead).toBe("a".repeat(40));
      expect(record.stagedPaths).toEqual([...PATHS].sort());
      expect(record.idempotencyKey).toBe(`GH-238:delivery:${"a".repeat(40)}`);
      for (const forbidden of ["message", "subject", "body", "fingerprint"]) {
        expect(Object.hasOwn(record, forbidden)).toBe(false);
      }
    } finally {
      removeRoot(root);
    }
  });

  test("one matching commit resolves already-applied with its SHA and no second commit", async () => {
    const { root, store } = storeFixture();
    try {
      seed(store);
      const recovered = await recoverCommitEffect({
        store,
        fenceToken: "fence-recover",
        effectId: "effect-1",
        log: logOf([{ sha: "b".repeat(40), changedPaths: PATHS }]),
        nowIso: NOW,
      });
      expect(recovered).toMatchObject({ ok: true, status: "already-applied", sha: "b".repeat(40) });
      const receipts = readCommandReceipts(store);
      if (receipts.ok) expect(receipts.latest.get("effect-1")?.status).toBe("already-applied");
    } finally {
      removeRoot(root);
    }
  });

  test("zero, multiple, mismatch, and unreadable stay unknown with no re-apply", async () => {
    const cases: CommitLogPort[] = [
      logOf([]),
      logOf([
        { sha: "b".repeat(40), changedPaths: PATHS },
        { sha: "c".repeat(40), changedPaths: PATHS },
      ]),
      logOf([{ sha: "b".repeat(40), changedPaths: ["src/other.ts"] }]),
      logOf([], false),
    ];
    for (const log of cases) {
      const { root, store } = storeFixture();
      try {
        seed(store);
        const recovered = await recoverCommitEffect({
          store,
          fenceToken: "fence-recover",
          effectId: "effect-1",
          log,
          nowIso: NOW,
        });
        expect(recovered.ok && recovered.status).toBe("unknown");
      } finally {
        removeRoot(root);
      }
    }
  });

  test("negative control: recording one path fewer breaks the derivation and stays unknown", () => {
    const { root, store } = storeFixture();
    try {
      seed(store, ["src/a.ts"]);
      return (async () => {
        const recovered = await recoverCommitEffect({
          store,
          fenceToken: "fence-recover",
          effectId: "effect-1",
          log: logOf([{ sha: "b".repeat(40), changedPaths: PATHS }]),
          nowIso: NOW,
        });
        expect(recovered.ok && recovered.status).toBe("unknown");
      })().finally(() => removeRoot(root));
    } catch {
      removeRoot(root);
    }
  });

  test("tracker verdicts: found is already-applied, not-found permits one re-apply, unreadable stops", () => {
    expect(resolveTrackerEffect({ verdict: "found" }, "tracker-comment")).toMatchObject({
      status: "already-applied",
    });
    expect(resolveTrackerEffect({ verdict: "not-found" }, "tracker-transition")).toMatchObject({
      status: "unknown",
      verdict: "not-found",
    });
    expect(resolveTrackerEffect({ verdict: "unreadable" }, "tracker-comment")).toMatchObject({
      status: "unknown",
      verdict: "unreadable",
    });
    expect(
      resolveCommitEffect(
        { baselineHead: "a", stagedPaths: PATHS },
        { ok: true, commits: [], capped: false },
      ),
    ).toMatchObject({
      status: "unknown",
    });
  });

  test("the daemon detects unresolved effects, queries once, and records attempt 0", async () => {
    const { root, store } = storeFixture();
    try {
      const effect: OutboxEffectRecord = {
        schema: OUTBOX_EFFECT_PAYLOAD_SCHEMA,
        effectId: "effect-1",
        intentId: "intent-1",
        ref: "GH-238",
        effectKind: "commit",
        target: "commit:GH-238:delivery",
        payloadDigest: "d",
        idempotencyKey: "k",
        state: "in-flight",
        attempts: 1,
        checkStrategy: "query-by-log-since",
        baselineHead: "a".repeat(40),
        changeRef: "GH-238",
        phase: "delivery",
        stagedPaths: PATHS,
        recordedAt: NOW,
      };
      expect(appendOutboxEffect(store, "f", effect).ok).toBe(true);
      let queries = 0;
      const requests: unknown[] = [];
      const result = await detectDaemonEffects({
        list: () => [effect],
        logSince: async () => {
          queries += 1;
          return {
            ok: true,
            commits: [{ sha: "b".repeat(40), changedPaths: PATHS }],
            capped: false,
          };
        },
        record: (request) => {
          requests.push(request);
          return { ok: true };
        },
        nowIso: NOW,
      });
      expect(result).toEqual({ ok: true, requests: 1 });
      expect(queries).toBe(1);
      expect(requests[0]).toMatchObject({
        effectId: "effect-1",
        queryVerdict: "found",
        discoveredSha: "b".repeat(40),
      });
    } finally {
      removeRoot(root);
    }
  });

  test("negative control: a single mismatched commit never records found+SHA", async () => {
    const effect: OutboxEffectRecord = {
      schema: OUTBOX_EFFECT_PAYLOAD_SCHEMA,
      effectId: "effect-1",
      intentId: "intent-1",
      ref: "GH-238",
      effectKind: "commit",
      target: "commit:GH-238:delivery",
      payloadDigest: "d",
      idempotencyKey: "k",
      state: "in-flight",
      attempts: 1,
      checkStrategy: "query-by-log-since",
      baselineHead: "a".repeat(40),
      changeRef: "GH-238",
      phase: "delivery",
      stagedPaths: PATHS,
      recordedAt: NOW,
    };
    const requests: unknown[] = [];
    const result = await detectDaemonEffects({
      list: () => [effect],
      logSince: async () => ({
        ok: true,
        commits: [{ sha: "b".repeat(40), changedPaths: ["src/unrelated.ts"] }],
        capped: false,
      }),
      record: (request) => {
        requests.push(request);
        return { ok: true };
      },
      nowIso: NOW,
    });
    expect(result).toEqual({ ok: true, requests: 1 });
    expect(requests[0]).toMatchObject({ effectId: "effect-1", queryVerdict: "not-found" });
    expect(requests[0]).not.toHaveProperty("discoveredSha");
    // Zero commits is not-found without a SHA; multiple commits is unreadable.
    const zero: unknown[] = [];
    await detectDaemonEffects({
      list: () => [effect],
      logSince: async () => ({ ok: true, commits: [], capped: false }),
      record: (request) => {
        zero.push(request);
        return { ok: true };
      },
      nowIso: NOW,
    });
    expect(zero[0]).toMatchObject({ queryVerdict: "not-found" });
    expect(zero[0]).not.toHaveProperty("discoveredSha");
    const multiple: unknown[] = [];
    await detectDaemonEffects({
      list: () => [effect],
      logSince: async () => ({
        ok: true,
        commits: [
          { sha: "b".repeat(40), changedPaths: PATHS },
          { sha: "c".repeat(40), changedPaths: PATHS },
        ],
        capped: false,
      }),
      record: (request) => {
        multiple.push(request);
        return { ok: true };
      },
      nowIso: NOW,
    });
    expect(multiple[0]).toMatchObject({ queryVerdict: "unreadable" });
    expect(multiple[0]).not.toHaveProperty("discoveredSha");
  });

  test("two simultaneous same-key appends yield exactly one intent", () => {
    const { root, store } = storeFixture();
    try {
      const record: OutboxEffectRecord = {
        schema: OUTBOX_EFFECT_PAYLOAD_SCHEMA,
        effectId: "effect-1",
        intentId: "intent-1",
        ref: "GH-238",
        effectKind: "commit",
        target: "commit:GH-238:delivery",
        payloadDigest: "d",
        idempotencyKey: "k",
        state: "accepted",
        attempts: 0,
        checkStrategy: "query-by-log-since",
        baselineHead: "a".repeat(40),
        changeRef: "GH-238",
        phase: "delivery",
        stagedPaths: PATHS,
        recordedAt: NOW,
      };
      let reentered = false;
      let secondOk: boolean | undefined;
      const racing: StateStorePort = {
        ...store,
        // Deterministically interleave the second caller between the first
        // caller's dedupe read and its append. With the dedupe outside the
        // fence the second caller would append before the first and leave two
        // intents; with the dedupe under the fence it cannot.
        readRecords: () => {
          const snapshot = store.readRecords();
          if (!reentered) {
            reentered = true;
            secondOk = appendOutboxEffect(racing, "fence-b", record).ok;
          }
          return snapshot;
        },
      };
      const first = appendOutboxEffect(racing, "fence-a", record);
      expect(first.ok).toBe(true);
      expect(secondOk).toBe(false);
      const effects = readOutboxEffects(store);
      expect(effects.ok).toBe(true);
      if (effects.ok) expect(effects.records).toHaveLength(1);
    } finally {
      removeRoot(root);
    }
  });

  test("an identical outbox intent replay appends no second intent record", () => {
    const { root, store } = storeFixture();
    try {
      const first = seed(store);
      expect(first.ok && first.appended).toBe(true);
      const replay = beginCommitEffect({
        store,
        fenceToken: "fence-effect-replay",
        effectId: "effect-1",
        intentId: "intent-1",
        ref: "GH-238",
        changeRef: "GH-238",
        phase: "delivery",
        baselineHead: "a".repeat(40),
        stagedPaths: PATHS,
        payloadDigest: "digest",
        nowIso: "2026-11-08T10:05:00Z",
      });
      expect(replay.ok && replay.appended).toBe(false);
      const effects = readOutboxEffects(store);
      expect(effects.ok).toBe(true);
      if (effects.ok) expect(effects.records).toHaveLength(1);
    } finally {
      removeRoot(root);
    }
  });

  test("a redrive request is attempt 0 evidence, never an apply", () => {
    const { root, store } = storeFixture();
    try {
      const appended = recordRedriveRequest(store, "f", {
        effectId: "effect-1",
        baselineHead: "a".repeat(40),
        queryVerdict: "unreadable",
        nowIso: NOW,
      });
      expect(appended.ok && appended.record.attempt).toBe(0);
      expect(readOutboxEffects(store).ok).toBe(true);
    } finally {
      removeRoot(root);
    }
  });
});
