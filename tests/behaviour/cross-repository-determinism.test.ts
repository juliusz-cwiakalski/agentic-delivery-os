/**
 * TC-XBOUND-003 (GH-310 AC-NFR2-1, DoD-11): the queue and lanes projections are
 * byte-identical over unchanged two-member state — entry order, dependency
 * order, and blocker order are stable, and the member refs are derived, never
 * generated.
 */
import { describe, expect, test } from "bun:test";
import {
  memberCloseoutObservation,
  runMemberCloseout,
} from "../fixtures/cross-repository/closeout";
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
  runMemberGates,
} from "../fixtures/cross-repository/facts";
import { createMemberQueueHarness, MEMBER_REFS } from "../fixtures/cross-repository/queue";
import { reviewFor } from "../fixtures/cross-repository/review";

describe("TC-XBOUND-001 gate report repeated-run determinism", () => {
  const world = (): MemberGatesWorld => ({
    members: [
      declaredMember(API_MEMBER, { gates: ["ci-green", "push-parity"] }),
      declaredMember(WEB_MEMBER, { gates: ["ci-green"] }),
      declaredMember(DOCS_MEMBER, { gates: ["owner-gate"] }),
    ],
    reads: {
      [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER),
      [WEB_MEMBER.repoKey]: greenMemberReads(WEB_MEMBER),
      [DOCS_MEMBER.repoKey]: greenMemberReads(DOCS_MEMBER),
    },
    landings: [
      landingObservation(WEB_MEMBER, true, 1),
      landingObservation(API_MEMBER, false),
      landingObservation(DOCS_MEMBER, false),
    ],
    reviews: [reviewFor(API_MEMBER), reviewFor(WEB_MEMBER)],
  });

  test("stdout, stderr, exit, and every derived order are byte-identical", async () => {
    const first = await runMemberGates(world());
    const second = await runMemberGates(world());
    expect(second.stdout).toBe(first.stdout);
    expect(second.stderr).toBe(first.stderr);
    expect(second.exitCode).toBe(first.exitCode);
    expect(second.stdout.length).toBe(first.stdout.length);

    const data = (JSON.parse(first.stdout) as { readonly data: Record<string, unknown> }).data as {
      readonly definitionOfDone: {
        readonly members: readonly { repoKey: string }[];
        readonly evidence: readonly { repoKey: string }[];
      };
      readonly blockingMembers: readonly string[];
      readonly reviewFlow: { readonly runId: string; readonly verdicts: readonly unknown[] };
    };
    const replay = (JSON.parse(second.stdout) as { readonly data: typeof data }).data;
    expect(replay.definitionOfDone.members.map((entry) => entry.repoKey)).toEqual(
      data.definitionOfDone.members.map((entry) => entry.repoKey),
    );
    expect(replay.definitionOfDone.evidence.map((entry) => entry.repoKey)).toEqual(
      data.definitionOfDone.evidence.map((entry) => entry.repoKey),
    );
    expect(replay.blockingMembers).toEqual(data.blockingMembers);
    expect(replay.reviewFlow.verdicts).toEqual(data.reviewFlow.verdicts);
    expect(replay.reviewFlow.runId).toBe(data.reviewFlow.runId);
  });
});

describe("TC-XBOUND-003 queue and lanes repeated-run determinism", () => {
  test("list, ready, plan, and lanes list are byte-identical across two runs each", async () => {
    const world = createMemberQueueHarness("determinism", { apiDeliveryState: "done" });
    const harness = world.harness;
    expect((await harness.run(["queue", "add", CHANGE_REF, "--json"])).exitCode).toBe(0);
    // One held lease (the prerequisite member) and one parked lane (the dependent).
    expect(
      (await harness.run(["queue", "claim", MEMBER_REFS.api, "--holder", "holder-api", "--json"]))
        .exitCode,
    ).toBe(0);
    expect(
      (await harness.run(["queue", "claim", MEMBER_REFS.web, "--holder", "holder-web", "--json"]))
        .exitCode,
    ).toBe(0);
    expect(
      await harness.run([
        "queue",
        "release",
        MEMBER_REFS.web,
        "--park",
        "provider-window",
        "--until",
        "2026-11-07T12:00:00Z",
        "--json",
      ]),
    ).toMatchObject({ exitCode: 0 });

    for (const argv of [
      ["queue", "list", "--json"],
      ["queue", "ready", CHANGE_REF, "--json"],
      ["queue", "plan", "--json"],
      ["lanes", "list", "--json"],
    ] as const) {
      const first = await harness.run(argv);
      const second = await harness.run(argv);
      expect(first.exitCode, `${argv.join(" ")} exit`).toBe(0);
      expect(second.exitCode, `${argv.join(" ")} exit`).toBe(first.exitCode);
      expect(second.stdout, `${argv.join(" ")} stdout`).toBe(first.stdout);
    }

    const listed = await harness.run(["queue", "list", "--json"]);
    const data = JSON.parse(listed.stdout).data as {
      readonly entries: Array<{ readonly ref: string }>;
    };
    expect(data.entries.map((entry) => entry.ref)).toEqual([MEMBER_REFS.api, MEMBER_REFS.web]);
  });
});

describe("TC-XBOUND-002 closeout member report repeated-run determinism", () => {
  const observations = () => [
    memberCloseoutObservation(API_MEMBER),
    memberCloseoutObservation(WEB_MEMBER, { merged: false }),
  ];

  test("plan and apply data are byte-identical over unchanged facts", async () => {
    for (const apply of [false, true]) {
      const first = await runMemberCloseout({ observations: observations(), apply });
      const second = await runMemberCloseout({ observations: observations(), apply });
      if (!first.result.ok || !second.result.ok) throw new Error("closeout failed");
      expect(JSON.stringify(second.result.data)).toBe(JSON.stringify(first.result.data));
    }
  });
});
