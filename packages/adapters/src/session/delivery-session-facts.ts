/**
 * Delivery-session facts source at the runtime edge (GH-227 DEC-6, F-1).
 *
 * The guard is mechanical: the edge injects the facts and the command refuses
 * when they say a delivery session is active. The harness one-shot's temporary
 * empty project context is deliberately not a delivery session (it supplies an
 * empty environment record).
 */
import type { CommitSessionFacts } from "@delivery-os/core/contracts";

/** The facts-source construction input; keys are supplied by the edge. */
export type DeliverySessionFactsInput = {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly keys: readonly string[];
};

/** Read the injected session facts; any non-empty key marks a session. */
export const createDeliverySessionFacts = (
  input: DeliverySessionFactsInput,
): CommitSessionFacts => {
  for (const key of input.keys) {
    const value = input.environment[key];
    if (typeof value === "string" && value.length > 0) {
      return { insideDeliverySession: true, sessionId: value };
    }
  }
  return { insideDeliverySession: false };
};
