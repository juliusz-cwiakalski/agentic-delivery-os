/**
 * TC-CHECK-001..012 — provider job timings and the bounded failure-log excerpt.
 *
 * Timings are copied verbatim and absent stays absent; the excerpt is a faithful
 * byte prefix bounded by one fixed cap, one read, never persisted, and rendered
 * only through the single redaction chokepoint.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createEnvironmentCredentialPort } from "../../../packages/adapters/src/credentials/index";
import { createGitHubClient } from "../../../packages/adapters/src/github/client";
import {
  createGitHubLogExcerptReader,
  GITHUB_LOG_EXCERPT_MAX_BYTES,
  type GithubLogExcerptOptions,
} from "../../../packages/adapters/src/github/log-excerpt";
import { redact } from "../../../packages/cli/src/output/serialize";
import type { ExternalSystemInstance } from "../../../packages/core/src/contracts/index";
import { fixtureBrand } from "../../fixtures/credentials/cases";
import { createFixtureTransport, isRecord, readJson, recordField, requireValue } from "./support";

const FIXTURES = "tests/fixtures/providers/github";
const TIMINGS = `${FIXTURES}/check-run-timings.json`;
const EXCERPT = `${FIXTURES}/check-run-log-excerpt.json`;
const SHA = "1111111111111111111111111111111111111111";
const JOB_ID = "9002";

const instance: ExternalSystemInstance = {
  instanceName: "github",
  systemKind: "vcs",
  baseUrl: "https://api.github.example.com",
  authMethod: { mechanism: "anonymous" },
};

const credentials = createEnvironmentCredentialPort({ environment: {}, brand: fixtureBrand });
const repository = { owner: "group-placeholder", name: "project-placeholder" } as const;
const repoPath = `/repos/${repository.owner}/${repository.name}`;
const checkRunsUrl = `${instance.baseUrl}${repoPath}/commits/${SHA}/check-runs?per_page=20`;
const logUrl = `${instance.baseUrl}${repoPath}/actions/jobs/${JOB_ID}/logs`;

const timingsCase = (key: string): Record<string, unknown> =>
  recordField(recordField(readJson(TIMINGS), "cases"), key);

const excerptCase = (key: string): Record<string, unknown> =>
  recordField(recordField(readJson(EXCERPT), "cases"), key);

const readTimings = async (key: string) => {
  const transport = createFixtureTransport([{ url: checkRunsUrl, body: timingsCase(key) }]);
  const client = createGitHubClient({ instance, credentials, repository, transport });
  return requireValue(await client.readPipelineRun(SHA), key);
};

const readerFor = (
  key: string,
  options: Partial<GithubLogExcerptOptions> = {},
): {
  readonly reader: ReturnType<typeof createGitHubLogExcerptReader>;
  readonly transport: ReturnType<typeof createFixtureTransport>;
} => {
  const fixture = excerptCase(key);
  const status = typeof fixture.status === "number" ? fixture.status : 200;
  const transport = createFixtureTransport([{ url: logUrl, status, body: fixture.body }]);
  return {
    reader: createGitHubLogExcerptReader({
      instance,
      credentials,
      repository,
      transport,
      ...options,
    }),
    transport,
  };
};

const providerText = (key: string): string => {
  const body = excerptCase(key).body;
  if (typeof body === "string") return body;
  if (isRecord(body) && typeof body.text === "string") return body.text;
  throw new Error(`${key} carries no log text`);
};

describe("TC-CHECK-001 timings are copied verbatim when the provider supplies them", () => {
  test("every provider timestamp appears byte-for-byte on the job", async () => {
    const run = await readTimings("bothPresent");
    const jobs = run.items.flatMap((item) => item.jobs);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]?.startedAt).toBe("2026-11-17T10:00:00Z");
    expect(jobs[0]?.completedAt).toBe("2026-11-17T10:04:12Z");
    expect(jobs[1]?.startedAt).toBe("2026-11-17T10:04:13Z");
    expect(jobs[1]?.completedAt).toBe("2026-11-17T10:11:59Z");
    for (const job of jobs) {
      expect(Object.hasOwn(job, "durationMs")).toBe(false);
      expect(JSON.stringify(job)).not.toContain("durationMs");
    }
  });

  test("a completed run carries both timings without reformatting", async () => {
    const run = await readTimings("completedRun");
    const job = run.items[0]?.jobs[0];
    expect(job?.startedAt).toBe("2026-11-17T10:00:00Z");
    expect(job?.completedAt).toBe("2026-11-17T10:01:00Z");
    // A parsed/reformatted representation would differ from the raw string.
    expect(job?.startedAt).not.toBe(new Date("2026-11-17T10:00:00Z").toISOString());
  });
});

describe("TC-CHECK-002 absent timings stay absent; no duration is derived", () => {
  test("a started-only run leaves completedAt absent", async () => {
    const run = await readTimings("startedOnly");
    const job = run.items[0]?.jobs[0];
    expect(job?.startedAt).toBe("2026-11-17T10:12:00Z");
    expect(job === undefined ? true : Object.hasOwn(job, "completedAt")).toBe(false);
    expect(job === undefined ? true : Object.hasOwn(job, "durationMs")).toBe(false);
  });

  test("a run with no timestamps keeps both fields absent", async () => {
    const run = await readTimings("nonePresent");
    const job = run.items[0]?.jobs[0];
    expect(job === undefined ? true : Object.hasOwn(job, "startedAt")).toBe(false);
    expect(job === undefined ? true : Object.hasOwn(job, "completedAt")).toBe(false);
  });

  test("an incomplete run never defaults its completion timestamp", async () => {
    const run = await readTimings("incompleteRunCompletionAbsent");
    const job = run.items[0]?.jobs[0];
    expect(job?.startedAt).toBe("2026-11-17T10:20:00Z");
    expect(job === undefined ? true : Object.hasOwn(job, "completedAt")).toBe(false);
  });
});

describe("TC-CHECK-003 the excerpt cap boundary is exact on UTF-8 bytes", () => {
  test("exactly 8192 bytes is not truncated", async () => {
    const { reader } = readerFor("exactly8192Ascii");
    const value = requireValue(await reader.readLogExcerpt(JOB_ID), "exactly-8192");
    expect(value.byteLength).toBe(GITHUB_LOG_EXCERPT_MAX_BYTES);
    expect(Buffer.byteLength(value.excerpt, "utf8")).toBe(value.byteLength);
    expect(value.truncated).toBe(false);
  });

  test("8193 bytes truncates to exactly 8192 bytes", async () => {
    const { reader } = readerFor("over8192Ascii");
    const value = requireValue(await reader.readLogExcerpt(JOB_ID), "8193");
    expect(value.truncated).toBe(true);
    expect(value.byteLength).toBe(GITHUB_LOG_EXCERPT_MAX_BYTES);
    expect(Buffer.byteLength(value.excerpt, "utf8")).toBe(GITHUB_LOG_EXCERPT_MAX_BYTES);
    expect(providerText("over8192Ascii").startsWith(value.excerpt)).toBe(true);
  });

  test("a multi-byte sequence is never split and byte length is the authority", async () => {
    for (const key of ["multibyteBoundary", "multibyteSplitAvoidance"]) {
      const { reader } = readerFor(key);
      const value = requireValue(await reader.readLogExcerpt(JOB_ID), key);
      expect(value.truncated, key).toBe(true);
      expect(value.byteLength <= GITHUB_LOG_EXCERPT_MAX_BYTES, key).toBe(true);
      expect(Buffer.byteLength(value.excerpt, "utf8"), key).toBe(value.byteLength);
      expect(providerText(key).startsWith(value.excerpt), key).toBe(true);
      expect(value.excerpt.includes("\uFFFD"), key).toBe(false);
    }
    const boundary = requireValue(
      await readerFor("multibyteBoundary").reader.readLogExcerpt(JOB_ID),
      "boundary",
    );
    expect(boundary.byteLength).toBe(8190);
  });
});

describe("TC-CHECK-004 the excerpt is a faithful prefix with identity", () => {
  test("the shape is exactly four keys and the text is an unmodified prefix", async () => {
    const { reader } = readerFor("prefixFidelity");
    const value = requireValue(await reader.readLogExcerpt(JOB_ID), "prefix");
    expect(Object.keys(value).sort()).toEqual(["byteLength", "excerpt", "jobId", "truncated"]);
    expect(value.jobId).toBe(JOB_ID);
    expect(value.excerpt).toBe("line one\nline two  \nline three\n");
    expect(providerText("prefixFidelity").startsWith(value.excerpt)).toBe(true);
    expect(value.truncated).toBe(false);
  });

  test("a raw string body is accepted as log text", async () => {
    const { reader } = readerFor("rawString200");
    const value = requireValue(await reader.readLogExcerpt(JOB_ID), "raw");
    expect(value.excerpt).toBe("raw log text\n");
  });
});

describe("TC-CHECK-005 empty log text is an observed empty", () => {
  test("an empty 2xx returns an empty excerpt, never not-found", async () => {
    const { reader } = readerFor("empty200");
    const value = requireValue(await reader.readLogExcerpt(JOB_ID), "empty");
    expect(value).toEqual({ jobId: JOB_ID, excerpt: "", truncated: false, byteLength: 0 });
  });
});

describe("TC-CHECK-006 404 is the adapter-local not-found result", () => {
  test("a 404 is not-found, never an empty success", async () => {
    const { reader } = readerFor("notFound404");
    const result = await reader.readLogExcerpt(JOB_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("provider.not-found");
      expect((result as { readonly httpStatus?: number }).httpStatus).toBe(404);
      expect("excerpt" in result).toBe(false);
    }
  });
});

describe("TC-CHECK-007 non-2xx and transport failures are classified payload failures", () => {
  for (const [key, status] of [
    ["unauthorized401", 401],
    ["forbidden403", 403],
    ["serverError500", 500],
    ["serviceUnavailable503", 503],
  ] as const) {
    test(`${key} is provider.payload.invalid with the structured status`, async () => {
      const { reader } = readerFor(key);
      const result = await reader.readLogExcerpt(JOB_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("provider.payload.invalid");
        expect((result as { readonly httpStatus?: number }).httpStatus).toBe(status);
      }
    });
  }

  test("a thrown transport failure has no status", async () => {
    const transport = {
      send: async (): Promise<never> => {
        throw new TypeError("synthetic transport failure");
      },
    };
    const reader = createGitHubLogExcerptReader({
      instance,
      credentials,
      repository,
      transport,
    });
    const result = await reader.readLogExcerpt(JOB_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("provider.payload.invalid");
      expect((result as { readonly httpStatus?: number }).httpStatus).toBeUndefined();
    }
  });
});

describe("TC-CHECK-008 a malformed 2xx is a classified payload failure", () => {
  test("a body without log text fails with httpStatus 200", async () => {
    const { reader } = readerFor("malformed2xx");
    const result = await reader.readLogExcerpt(JOB_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("provider.payload.invalid");
      expect((result as { readonly httpStatus?: number }).httpStatus).toBe(200);
    }
  });
});

describe("TC-CHECK-009 one read per excerpt: no retry, no pagination", () => {
  test("success and failure each record exactly one request with no page parameter", async () => {
    for (const key of ["largeText", "serverError500"]) {
      const { reader, transport } = readerFor(key);
      await reader.readLogExcerpt(JOB_ID);
      expect(transport.requests, key).toHaveLength(1);
      expect(transport.requests[0]?.url, key).not.toContain("page=");
      expect(transport.requests[0]?.method, key).toBe("GET");
    }
  });
});

describe("TC-CHECK-010 the excerpt never reaches a persisted or artifact surface", () => {
  test("only the reader module and the subpath index reference the excerpt module", () => {
    const root = join(process.cwd(), "packages/adapters/src/github");
    const referencing = [
      "client.ts",
      "normalize.ts",
      "review-state.ts",
      "workflow-map.ts",
      "deploy-trace.ts",
      "capabilities.ts",
      "cli-transport.ts",
    ].filter((file) => readFileSync(join(root, file), "utf8").includes("log-excerpt"));
    expect(referencing).toEqual([]);
    const index = readFileSync(join(root, "index.ts"), "utf8");
    expect(index).toContain("log-excerpt");
  });

  test("the read result carries the text in memory only, with no persistence hook", async () => {
    const canary = "EVIDENCE-CANARY-7f3a";
    const transport = createFixtureTransport([
      { url: logUrl, body: { text: `prefix ${canary} suffix` } },
    ]);
    const reader = createGitHubLogExcerptReader({
      instance,
      credentials,
      repository,
      transport,
    });
    const value = requireValue(await reader.readLogExcerpt(JOB_ID), "canary");
    expect(value.excerpt).toContain(canary);
    expect(transport.requests).toHaveLength(1);
  });
});

describe("TC-CHECK-011 a rendered excerpt passes the redaction chokepoint", () => {
  test("secret-shaped material is redacted and a clean text renders normally", () => {
    // Constructed at runtime so no provider-token literal is committed.
    const secret = ["ghp", "abcdefghijklmnopqrstuvwx"].join("_");
    const dirty = redact({ excerpt: `before ${secret} after` }, [secret]);
    expect(dirty.excerpt).toContain("[redacted]");
    expect(dirty.excerpt).not.toContain(secret);
    const clean = redact({ excerpt: "before after" }, [secret]);
    expect(clean.excerpt).toBe("before after");
  });
});

describe("TC-CHECK-012 the cap is fixed and not caller-tunable", () => {
  test("the declared constant is the only cap and a runtime extra option changes nothing", async () => {
    expect(GITHUB_LOG_EXCERPT_MAX_BYTES).toBe(8192);
    const injected = {
      instance,
      credentials,
      repository,
      transport: createFixtureTransport([{ url: logUrl, body: excerptCase("largeText").body }]),
      maxBytes: 16,
    } as unknown as GithubLogExcerptOptions;
    const reader = createGitHubLogExcerptReader(injected);
    const value = requireValue(await reader.readLogExcerpt(JOB_ID), "tunable");
    expect(value.byteLength).toBe(GITHUB_LOG_EXCERPT_MAX_BYTES);
    expect(value.excerpt.length).toBe(GITHUB_LOG_EXCERPT_MAX_BYTES);
    expect(value.truncated).toBe(true);
  });
});
