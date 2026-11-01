/**
 * The GitHub seed's `AdapterContract` (GH-188 OQ-G GitHub row).
 *
 * The minimal read slice supports the three read operations and declares every
 * write operation as a gap (the full adapter is M3-S3). No envelope carriers.
 */
import type { AdapterContract } from "@delivery-os/core/contracts";

/** The GitHub read slice's honest capability declaration. */
export const GITHUB_ADAPTER_CONTRACT: AdapterContract = {
  adapterName: "github",
  systemKind: "vcs",
  capabilities: {
    supportedOperations: ["read-work-item", "read-delivery-request", "read-pipeline-run"],
    declaredGaps: [
      { operation: "write-work-item", reason: "adapter-not-implemented" },
      { operation: "write-delivery-request", reason: "adapter-not-implemented" },
      { operation: "transition-work-item", reason: "adapter-not-implemented" },
      { operation: "write-comment", reason: "adapter-not-implemented" },
      { operation: "resolve-delivery-thread", reason: "adapter-not-implemented" },
    ],
    writableCarriers: [],
    readableCarriers: [],
  },
};
