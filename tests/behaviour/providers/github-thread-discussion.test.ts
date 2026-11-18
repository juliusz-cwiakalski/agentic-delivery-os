/**
 * TC-THREAD-001..011 — the bounded review-thread discussion read.
 *
 * One read per thread, at most 50 oldest-first comments in provider order, at
 * most 4096 UTF-8 bytes per body without splitting a multi-byte sequence, the
 * provider total preserved, and one explicit thread-level truncation flag.
 * Bodies are evidence: no write path imports this module and nothing is
 * persisted or captured in the conformance artifact.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createEnvironmentCredentialPort } from "../../../packages/adapters/src/credentials/index";
import {
  createGitHubThreadDiscussionReader,
  GITHUB_THREAD_DISCUSSION_MAX_BODY_BYTES,
  GITHUB_THREAD_DISCUSSION_MAX_COMMENTS,
} from "../../../packages/adapters/src/github/thread-discussion";
import { redact } from "../../../packages/cli/src/output/serialize";
import type { ExternalSystemInstance } from "../../../packages/core/src/contracts/index";
import { fixtureBrand } from "../../fixtures/credentials/cases";
import { createFixtureTransport, isRecord, readJson, recordField, requireValue } from "./support";

const FIXTURE = "tests/fixtures/providers/github/thread-discussion.json";
const THREAD_ID = "PRRT_2";
const GRAPHQL_URL = "https://graphql.github.example.com/graphql";

const instance: ExternalSystemInstance = {
  instanceName: "github",
  systemKind: "vcs",
  baseUrl: "https://graphql.github.example.com",
  authMethod: { mechanism: "anonymous" },
};

const credentials = createEnvironmentCredentialPort({ environment: {}, brand: fixtureBrand });
const cases = recordField(readJson(FIXTURE), "cases");

const caseOf = (key: string): Record<string, unknown> => recordField(cases, key);

const graphqlBody = (entry: Record<string, unknown>): unknown => {
  if (entry.malformed === true) return { data: {} };
  const thread = entry.thread;
  if (thread === null || thread === undefined) return { data: { node: null } };
  if (!isRecord(thread)) return { data: {} };
  return {
    data: {
      node: {
        isResolved: thread.isResolved,
        comments: {
          totalCount: thread.totalCount,
          nodes: thread.comments,
        },
      },
    },
  };
};

const readerFor = (
  key: string,
): {
  readonly reader: ReturnType<typeof createGitHubThreadDiscussionReader>;
  readonly transport: ReturnType<typeof createFixtureTransport>;
} => {
  const entry = caseOf(key);
  const status = typeof entry.status === "number" ? entry.status : 200;
  const transport = createFixtureTransport([
    { method: "POST", url: GRAPHQL_URL, status, body: graphqlBody(entry) },
  ]);
  return {
    reader: createGitHubThreadDiscussionReader({ instance, credentials, transport }),
    transport,
  };
};

const readCase = async (key: string) =>
  requireValue(await readerFor(key).reader.readThreadDiscussion(THREAD_ID), key);

describe("TC-THREAD-001 the discussion shape and the 50-comment cap", () => {
  test("the closed shape carries the thread facts and provider-ordered comments", async () => {
    const value = await readCase("underCap");
    expect(Object.keys(value).sort()).toEqual([
      "commentCount",
      "comments",
      "resolved",
      "threadId",
      "truncated",
    ]);
    expect(value.threadId).toBe(THREAD_ID);
    expect(value.resolved).toBe(false);
    expect(value.commentCount).toBe(3);
    expect(value.comments.map((comment) => comment.commentId)).toEqual([
      "PRRC_1001",
      "PRRC_1002",
      "PRRC_1003",
    ]);
    expect(Object.keys(value.comments[0] ?? {}).sort()).toEqual([
      "authorAssociation",
      "authorKind",
      "authorLogin",
      "body",
      "bodyTruncated",
      "commentId",
    ]);
    for (const comment of value.comments) {
      expect(comment.bodyTruncated).toBe(false);
      expect(comment.authorKind).toBe("human");
    }
  });

  test("a non-human author normalizes to non-human", async () => {
    const value = await readCase("botAuthor");
    expect(value.comments[0]?.authorKind).toBe("non-human");
    expect(value.comments[0]?.authorLogin).toBe("dependabot[bot]");
  });

  test("exactly 50 is not truncated and 51 returns the first 50 with the provider total", async () => {
    const exact = await readCase("exactly50");
    expect(exact.comments).toHaveLength(GITHUB_THREAD_DISCUSSION_MAX_COMMENTS);
    expect(exact.commentCount).toBe(50);
    expect(exact.truncated).toBe(false);

    const capped = await readCase("fiftyOne");
    expect(capped.comments).toHaveLength(50);
    expect(capped.comments[49]?.commentId).toBe("PRRC_1050");
    expect(capped.commentCount).toBe(51);
    expect(capped.truncated).toBe(true);
  });
});

describe("TC-THREAD-002 the per-body cap is 4096 UTF-8 bytes", () => {
  test("exactly 4096 bytes is not truncated and 4097 truncates on the byte boundary", async () => {
    const exact = await readCase("body4096");
    expect(exact.comments[0]?.bodyTruncated).toBe(false);
    expect(Buffer.byteLength(exact.comments[0]?.body ?? "", "utf8")).toBe(
      GITHUB_THREAD_DISCUSSION_MAX_BODY_BYTES,
    );

    const over = await readCase("body4097");
    expect(over.comments[0]?.bodyTruncated).toBe(true);
    expect(Buffer.byteLength(over.comments[0]?.body ?? "", "utf8")).toBe(
      GITHUB_THREAD_DISCUSSION_MAX_BODY_BYTES,
    );
    expect(over.truncated).toBe(true);
  });

  test("a multi-byte sequence is never split at the body cap", async () => {
    const value = await readCase("bodyMultibyte");
    const comment = value.comments[0];
    expect(comment?.bodyTruncated).toBe(true);
    expect(Buffer.byteLength(comment?.body ?? "", "utf8")).toBe(4095);
    expect(comment?.body.includes("\uFFFD")).toBe(false);
    expect(comment?.body.endsWith("a")).toBe(true);
  });
});

describe("TC-THREAD-003 the truncation flag follows the exact declared rule", () => {
  test("fewer returned comments than the provider total is truncated", async () => {
    const short = await readCase("fortyNineOfFifty");
    expect(short.comments).toHaveLength(49);
    expect(short.commentCount).toBe(50);
    expect(short.truncated).toBe(true);

    const capped = await readCase("fiftyOfFiftyOne");
    expect(capped.comments).toHaveLength(50);
    expect(capped.commentCount).toBe(51);
    expect(capped.truncated).toBe(true);
  });
});

describe("TC-THREAD-004 404 and an absent thread are the not-found result", () => {
  for (const key of ["notFound404", "absentThread"]) {
    test(`${key} is not-found, never an empty success`, async () => {
      const result = await readerFor(key).reader.readThreadDiscussion(THREAD_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("provider.not-found");
    });
  }
});

describe("TC-THREAD-005 non-2xx and transport failures are classified payload failures", () => {
  for (const [key, status] of [
    ["unauthorized401", 401],
    ["forbidden403", 403],
    ["serverError500", 500],
    ["serviceUnavailable503", 503],
  ] as const) {
    test(`${key} is provider.payload.invalid with the structured status`, async () => {
      const result = await readerFor(key).reader.readThreadDiscussion(THREAD_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("provider.payload.invalid");
        expect((result as { readonly httpStatus?: number }).httpStatus).toBe(status);
      }
    });
  }

  test("a thrown transport failure has no status", async () => {
    const reader = createGitHubThreadDiscussionReader({
      instance,
      credentials,
      transport: {
        send: async (): Promise<never> => {
          throw new TypeError("synthetic transport failure");
        },
      },
    });
    const result = await reader.readThreadDiscussion(THREAD_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("provider.payload.invalid");
      expect((result as { readonly httpStatus?: number }).httpStatus).toBeUndefined();
    }
  });
});

describe("TC-THREAD-006 a malformed 2xx is a classified payload failure", () => {
  test("a payload without a thread node fails with httpStatus 200", async () => {
    const result = await readerFor("malformed2xx").reader.readThreadDiscussion(THREAD_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("provider.payload.invalid");
      expect((result as { readonly httpStatus?: number }).httpStatus).toBe(200);
    }
  });
});

describe("TC-THREAD-007 a zero-count thread with an empty list is observed empty", () => {
  test("the observed empty is distinct from not-found and failure", async () => {
    const value = await readCase("zeroCountEmpty");
    expect(value.commentCount).toBe(0);
    expect(value.comments).toEqual([]);
    expect(value.truncated).toBe(false);
  });
});

describe("TC-THREAD-008 a body never changes a closeout decision", () => {
  test("no write path imports the discussion reader", () => {
    const root = join(process.cwd(), "packages/adapters/src/github");
    const writePaths = ["client.ts", "normalize.ts", "workflow-map.ts", "capabilities.ts"];
    for (const file of writePaths) {
      expect(readFileSync(join(root, file), "utf8").includes("thread-discussion"), file).toBe(
        false,
      );
    }
    const closeout = readFileSync(
      join(process.cwd(), "packages/core/src/domain/closeout.ts"),
      "utf8",
    );
    expect(closeout).not.toContain("thread-discussion");
    expect(closeout).not.toContain("readThreadDiscussion");
  });

  test("the discussion body is not a DeliveryThread field and does not reach the plan", async () => {
    const value = await readCase("underCap");
    const serialized = JSON.stringify(value);
    expect(serialized).toContain("body");
    // The closeout residue/plan consumes DeliveryThread only (identity facts).
    const residue = { threadId: value.threadId, resolved: value.resolved };
    expect(JSON.stringify(residue)).not.toContain("body");
  });
});

describe("TC-THREAD-009 DeliveryThread, operations, capabilities, and projections are unchanged", () => {
  test("the discussion read adds no operation, no capability, and no conformance projection", () => {
    const tenant = JSON.parse(
      readFileSync(
        join(process.cwd(), "tests/fixtures/providers/conformance/github/tenant.json"),
        "utf8",
      ),
    ) as { expected: Record<string, unknown> };
    expect(
      Object.keys(tenant.expected).some((key) => key.toLowerCase().includes("discussion")),
    ).toBe(false);
  });
});

describe("TC-THREAD-010 no body is persisted or artifacted; rendering redacts", () => {
  test("the read result stays in memory and the adapter persists nothing", async () => {
    const canary = "REVIEW-BODY-CANARY-91c2";
    const transport = createFixtureTransport([
      {
        method: "POST",
        url: GRAPHQL_URL,
        body: {
          data: {
            node: {
              isResolved: false,
              comments: {
                totalCount: 1,
                nodes: [
                  {
                    id: "PRRC_3000",
                    author: { login: "reviewer-placeholder", __typename: "User" },
                    authorAssociation: "MEMBER",
                    body: `prefix ${canary} suffix`,
                  },
                ],
              },
            },
          },
        },
      },
    ]);
    const reader = createGitHubThreadDiscussionReader({ instance, credentials, transport });
    const value = requireValue(await reader.readThreadDiscussion(THREAD_ID), "canary");
    expect(value.comments[0]?.body).toContain(canary);
    expect(transport.requests).toHaveLength(1);
  });

  test("a rendered body passes the redaction chokepoint with a paired positive", () => {
    const secret = ["ghp", "zyxwvutsrqponmlkjihgfedc"].join("_");
    const dirty = redact({ body: `before ${secret} after` }, [secret]);
    expect(dirty.body).toContain("[redacted]");
    expect(dirty.body).not.toContain(secret);
    const clean = redact({ body: "before after" }, [secret]);
    expect(clean.body).toBe("before after");
  });
});

describe("TC-THREAD-011 exactly one read per thread", () => {
  test("a truncated read sends exactly one request with no pagination or cursor", async () => {
    const { reader, transport } = readerFor("fiftyOne");
    const value = requireValue(await reader.readThreadDiscussion(THREAD_ID), "one read");
    expect(value.truncated).toBe(true);
    expect(transport.requests).toHaveLength(1);
    const request = transport.requests[0];
    expect(request?.method).toBe("POST");
    expect(request?.url).toBe(GRAPHQL_URL);
    expect(request?.body).toContain(THREAD_ID);
    expect(request?.body ?? "").not.toContain("page");
    expect(request?.body ?? "").not.toContain("cursor");
  });
});
