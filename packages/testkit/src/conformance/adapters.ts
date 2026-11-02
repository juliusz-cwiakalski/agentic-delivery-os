/**
 * The conformance adapter registry for the three shipped provider contracts
 * (GH-189 F-3, DEC-1).
 *
 * Each registration binds the imported contract and a client builder over the
 * tenant instance, credential port, injected transport, and provider
 * addressing. Production registrations never set the test-only write handler.
 */
import { createGitHubClient, GITHUB_ADAPTER_CONTRACT } from "@delivery-os/adapters/github";
import { createGitLabClient, GITLAB_ADAPTER_CONTRACT } from "@delivery-os/adapters/gitlab";
import { createJiraClient, JIRA_ADAPTER_CONTRACT } from "@delivery-os/adapters/jira";
import type {
  ConformanceAdapterClient,
  ConformanceAdapterRegistration,
  GithubMockAddressing,
  GitlabMockAddressing,
  JiraMockAddressing,
  MockTenant,
} from "./types.js";

const requireGithubAddressing = (tenant: MockTenant): GithubMockAddressing => {
  if (tenant.addressing.provider !== "github") {
    throw new Error(`tenant ${tenant.provider} does not carry github addressing`);
  }
  return tenant.addressing;
};

const requireGitlabAddressing = (tenant: MockTenant): GitlabMockAddressing => {
  if (tenant.addressing.provider !== "gitlab") {
    throw new Error(`tenant ${tenant.provider} does not carry gitlab addressing`);
  }
  return tenant.addressing;
};

const requireJiraAddressing = (tenant: MockTenant): JiraMockAddressing => {
  if (tenant.addressing.provider !== "jira") {
    throw new Error(`tenant ${tenant.provider} does not carry jira addressing`);
  }
  return tenant.addressing;
};

/** The sole conformance participant list: exactly the three shipped contracts. */
export const CONFORMANCE_ADAPTERS: readonly ConformanceAdapterRegistration[] = [
  {
    provider: "github",
    contract: GITHUB_ADAPTER_CONTRACT,
    buildClient: ({ tenant, instance, credentials, transport }): ConformanceAdapterClient => {
      const addressing = requireGithubAddressing(tenant);
      const client = createGitHubClient({
        instance,
        credentials,
        repository: { owner: addressing.owner, name: addressing.repo },
        transport,
      });
      return {
        readWorkItem: () => client.readWorkItem(addressing.issueNumber),
        readDeliveryRequest: () => client.readDeliveryRequest(addressing.pullNumber),
        readPipelineRun: async () => {
          const result = await client.readPipelineRun(addressing.commitSha);
          return result.ok ? { ok: true, value: result.value.items } : result;
        },
        writeWorkItem: () =>
          client.writeWorkItem({
            entityId: String(addressing.issueNumber),
            add: ["delivered"],
            remove: ["planning"],
          }),
        transitionWorkItem: () =>
          client.transitionWorkItem({
            entityId: String(addressing.issueNumber),
            deliveryState: "done",
          }),
        resolveDeliveryThread: () =>
          client.resolveDeliveryThread({
            deliveryRequest: {
              systemName: tenant.instance.instanceName,
              entityId: String(addressing.pullNumber),
            },
            threadId: addressing.threadId,
          }),
      };
    },
  },
  {
    provider: "gitlab",
    contract: GITLAB_ADAPTER_CONTRACT,
    buildClient: ({ tenant, instance, credentials, transport }): ConformanceAdapterClient => {
      const addressing = requireGitlabAddressing(tenant);
      const client = createGitLabClient({
        instance,
        credentials,
        projectPath: addressing.projectPath,
        transport,
      });
      return {
        readDeliveryRequest: () => client.readDeliveryRequest(addressing.mrIid),
        readPipelineRun: () => client.readPipelineRun(addressing.commitSha),
      };
    },
  },
  {
    provider: "jira",
    contract: JIRA_ADAPTER_CONTRACT,
    buildClient: ({ tenant, instance, credentials, transport }): ConformanceAdapterClient => {
      const addressing = requireJiraAddressing(tenant);
      const client = createJiraClient({ instance, credentials, transport });
      return {
        readWorkItem: () => client.readWorkItem(addressing.issueKey),
        writeWorkItem: () =>
          client.writeWorkItem({
            issueKey: addressing.issueKey,
            add: ["delivered"],
            remove: ["planning"],
          }),
        transitionWorkItem: () =>
          client.transitionWorkItem({
            issueKey: addressing.issueKey,
            deliveryState: "done",
          }),
      };
    },
  },
];
