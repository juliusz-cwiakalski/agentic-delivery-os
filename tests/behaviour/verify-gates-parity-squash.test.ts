/** TC-VGATES-028..031, 035..039, 060, 061, 064, 067 — parity and squash. */
import { describe, expect, test } from "bun:test";
import type { DeliveryRequest } from "../../packages/core/src/contracts/index";
import { evaluateVerifyGates, resolveOpenPr } from "../../packages/core/src/domain/index";
import {
  baseFacts,
  clone,
  EXPECTED_JOBS,
  LOCAL_SHA,
  REMOTE_SHA,
  request,
  run,
} from "../fixtures/verify-gates/cases/facts";

const parity = (facts: ReturnType<typeof baseFacts>) => evaluateVerifyGates(facts).gates[2];
const squash = (facts: ReturnType<typeof baseFacts>) => evaluateVerifyGates(facts).gates[4];

const countOf = (record: ReturnType<typeof parity>, name: string): number | undefined =>
  record.citation.counts.find((entry) => entry.name === name)?.value;

const signals = (record: ReturnType<typeof squash>): readonly string[] =>
  record.citation.names.find((entry) => entry.kind === "squash-signals")?.values ?? [];

const withList = (items: readonly DeliveryRequest[], pageItemCount = items.length) => {
  const facts = clone(baseFacts());
  facts.openPullRequests = { ok: true, value: { items, pageItemCount } };
  facts.deliveryRequestDetail = { ok: false, reason: "not-attempted" };
  facts.checkRuns = { ok: false, reason: "not-attempted" };
  const resolved = items.find((item) => item.sourceRef === facts.repository.head.branch);
  if (resolved !== undefined)
    facts.deliveryRequestDetail = { ok: true, value: { request: resolved } };
  return facts;
};

describe("TC-VGATES-028/029 parity match and mismatch", () => {
  test("equal SHAs pass with branch, both SHAs, PR, and counts", () => {
    const record = parity(baseFacts());
    expect(record.verdict).toBe("pass");
    expect(record.reason).toBe("parity-matched");
    expect(record.citation.identity).toMatchObject({
      branch: "feat/GH-178/verify-gates-v1",
      localSha: LOCAL_SHA,
      headSha: REMOTE_SHA,
      deliveryRequest: "178",
    });
    expect(countOf(record, "compared")).toBe(1);
    expect(countOf(record, "matched")).toBe(1);
    expect(record.citation.sources.map((source) => source.name)).toEqual([
      "repository-head",
      "github-delivery-request-list",
      "github-delivery-request-detail",
    ]);
  });

  test("mismatch fails parity-mismatched and cites both SHAs", () => {
    const facts = clone(baseFacts());
    facts.deliveryRequestDetail = {
      ok: true,
      value: { request: request({ sourceHeadSha: "2".repeat(40) }) },
    };
    const record = parity(facts);
    expect(record.verdict).toBe("fail");
    expect(record.reason).toBe("parity-mismatched");
    expect(record.citation.identity.localSha).toBe(LOCAL_SHA);
    expect(record.citation.identity.headSha).toBe("2".repeat(40));
    expect(countOf(record, "compared")).toBe(1);
    expect(countOf(record, "matched")).toBe(0);
  });

  test("case-only SHA differences match", () => {
    const facts = clone(baseFacts());
    facts.deliveryRequestDetail = {
      ok: true,
      value: { request: request({ sourceHeadSha: LOCAL_SHA.toUpperCase() }) },
    };
    expect(parity(facts).reason).toBe("parity-matched");
  });
});

describe("TC-VGATES-030/060 resolution failures and at-limit", () => {
  test("detached HEAD fails branch-unresolved", () => {
    const facts = clone(baseFacts());
    facts.repository.head = { sha: LOCAL_SHA, detached: true };
    facts.openPullRequests = { ok: false, reason: "not-attempted" };
    facts.deliveryRequestDetail = { ok: false, reason: "not-attempted" };
    expect(parity(facts).reason).toBe("branch-unresolved");
    expect(squash(facts).reason).toBe("branch-unresolved");
    expect(signals(squash(facts))).toEqual([]);
  });

  test("zero open PRs is no-open-pr, lone non-matching is branch-mismatch, multiple are ambiguous", () => {
    const zero = withList([]);
    expect(parity(zero).reason).toBe("no-open-pr");
    expect(squash(zero).reason).toBe("no-open-pr");
    const lone = withList([request({ sourceRef: "feat/other" })]);
    expect(parity(lone).reason).toBe("branch-mismatch");
    expect(squash(lone).reason).toBe("branch-mismatch");
    const multiple = withList([request(), request()]);
    expect(parity(multiple).reason).toBe("ambiguous-open-pr");
    expect(squash(multiple).reason).toBe("ambiguous-open-pr");
  });

  test("an at-limit page is ambiguous with or without a match", () => {
    const withMatch = withList(
      [
        request(),
        ...Array.from({ length: 99 }, (_, index) => request({ sourceRef: `other-${index}` })),
      ],
      100,
    );
    const withoutMatch = withList(
      Array.from({ length: 100 }, (_, index) => request({ sourceRef: `other-${index}` })),
      100,
    );
    for (const facts of [withMatch, withoutMatch]) {
      expect(parity(facts).reason).toBe("ambiguous-open-pr");
      expect(squash(facts).reason).toBe("ambiguous-open-pr");
      expect(signals(squash(facts))).toEqual([]);
    }
    const below = withList(
      [
        request(),
        ...Array.from({ length: 98 }, (_, index) => request({ sourceRef: `other-${index}` })),
      ],
      99,
    );
    expect(parity(below).reason).toBe("parity-matched");
    expect(squash(below).reason).toBe("squash-ready");
  });

  test("shared helper is the single resolution rule", () => {
    expect(
      resolveOpenPr({
        branch: "feat/x",
        detached: false,
        pageItemCount: 1,
        items: [request({ sourceRef: "feat/x" }), request({ sourceRef: "feat/x" })],
      }).outcome,
    ).toBe("ambiguous-open-pr");
  });
});

describe("TC-VGATES-031/061/067 read-specific 404 and read failures", () => {
  test("PR list 404 is no-open-pr for parity and squash", () => {
    const facts = clone(baseFacts());
    facts.openPullRequests = { ok: false, reason: "not-found" };
    facts.deliveryRequestDetail = { ok: false, reason: "not-attempted" };
    facts.checkRuns = { ok: false, reason: "not-attempted" };
    expect(parity(facts).reason).toBe("no-open-pr");
    expect(squash(facts).reason).toBe("no-open-pr");
    expect(parity(facts).citation.sources[1]?.outcome).toBe("absent");
  });

  test("matched detail 404 fails head-unresolved with absent source for CI, parity, and squash", () => {
    const facts = clone(baseFacts());
    facts.deliveryRequestDetail = { ok: false, reason: "not-found" };
    facts.checkRuns = { ok: false, reason: "not-attempted" };
    expect(evaluateVerifyGates(facts).gates[1]?.reason).toBe("head-unresolved");
    expect(parity(facts).reason).toBe("head-unresolved");
    expect(squash(facts).reason).toBe("head-unresolved");
    expect(squash(facts).citation.sources[1]?.outcome).toBe("absent");
    expect(signals(squash(facts))).toEqual([]);
    expect(countOf(squash(facts), "commits")).toBeUndefined();
  });

  test("non-404 failures stay unknown with the declared reason", () => {
    for (const reason of ["read-failed", "credential-unavailable", "address-unresolved"] as const) {
      const facts = clone(baseFacts());
      facts.openPullRequests = { ok: false, reason };
      facts.deliveryRequestDetail = { ok: false, reason: "not-attempted" };
      const record = parity(facts);
      expect(record.verdict).toBe("unknown");
      expect(record.reason).toBe(reason);
      const squashRecord = squash(facts);
      expect(squashRecord.verdict).toBe("unknown");
      expect(signals(squashRecord)).toEqual([]);
    }
  });
});

describe("TC-VGATES-035..038 squash conditions and signals", () => {
  const withRequest = (overrides: Partial<DeliveryRequest>) => {
    const facts = clone(baseFacts());
    const detail = request(overrides);
    facts.deliveryRequestDetail = { ok: true, value: { request: detail } };
    facts.openPullRequests = { ok: true, value: { items: [detail], pageItemCount: 1 } };
    facts.checkRuns = {
      ok: true,
      value: { items: EXPECTED_JOBS.map((name) => run(name, "succeeded")), pageItemCount: 23 },
    };
    return facts;
  };

  test("ready PR passes with two ordered signals and surface counts", () => {
    const record = squash(baseFacts());
    expect(record.verdict).toBe("pass");
    expect(record.reason).toBe("squash-ready");
    expect(signals(record)).toEqual(["draft=false", "mergeable=mergeable"]);
    expect(countOf(record, "commits")).toBe(3);
    expect(countOf(record, "changedFiles")).toBe(7);
    expect(record.citation.identity.baseRef).toBe("main-tools");
  });

  test("approved and changes-requested remain open for v1", () => {
    for (const reviewState of ["approved", "changes-requested"] as const) {
      expect(squash(withRequest({ reviewState })).reason).toBe("squash-ready");
    }
  });

  test("wrong base, draft, merged, and closed fail with signals preserved", () => {
    const cases = [
      [{ targetRef: "main" }, "squash-target-mismatch"],
      [{ reviewState: "draft" }, "squash-draft"],
      [{ reviewState: "merged" }, "squash-not-open"],
      [{ reviewState: "closed" }, "squash-not-open"],
    ] as const;
    for (const [overrides, reason] of cases) {
      const record = squash(withRequest(overrides));
      expect(record.verdict).toBe("fail");
      expect(record.reason).toBe(reason);
      expect(signals(record)).toHaveLength(2);
    }
  });

  test("conflicting and not-mergeable fail with the matching signal value", () => {
    const conflicting = squash(withRequest({ mergeableState: "conflicting" }));
    expect(conflicting.reason).toBe("squash-conflicting");
    expect(signals(conflicting)).toEqual(["draft=false", "mergeable=conflicting"]);
    const notMergeable = squash(withRequest({ mergeableState: "not-mergeable" }));
    expect(notMergeable.reason).toBe("squash-not-mergeable");
    expect(signals(notMergeable)).toEqual(["draft=false", "mergeable=not-mergeable"]);
  });

  test("unknown mergeability, zero/absent surface fail without defaulting", () => {
    const unknown = squash(withRequest({ mergeableState: "unknown" }));
    expect(unknown.reason).toBe("squash-mergeability-unknown");
    expect(signals(unknown)).toEqual(["draft=false", "mergeable=unknown"]);
    const zeroCommits = squash(withRequest({ commitCount: 0 }));
    expect(zeroCommits.reason).toBe("squash-no-commits");
    expect(signals(zeroCommits)).toHaveLength(2);
    const zeroFiles = squash(withRequest({ changedFileCount: 0 }));
    expect(zeroFiles.reason).toBe("squash-no-changes");
    const absent = squash(withRequest({ commitCount: undefined, changedFileCount: undefined }));
    expect(absent.reason).toBe("squash-surface-unknown");
    expect(countOf(absent, "commits")).toBeUndefined();
    expect(countOf(absent, "changedFiles")).toBeUndefined();
    expect(signals(absent)).toHaveLength(2);
  });

  test("TC-VGATES-038 non-finite, negative, and absent surfaces never pass or default", () => {
    const cases: ReadonlyArray<[string, Partial<DeliveryRequest>, string]> = [
      ["commit NaN", { commitCount: Number.NaN }, "squash-surface-unknown"],
      ["files NaN", { changedFileCount: Number.NaN }, "squash-surface-unknown"],
      ["commit Infinity", { commitCount: Number.POSITIVE_INFINITY }, "squash-surface-unknown"],
      ["files -Infinity", { changedFileCount: Number.NEGATIVE_INFINITY }, "squash-surface-unknown"],
      ["commit -1", { commitCount: -1 }, "squash-surface-unknown"],
      ["files -1", { changedFileCount: -1 }, "squash-surface-unknown"],
      ["commit absent", { commitCount: undefined }, "squash-surface-unknown"],
      ["files absent", { changedFileCount: undefined }, "squash-surface-unknown"],
      [
        "both absent",
        { commitCount: undefined, changedFileCount: undefined },
        "squash-surface-unknown",
      ],
    ];
    for (const [label, overrides, reason] of cases) {
      const record = squash(withRequest(overrides));
      expect(record.verdict, label).toBe("fail");
      expect(record.reason, label).toBe(reason);
      for (const countEntry of record.citation.counts) {
        expect(Number.isInteger(countEntry.value), label).toBe(true);
        expect(countEntry.value, label).toBeGreaterThanOrEqual(0);
      }
      if (Object.hasOwn(overrides, "commitCount")) {
        expect(countOf(record, "commits"), label).toBeUndefined();
      } else {
        expect(countOf(record, "commits"), label).toBe(3);
      }
      if (Object.hasOwn(overrides, "changedFileCount")) {
        expect(countOf(record, "changedFiles"), label).toBeUndefined();
      } else {
        expect(countOf(record, "changedFiles"), label).toBe(7);
      }
    }
  });

  test("TC-VGATES-038 real zero counts stay definitive and positive counts pass", () => {
    const zeroCommits = squash(withRequest({ commitCount: 0 }));
    expect(zeroCommits.reason).toBe("squash-no-commits");
    expect(countOf(zeroCommits, "commits")).toBe(0);
    const zeroFiles = squash(withRequest({ changedFileCount: 0 }));
    expect(zeroFiles.reason).toBe("squash-no-changes");
    expect(countOf(zeroFiles, "changedFiles")).toBe(0);
    const ready = squash(withRequest({ commitCount: 1, changedFileCount: 1 }));
    expect(ready.verdict).toBe("pass");
    expect(ready.reason).toBe("squash-ready");
  });

  test("TC-VGATES-064 mergeable true with blocked/draft renders not-mergeable", () => {
    const blocked = squash(withRequest({ mergeableState: "not-mergeable" }));
    expect(blocked.reason).toBe("squash-not-mergeable");
    expect(signals(blocked)).toEqual(["draft=false", "mergeable=not-mergeable"]);
    const draft = squash(withRequest({ reviewState: "draft", mergeableState: "not-mergeable" }));
    expect(draft.reason).toBe("squash-draft");
    expect(signals(draft)).toEqual(["draft=true", "mergeable=not-mergeable"]);
  });
});
