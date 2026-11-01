/** The exact v1 provider postures for closeout (spec Appendix B). */
import type { AdapterCapabilityDeclaration } from "../../../packages/core/src/contracts/index";

export const GITHUB_CLOSEOUT_CAPABILITIES: AdapterCapabilityDeclaration = {
  supportedOperations: [
    "read-work-item",
    "read-delivery-request",
    "read-pipeline-run",
    "write-work-item",
    "transition-work-item",
    "resolve-delivery-thread",
  ],
  declaredGaps: [
    { operation: "write-comment", reason: "adapter-not-implemented" },
    { operation: "write-delivery-request", reason: "adapter-not-implemented" },
  ],
  writableCarriers: [],
  readableCarriers: [],
};

export const JIRA_CLOSEOUT_CAPABILITIES: AdapterCapabilityDeclaration = {
  supportedOperations: ["read-work-item", "write-work-item", "transition-work-item"],
  declaredGaps: [
    { operation: "write-comment", reason: "adapter-not-implemented" },
    { operation: "read-delivery-request", reason: "provider-unsupported" },
    { operation: "write-delivery-request", reason: "provider-unsupported" },
    { operation: "read-pipeline-run", reason: "provider-unsupported" },
    { operation: "resolve-delivery-thread", reason: "provider-unsupported" },
  ],
  writableCarriers: [],
  readableCarriers: [],
};

export const GITLAB_CLOSEOUT_CAPABILITIES: AdapterCapabilityDeclaration = {
  supportedOperations: ["read-delivery-request", "read-pipeline-run"],
  declaredGaps: [
    { operation: "read-work-item", reason: "adapter-not-implemented" },
    { operation: "write-work-item", reason: "adapter-not-implemented" },
    { operation: "transition-work-item", reason: "adapter-not-implemented" },
    { operation: "write-comment", reason: "adapter-not-implemented" },
    { operation: "write-delivery-request", reason: "adapter-not-implemented" },
    { operation: "resolve-delivery-thread", reason: "adapter-not-implemented" },
  ],
  writableCarriers: [],
  readableCarriers: [],
};
