/**
 * The `status` tool engine half (F-2, AC-F2-1).
 *
 * Mirrors the CLI status handler orchestration exactly over the injected
 * readers: the same read order, the same digest aggregation, and the same
 * section semantics. Section-level failures remain digest data (`ok: true`);
 * only a containment-class failure escapes as a classified tool failure.
 */
import { aggregateStatus } from "@delivery-os/core";
import {
  type SpendDigestSection,
  STATUS_SOURCE_ITEM_LIMIT,
  STATUS_SOURCE_PIPELINE_LIMIT,
  type StatusDeliveryRequestRead,
  type StatusDigest,
  type StatusLocalContextRead,
  type StatusParkRead,
  type StatusPipelineRunRead,
  type StatusProviderConfigRead,
  type StatusRepositoryFacts,
  type StatusRepositoryTarget,
  type StatusWorkItemRead,
} from "@delivery-os/core/contracts";
import { failureFromValue, type McpToolResult } from "../output/payload.js";

/** Everything the status tool reads; all I/O is injected by the caller. */
export type StatusToolRuntime = {
  readonly readRepository: () => StatusRepositoryFacts;
  readonly readWorkItems: (
    target: StatusRepositoryTarget,
    limit: number,
  ) => Promise<StatusWorkItemRead>;
  readonly readDeliveryRequests: (
    target: StatusRepositoryTarget,
    limit: number,
  ) => Promise<StatusDeliveryRequestRead>;
  readonly readPipelineRuns: (sha: string, limit?: number) => Promise<StatusPipelineRunRead>;
  readonly readProviderConfig: () => StatusProviderConfigRead;
  readonly readProviderParks: (nowMs: number) => StatusParkRead;
  readonly readLocalContext: () => StatusLocalContextRead;
  /** The spend read projection; absent means the verified-empty observation. */
  readonly readSpend?: () => SpendDigestSection;
  readonly nowIso: () => string;
  readonly nowMs: () => number;
};

const unavailableRead = {
  ok: false,
  reason: "not-configured",
} as const;

/**
 * Collect the delivered status facts once, in the CLI collector's read order.
 * Two independent read gates: issues/pulls read whenever the binding is
 * observed; check-runs read only when the binding is observed and HEAD resolves.
 */
const collectStatusFacts = async (runtime: StatusToolRuntime) => {
  const repository = runtime.readRepository();
  let tracker: StatusWorkItemRead;
  let changes: StatusDeliveryRequestRead;
  let ci: StatusPipelineRunRead;
  if (repository.binding.state !== "observed") {
    tracker = unavailableRead;
    changes = unavailableRead;
    ci = unavailableRead;
  } else {
    const target: StatusRepositoryTarget = {
      owner: repository.binding.owner,
      name: repository.binding.name,
    };
    tracker = await runtime.readWorkItems(target, STATUS_SOURCE_ITEM_LIMIT);
    changes = await runtime.readDeliveryRequests(target, STATUS_SOURCE_ITEM_LIMIT);
    ci =
      repository.head.sha === undefined
        ? { ok: false, reason: "commit-unresolved" }
        : await runtime.readPipelineRuns(repository.head.sha, STATUS_SOURCE_PIPELINE_LIMIT);
  }
  const nowMs = runtime.nowMs();
  return {
    nowIso: runtime.nowIso(),
    nowMs,
    repository,
    tracker,
    changes,
    ci,
    providers: {
      config: runtime.readProviderConfig(),
      parks: runtime.readProviderParks(nowMs),
    },
    localContext: runtime.readLocalContext(),
    spend: runtime.readSpend?.() ?? { state: "observed", captured: false },
  };
};

/** Run one `status` tool call over the injected runtime. */
export const runStatusTool = async (
  runtime: StatusToolRuntime,
): Promise<McpToolResult<StatusDigest>> => {
  try {
    return { ok: true, data: aggregateStatus(await collectStatusFacts(runtime)) };
  } catch (thrown) {
    return failureFromValue(thrown);
  }
};
