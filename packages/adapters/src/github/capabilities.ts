/**
 * The GitHub seed's `AdapterContract` (GH-188 OQ-G GitHub row, GH-183 F-11).
 *
 * The adapter completion supports the whole closed operation set: the closeout
 * slice contributes issue close, labels/assignee, and thread resolution; the
 * milestone adds the provider-side landing, the carrier-free comment write, and
 * the delivery-request content write. No envelope carriers, no declared gaps.
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
      "write-comment",
      "write-delivery-request",
    ],
    declaredGaps: [],
    writableCarriers: [],
    readableCarriers: [],
  },
};
