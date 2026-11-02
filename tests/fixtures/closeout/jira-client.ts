/** A fully offline Jira client over committed synthetic fixtures. */
import { createEnvironmentCredentialPort } from "../../../packages/adapters/src/credentials/index";
import { createJiraClient, type JiraClient } from "../../../packages/adapters/src/jira/client";
import type { ExternalSystemInstance } from "../../../packages/core/src/contracts/index";
import {
  createFixtureTransport,
  type FixtureRoute,
  readJson,
  requireRecord,
} from "../../behaviour/providers/support";
import { fixtureBrand } from "../credentials/cases";

export const JIRA_FIXTURES = "tests/fixtures/providers/jira";

export const jiraInstance: ExternalSystemInstance = {
  instanceName: "jira",
  systemKind: "tracker",
  baseUrl: "https://jira.example.com",
  authMethod: {
    mechanism: "credential-reference",
    reference: {
      referenceName: "jira-closeout",
      sourceKey: { style: "literal", name: "FIXTURE_JIRA_TOKEN" },
    },
  },
};

export const jiraCredentials = createEnvironmentCredentialPort({
  environment: { FIXTURE_JIRA_TOKEN: "canary-jira-token" },
  brand: fixtureBrand,
});

export const issueUrl = (key: string): string => `${jiraInstance.baseUrl}/rest/api/2/issue/${key}`;

export const transitionsUrl = (key: string): string => `${issueUrl(key)}/transitions`;

export const dependentsUrl = (key: string, limit: number): string =>
  `${jiraInstance.baseUrl}/rest/api/2/search?jql=${encodeURIComponent(
    `issue in linkedIssues("${key}", "blocks") AND statusCategory != Done ORDER BY key ASC`,
  )}&maxResults=${limit}`;

export const jiraIssueFixture = (): unknown =>
  requireRecord(readJson(`${JIRA_FIXTURES}/closeout-issue.json`), "jira issue").issue;

export const jiraDependentsFixture = (): unknown =>
  requireRecord(readJson(`${JIRA_FIXTURES}/closeout-dependents.json`), "jira dependents").issues;

export const jiraTransitionsFixture = (): unknown => readJson(`${JIRA_FIXTURES}/transitions.json`);

export const defaultJiraRoutes = (): readonly FixtureRoute[] => [
  { method: "GET", url: issueUrl("TRACK-101"), body: jiraIssueFixture() },
  { method: "PUT", url: issueUrl("TRACK-101"), status: 204, body: {} },
  { method: "GET", url: transitionsUrl("TRACK-101"), body: jiraTransitionsFixture() },
  { method: "POST", url: transitionsUrl("TRACK-101"), status: 204, body: {} },
  {
    method: "GET",
    url: dependentsUrl("TRACK-101", 200),
    body: { issues: jiraDependentsFixture() },
  },
];

export type JiraHarness = {
  readonly client: JiraClient;
  readonly transport: ReturnType<typeof createFixtureTransport>;
};

export const makeJiraClient = (
  routes: readonly FixtureRoute[] = defaultJiraRoutes(),
): JiraHarness => {
  const transport = createFixtureTransport(routes);
  const client = createJiraClient({
    instance: jiraInstance,
    credentials: jiraCredentials,
    transport,
  });
  return { client, transport };
};
