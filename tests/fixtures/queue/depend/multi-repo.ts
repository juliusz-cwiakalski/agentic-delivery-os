/**
 * Multi-repository producer-root fixture for TC-DEPEND-003/004 (GH-237).
 *
 * Roots are recorded on entry records only; the port resolves a root's remote
 * and its own `merge.deploy-expectations`. The invocation root is never used.
 */
import type { QueueDeployExpectationPort } from "../../../../packages/cli/src/edge";
import { declareQueueEntry } from "../../../../packages/core/src/app/index";
import type {
  QueueCiFact,
  QueueCloseFact,
  QueueDeployFacts,
} from "../../../../packages/core/src/domain/queue-readiness";
import { NOW_ISO, type QueueEdgeHarness } from "../cli/harness";
import { ciSucceeded, observed } from "../schedule/harness";

export type ProducerConfig = {
  readonly normalizedRemote?: string;
  readonly deploy?:
    | { readonly ok: true; readonly declared: boolean; readonly steps: readonly string[] }
    | { readonly ok: false; readonly reason: "config-missing" | "config-invalid" };
};

/** Build the producer-root port over a root -> config map. */
export const producerPort = (
  repositories: Readonly<Record<string, ProducerConfig>>,
): QueueDeployExpectationPort => ({
  normalizedRemote: (root) => repositories[root]?.normalizedRemote,
  deployExpectations: (root) => {
    const repository = repositories[root];
    if (repository?.deploy === undefined) {
      return { ok: false, reason: "config-missing" };
    }
    return repository.deploy;
  },
});

/** Record one entry with its declaring checkout root (never rendered). */
export const seedEntry = (
  harness: QueueEdgeHarness,
  input: {
    readonly ref: string;
    readonly repository?: string;
    readonly repositoryRoot?: string;
    readonly priority?: number;
    readonly edges?: readonly string[];
  },
): void => {
  const result = declareQueueEntry(harness.composition.store, {
    ref: input.ref,
    ...(input.repository === undefined ? {} : { repository: input.repository }),
    ...(input.repositoryRoot === undefined ? {} : { repositoryRoot: input.repositoryRoot }),
    priority: input.priority ?? 1,
    ...(input.edges === undefined ? {} : { edges: input.edges }),
    recordedAt: NOW_ISO,
    fenceToken: `seed-${input.ref}`,
  });
  if (!result.ok) throw new Error(`seed entry ${input.ref} failed`);
};

type MutableFacts = {
  plans: Record<string, unknown>;
  workItems: Record<string, unknown>;
  ci: Record<string, QueueCiFact>;
  close: Record<string, QueueCloseFact>;
  deploy: QueueDeployFacts;
};

/** Seed a landed producer (repo-alpha) and a merge-ready consumer (repo-beta). */
export const seedDependFacts = (
  harness: QueueEdgeHarness,
  input: {
    readonly producerRef?: string;
    readonly consumerRef?: string;
    readonly verdict?: "verified" | "unknown" | "failed";
    readonly preResolvedExpectations?: QueueDeployFacts["expectations"];
  } = {},
): { readonly producerRef: string; readonly consumerRef: string } => {
  const producerRef = input.producerRef ?? "GH-300";
  const consumerRef = input.consumerRef ?? "GH-301";
  const facts = harness.factSource as unknown as MutableFacts;
  facts.workItems[producerRef] = observed({ deliveryState: "done" });
  facts.plans[producerRef] = { state: "valid", tier: "full" };
  facts.close[producerRef] = "none";
  facts.ci[producerRef] = ciSucceeded();
  facts.workItems[consumerRef] = observed({ deliveryState: "ready" });
  facts.plans[consumerRef] = { state: "valid", tier: "full" };
  facts.close[consumerRef] = "merge-ready";
  facts.ci[consumerRef] = ciSucceeded();
  facts.deploy = {
    expectations: input.preResolvedExpectations ?? {},
    verdicts: input.verdict === undefined ? {} : { [producerRef]: { verdict: input.verdict } },
  };
  return { producerRef, consumerRef };
};
