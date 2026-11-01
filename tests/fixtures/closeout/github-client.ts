/** A fully offline GitHub client over committed synthetic fixtures. */
import { createEnvironmentCredentialPort } from "../../../packages/adapters/src/credentials/index";
import {
  createGitHubClient,
  type GithubClient,
} from "../../../packages/adapters/src/github/client";
import type { ExternalSystemInstance } from "../../../packages/core/src/contracts/index";
import {
  createFixtureTransport,
  type FixtureRoute,
  readJson,
  requireRecord,
} from "../../behaviour/providers/support";
import { fixtureBrand } from "../credentials/cases";

export const GITHUB_FIXTURES = "tests/fixtures/providers/github";
const REPO = { owner: "group-placeholder", name: "project-placeholder" } as const;

export const githubInstance: ExternalSystemInstance = {
  instanceName: "github",
  systemKind: "vcs",
  baseUrl: "https://api.github.example.com",
  authMethod: {
    mechanism: "credential-reference",
    reference: {
      referenceName: "github-closeout",
      sourceKey: { style: "literal", name: "FIXTURE_GITHUB_TOKEN" },
    },
  },
};

const credentials = createEnvironmentCredentialPort({
  environment: { FIXTURE_GITHUB_TOKEN: "canary-closeout-token" },
  brand: fixtureBrand,
});

const repoPath = `/repos/${REPO.owner}/${REPO.name}`;
export const issueUrl = (number: number): string =>
  `${githubInstance.baseUrl}${repoPath}/issues/${number}`;
export const pullsUrl = (limit: number): string =>
  `${githubInstance.baseUrl}${repoPath}/pulls?state=closed&per_page=${limit}&sort=updated&direction=desc`;
export const dependenciesUrl = (number: number, limit: number): string =>
  `${githubInstance.baseUrl}${repoPath}/issues/${number}/dependencies/blocking?per_page=${limit}`;
export const blockersUrl = (number: number, limit: number): string =>
  `${githubInstance.baseUrl}${repoPath}/issues/${number}/dependencies/blocked_by?per_page=${limit}`;
export const graphqlUrl = `${githubInstance.baseUrl}/graphql`;

export const githubIssueFixture = (): unknown =>
  requireRecord(readJson(`${GITHUB_FIXTURES}/closeout-issues.json`), "issue fixture").issue;

export const githubPullsFixture = (): unknown =>
  requireRecord(readJson(`${GITHUB_FIXTURES}/closeout-pulls-merged.json`), "pulls fixture").pulls;

export const githubDependenciesFixture = (): unknown =>
  requireRecord(readJson(`${GITHUB_FIXTURES}/closeout-dependencies.json`), "dependencies fixture")
    .issues;

export const githubBlockersFixture = (number: number): unknown =>
  requireRecord(readJson(`${GITHUB_FIXTURES}/closeout-blockers-${number}.json`), "blockers fixture")
    .issues;

export const githubReviewThreadsFixture = (): unknown =>
  readJson(`${GITHUB_FIXTURES}/graphql-review-threads.json`);

export const defaultGithubRoutes = (): readonly FixtureRoute[] => [
  { method: "GET", url: issueUrl(183), body: githubIssueFixture() },
  { method: "PATCH", url: issueUrl(183), body: { number: 183, state: "closed" } },
  { method: "GET", url: pullsUrl(20), body: githubPullsFixture() },
  {
    method: "GET",
    url: blockersUrl(183, 200),
    body: githubBlockersFixture(183),
  },
  { method: "GET", url: dependenciesUrl(183, 200), body: githubDependenciesFixture() },
  {
    method: "POST",
    url: graphqlUrl,
    requestBodyContains: "reviewThreads",
    body: githubReviewThreadsFixture(),
  },
  {
    method: "POST",
    url: graphqlUrl,
    requestBodyContains: "resolveReviewThread",
    body: readJson(`${GITHUB_FIXTURES}/graphql-resolve-thread.json`),
  },
];

export type GithubHarness = {
  readonly client: GithubClient;
  readonly transport: ReturnType<typeof createFixtureTransport>;
};

export const makeGithubClient = (
  routes: readonly FixtureRoute[] = defaultGithubRoutes(),
): GithubHarness => {
  const transport = createFixtureTransport(routes);
  const client = createGitHubClient({
    instance: githubInstance,
    credentials,
    repository: REPO,
    transport,
  });
  return { client, transport };
};
