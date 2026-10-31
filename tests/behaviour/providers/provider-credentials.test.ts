/**
 * TC-CRED-001/002 — credential-port exclusivity and classified missing
 * credentials for every delivered client seed.
 *
 * The canary secret is used to build the provider request but never stored on
 * the client, logged, or returned. An unresolvable reference surfaces exactly
 * `config.credential.missing` and the transport is never called.
 */
import { describe, expect, test } from "bun:test";
import {
  createEnvironmentCredentialPort,
  resolveCredentialSourceKey,
} from "../../../packages/adapters/src/credentials/index";
import { createGitHubClient } from "../../../packages/adapters/src/github/client";
import { createGitLabClient } from "../../../packages/adapters/src/gitlab/client";
import type {
  ProviderReadResult,
  ProviderTransport,
} from "../../../packages/adapters/src/io/provider-transport";
import { createJiraClient } from "../../../packages/adapters/src/jira/client";
import type {
  CredentialPort,
  CredentialReference,
  CredentialResolution,
  ExternalSystemInstance,
} from "../../../packages/core/src/contracts/index";
import { CANARY, fixtureBrand } from "../../fixtures/credentials/cases";
import { arrayField, createFixtureTransport, readJson, recordField } from "./support";

const MISSING: CredentialResolution = {
  ok: false,
  code: "config.credential.missing",
  domainKind: "config",
  category: "user",
  retryable: false,
  consequence: "not_landed",
  projectionClass: "user-validation",
};

const jiraInstance: ExternalSystemInstance = {
  instanceName: "tracker-primary",
  systemKind: "tracker",
  baseUrl: "https://jira.example.com",
  authMethod: {
    mechanism: "credential-reference",
    reference: { referenceName: "jira-read", sourceKey: { style: "literal", name: "JIRA_TOKEN" } },
  },
};
const gitlabInstance: ExternalSystemInstance = {
  instanceName: "vcs-gitlab",
  systemKind: "vcs",
  baseUrl: "https://gitlab.example.com",
  authMethod: {
    mechanism: "credential-reference",
    reference: {
      referenceName: "gitlab-read",
      sourceKey: { style: "literal", name: "GITLAB_TOKEN" },
    },
  },
};
const githubInstance: ExternalSystemInstance = {
  instanceName: "vcs-github",
  systemKind: "vcs",
  baseUrl: "https://api.github.example.com",
  authMethod: {
    mechanism: "credential-reference",
    reference: {
      referenceName: "github-read",
      sourceKey: { style: "literal", name: "GITHUB_TOKEN" },
    },
  },
};

type SeedDescriptor = {
  readonly name: string;
  readonly instance: ExternalSystemInstance;
  readonly url: string;
  readonly body: unknown;
  readonly build: (
    credentials: CredentialPort,
    transport: ProviderTransport,
  ) => { readonly client: object; readonly read: () => Promise<ProviderReadResult<unknown>> };
};

const declaredReference = (instance: ExternalSystemInstance): CredentialReference => {
  if (instance.authMethod.mechanism !== "credential-reference") {
    throw new Error(`${instance.instanceName}: fixture expects a credential reference`);
  }
  return instance.authMethod.reference;
};

const jiraIssue = recordField(
  readJson("tests/fixtures/providers/jira/labels-replace-before.json"),
  "issue",
);
const gitlabMergeRequest = arrayField(
  readJson("tests/fixtures/providers/gitlab/merge-requests.json"),
  "merge_requests",
)[0];
const githubIssue = arrayField(
  readJson("tests/fixtures/providers/github/issues.json"),
  "issues",
)[0];

const SEEDS: readonly SeedDescriptor[] = [
  {
    name: "jira",
    instance: jiraInstance,
    url: `${jiraInstance.baseUrl}/rest/api/2/issue/TRACK-101`,
    body: jiraIssue,
    build: (credentials, transport) => {
      const client = createJiraClient({ instance: jiraInstance, credentials, transport });
      return { client, read: () => client.readWorkItem("TRACK-101") };
    },
  },
  {
    name: "gitlab",
    instance: gitlabInstance,
    url: `${gitlabInstance.baseUrl}/api/v4/projects/${encodeURIComponent("group-placeholder/project-placeholder")}/merge_requests/42`,
    body: gitlabMergeRequest,
    build: (credentials, transport) => {
      const client = createGitLabClient({
        instance: gitlabInstance,
        credentials,
        projectPath: "group-placeholder/project-placeholder",
        transport,
      });
      return { client, read: () => client.readDeliveryRequest(42) };
    },
  },
  {
    name: "github",
    instance: githubInstance,
    url: `${githubInstance.baseUrl}/repos/group-placeholder/project-placeholder/issues/601`,
    body: githubIssue,
    build: (credentials, transport) => {
      const client = createGitHubClient({
        instance: githubInstance,
        credentials,
        repository: { owner: "group-placeholder", name: "project-placeholder" },
        transport,
      });
      return { client, read: () => client.readWorkItem(601) };
    },
  },
];

const recordingPort = (
  resolution: CredentialResolution,
): { readonly port: CredentialPort; readonly references: CredentialReference[] } => {
  const references: CredentialReference[] = [];
  return {
    references,
    port: {
      resolve: (reference) => {
        references.push(reference);
        return resolution;
      },
    },
  };
};

describe("TC-CRED-001 credential resolution through the port only", () => {
  for (const seed of SEEDS) {
    test(`${seed.name}: the secret builds the request and is never stored`, async () => {
      const recording = recordingPort({ ok: true, material: { value: CANARY } });
      const transport = createFixtureTransport([{ url: seed.url, body: seed.body }]);
      const built = seed.build(recording.port, transport);
      const result = await built.read();
      expect(result.ok).toBe(true);

      const request = transport.requests[0];
      expect(request?.headers.Authorization).toBe(`Bearer ${CANARY}`);
      expect(recording.references).toEqual([declaredReference(seed.instance)]);

      const clientText = JSON.stringify(built.client);
      expect(clientText).not.toContain(CANARY);
      for (const value of Object.values(built.client)) {
        expect(String(value)).not.toContain(CANARY);
      }
      const diagnostics = JSON.stringify(result);
      expect(diagnostics).not.toContain(CANARY);
      expect(diagnostics).not.toContain(JSON.stringify(CANARY).slice(1, -1));
    });
  }
});

describe("TC-CRED-002 unresolvable credential classified", () => {
  for (const seed of SEEDS) {
    test(`${seed.name}: an absent key is exactly config.credential.missing`, async () => {
      const recording = recordingPort(MISSING);
      const transport = createFixtureTransport([{ url: seed.url, body: seed.body }]);
      const built = seed.build(recording.port, transport);
      const result = await built.read();
      expect(result).toEqual(MISSING);
      expect(transport.requests).toEqual([]);
      expect(recording.references).toEqual([declaredReference(seed.instance)]);

      const payload = JSON.stringify(result);
      expect(payload).not.toContain("fallback.");
      expect(payload).not.toContain("process");
      expect(payload).not.toContain("PATH");
      expect(payload).not.toContain(CANARY);
    });

    test(`${seed.name}: the real environment-backed port classifies absent and empty values`, async () => {
      const reference = declaredReference(seed.instance);
      const key = resolveCredentialSourceKey(reference, fixtureBrand);

      const absentPort = createEnvironmentCredentialPort({ environment: {}, brand: fixtureBrand });
      const absentTransport = createFixtureTransport([{ url: seed.url, body: seed.body }]);
      const absent = await seed.build(absentPort, absentTransport).read();
      expect(absent).toEqual(MISSING);
      expect(absentTransport.requests).toEqual([]);

      const emptyPort = createEnvironmentCredentialPort({
        environment: { [key]: "" },
        brand: fixtureBrand,
      });
      const emptyTransport = createFixtureTransport([{ url: seed.url, body: seed.body }]);
      const empty = await seed.build(emptyPort, emptyTransport).read();
      expect(empty).toEqual(MISSING);
      expect(emptyTransport.requests).toEqual([]);
    });
  }
});
