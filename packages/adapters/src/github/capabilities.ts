/**
 * The GitHub seed's `AdapterContract` (GH-188 OQ-G GitHub row, GH-183 F-11).
 *
 * The closeout slice adds issue close, labels/assignee, and thread resolution;
 * the adapter completion adds the provider-side landing. Comment and
 * delivery-request writes remain declared gaps until the backlog slice closes
 * them. No envelope carriers.
 */
import type { AdapterContract } from "@delivery-os/core/contracts";

/** The GitHub slice's honest capability declaration. */
export const GITHUB_ADAPTER_CONTRACT: AdapterContract = {
  adapterName: "github",
  systemKind: "vcs",
  capabilities: {
    supportedOperations: [
      "read-work-item",
      "read-delivery-request",
      "read-pipeline-run",
      "write-work-item",
      "transition-work-item",
      "resolve-delivery-thread",
      "merge-delivery-request",
    ],
    declaredGaps: [
      { operation: "write-comment", reason: "adapter-not-implemented" },
      { operation: "write-delivery-request", reason: "adapter-not-implemented" },
    ],
    writableCarriers: [],
    readableCarriers: [],
  },
};
