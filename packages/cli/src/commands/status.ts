/**
 * The read-only `status` command definition (GH-175 F-1, D4).
 *
 * The handler owns no stream writes and chooses no exit code. Every source is
 * injected through `StatusCommandRuntime`; failures become digest evidence, not
 * command failures.
 */
import { aggregateStatus, renderStatusHuman } from "@delivery-os/core";
import {
  type BrandIdentity,
  STATUS_SOURCE_ITEM_LIMIT,
  STATUS_SOURCE_PIPELINE_LIMIT,
  type StatusDeliveryRequestRead,
  type StatusDigest,
  type StatusFacts,
  type StatusLocalContextRead,
  type StatusParkRead,
  type StatusPipelineRunRead,
  type StatusProviderConfigRead,
  type StatusRepositoryFacts,
  type StatusRepositoryTarget,
  type StatusWorkItemRead,
} from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";

/** Everything the status handler reads, injected at the edge. */
export type StatusCommandRuntime = {
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
  readonly nowIso: () => string;
  readonly nowMs: () => number;
};

const unavailableRead = {
  ok: false,
  reason: "not-configured",
} as const;

/** Build the `status` command definition over injected readers. */
export const createStatusCommandDefinition = (
  runtime: StatusCommandRuntime,
): CommandDefinition => ({
  flags: [],
  positionals: { max: 0 },
  humanText: (data: unknown, brand: BrandIdentity): string =>
    renderStatusHuman(data as StatusDigest, brand),
  handler: async () => {
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
    const facts: StatusFacts = {
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
    };
    return { data: aggregateStatus(facts) };
  },
});
