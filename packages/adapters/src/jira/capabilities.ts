/**
 * The Jira seed's `AdapterContract` (GH-188 OQ-G Jira row).
 *
 * Read slice only: `read-work-item` is supported. The three write operations are
 * deferred to the closeout story (M0-S14) and the tracker has no delivery-request
 * or pipeline surface. Empty carrier arrays: this seed ships no envelope-carrier
 * surface.
 *
 * Declared data only: no behaviour, no I/O.
 */
import type { AdapterContract } from "@delivery-os/core/contracts";

/** The Jira seed's honest capability declaration. */
export const JIRA_ADAPTER_CONTRACT: AdapterContract = {
  adapterName: "jira",
  systemKind: "tracker",
  capabilities: {
    supportedOperations: ["read-work-item"],
    declaredGaps: [
      { operation: "write-work-item", reason: "adapter-not-implemented" },
      { operation: "transition-work-item", reason: "adapter-not-implemented" },
      { operation: "write-comment", reason: "adapter-not-implemented" },
      { operation: "read-delivery-request", reason: "provider-unsupported" },
      { operation: "write-delivery-request", reason: "provider-unsupported" },
      { operation: "read-pipeline-run", reason: "provider-unsupported" },
      { operation: "resolve-delivery-thread", reason: "provider-unsupported" },
    ],
    writableCarriers: [],
    readableCarriers: [],
  },
};
