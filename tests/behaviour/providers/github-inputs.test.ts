/**
 * TC-GITHUB-004 — the complete status/verify input set from the read slice.
 *
 * One delivery scenario (approved PR + its head-SHA check runs + linked issue)
 * resolves to exactly `DeliveryRequest` + `PipelineRun` + `WorkItem`, enough to
 * answer CI-green, review state, and work-item status/owner. The downstream
 * status/verify commands are out of scope (DEC-5); this proves their inputs.
 */
import { describe, expect, test } from "bun:test";
import { createEnvironmentCredentialPort } from "../../../packages/adapters/src/credentials/index";
import { createGitHubClient } from "../../../packages/adapters/src/github/client";
import type { ExternalSystemInstance } from "../../../packages/core/src/contracts/index";
import { fixtureBrand } from "../../fixtures/credentials/cases";
import {
  arrayField,
  createFixtureTransport,
  installThrowingFetchGuard,
  isRecord,
  readJson,
  recordField,
  requireValue,
} from "./support";

const FIXTURES = "tests/fixtures/providers/github";
const PULL_NUMBER = 504;
const ISSUE_NUMBER = 601;
const HEAD_SHA = "1111111111111111111111111111111111111111";

const instance: ExternalSystemInstance = {
  instanceName: "vcs-github",
  systemKind: "vcs",
  baseUrl: "https://api.github.example.com",
  authMethod: {
    mechanism: "credential-reference",
    reference: {
      referenceName: "github-read",
      sourceKey: { style: "literal", name: "FIXTURE_GITHUB_TOKEN" },
    },
  },
};

const credentials = createEnvironmentCredentialPort({
  environment: { FIXTURE_GITHUB_TOKEN: "canary-github-read-token" },
  brand: fixtureBrand,
});

const repository = { owner: "group-placeholder", name: "project-placeholder" } as const;
const repoPath = `/repos/${repository.owner}/${repository.name}`;
const pullUrl = `${instance.baseUrl}${repoPath}/pulls/${PULL_NUMBER}`;
const checkRunsUrl = `${instance.baseUrl}${repoPath}/commits/${HEAD_SHA}/check-runs?per_page=20`;
const issueUrl = `${instance.baseUrl}${repoPath}/issues/${ISSUE_NUMBER}`;

const pulls = arrayField(readJson(`${FIXTURES}/pr-review-states.json`), "pulls");
const shaSections = recordField(readJson(`${FIXTURES}/check-runs-per-sha.json`), "shas");
const issues = arrayField(readJson(`${FIXTURES}/issues.json`), "issues");

const findNumbered = (items: readonly unknown[], number: number): unknown => {
  const found = items.find((candidate) => isRecord(candidate) && candidate.number === number);
  if (found === undefined) throw new Error(`fixture item ${number} is missing`);
  return found;
};

const bodyFor = (): {
  readonly pull: unknown;
  readonly checkRuns: unknown;
  readonly issue: unknown;
} => ({
  pull: findNumbered(pulls, PULL_NUMBER),
  checkRuns: recordField(shaSections, HEAD_SHA),
  issue: findNumbered(issues, ISSUE_NUMBER),
});

describe("TC-GITHUB-004 complete status/verify input set", () => {
  test("the slice yields exactly the three primitive views", async () => {
    const body = bodyFor();
    const transport = createFixtureTransport([
      { url: pullUrl, body: body.pull },
      { url: checkRunsUrl, body: body.checkRuns },
      { url: issueUrl, body: body.issue },
    ]);
    const client = createGitHubClient({ instance, credentials, repository, transport });
    const guard = installThrowingFetchGuard();
    try {
      const request = requireValue(
        await client.readDeliveryRequest(PULL_NUMBER),
        "delivery request",
      );
      const runsRead = requireValue(await client.readPipelineRun(HEAD_SHA), "pipeline runs");
      expect(runsRead.pageItemCount).toBe(4);
      const runs = runsRead.items;
      const workItem = requireValue(await client.readWorkItem(ISSUE_NUMBER), "work item");

      expect(Object.keys(request).sort()).toEqual(
        [
          "headSha",
          "identity",
          "mergeableState",
          "reviewState",
          "sourceHeadSha",
          "sourceRef",
          "targetRef",
          "threads",
        ].sort(),
      );
      expect(Array.isArray(runs)).toBe(true);
      expect(Object.keys(workItem)).toContain("identity");
      expect(Object.keys(workItem)).toContain("status");

      const ciGreen = runs.flatMap((run) => run.jobs).every((job) => job.jobState === "succeeded");
      expect(ciGreen).toBe(false);
      expect(runs.flatMap((run) => run.jobs).some((job) => job.jobState === "failed")).toBe(true);
      expect(request.reviewState).toBe("approved");
      expect(workItem.status.deliveryState).toBe("ready");
      expect(workItem.assignee).toBe("owner-placeholder");

      expect(transport.requests.map((entry) => entry.url).sort()).toEqual(
        [checkRunsUrl, issueUrl, pullUrl].sort(),
      );
      expect(guard.calls).toEqual([]);
    } finally {
      guard.restore();
    }
  });

  test("an unfixtured request fails loudly instead of reaching the network", async () => {
    const body = bodyFor();
    const transport = createFixtureTransport([
      { url: pullUrl, body: body.pull },
      { url: checkRunsUrl, body: body.checkRuns },
      { url: issueUrl, body: body.issue },
    ]);
    const client = createGitHubClient({ instance, credentials, repository, transport });
    const guard = installThrowingFetchGuard();
    try {
      const result = await client.readWorkItem(999);
      expect(result.ok).toBe(false);
      expect(guard.calls).toEqual([]);
    } finally {
      guard.restore();
    }
  });
});
describe("GH-178 HTTP 404 is definitive absence, not a payload failure", () => {
  test("a 404 detail read returns provider.not-found", async () => {
    const transport = createFixtureTransport([{ url: pullUrl, body: {}, status: 404 }]);
    const client = createGitHubClient({ instance, credentials, repository, transport });
    const result = await client.readDeliveryRequest(PULL_NUMBER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("provider.not-found");
    expect(transport.requests).toHaveLength(1);
  });

  test("a non-404 failure stays provider.payload.invalid", async () => {
    const transport = createFixtureTransport([{ url: pullUrl, body: {}, status: 500 }]);
    const client = createGitHubClient({ instance, credentials, repository, transport });
    const result = await client.readDeliveryRequest(PULL_NUMBER);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("provider.payload.invalid");
  });
});
describe("GH-279 a malformed 2xx carries the received status", () => {
  test("the real client and normalizer stamp httpStatus 200 on a decode failure", async () => {
    const transport = createFixtureTransport([
      { url: issueUrl, body: { number: ISSUE_NUMBER }, status: 200 },
    ]);
    const client = createGitHubClient({ instance, credentials, repository, transport });
    const guard = installThrowingFetchGuard();
    try {
      const result = await client.readWorkItem(ISSUE_NUMBER);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("provider.payload.invalid");
        expect((result as { readonly httpStatus?: number }).httpStatus).toBe(200);
      }
      expect(transport.requests).toHaveLength(1);
      expect(guard.calls).toEqual([]);
    } finally {
      guard.restore();
    }
  });

  test("a thrown transport stays status-absent", async () => {
    const client = createGitHubClient({
      instance,
      credentials,
      repository,
      transport: {
        send: async () => {
          throw new TypeError("synthetic transport failure");
        },
      },
    });
    const result = await client.readWorkItem(ISSUE_NUMBER);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("provider.payload.invalid");
      expect((result as { readonly httpStatus?: number }).httpStatus).toBeUndefined();
    }
  });
});
