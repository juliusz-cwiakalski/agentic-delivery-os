/**
 * The one shared harness-neutral classifier (GH-233 F-2, DEC-10, NFR-8).
 *
 * A pure function over the neutral evidence type only. It imports the
 * delivery-result taxonomy (never re-declares it) and resolves the derivation
 * class from the taxonomy row, so adapters cannot carry divergent
 * classification logic. No harness-kind comparison and no token literal exists
 * in this module.
 */
import {
  DELIVERY_RESULT_TAXONOMY,
  type DeliveryResultDerivationClass,
  type DeliveryResultToken,
  HARNESS_CLASSIFICATION_TOKENS,
  type HarnessClassification,
  type HarnessEvidence,
  type HarnessOutcome,
} from "#contracts";

const derivationOf = (token: DeliveryResultToken): DeliveryResultDerivationClass => {
  const row = DELIVERY_RESULT_TAXONOMY.find((entry) => entry.token === token);
  if (row === undefined) throw new Error(`delivery-result token ${token} is not in the taxonomy`);
  return row.derivationClass;
};

const classification = (
  outcome: HarnessOutcome,
  token: DeliveryResultToken,
): HarnessClassification => ({
  outcome,
  token,
  derivationClass: derivationOf(token),
});

/**
 * Classify adapter-normalized evidence.
 *
 * Order is structural: a spawn refusal and a timeout are terminal before any
 * exit is read; a non-zero exit or reported failure is a failure; a completion
 * marker separates completion from premature end. Premature end never collapses
 * into completed or failed.
 */
export const classifyHarnessEvidence = (evidence: HarnessEvidence): HarnessClassification => {
  if (evidence.spawnRefused) {
    return classification("refused", HARNESS_CLASSIFICATION_TOKENS.refused);
  }
  if (evidence.timedOut) {
    return classification("timed-out", HARNESS_CLASSIFICATION_TOKENS["timed-out"]);
  }
  if (evidence.exitStatus !== null && evidence.exitStatus !== 0) {
    return classification("failed", HARNESS_CLASSIFICATION_TOKENS.failed);
  }
  if (evidence.failureReported) {
    return classification("failed", HARNESS_CLASSIFICATION_TOKENS.failed);
  }
  if (evidence.completionMarker) {
    return evidence.toolFailure
      ? classification("completed", HARNESS_CLASSIFICATION_TOKENS["completed-with-tool-failure"])
      : classification("completed", HARNESS_CLASSIFICATION_TOKENS.completed);
  }
  return classification("premature-end", HARNESS_CLASSIFICATION_TOKENS["premature-end"]);
};
