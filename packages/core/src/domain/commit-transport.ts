/**
 * Ordered transport selection and classified failover (GH-227 F-4, DEC-3).
 *
 * The seam tries core-owned inference first, then the harness one-shot, then
 * the deterministic template. Selection consumes injected availability facts
 * (provider route, quota park, credentials) and configuration; a quota park
 * falls through without waiting. Zero model calls happen when no transport is
 * available or the template is selected.
 */
import type {
  CommitMessageDraft,
  CommitTokenSpend,
  CommitTransport,
  CommitTransportAvailability,
  CommitTransportOutcome,
  CommitTransportPort,
  CommitTransportRequest,
} from "#contracts";

/** The ordered selection plus the classified failover reasons. */
export type CommitTransportSelection = {
  readonly selected: "core-inference" | "harness-one-shot" | "none";
  readonly failover: readonly { readonly transport: CommitTransport; readonly reason: string }[];
};

/** Select the first available transport without waiting on a park window. */
export const selectCommitTransport = (
  availability: CommitTransportAvailability,
): CommitTransportSelection => {
  const failover: { transport: CommitTransport; reason: string }[] = [];
  if (
    availability.coreInference.available &&
    availability.coreInference.parkedUntil === undefined
  ) {
    return { selected: "core-inference", failover };
  }
  failover.push({
    transport: "core-inference",
    reason:
      availability.coreInference.reason ??
      (availability.coreInference.parkedUntil === undefined ? "unavailable" : "quota-parked"),
  });
  if (availability.harnessOneShot.available) {
    return { selected: "harness-one-shot", failover };
  }
  failover.push({
    transport: "harness-one-shot",
    reason: availability.harnessOneShot.reason ?? "unavailable",
  });
  return { selected: "none", failover };
};

/** The injectable ports for one generation attempt chain. */
export type CommitTransportPorts = {
  readonly coreInference?: CommitTransportPort;
  readonly harnessOneShot?: CommitTransportPort;
};

/** One generation result: model or template, with failover evidence. */
export type CommitGeneration =
  | {
      readonly source: "model";
      readonly transport: Exclude<CommitTransport, "none">;
      readonly message: CommitMessageDraft;
      readonly tokenSpend: CommitTokenSpend;
      readonly failover: CommitTransportSelection["failover"];
    }
  | {
      readonly source: "template";
      readonly transport: "none";
      readonly tokenSpend: CommitTokenSpend;
      readonly failover: readonly {
        readonly transport: CommitTransport;
        readonly reason: string;
      }[];
    };

const ZERO_SPEND: CommitTokenSpend = { inputTokens: 0, outputTokens: 0 };

const failure = (outcome: CommitTransportOutcome): { readonly reason: string } =>
  outcome.ok ? { reason: "invalid-response" } : { reason: outcome.code };

/**
 * Generate through the seam. A failing transport fails over to the next
 * available one; an exhausted chain returns the template without a model call.
 */
export const generateCommitMessage = async (input: {
  readonly request: CommitTransportRequest;
  readonly ports: CommitTransportPorts;
  readonly availability: CommitTransportAvailability;
}): Promise<CommitGeneration> => {
  const selection = selectCommitTransport(input.availability);
  const failover = [...selection.failover];
  if (selection.selected === "none") {
    return { source: "template", transport: "none", tokenSpend: ZERO_SPEND, failover };
  }
  if (selection.selected === "core-inference") {
    const port = input.ports.coreInference;
    if (port === undefined) {
      failover.push({ transport: "core-inference", reason: "not-constructed" });
    } else {
      const outcome = await port.generate(input.request);
      if (outcome.ok) {
        return {
          source: "model",
          transport: "core-inference",
          message: outcome.message,
          tokenSpend: outcome.tokenSpend,
          failover,
        };
      }
      failover.push({ transport: "core-inference", reason: failure(outcome).reason });
    }
  }
  const harness = input.availability.harnessOneShot.available
    ? input.ports.harnessOneShot
    : undefined;
  if (harness !== undefined) {
    const outcome = await harness.generate(input.request);
    if (outcome.ok) {
      return {
        source: "model",
        transport: "harness-one-shot",
        message: outcome.message,
        tokenSpend: outcome.tokenSpend,
        failover,
      };
    }
    failover.push({ transport: "harness-one-shot", reason: failure(outcome).reason });
  } else if (input.availability.harnessOneShot.available) {
    failover.push({ transport: "harness-one-shot", reason: "not-constructed" });
  }
  return { source: "template", transport: "none", tokenSpend: ZERO_SPEND, failover };
};
