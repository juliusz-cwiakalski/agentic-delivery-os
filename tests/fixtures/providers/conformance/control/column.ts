/**
 * The conformance-only control adapter's declared five items (TDR-0039 §3).
 *
 * It is composition-injected only: it never enters CONFORMANCE_ADAPTERS. The
 * tenant is declared here as data so the test does not modify the shipped
 * fixture tree.
 */
import type { AdapterContract, WorkItem } from "@delivery-os/core/contracts";
import type { ConformanceAdapterRegistration, MockTenant } from "@delivery-os/testkit";

export const CONTROL_PROVIDER = "control";

export const CONTROL_CONTRACT: AdapterContract = {
  adapterName: CONTROL_PROVIDER,
  systemKind: "tracker",
  capabilities: {
    supportedOperations: ["read-work-item"],
    declaredGaps: [
      { operation: "write-work-item", reason: "provider-unsupported" },
      { operation: "transition-work-item", reason: "provider-unsupported" },
      { operation: "read-delivery-request", reason: "provider-unsupported" },
      { operation: "write-delivery-request", reason: "provider-unsupported" },
      { operation: "read-pipeline-run", reason: "provider-unsupported" },
      { operation: "write-comment", reason: "provider-unsupported" },
      { operation: "resolve-delivery-thread", reason: "provider-unsupported" },
      { operation: "merge-delivery-request", reason: "provider-unsupported" },
    ],
    writableCarriers: [],
    readableCarriers: [],
  },
};

const CONTROL_ITEM: WorkItem = {
  identity: { systemName: "control-tracker", entityId: "1" },
  title: "Control work item",
  status: { nativeStatus: "open", deliveryState: "ready" },
  labels: [],
  relations: [],
};

export const CONTROL_TENANT: MockTenant = {
  provenance: "hand-authored-synthetic 2026-11-18",
  provider: CONTROL_PROVIDER,
  adapterName: CONTROL_PROVIDER,
  instance: {
    instanceName: "control-tracker",
    systemKind: "tracker",
    baseUrl: "https://control.example.com",
    authMethod: { mechanism: "anonymous" },
  },
  credentialReferenceName: "control-read",
  addressing: {
    provider: "github",
    owner: "owner-placeholder",
    repo: "project-placeholder",
    issueNumber: 1,
    pullNumber: 1,
    commitSha: "1111111111111111111111111111111111111111",
    threadId: "thread-1",
  },
  routes: [
    {
      method: "GET",
      url: "https://control.example.com/work-items/1",
      status: 200,
      body: { id: "1", title: "Control work item", state: "open" },
    },
  ],
  expected: {
    "change-lifecycle.read-work-item": CONTROL_ITEM,
    "comment-provenance.read-comments": CONTROL_ITEM,
    "label-semantics.read-labels": CONTROL_ITEM,
  },
};

export const CONTROL_REGISTRATION: ConformanceAdapterRegistration = {
  provider: CONTROL_PROVIDER,
  contract: CONTROL_CONTRACT,
  buildClient: () => ({ readWorkItem: async () => ({ ok: true, value: CONTROL_ITEM }) }),
};

/** The control's nine-cell matrix column, declared as data by the test. */
export const CONTROL_COLUMN = [
  { operation: "read-work-item", cell: { kind: "same-as-reference" as const } },
  ...CONTROL_CONTRACT.capabilities.declaredGaps.map((gap) => ({
    operation: gap.operation,
    cell: { kind: "gap" as const, reason: gap.reason },
  })),
];

/** The control's six family postures; all covered by its own trap catalog. */
export const CONTROL_FAMILY_ACCOUNTING = [
  "auth-shape",
  "transport-failure",
  "rate-limit",
  "payload-shape",
  "workflow-state-mismatch",
  "pagination-truncation",
].map((family) => ({ family, posture: "covered" as const }));
