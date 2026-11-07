/** TC-CAP-029 — human leaves residue, non-human resolves, unknown/absent is human. */
import { describe, expect, test } from "bun:test";
import { buildCloseoutPlan } from "../../../packages/core/src/domain/closeout";
import { makeFacts, makeMergedRequest } from "../../fixtures/closeout/harness";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeReviewThreads } from "../../../packages/adapters/src/github/normalize";

const threads = [
  {
    threadId: "PRRT_2",
    resolved: false,
    commentCount: 1,
    authorLogin: "dependabot[bot]",
    authorKind: "non-human" as const,
  },
  {
    threadId: "PRRT_3",
    resolved: false,
    commentCount: 1,
    authorLogin: "reviewer-bob",
    authorKind: "human" as const,
  },
  {
    threadId: "PRRT_4",
    resolved: false,
    commentCount: 1,
    authorLogin: "unmapped-actor",
    authorKind: "unknown" as const,
  },
];

const facts = (override?: { readonly omitFacts?: boolean }) =>
  makeFacts({
    mergedRequest: { observation: "observed", value: makeMergedRequest({ threads }) },
    ...(override?.omitFacts === true ? { threadAuthorFacts: undefined } : {}),
  });

describe("TC-CAP-029 thread authorship", () => {
  test("a Mannequin author is unknown (fail-closed human), never non-human", () => {
    const payload: unknown = {
      data: {
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: [
                {
                  id: "PRRT_M",
                  isResolved: false,
                  comments: {
                    totalCount: 1,
                    nodes: [
                      {
                        author: { login: "ghost", __typename: "Mannequin" },
                        authorAssociation: "NONE",
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    };
    const read = normalizeReviewThreads(payload);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value[0]?.authorKind).toBe("unknown");
  });

  test("the GitHub review-thread read normalizes the root author kind", () => {
    const payload: unknown = JSON.parse(
      readFileSync(
        join(process.cwd(), "tests/fixtures/providers/github/graphql-review-threads.json"),
        "utf8",
      ),
    );
    const read = normalizeReviewThreads(payload);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const byId = new Map(read.value.map((thread) => [thread.threadId, thread]));
    expect(byId.get("PRRT_1")?.authorKind).toBe("human");
    expect(byId.get("PRRT_1")?.authorLogin).toBe("octocat");
    expect(byId.get("PRRT_2")?.authorKind).toBe("non-human");
    const withUnknown = JSON.parse(JSON.stringify(payload)) as {
      data: { repository: { pullRequest: { reviewThreads: { nodes: unknown[] } } } };
    };
    withUnknown.data.repository.pullRequest.reviewThreads.nodes.push({
      id: "PRRT_3",
      isResolved: true,
      comments: { totalCount: 1, nodes: [] },
    });
    const unknownRead = normalizeReviewThreads(withUnknown);
    expect(unknownRead.ok).toBe(true);
    if (unknownRead.ok) {
      expect(
        new Map(unknownRead.value.map((t) => [t.threadId, t])).get("PRRT_3")?.authorKind,
      ).toBeUndefined();
    }
  });

  test("only the non-human thread is resolved", () => {
    const plan = buildCloseoutPlan(facts());
    const step = plan.steps.find((entry) => entry.stepId === "comment-resolution");
    expect(step?.operations.map((operation) => operation.name)).toEqual([
      "resolve-delivery-thread",
    ]);
    expect(step?.operations[0]?.arguments).toMatchObject({ threadId: "PRRT_2" });
  });

  test("human and unknown threads become identity-only residue", () => {
    const plan = buildCloseoutPlan(facts());
    expect(plan.residue?.map((item) => item.location).sort()).toEqual([
      "thread:PRRT_3",
      "thread:PRRT_4",
    ]);
    expect(plan.residue?.every((item) => item.kind === "unresolved-human-thread")).toBe(true);
    expect(JSON.stringify(plan.residue)).toContain("reviewer-bob");
    expect(JSON.stringify(plan.residue)).toContain("unmapped-actor");
  });

  test("absent authorship facts fail closed: no thread is resolved", () => {
    const plan = buildCloseoutPlan(facts({ omitFacts: true }));
    const step = plan.steps.find((entry) => entry.stepId === "comment-resolution");
    expect(step?.operations).toEqual([]);
    expect(plan.residue?.map((item) => item.location).sort()).toEqual([
      "thread:PRRT_2",
      "thread:PRRT_3",
      "thread:PRRT_4",
    ]);
  });
});
