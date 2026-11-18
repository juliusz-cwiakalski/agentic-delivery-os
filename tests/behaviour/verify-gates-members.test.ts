/**
 * TC-XDOD-001/002/003/005/006/008 (GH-310 AC-F3-1..AC-F3-5, AC-F3-7; DM-2,
 * DM-3, DM-9, DM-11, DEC-3, DEC-4, DEC-18, NFR-5, NFR-6): the shared verdict is
 * mechanical over each member's records AND its CI reading, every record is
 * attributable, and a negative report is data-bearing at exit 1.
 */
import { describe, expect, test } from "bun:test";
import type {
  CrossRepositoryVerifyGateRecord,
  CrossRepositoryVerifyGatesReport,
  MergeGateVerificationRecord,
} from "../../packages/core/src/contracts/index";
import {
  appendMergeGateVerification,
  readMergeGateVerifications,
} from "../../packages/core/src/state/index";
import {
  API_MEMBER,
  CHANGE_REF,
  DOCS_MEMBER,
  WEB_MEMBER,
} from "../fixtures/cross-repository/constants";
import {
  declaredMember,
  greenMemberReads,
  landingObservation,
  type MemberGatesWorld,
  memberGatesRuntime,
  redReads,
  reviewObservation,
  runMemberGates,
  unavailableReads,
} from "../fixtures/cross-repository/facts";
import { makeAuditStore, removeRoot } from "../fixtures/state/harness";
import { type Run, runVerify } from "../fixtures/verify-gates/cases/harness";

const report = (run: Run): CrossRepositoryVerifyGatesReport =>
  run.envelope?.data as CrossRepositoryVerifyGatesReport;

const twoMembers = (): MemberGatesWorld => ({
  members: [
    declaredMember(API_MEMBER, { gates: ["ci-green", "push-parity", "owner-gate"] }),
    declaredMember(WEB_MEMBER, { gates: ["ci-green", "push-parity"] }),
  ],
  reads: {
    [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER),
    [WEB_MEMBER.repoKey]: greenMemberReads(WEB_MEMBER),
  },
  landings: [landingObservation(API_MEMBER, false), landingObservation(WEB_MEMBER, false)],
  reviews: [reviewObservation(API_MEMBER, ["pass"]), reviewObservation(WEB_MEMBER, ["pass"])],
});

const recordsFor = (
  data: CrossRepositoryVerifyGatesReport,
  repoKey: string,
): readonly CrossRepositoryVerifyGateRecord[] =>
  data.gates.filter((record) => record.member === repoKey);

describe("TC-XDOD-001 both members pass", () => {
  test("green, pass, one record per pair, matching summary, exit 0", async () => {
    const run = await runMemberGates(twoMembers());
    expect(run.exitCode).toBe(0);
    const data = report(run);
    expect(run.envelope?.error).toBeUndefined();
    expect(data.definitionOfDone).toBeDefined();
    expect(data.overall).toBe("pass");
    expect(data.definitionOfDone.status).toBe("green");
    expect(data.blockingMembers).toEqual([]);
    expect(data.definitionOfDone.members).toEqual([
      { repoKey: API_MEMBER.repoKey, gates: { ci: "pass" }, verdict: "pass" },
      { repoKey: WEB_MEMBER.repoKey, gates: { ci: "pass" }, verdict: "pass" },
    ]);
    expect(data.gates.map((record) => `${record.member}:${record.id}`)).toEqual([
      `${API_MEMBER.repoKey}:ci-green`,
      `${API_MEMBER.repoKey}:push-parity`,
      `${API_MEMBER.repoKey}:owner-gate`,
      `${WEB_MEMBER.repoKey}:ci-green`,
      `${WEB_MEMBER.repoKey}:push-parity`,
    ]);
    expect(data.gates.every((record) => record.verdict === "pass")).toBe(true);
    expect(data.summary).toEqual({ gates: 5, passed: 5, failed: 0, unknown: 0 });
    expect(data.definitionOfDone.evidence).toEqual([
      { repoKey: API_MEMBER.repoKey, pullRequest: API_MEMBER.pullRequest, landed: false },
      { repoKey: WEB_MEMBER.repoKey, pullRequest: WEB_MEMBER.pullRequest, landed: false },
    ]);
    expect(data.reviewFlow.complete).toBe(true);
    expect(data.reviewFlow.verdicts.map((entry) => entry.repoKey)).toEqual([
      API_MEMBER.repoKey,
      WEB_MEMBER.repoKey,
    ]);
  });
});

describe("TC-XDOD-002 a member failure blocks the change", () => {
  const variantA = (): MemberGatesWorld => {
    const world = twoMembers();
    return { ...world, reads: { ...world.reads, [WEB_MEMBER.repoKey]: redReads(WEB_MEMBER) } };
  };

  test("variant A: a failing gate record blocks, attributes, exits 1", async () => {
    const run = await runMemberGates(variantA());
    expect(run.exitCode).toBe(1);
    const data = report(run);
    expect(run.envelope?.error).toBeUndefined();
    expect(data.definitionOfDone.status).toBe("blocked");
    expect(data.overall).toBe("fail");
    expect(data.blockingMembers).toEqual([WEB_MEMBER.repoKey]);
    expect(data.definitionOfDone.members.map((entry) => entry.verdict)).toEqual(["pass", "fail"]);
    const web = recordsFor(data, WEB_MEMBER.repoKey);
    expect(web.length).toBe(2);
    expect(web.some((record) => record.verdict === "fail")).toBe(true);
    expect(data.summary.gates).toBe(5);
    expect(data.summary.failed).toBeGreaterThanOrEqual(1);
    expect(data.summary.passed + data.summary.failed + data.summary.unknown).toBe(
      data.summary.gates,
    );
    expect("classification" in data).toBe(false);
    expect(data.overall).not.toBe("unknown");
  });

  test("variant B: all records pass but ci fails, member fails on the CI conjunct", async () => {
    const world = twoMembers();
    const run = await runMemberGates({
      ...world,
      members: [world.members[0] as never, declaredMember(WEB_MEMBER, { gates: ["push-parity"] })],
      reads: {
        ...world.reads,
        [WEB_MEMBER.repoKey]: {
          ...greenMemberReads(WEB_MEMBER),
          checkRuns: redReads(WEB_MEMBER).checkRuns,
        },
      },
    });
    expect(run.exitCode).toBe(1);
    const data = report(run);
    expect(data.definitionOfDone.status).toBe("blocked");
    expect(data.overall).toBe("fail");
    const web = data.definitionOfDone.members[1];
    expect(web?.gates.ci).toBe("fail");
    expect(web?.verdict).toBe("fail");
    expect(recordsFor(data, WEB_MEMBER.repoKey).every((record) => record.verdict === "pass")).toBe(
      true,
    );
    expect(data.summary.failed).toBe(0);
    expect(data.blockingMembers).toContain(WEB_MEMBER.repoKey);
  });

  test("variant C: blocked wins over incomplete and names both blockers", async () => {
    const world = twoMembers();
    const run = await runMemberGates({
      ...world,
      members: [
        ...world.members,
        {
          repoKey: DOCS_MEMBER.repoKey,
          slice: DOCS_MEMBER.slice,
          branch: DOCS_MEMBER.branch,
          dependsOn: [],
          gates: ["ci-green"],
        },
      ],
      reads: {
        ...world.reads,
        [WEB_MEMBER.repoKey]: redReads(WEB_MEMBER),
        [DOCS_MEMBER.repoKey]: greenMemberReads(DOCS_MEMBER),
      },
    });
    const data = report(run);
    expect(run.exitCode).toBe(1);
    expect(data.definitionOfDone.status).toBe("blocked");
    expect(data.overall).toBe("fail");
    expect(data.definitionOfDone.members[2]?.gates.ci).toBe("absent");
    expect(data.blockingMembers).toEqual([WEB_MEMBER.repoKey, DOCS_MEMBER.repoKey]);
  });
});

describe("TC-XDOD-003 unavailable CI never reads green", () => {
  test("an unreadable reading makes its member unknown and blocks at exit 1", async () => {
    const world = twoMembers();
    const run = await runMemberGates({
      ...world,
      members: [
        declaredMember(API_MEMBER, { gates: ["ci-green", "push-parity", "owner-gate"] }),
        declaredMember(WEB_MEMBER, { gates: ["push-parity"] }),
      ],
      reads: {
        ...world.reads,
        [WEB_MEMBER.repoKey]: {
          ...greenMemberReads(WEB_MEMBER),
          checkRuns: unavailableReads(),
        },
      },
    });
    expect(run.exitCode).toBe(1);
    const data = report(run);
    const web = data.definitionOfDone.members[1];
    expect(web?.gates.ci).toBe("unavailable");
    expect(web?.verdict).toBe("unknown");
    expect(recordsFor(data, WEB_MEMBER.repoKey).every((record) => record.verdict === "pass")).toBe(
      true,
    );
    expect(data.summary.failed).toBe(0);
    expect(data.summary.unknown).toBe(0);
    expect(data.blockingMembers).toContain(WEB_MEMBER.repoKey);
    expect(data.definitionOfDone.status).toBe("blocked");
    expect(data.overall).toBe("fail");
    expect(run.envelope?.data).toBeDefined();

    const replay = await runMemberGates({
      ...world,
      members: [
        declaredMember(API_MEMBER, { gates: ["ci-green", "push-parity", "owner-gate"] }),
        declaredMember(WEB_MEMBER, { gates: ["push-parity"] }),
      ],
      reads: {
        ...world.reads,
        [WEB_MEMBER.repoKey]: {
          ...greenMemberReads(WEB_MEMBER),
          checkRuns: unavailableReads(),
        },
      },
    });
    expect(replay.stdout).toBe(run.stdout);
    expect(replay.exitCode).toBe(run.exitCode);
  });
});

describe("TC-XDOD-005 no cross-member CI reuse", () => {
  test("each member reads its own head; only the unavailable member is unknown", async () => {
    const world = twoMembers();
    const readLog: string[] = [];
    const run = await runMemberGates({
      members: world.members,
      readLog,
      reads: {
        [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER),
        [WEB_MEMBER.repoKey]: {
          ...greenMemberReads(WEB_MEMBER),
          checkRuns: unavailableReads(),
        },
      },
    });
    expect(readLog).toEqual([API_MEMBER.repoKey, WEB_MEMBER.repoKey]);
    const data = report(run);
    expect(data.definitionOfDone.members.map((entry) => entry.gates.ci)).toEqual([
      "pass",
      "unavailable",
    ]);
    expect(data.definitionOfDone.members.map((entry) => entry.verdict)).toEqual([
      "pass",
      "unknown",
    ]);
    expect(data.definitionOfDone.status).toBe("blocked");
    expect(data.overall).toBe("fail");
    expect(data.blockingMembers).toEqual([WEB_MEMBER.repoKey]);
    expect(run.exitCode).toBe(1);
    for (const member of [API_MEMBER, WEB_MEMBER]) {
      const headShas = recordsFor(data, member.repoKey)
        .filter((record) => record.id === "ci-green")
        .map((record) => record.citation.identity.headSha);
      expect(headShas).toEqual([member.headSha]);
    }
  });
});

describe("TC-XDOD-006/008 an unresolvable declared identifier never passes", () => {
  const unresolvedWorld = (webGates: readonly string[]): MemberGatesWorld => {
    const world = twoMembers();
    return {
      ...world,
      members: [
        declaredMember(API_MEMBER, { gates: ["ci-green", "push-parity", "owner-gate"] }),
        declaredMember(WEB_MEMBER, { gates: webGates }),
      ],
    };
  };

  test("TC-XDOD-006: an unknown identifier degrades its member and blocks", async () => {
    const run = await runMemberGates(unresolvedWorld(["ci-green", "not-a-declared-gate"]));
    expect(run.exitCode).toBe(1);
    const data = report(run);
    const web = data.definitionOfDone.members[1];
    expect(web?.verdict).toBe("unknown");
    expect(data.definitionOfDone.status).toBe("blocked");
    expect(data.blockingMembers).toContain(WEB_MEMBER.repoKey);
    expect(run.envelope?.error).toBeUndefined();
    expect(data.gates.some((record) => record.id === "not-a-declared-gate")).toBe(true);
  });

  test("TC-XDOD-008: exactly one pinned synthetic record, counted once, never a pass", async () => {
    const run = await runMemberGates(
      unresolvedWorld(["ci-green", "push-parity", "not-a-declared-gate"]),
    );
    const data = report(run);
    const synthetic = data.gates.filter((record) => record.id === "not-a-declared-gate");
    expect(synthetic).toHaveLength(1);
    expect(synthetic[0]).toEqual({
      id: "not-a-declared-gate",
      member: WEB_MEMBER.repoKey,
      verdict: "unknown",
      reason: "read-failed",
      citation: {
        sources: [],
        identity: { changeRef: CHANGE_REF },
        counts: [],
        names: [],
        reasons: ["read-failed"],
      },
    });
    expect(data.summary.unknown).toBe(1);
    expect(data.summary.passed).toBe(5);
    expect(data.summary.gates).toBe(6);
    expect(data.summary.passed + data.summary.failed + data.summary.unknown).toBe(
      data.summary.gates,
    );
    expect(recordsFor(data, WEB_MEMBER.repoKey).some((record) => record.verdict === "pass")).toBe(
      true,
    );
    for (const record of data.gates) {
      expect(typeof record.member).toBe("string");
      if (record.id === "not-a-declared-gate") expect(record.verdict).not.toBe("pass");
    }
    expect(data.definitionOfDone.members[1]?.verdict).toBe("unknown");
    expect(data.definitionOfDone.status).toBe("blocked");
    expect(data.overall).toBe("fail");
    expect(data.blockingMembers).toContain(WEB_MEMBER.repoKey);
    expect(run.exitCode).toBe(1);

    const replay = await runMemberGates(
      unresolvedWorld(["ci-green", "push-parity", "not-a-declared-gate"]),
    );
    expect(replay.stdout).toBe(run.stdout);
  });
});

describe("TC-XDOD-008 summary counts the synthetic record exactly once", () => {
  test("the pinned citation carries no provider attribution", async () => {
    const world = twoMembers();
    const run = await runMemberGates({
      ...world,
      members: [
        ...world.members,
        {
          repoKey: DOCS_MEMBER.repoKey,
          slice: DOCS_MEMBER.slice,
          branch: DOCS_MEMBER.branch,
          dependsOn: [],
          gates: ["also-not-a-declared-gate"],
        },
      ],
      reads: { ...world.reads, [DOCS_MEMBER.repoKey]: greenMemberReads(DOCS_MEMBER) },
    });
    const data = report(run);
    const synthetic = data.gates.filter((record) => record.member === DOCS_MEMBER.repoKey);
    expect(synthetic).toHaveLength(1);
    expect(synthetic[0]?.citation.sources).toEqual([]);
    expect(synthetic[0]?.citation.names).toEqual([]);
    expect(synthetic[0]?.citation.identity).toEqual({ changeRef: CHANGE_REF });
    expect(data.summary.unknown).toBe(1);
    expect(data.definitionOfDone.status).toBe("blocked");
  });
});

/** Append through the REAL delivered state module, as the merge composition wires it. */
const realAppender =
  (fixture: ReturnType<typeof makeAuditStore>) => (record: MergeGateVerificationRecord) => {
    const appended = appendMergeGateVerification(fixture.store, {
      record,
      fenceToken: "fixture-gh310-members",
    });
    return appended.ok ? { ok: true as const } : { ok: false as const, code: appended.error.code };
  };

describe("TC-XDOD-001/002 the durable append is the delivered ledger projection (DEC-22)", () => {
  test("the positive report round-trips through the real state module, not torn", async () => {
    const fixture = makeAuditStore("gh310-members-green");
    try {
      const runtime = memberGatesRuntime(twoMembers());
      const gates = runtime.gates;
      if (gates === undefined) throw new Error("missing gates runtime");
      const run = await runVerify(
        { ...runtime, gates: { ...gates, appendVerification: realAppender(fixture) } },
        ["gates", CHANGE_REF],
      );
      expect(run.exitCode).toBe(0);
      const data = report(run);
      const read = readMergeGateVerifications(fixture.store, CHANGE_REF);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records).toHaveLength(1);
      const record = read.records[0];
      // Gate count equals the member records' count (members x declared gates).
      expect(record?.gates).toHaveLength(data.gates.length);
      expect(record?.gates).toHaveLength(5);
      // `member` is dropped; id/verdict/reason/citation are preserved in order.
      for (const gate of record?.gates ?? []) expect("member" in gate).toBe(false);
      expect(record?.gates.map((gate) => `${gate.id}:${gate.verdict}:${gate.reason}`)).toEqual(
        data.gates.map((gate) => `${gate.id}:${gate.verdict}:${gate.reason}`),
      );
      expect(record?.gates.map((gate) => gate.citation)).toEqual(
        data.gates.map((gate) => gate.citation),
      );
      // The appended posture keeps its delivered change-level derivation.
      expect(record?.trackerPosture).toEqual({ labels: [], ownerLabels: [] });
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("the negative report's failing record is preserved in place and count", async () => {
    const fixture = makeAuditStore("gh310-members-red");
    try {
      const world = twoMembers();
      const runtime = memberGatesRuntime({
        ...world,
        reads: { ...world.reads, [WEB_MEMBER.repoKey]: redReads(WEB_MEMBER) },
      });
      const gates = runtime.gates;
      if (gates === undefined) throw new Error("missing gates runtime");
      const run = await runVerify(
        { ...runtime, gates: { ...gates, appendVerification: realAppender(fixture) } },
        ["gates", CHANGE_REF],
      );
      expect(run.exitCode).toBe(1);
      const data = report(run);
      const read = readMergeGateVerifications(fixture.store, CHANGE_REF);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      const record = read.records[0];
      const failing = data.gates.filter((gate) => gate.verdict === "fail");
      expect(failing.length).toBeGreaterThanOrEqual(1);
      expect(record?.gates).toHaveLength(data.gates.length);
      for (const gate of failing) {
        expect(
          record?.gates.some(
            (candidate) =>
              candidate.id === gate.id &&
              candidate.verdict === gate.verdict &&
              candidate.reason === gate.reason &&
              JSON.stringify(candidate.citation) === JSON.stringify(gate.citation),
          ),
        ).toBe(true);
      }
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("an unprojected member record is refused and its history reads torn", async () => {
    const fixture = makeAuditStore("gh310-members-unprojected");
    try {
      const runtime = memberGatesRuntime(twoMembers());
      const gates = runtime.gates;
      if (gates === undefined) throw new Error("missing gates runtime");
      const captured: MergeGateVerificationRecord[] = [];
      await runVerify(
        {
          ...runtime,
          gates: {
            ...gates,
            appendVerification: (record) => {
              captured.push(record);
              return { ok: true as const };
            },
          },
        },
        ["gates", CHANGE_REF],
      );
      const projected = captured[0];
      if (projected === undefined) throw new Error("the handler must append one record");
      // Re-append the record with the report's `member` discriminator restored,
      // i.e. the shape the delivered closed-key validation must refuse.
      const unprojected = {
        ...projected,
        gates: projected.gates.map((gate) => ({ ...gate, member: API_MEMBER.repoKey })),
      } as unknown as MergeGateVerificationRecord;
      const appended = appendMergeGateVerification(fixture.store, {
        record: unprojected,
        fenceToken: "fixture-gh310-unprojected",
      });
      expect(appended.ok).toBe(false);
      if (appended.ok) return;
      expect(appended.error.code).toBe("state.store.torn");
      expect(appended.error.consequence).toBe("not_landed");
      const read = readMergeGateVerifications(fixture.store, CHANGE_REF);
      expect(read.ok).toBe(false);
      if (read.ok) return;
      expect(read.reason).toBe("torn");
    } finally {
      removeRoot(fixture.root);
    }
  });
});
