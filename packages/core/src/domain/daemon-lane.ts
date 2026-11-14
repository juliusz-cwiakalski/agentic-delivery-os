/**
 * The lane execution state machine and liveness shaping (GH-238 F-9; DM-3,
 * DM-16; AC-F9-1, AC-F9-2; TC-LANE-004..006).
 *
 * The daemon execution set is distinct from the delivered six-value lane
 * projection. A prefilling or resuming session with rising token delta or
 * traffic is `progressing`; only a fully corroborated stall applies the
 * delivered `watchdog.liveness-stalled` classification.
 */
import type {
  DaemonLaneClassification,
  DaemonLaneLivenessClassification,
  DaemonLaneRecord,
  DaemonLaneState,
  DaemonResumeIntent,
} from "#contracts";

export type LaneProgressInput = {
  readonly tokenDelta: number;
  readonly traffic: number;
  readonly prefillOrResume?: boolean;
  /** Every declared progress source agreed there was no progress. */
  readonly corroborated?: boolean;
};

export const classifyLaneProgress = (
  input: LaneProgressInput,
): DaemonLaneLivenessClassification => {
  if (input.tokenDelta > 0 || input.traffic > 0) return "progressing";
  if (input.prefillOrResume === true) return "progressing";
  if (input.corroborated === true) return "stalled";
  return "unknown";
};

export type LaneShapingInput = {
  readonly ref: string;
  readonly state: DaemonLaneState;
  readonly harnessKind?: string;
  readonly sessionId?: string;
  readonly processId?: number;
  readonly ledgerPosition?: { readonly lastCompletedPhase: string };
  readonly spawnOrdinal: number;
  readonly liveness?:
    | DaemonLaneLivenessClassification
    | { readonly classification: DaemonLaneLivenessClassification; readonly observedAt: string };
  readonly observedAt?: string;
  readonly detachedAt?: string;
  readonly classification?: DaemonLaneClassification;
  readonly resumeIntent?: DaemonResumeIntent;
  /** The nominated provider profile (GH-294 DM-2); absent keeps the delivered shape. */
  readonly providerProfile?: string;
  readonly recordedAt: string;
};

export const shapeDaemonLane = (input: LaneShapingInput): DaemonLaneRecord => ({
  schema: "delivery.daemon.lane.v1",
  ref: input.ref,
  state: input.state,
  ...(input.harnessKind === undefined ? {} : { harnessKind: input.harnessKind }),
  ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
  ...(input.processId === undefined ? {} : { processId: input.processId }),
  ...(input.ledgerPosition === undefined ? {} : { ledgerPosition: input.ledgerPosition }),
  spawnOrdinal: input.spawnOrdinal,
  ...(input.liveness === undefined
    ? {}
    : {
        liveness:
          typeof input.liveness === "string"
            ? { classification: input.liveness, observedAt: input.observedAt ?? input.recordedAt }
            : input.liveness,
      }),
  ...(input.detachedAt === undefined ? {} : { detachedAt: input.detachedAt }),
  ...(input.classification === undefined ? {} : { classification: input.classification }),
  ...(input.resumeIntent === undefined ? {} : { resumeIntent: input.resumeIntent }),
  ...(input.providerProfile === undefined ? {} : { providerProfile: input.providerProfile }),
  recordedAt: input.recordedAt,
});

/** The next spawn ordinal for one ref (monotone, never reset by a restart). */
export const nextSpawnOrdinal = (lane: DaemonLaneRecord | undefined): number =>
  lane === undefined ? 1 : lane.spawnOrdinal + 1;
