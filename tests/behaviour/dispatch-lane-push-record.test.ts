/**
 * GH-416 — the durable `dispatch.lane-push` record (TC-LSTORE-001, TC-LSTORE-002).
 *
 * The record is read back from the delivered temporary state store after a real
 * command-path invocation: exact member set and order, cause only on a refusal,
 * one append per invocation, append-only latest-wins, the full-hex head read at
 * act time, and no transport text. The identity binding is exercised through the
 * use case with an injected lane read.
 */
import { describe, expect, test } from "bun:test";
import type { GitPushRunnerResult } from "../../packages/adapters/src/git/index";
import { runDispatchLanePush } from "../../packages/core/src/app/dispatch-lane-push";
import {
  appendDispatchLane,
  readDispatchLanePushes,
} from "../../packages/core/src/app/dispatch-ledger";
import {
  DISPATCH_LANE_PAYLOAD_SCHEMA,
  DISPATCH_LANE_PUSH_PAYLOAD_SCHEMA,
  DISPATCH_PUSH_RECORDABLE_CAUSES,
  type DispatchLanePushRecord,
  type DispatchLaneRecord,
} from "../../packages/core/src/contracts/index";
import { createParityHarness, readableParityTransport } from "../fixtures/dispatch/parity/harness";
import { createGuardedRunner } from "../fixtures/dispatch/parity/process-runner";

const REF = "GH-347";
const BRANCH = "feat/GH-347/parity";
const HEAD = "0123456789abcdef0123456789abcdef01234567";

const accepted = (): GitPushRunnerResult => ({
  stdout: "",
  stderr: "",
  status: 0,
  timedOut: false,
});
const rejected = (stderr: string): GitPushRunnerResult => ({
  stdout: "",
  stderr,
  status: 1,
  timedOut: false,
});

const runAndReadRecords = async (input: {
  readonly push: () => GitPushRunnerResult;
  readonly laneSeeds?: readonly Partial<DispatchLaneRecord>[];
}): Promise<{ readonly records: readonly DispatchLanePushRecord[] }> => {
  const guarded = createGuardedRunner({ head: HEAD, push: input.push });
  const harness = createParityHarness({
    label: "lane-push-record",
    localHead: HEAD,
    guarded,
    transport: readableParityTransport(),
  });
  try {
    for (const [index, seed] of (input.laneSeeds ?? []).entries()) {
      const record: DispatchLaneRecord = {
        schema: DISPATCH_LANE_PAYLOAD_SCHEMA,
        ref: REF,
        repository: "github.com/owner/repo",
        attemptId: `attempt-GH-347-${index + 1}`,
        sessionId: `ses-${index + 1}`,
        harnessKind: "opencode",
        owner: { processId: 4242, startedAt: "2026-11-19T00:00:00.000Z" },
        iterationOrdinal: 1,
        restartsConsumed: 0,
        state: "active",
        recordedAt: `2026-11-19T00:0${index}:00.000Z`,
        ...seed,
      };
      const appended = appendDispatchLane(harness.store, `seed-lane-${index}`, record);
      expect(appended.ok).toBe(true);
    }
    await harness.run(["push", REF, "--json"]);
    const read = readDispatchLanePushes(harness.store);
    expect(read.ok).toBe(true);
    return { records: read.ok ? read.records : [] };
  } finally {
    harness.dispose();
  }
};

const bytesOf = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).length;

describe("GH-416 TC-LSTORE-001 the record is bounded and identifier-only", () => {
  test("an accepted act writes the exact member set with no cause", async () => {
    const { records } = await runAndReadRecords({ push: accepted });
    expect(records).toHaveLength(1);
    const record = records[0] as DispatchLanePushRecord;
    expect(Object.keys(record)).toEqual([
      "schema",
      "ref",
      "repository",
      "branch",
      "head",
      "verdict",
      "recordedAt",
    ]);
    expect(record.schema).toBe(DISPATCH_LANE_PUSH_PAYLOAD_SCHEMA);
    expect(record.ref).toBe(REF);
    expect(record.branch).toBe(BRANCH);
    expect(record.head).toBe(HEAD);
    expect(record.verdict).toBe("pushed");
    expect(record.cause).toBeUndefined();
    expect(Number.isFinite(Date.parse(record.recordedAt))).toBe(true);
    expect(bytesOf(record)).toBeLessThanOrEqual(512);
  });

  test("a refused act carries one recordable cause and stays bounded", async () => {
    const { records } = await runAndReadRecords({
      push: () => rejected("! [rejected] (non-fast-forward)"),
    });
    expect(records).toHaveLength(1);
    const record = records[0] as DispatchLanePushRecord;
    expect(record.verdict).toBe("failed");
    expect(record.cause).toBe("non-fast-forward");
    expect(DISPATCH_PUSH_RECORDABLE_CAUSES).toContain(record.cause as string);
    expect(bytesOf(record)).toBeLessThanOrEqual(512);
  });

  test("transport text never reaches the record", async () => {
    const secret = "https://example.invalid/repo.git";
    const { records } = await runAndReadRecords({
      push: () => rejected(`fatal: Authentication failed for '${secret}' (token tok_live_abcdefghijklmnop)`),
    });
    const serialized = JSON.stringify(records[0]);
    expect(serialized).not.toContain("http");
    expect(serialized).not.toContain("tok_live_abcdefghijklmnop");
    expect(serialized).not.toContain("Authentication failed");
    expect(records[0]?.cause).toBe("auth-rejected");
  });

  test("two invocations append two records under the per-ref key prefix", async () => {
    const guarded = createGuardedRunner({ head: HEAD, push: accepted });
    const harness = createParityHarness({
      label: "lane-push-record-append",
      localHead: HEAD,
      guarded,
      transport: readableParityTransport(),
    });
    try {
      await harness.run(["push", REF, "--json"]);
      harness.clock.advanceMs(1000);
      await harness.run(["push", REF, "--json"]);
      const raw = harness.store.readRecords();
      expect(raw.ok).toBe(true);
      const keys =
        raw.ok === true
          ? raw.value.records
              .filter((record) => record.kind === "dispatch.lane-push")
              .map((record) => record.key)
          : [];
      expect(keys).toEqual([`dispatch.lane-pushes:${REF}`, `dispatch.lane-pushes:${REF}`]);
      const read = readDispatchLanePushes(harness.store);
      expect(read.ok && read.records).toHaveLength(2);
    } finally {
      harness.dispose();
    }
  });
});

describe("GH-416 TC-LSTORE-002 the record is bound to the readable lane", () => {
  test("the newest readable lane record supplies the identity", async () => {
    const { records } = await runAndReadRecords({
      push: accepted,
      laneSeeds: [{}, { attemptId: "attempt-GH-347-newest", sessionId: "ses-newest" }],
    });
    const record = records[0] as DispatchLanePushRecord;
    expect(record.attemptId).toBe("attempt-GH-347-newest");
    expect(record.sessionId).toBe("ses-newest");
  });

  test("a manual run without a lane record writes no identity members", async () => {
    const { records } = await runAndReadRecords({ push: accepted });
    const record = records[0] as DispatchLanePushRecord;
    expect(record.attemptId).toBeUndefined();
    expect(record.sessionId).toBeUndefined();
    expect(record.head).toBe(HEAD);
  });

  test("an unreadable lane store leaves the identity absent but the act still lands", async () => {
    const appended: DispatchLanePushRecord[] = [];
    const result = await runDispatchLanePush(
      {
        repository: "github.com/owner/repo",
        readBranchDeclaration: () => undefined,
        listBranches: async () => [{ name: BRANCH, head: HEAD }],
        readCheckoutHead: async () => HEAD,
        readLaneIdentity: () => undefined,
        pushChangeBranch: async () => ({ outcome: "accepted" }),
        appendRecord: (record) => {
          appended.push(record);
          return { ok: true };
        },
        nowIso: () => "2026-11-19T00:00:00.000Z",
      },
      { ref: REF },
    );
    expect(result.kind).toBe("answered");
    expect(appended).toHaveLength(1);
    expect(appended[0]?.attemptId).toBeUndefined();
    expect(appended[0]?.head).toBe(HEAD);
  });
});
