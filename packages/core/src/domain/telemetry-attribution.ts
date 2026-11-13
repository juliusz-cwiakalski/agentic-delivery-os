/**
 * The five-dimension telemetry attribution (GH-291 F-2, AC-F2-1, DM-1, RSK-3).
 *
 * Pure by construction: values arrive as arguments and the result is a value.
 * Every stored step carries ticket, repository, lane, agent role, and model.
 * The two attribution substrates the change consumes are injected as plain
 * read ports: the delivered session economics (session/run identity) and the
 * delivered command-audit identity (claimed agent role and lane). A dimension
 * the substrates cannot derive is `null` with a closed-vocabulary
 * `unattributable-step` warning naming it — never a guessed or defaulted value,
 * and never a silent omission.
 */
import type { TelemetryWarning } from "#contracts";

/** The claimed agent identity the delivered audit ledger records at spawn. */
export type TelemetryClaimedIdentity = {
  readonly agentRole: string | null;
  readonly lane: string | null;
};

/** One session identity as the delivered economics records carry it. */
export type TelemetrySessionIdentity = {
  readonly sessionId: string;
  readonly runId: string;
};

/** The input facts one step is attributed from. */
export type TelemetryAttributionInput = {
  readonly workItemRef: string;
  readonly runId: string;
  readonly sessionId: string;
  readonly repository: string | null;
  readonly model: string | null;
  readonly claimed: TelemetryClaimedIdentity;
};

/** The five attribution dimensions plus the degradation the step carries. */
export type TelemetryAttribution = {
  readonly ticket: string | null;
  readonly repository: string | null;
  readonly lane: string | null;
  readonly agentRole: string | null;
  readonly model: string | null;
  readonly warnings: readonly TelemetryWarning[];
};

/**
 * The injected attribution substrates.
 *
 * `readSessionIdentity` answers from the delivered session economics records;
 * `readClaimedIdentity` answers from the delivered command-audit ledger. Both
 * are read once per step, and nothing else is consulted: no new identity
 * source is invented for telemetry.
 */
export type TelemetryAttributionSubstrates = {
  readonly readSessionIdentity: (sessionId: string) => TelemetrySessionIdentity | undefined;
  readonly readClaimedIdentity: (runId: string) => TelemetryClaimedIdentity | undefined;
};

/** A present non-blank identity value; everything else is an absent dimension. */
export const attributedValue = (value: string | null | undefined): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const dimension = (
  value: string | null,
  field: string,
  warnings: TelemetryWarning[],
): string | null => {
  const normalized = attributedValue(value);
  if (normalized === null) warnings.push({ reason: "unattributable-step", field });
  return normalized;
};

/**
 * Attribute one step from its own identity facts.
 *
 * The ticket is the delivery's work-item ref, the repository is the checkout
 * identity, and the role/lane/model are supplied by the substrates or the
 * frame. An absent value is excluded and disclosed, never defaulted.
 */
export const attributeStep = (input: TelemetryAttributionInput): TelemetryAttribution => {
  const warnings: TelemetryWarning[] = [];
  return {
    ticket: dimension(input.workItemRef, "ticket", warnings),
    repository: dimension(input.repository, "repository", warnings),
    lane: dimension(input.claimed.lane, "lane", warnings),
    agentRole: dimension(input.claimed.agentRole, "agentRole", warnings),
    model: dimension(input.model, "model", warnings),
    warnings,
  };
};

/**
 * Join the two delivered substrates, then attribute one step.
 *
 * Each substrate is consulted exactly once with the step's own identity: the
 * economics port by session id, the audit port by run id. A substrate that
 * answers nothing leaves its dimensions absent; the join never substitutes a
 * value the substrate did not report.
 */
export const joinAttributionSubstrates = (
  input: {
    readonly workItemRef: string;
    readonly runId: string;
    readonly sessionId: string;
    readonly repository: string | null;
    readonly model: string | null;
  },
  substrates: TelemetryAttributionSubstrates,
): TelemetryAttribution => {
  const session = substrates.readSessionIdentity(input.sessionId);
  const claimed = substrates.readClaimedIdentity(session?.runId ?? input.runId);
  return attributeStep({
    workItemRef: input.workItemRef,
    runId: session?.runId ?? input.runId,
    sessionId: input.sessionId,
    repository: input.repository,
    model: input.model,
    claimed: claimed ?? { agentRole: null, lane: null },
  });
};
