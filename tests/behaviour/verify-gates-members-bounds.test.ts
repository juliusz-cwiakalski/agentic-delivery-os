/**
 * TC-XBOUND-004 (GH-310 AC-NFR2-1; DM-4, DEC-10, RSK-7): at the eight-member
 * cap the machine report fits the documented byte bound and no blocking member
 * is ever truncated — from the machine report or the human report.
 *
 * The bound is the delivered `VERIFY_GATES_MAX_MACHINE_BYTES` on the serialized
 * machine report (`data`), which is the documented definition of the constant;
 * the envelope's stdout is the pretty-printed projection of that same data.
 */
import { describe, expect, test } from "bun:test";
import type { CrossRepositoryVerifyGatesReport } from "../../packages/core/src/contracts/index";
import { VERIFY_GATES_MAX_MACHINE_BYTES } from "../../packages/core/src/contracts/index";
import { parsePlanMembers } from "../../packages/core/src/domain/plan-members";
import {
  API_MEMBER,
  DOCS_MEMBER,
  type MemberFixture,
  WEB_MEMBER,
} from "../fixtures/cross-repository/constants";
import {
  declaredMember,
  greenMemberReads,
  type MemberGatesWorld,
  noRunReads,
  pullRequestless,
  redReads,
  runMemberGates,
  unavailableReads,
} from "../fixtures/cross-repository/facts";
import type { Run } from "../fixtures/verify-gates/cases/harness";

/** Sixteen declared gates per member: one CI gate plus fifteen tracker gates. */
const sixteenGates = (): readonly string[] => [
  "ci-green",
  ...Array.from({ length: 15 }, () => "owner-gate"),
];

const extraMember = (index: number): MemberFixture => ({
  repoKey: `member-${index}-0000000${index}`,
  slice: `member ${index} slice`,
  branch: `feat/GH-310/member-${index}`,
  pullRequest: `${400 + index}`,
  headSha: `${index}`.repeat(40),
  label: `member-${index}`,
});

const eightMembers = (): readonly MemberFixture[] => [
  API_MEMBER,
  WEB_MEMBER,
  DOCS_MEMBER,
  extraMember(4),
  extraMember(5),
  extraMember(6),
  extraMember(7),
  extraMember(8),
];

const report = (run: Run): CrossRepositoryVerifyGatesReport =>
  run.envelope?.data as CrossRepositoryVerifyGatesReport;

const atCapWorld = (): MemberGatesWorld => {
  const [api, web, docs, four, five, six, seven, eight] = eightMembers() as [
    MemberFixture,
    MemberFixture,
    MemberFixture,
    MemberFixture,
    MemberFixture,
    MemberFixture,
    MemberFixture,
    MemberFixture,
  ];
  const members = [
    declaredMember(api, { gates: sixteenGates() }),
    declaredMember(web, { gates: sixteenGates() }),
    pullRequestless(docs, sixteenGates()),
    declaredMember(four, { gates: sixteenGates() }),
    declaredMember(five, { gates: sixteenGates() }),
    declaredMember(six, { gates: sixteenGates() }),
    declaredMember(seven, { gates: sixteenGates() }),
    declaredMember(eight, { gates: sixteenGates() }),
  ];
  return {
    members,
    reads: {
      // fail, unavailable, absent, absent, absent, unavailable, fail, pass.
      [api.repoKey]: redReads(api),
      [web.repoKey]: { ...greenMemberReads(web), checkRuns: unavailableReads() },
      [docs.repoKey]: greenMemberReads(docs),
      [four.repoKey]: noRunReads(four),
      [five.repoKey]: noRunReads(five),
      [six.repoKey]: { ...greenMemberReads(six), checkRuns: unavailableReads() },
      [seven.repoKey]: redReads(seven),
      [eight.repoKey]: greenMemberReads(eight),
    },
    reviews: members
      .filter((member) => member.pullRequest !== undefined)
      .map((member) => ({
        repoKey: member.repoKey,
        pullRequest: member.pullRequest as string,
        verdicts: ["pass" as const],
      })),
  };
};

describe("TC-XBOUND-004 eight-member report within bounds", () => {
  test("the machine report fits 65 536 bytes and every blocker is named", async () => {
    const run = await runMemberGates(atCapWorld());
    const data = report(run);
    expect(Buffer.byteLength(JSON.stringify(data), "utf8")).toBeLessThanOrEqual(
      VERIFY_GATES_MAX_MACHINE_BYTES,
    );
    expect(data.definitionOfDone.members).toHaveLength(8);
    expect(data.gates).toHaveLength(128);
    expect(data.definitionOfDone.status).toBe("blocked");
    expect(data.overall).toBe("fail");
    expect(data.blockingMembers).toEqual(
      data.definitionOfDone.members
        .filter((member) => member.verdict !== "pass")
        .map((member) => member.repoKey),
    );
    expect(data.blockingMembers).toHaveLength(7);
  });

  test("the report is reproducible byte for byte", async () => {
    const first = await runMemberGates(atCapWorld());
    const second = await runMemberGates(atCapWorld());
    expect(second.stdout).toBe(first.stdout);
    expect(second.exitCode).toBe(first.exitCode);
  });

  test("the human report names a blocking member", async () => {
    const data = report(await runMemberGates(atCapWorld()));
    const blocker = data.blockingMembers[0] as string;
    const run = await runMemberGates(atCapWorld(), { json: false });
    expect(run.stdout).toContain("blocked");
    expect(run.stdout).toContain(blocker);
  });

  test("a ninth member is rejected at declaration time", () => {
    const nine = [
      ...eightMembers().map((member) => ({
        repoKey: member.repoKey,
        slice: member.slice,
        branch: member.branch,
        pullRequest: member.pullRequest,
        gates: ["ci-green"],
      })),
      {
        repoKey: "member-9-00000009",
        slice: "ninth",
        branch: "feat/GH-310/member-9",
        pullRequest: "409",
        gates: ["ci-green"],
      },
    ];
    const parsed = parsePlanMembers(nine, "GH-310");
    expect(parsed.errors.some((error) => error.code === "plan.schema.invalid")).toBe(true);
    expect(parsed.members).toBeUndefined();
  });
});
