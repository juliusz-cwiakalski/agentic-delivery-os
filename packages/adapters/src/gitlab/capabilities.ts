/**
 * The GitLab seed's `AdapterContract` (GH-188 OQ-G GitLab row).
 *
 * MR and pipeline reads only. Write operations and the work-item operations
 * (GitLab issues exist as a provider capability but are out of this seed) are
 * declared gaps, never implied parity. No envelope-carrier surface.
 */
import type { AdapterContract } from "@delivery-os/core/contracts";

/** The GitLab seed's honest capability declaration. */
export const GITLAB_ADAPTER_CONTRACT: AdapterContract = {
  adapterName: "gitlab",
  systemKind: "vcs",
  capabilities: {
    supportedOperations: ["read-delivery-request", "read-pipeline-run"],
    declaredGaps: [
      { operation: "write-delivery-request", reason: "adapter-not-implemented" },
      { operation: "read-work-item", reason: "adapter-not-implemented" },
      { operation: "write-work-item", reason: "adapter-not-implemented" },
      { operation: "transition-work-item", reason: "adapter-not-implemented" },
      { operation: "write-comment", reason: "adapter-not-implemented" },
    ],
    writableCarriers: [],
    readableCarriers: [],
  },
};
