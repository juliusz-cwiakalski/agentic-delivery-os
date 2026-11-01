/**
 * The Jira seed's `AdapterContract` (GH-188 OQ-G Jira row, GH-183 F-11).
 *
 * The closeout slice adds the done transition, label replace with preservation,
 * and assignee clear. Comment writes remain an adapter gap; delivery-request,
 * pipeline, and thread operations are provider-unsupported. Empty carriers.
 *
 * Declared data only: no behaviour, no I/O.
 */
import type { AdapterContract } from "@delivery-os/core/contracts";

/** The Jira slice's honest capability declaration. */
export const JIRA_ADAPTER_CONTRACT: AdapterContract = {
  adapterName: "jira",
  systemKind: "tracker",
  capabilities: {
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
  },
};
