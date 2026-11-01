/**
 * The GitHub seed's `AdapterContract` (GH-188 OQ-G GitHub row, GH-183 F-11).
 *
 * The closeout slice adds issue close, labels/assignee, and thread resolution.
 * Comment and delivery-request writes remain declared gaps; the full adapter is
 * M3-S3. No envelope carriers.
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
    ],
    declaredGaps: [
      { operation: "write-comment", reason: "adapter-not-implemented" },
      { operation: "write-delivery-request", reason: "adapter-not-implemented" },
    ],
    writableCarriers: [],
    readableCarriers: [],
  },
};
