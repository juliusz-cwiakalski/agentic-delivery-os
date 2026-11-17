/**
 * Pure supervision classification (GH-295 F-2, F-3, F-4, DEC-1, DEC-4, DEC-5).
 *
 * Everything here is a deterministic function of artifact facts and the
 * injected instant: no I/O, clock, randomness, process, or environment access.
 * The tri-state derivation delegates the advancing/stale decision to the
 * delivered lane classification instead of declaring a second predicate, and
 * `stalled` requires the full corroboration combination.
 */
import {
  SUPERVISION_CORROBORATION_BOUND_MS,
  SUPERVISION_LANE_CAP,
  SUPERVISION_MAX_EVIDENCE_BYTES,
  SUPERVISION_STATE_FROM_DAEMON_LIVENESS,
  type SupervisionActionEntry,
  type SupervisionClassificationInput,
  type SupervisionCounts,
  type SupervisionEvidence,
  type SupervisionEvidenceCode,
  type SupervisionLaneEntry,
  type SupervisionState,
  type SupervisionSupervisorEntry,
} from "#contracts";
import { classifyLaneProgress } from "./daemon-lane.js";

/** One classification plus the evidence that decided it. */
export type SupervisionClassification = {
  readonly state: SupervisionState;
  readonly evidence: readonly SupervisionEvidence[];
};

const isInstant = (value: string | undefined): value is string =>
  value !== undefined && Number.isFinite(Date.parse(value));

const ageOf = (instant: string, nowMs: number): number => nowMs - Date.parse(instant);

/** Whether an instant falls inside the declared observation span (inclusive). */
const withinSpan = (instant: string | undefined, nowMs: number): boolean =>
  isInstant(instant) && ageOf(instant, nowMs) <= SUPERVISION_CORROBORATION_BOUND_MS;

const observedAcrossSpan = (first: string | undefined, nowMs: number): boolean =>
  isInstant(first) && ageOf(first, nowMs) >= SUPERVISION_CORROBORATION_BOUND_MS;

const spanStartIso = (nowMs: number): string =>
  new Date(Math.max(0, nowMs - SUPERVISION_CORROBORATION_BOUND_MS)).toISOString();

const evidence = (
  code: SupervisionEvidenceCode,
  extra: Omit<SupervisionEvidence, "code"> = {},
): SupervisionEvidence => ({ code, ...extra });

/**
 * Classify one lane or supervision claim from its artifact facts (AC-F2-1,
 * AC-F3-1, AC-F4-1).
 *
 * - any advancing artifact inside the span reads `progressing` (prefill-safe);
 * - a fresh heartbeat without advancing artifacts reads `progressing` (the
 *   delivered partial reading);
 * - an aged heartbeat, or a heartbeat trail spanning the whole observation
 *   window, with a flat artifact trail reads `stalled` (lying liveness);
 * - absent sources read `unknown`, never a guessed verdict.
 */
export const classifySupervision = (
  input: SupervisionClassificationInput,
  nowMs: number,
): SupervisionClassification => {
  const scope = input.ref === undefined ? {} : { ref: input.ref };
  const spanEvidence = evidence("observation-span", {
    ...scope,
    instant: spanStartIso(nowMs),
  });
  const boundEvidence = evidence("bound-applied", {
    ...scope,
    recordKind: "watchdog.stall-bound",
    instant: spanStartIso(nowMs),
  });

  if (!input.sourcePresent) {
    return {
      state: SUPERVISION_STATE_FROM_DAEMON_LIVENESS.unknown,
      evidence: boundEvidenceList([
        evidence("artifact-source-absent", { ...scope, recordKind: input.claimKind }),
        boundEvidence,
      ]),
    };
  }

  const artifactAdvancing =
    input.artifactAdvancing || input.artifactInstants.some((instant) => withinSpan(instant, nowMs));
  const heartbeatPresent = isInstant(input.lastHeartbeatAt);
  const heartbeatFresh =
    heartbeatPresent && ageOf(input.lastHeartbeatAt, nowMs) < SUPERVISION_CORROBORATION_BOUND_MS;
  const liesAcrossSpan = observedAcrossSpan(input.firstHeartbeatAt, nowMs);
  const corroborated =
    heartbeatPresent && !artifactAdvancing && (liesAcrossSpan || !heartbeatFresh);

  const delivered = classifyLaneProgress({
    tokenDelta: artifactAdvancing ? 1 : 0,
    // A heartbeat trail that spans the observation window while artifacts stay
    // flat is the lying-liveness cell: freshness alone is not progress there.
    traffic: heartbeatFresh && !liesAcrossSpan ? 1 : 0,
    corroborated,
  });
  const state = SUPERVISION_STATE_FROM_DAEMON_LIVENESS[delivered];

  const facts: SupervisionEvidence[] = [];
  if (heartbeatPresent && input.lastHeartbeatAt !== undefined) {
    facts.push(
      evidence(heartbeatFresh ? "artifact-heartbeat-fresh" : "artifact-heartbeat-aged", {
        ...scope,
        recordKind: "daemon.heartbeat",
        instant: input.lastHeartbeatAt,
      }),
    );
  } else {
    facts.push(evidence("artifact-source-absent", { ...scope, recordKind: "daemon.heartbeat" }));
  }
  if (artifactAdvancing) {
    const advancingInstant = input.artifactInstants.find((instant) => withinSpan(instant, nowMs));
    facts.push(
      evidence("artifact-progress", {
        ...scope,
        recordKind: input.artifactClasses[0] ?? "artifact-trail",
        ...(advancingInstant === undefined ? {} : { instant: advancingInstant }),
      }),
    );
  } else {
    facts.push(
      evidence("artifact-flat", {
        ...scope,
        recordKind: input.artifactClasses[0] ?? "artifact-trail",
      }),
    );
  }
  if (liesAcrossSpan) facts.push(spanEvidence);
  return { state, evidence: boundEvidenceList([...facts, boundEvidence]) };
};

/** Bound one evidence list to the delivered byte cap with a declared marker. */
export const boundSupervisionEvidence = (
  entries: readonly SupervisionEvidence[],
): readonly SupervisionEvidence[] => {
  const kept = [...entries];
  const size = (): number => new TextEncoder().encode(JSON.stringify(kept)).length;
  while (kept.length > 1 && size() > SUPERVISION_MAX_EVIDENCE_BYTES) kept.pop();
  if (kept.length < entries.length) kept.push({ code: "evidence-truncated" });
  return kept;
};

const boundEvidenceList = (
  entries: readonly SupervisionEvidence[],
): readonly SupervisionEvidence[] => boundSupervisionEvidence(entries);

/** The declared state count over one population; never a copied number. */
const countStates = (
  states: readonly SupervisionState[],
): Pick<SupervisionCounts, "progressing" | "stalled" | "unknown"> => ({
  progressing: states.filter((state) => state === "progressing").length,
  stalled: states.filter((state) => state === "stalled").length,
  unknown: states.filter((state) => state === "unknown").length,
});

/** Build the report counts from the entries actually emitted (DM-1). */
export const summarizeSupervision = (input: {
  readonly lanes: readonly SupervisionLaneEntry[];
  readonly supervisors: readonly SupervisionSupervisorEntry[];
  readonly actions: readonly SupervisionActionEntry[];
  readonly parked: number;
}): SupervisionCounts => ({
  lanes: input.lanes.length,
  ...countStates(input.lanes.map((lane) => lane.classification)),
  supervisors: input.supervisors.length,
  actions: input.actions.length,
  parked: input.parked,
});

/** The report's lane bound: 200 entries plus the named truncation reason (NFR-4). */
export const boundSupervisionLanes = <T>(
  lanes: readonly T[],
): { readonly lanes: readonly T[]; readonly truncated: boolean } =>
  lanes.length <= SUPERVISION_LANE_CAP
    ? { lanes: [...lanes], truncated: false }
    : { lanes: lanes.slice(0, SUPERVISION_LANE_CAP), truncated: true };
