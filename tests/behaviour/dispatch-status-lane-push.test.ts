/**
 * GH-416 — the `dispatch status` `lanePush` projection (TC-LSTATUS-001, the
 * projection-level arm of TC-LSTATUS-002/003).
 *
 * One bounded lane read, one bounded park read, and one bounded lane-push read:
 * the fact is the newest lane-push record whose attempt identity equals the
 * addressed lane's, carried verbatim; a foreign attempt, a foreign repository,
 * and no lane each answer absence.
 */
import { describe, expect, test } from "bun:test";
import { readOperatorStatus } from "../../packages/core/src/app/dispatch-lane-view";
import type { StateRecord, StateStorePort } from "../../packages/core/src/contracts/index";

const REPOSITORY = "github.com/owner/repo";
const REF = "GH-416";
const ATTEMPT = "attempt-416";
const HEAD = "0123456789abcdef0123456789abcdef01234567";
const BRANCH = "feat/GH-416/lane-pushes-own-evidence-commit";
const NOW = "2026-11-27T00:00:00.000Z";
const LATER = "2026-11-27T00:05:00.000Z";

let sequence = 0;

const laneRecord = (overrides: Record<string, unknown> = {}): StateRecord => {
  sequence += 1;
  return {
    schemaVersion: "delivery.state.v1",
    kind: "dispatch.lane",
    key: `dispatch.lanes:${REF}`,
    sequence,
    checksum: "fixture",
    payload: {
      schema: "delivery.dispatch.lane.v1",
      ref: REF,
      repository: REPOSITORY,
      attemptId: ATTEMPT,
      sessionId: "ses-416",
      harnessKind: "opencode",
      owner: { processId: 4242, startedAt: NOW },
      iterationOrdinal: 1,
      restartsConsumed: 0,
      state: "active",
      recordedAt: NOW,
      ...overrides,
    } as never,
  };
};

const lanePushRecord = (overrides: Record<string, unknown> = {}): StateRecord => {
  sequence += 1;
  return {
    schemaVersion: "delivery.state.v1",
    kind: "dispatch.lane-push",
    key: `dispatch.lane-pushes:${REF}`,
    sequence,
    checksum: "fixture",
    payload: {
      schema: "delivery.dispatch.lane-push.v1",
      ref: REF,
      repository: REPOSITORY,
      branch: BRANCH,
      head: HEAD,
      verdict: "pushed",
      attemptId: ATTEMPT,
      sessionId: "ses-416",
      recordedAt: NOW,
      ...overrides,
    } as never,
  };
};

const storeOf = (records: readonly StateRecord[]) => {
  let reads = 0;
  const store = {
    readRecords: () => {
      reads += 1;
      return {
        ok: true as const,
        value: {
          records,
          evidence: {
            storePath: "state/ledger.jsonl",
            verification: ["framing", "terminal", "sequence", "checksum"],
            verifiedEmpty: records.length === 0,
            recordCount: records.length,
          },
        },
      };
    },
  } as unknown as StateStorePort;
  return { store, reads: () => reads };
};

const statusOf = (records: readonly StateRecord[]) => {
  const fixture = storeOf(records);
  const result = readOperatorStatus({
    store: fixture.store,
    repository: REPOSITORY,
    ref: REF,
    probe: () => "live",
  });
  if (!result.ok) throw new Error(result.code);
  return { data: result.data, reads: fixture.reads() };
};

describe("GH-416 TC-LSTATUS-001 the lanePush fact is carried verbatim", () => {
  test("a pushed record answers the verdict, branch, head, and instant with no cause", () => {
    const { data, reads } = statusOf([laneRecord(), lanePushRecord()]);
    expect(data.lanePush).toEqual({
      verdict: "pushed",
      branch: BRANCH,
      head: HEAD,
      recordedAt: NOW,
    });
    // One lane read, one park read, one lane-push read.
    expect(reads).toBe(3);
  });

  test("a failed record carries its cause verbatim", () => {
    const { data } = statusOf([
      laneRecord(),
      lanePushRecord({ verdict: "failed", cause: "non-fast-forward", recordedAt: LATER }),
    ]);
    expect(data.lanePush).toEqual({
      verdict: "failed",
      branch: BRANCH,
      head: HEAD,
      cause: "non-fast-forward",
      recordedAt: LATER,
    });
  });

  test("the newest matching record is the fact", () => {
    const { data } = statusOf([
      laneRecord(),
      lanePushRecord({ verdict: "failed", cause: "unclassified", recordedAt: NOW }),
      lanePushRecord({ recordedAt: LATER }),
    ]);
    expect(data.lanePush?.verdict).toBe("pushed");
    expect(data.lanePush?.recordedAt).toBe(LATER);
  });
});

describe("GH-416 TC-LSTATUS-002 absence is an absent key", () => {
  test("a foreign attempt contributes no fact", () => {
    const { data } = statusOf([laneRecord(), lanePushRecord({ attemptId: "attempt-other" })]);
    expect(data.lanePush).toBeUndefined();
    expect(Object.hasOwn(data, "lanePush")).toBe(false);
  });

  test("a foreign repository contributes no fact", () => {
    const { data } = statusOf([
      laneRecord(),
      lanePushRecord({ repository: "github.com/other/repo" }),
    ]);
    expect(data.lanePush).toBeUndefined();
  });

  test("no lane for the ref answers absence", () => {
    const { data } = statusOf([lanePushRecord()]);
    expect(data.lane).toBeNull();
    expect(data.lanePush).toBeUndefined();
  });

  test("the delivered members are unchanged when the fact is absent", () => {
    const withFact = statusOf([laneRecord(), lanePushRecord()]).data;
    const withoutFact = statusOf([laneRecord()]).data;
    const { lanePush: _lanePush, ...rest } = withFact;
    expect(rest).toEqual(withoutFact);
  });
});
