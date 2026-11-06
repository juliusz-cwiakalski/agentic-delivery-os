/**
 * Deterministic safety classification (GH-227 F-5, DEC-5, NFR-7).
 *
 * Safety is never AI. Secret suspicion STOPs the operation as a user identity
 * naming the finding class only; scanner unavailability fails closed as a
 * platform identity. Forbidden-path and binary exclusions are staging policy,
 * not STOP findings, and are disclosed by the staging plan.
 */
import type { CommitSafetyFinding, CommitSafetyOutcome } from "#contracts";

/** The closed STOP finding classes: only secret suspicion halts the act. */
const STOP_CLASSES: ReadonlySet<CommitSafetyFinding["class"]> = new Set([
  "secret-content",
  "secret-filename",
]);

/** The safety verdict the atomic act consumes. */
export type CommitSafetyVerdict =
  | {
      readonly ok: true;
      readonly completed: true;
      readonly findings: readonly CommitSafetyFinding[];
    }
  | {
      readonly ok: false;
      readonly code: "commit.safety.secret-suspected";
      readonly findings: readonly CommitSafetyFinding[];
    }
  | {
      readonly ok: false;
      readonly code: "commit.safety.scan-unavailable";
      readonly detail: string;
    };

/** The finding classes named in an output; material is never included. */
export const findingClasses = (
  findings: readonly CommitSafetyFinding[],
): readonly string[] => [...new Set(findings.map((finding) => finding.class))].sort();

/** Classify a scanner outcome without ever carrying the material. */
export const classifyCommitSafety = (outcome: CommitSafetyOutcome): CommitSafetyVerdict => {
  if (!outcome.ok) return outcome;
  const stops = outcome.findings.filter((finding) => STOP_CLASSES.has(finding.class));
  if (stops.length > 0) {
    return { ok: false, code: "commit.safety.secret-suspected", findings: stops };
  }
  return { ok: true, completed: true, findings: outcome.findings };
};
