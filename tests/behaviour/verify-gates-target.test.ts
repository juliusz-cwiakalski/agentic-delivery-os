/** TC-VGATES-011/012/060 — target resolution through the in-process command. */
import { describe, expect, test } from "bun:test";
import type { CrossRepositoryVerifyGatesReport } from "../../packages/core/src/contracts/index";
import { API_MEMBER, WEB_MEMBER } from "../fixtures/cross-repository/constants";
import {
  declaredMember,
  greenMemberReads,
  runMemberGates,
} from "../fixtures/cross-repository/facts";
import { baseFacts, clone, request } from "../fixtures/verify-gates/cases/facts";
import { combinedRuntime, runVerify } from "../fixtures/verify-gates/cases/harness";

const gate = (result: Awaited<ReturnType<typeof runVerify>>, id: string) => {
  const summary = (result.envelope?.error as { summary?: string } | undefined)?.summary ?? "";
  return summary.split("\n").find((line) => line.startsWith(`${id} `));
};

describe("TC-VGATES-011/012/060 target resolution", () => {
  test("unique match evaluates all five gates", async () => {
    const result = await runVerify(combinedRuntime(), ["gates", "GH-178"]);
    expect(result.exitCode).toBe(0);
    expect(((result.envelope?.data as { gates: unknown[] } | undefined)?.gates ?? []).length).toBe(
      5,
    );
  });

  test("zero open PRs fails parity and squash no-open-pr and CI head-unresolved", async () => {
    const facts = clone(baseFacts());
    facts.openPullRequests = { ok: true, value: { items: [], pageItemCount: 0 } };
    facts.deliveryRequestDetail = { ok: false, reason: "not-attempted" };
    facts.checkRuns = { ok: false, reason: "not-attempted" };
    const result = await runVerify(combinedRuntime({ facts }), ["gates", "GH-178"]);
    expect(result.exitCode).toBe(1);
    expect(gate(result, "push-parity")).toContain("reason=no-open-pr");
    expect(gate(result, "squash-preflight")).toContain("reason=no-open-pr");
    expect(gate(result, "ci-green")).toContain("reason=head-unresolved");
  });

  test("a lone non-matching PR is branch-mismatch for both gates", async () => {
    const facts = clone(baseFacts());
    const lone = request({ sourceRef: "feat/other" });
    facts.openPullRequests = { ok: true, value: { items: [lone], pageItemCount: 1 } };
    facts.deliveryRequestDetail = { ok: false, reason: "not-attempted" };
    facts.checkRuns = { ok: false, reason: "not-attempted" };
    const result = await runVerify(combinedRuntime({ facts }), ["gates", "GH-178"]);
    expect(gate(result, "push-parity")).toContain("reason=branch-mismatch");
    expect(gate(result, "squash-preflight")).toContain("reason=branch-mismatch");
  });

  test("an at-limit page is ambiguous-open-pr with or without a match", async () => {
    const withMatch = clone(baseFacts());
    withMatch.openPullRequests = {
      ok: true,
      value: {
        items: [
          request(),
          ...Array.from({ length: 99 }, (_, index) => request({ sourceRef: `other-${index}` })),
        ],
        pageItemCount: 100,
      },
    };
    withMatch.deliveryRequestDetail = { ok: false, reason: "not-attempted" };
    withMatch.checkRuns = { ok: false, reason: "not-attempted" };
    const result = await runVerify(combinedRuntime({ facts: withMatch }), ["gates", "GH-178"]);
    expect(gate(result, "push-parity")).toContain("reason=ambiguous-open-pr");
    expect(gate(result, "squash-preflight")).toContain("reason=ambiguous-open-pr");
  });

  test("detached HEAD fails branch-dependent gates without a PR read", async () => {
    const facts = clone(baseFacts());
    facts.repository.head = { sha: "1".repeat(40), detached: true };
    facts.openPullRequests = { ok: false, reason: "not-attempted" };
    facts.deliveryRequestDetail = { ok: false, reason: "not-attempted" };
    facts.checkRuns = { ok: false, reason: "not-attempted" };
    const result = await runVerify(combinedRuntime({ facts }), ["gates", "GH-178"]);
    expect(gate(result, "push-parity")).toContain("reason=branch-unresolved");
    expect(gate(result, "squash-preflight")).toContain("reason=branch-unresolved");
    expect(gate(result, "squash-preflight")).toContain("counts=- names=-");
  });
});

describe("TC-XDOD-002 per-member target resolution", () => {
  test("each member resolves against its own head, never the local target", async () => {
    const world = {
      members: [
        declaredMember(API_MEMBER, { gates: ["ci-green", "push-parity"] }),
        declaredMember(WEB_MEMBER, { gates: ["ci-green", "push-parity"] }),
      ],
      reads: {
        [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER),
        [WEB_MEMBER.repoKey]: greenMemberReads(WEB_MEMBER),
      },
    };
    const result = await runMemberGates(world);
    expect(result.exitCode).toBe(0);
    const data = result.envelope?.data as CrossRepositoryVerifyGatesReport;
    expect(data.gates).toHaveLength(4);
    expect(data.gates.map((record) => record.member)).toEqual([
      API_MEMBER.repoKey,
      API_MEMBER.repoKey,
      WEB_MEMBER.repoKey,
      WEB_MEMBER.repoKey,
    ]);
    expect(data.gates.map((record) => record.citation.identity.headSha)).toEqual([
      API_MEMBER.headSha,
      API_MEMBER.headSha,
      WEB_MEMBER.headSha,
      WEB_MEMBER.headSha,
    ]);
  });
});
