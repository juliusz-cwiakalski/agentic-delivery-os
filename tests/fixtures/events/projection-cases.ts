/**
 * The GH-290 projection cases (TC-EVT-088).
 *
 * One synthetic store view that drives the REAL projector through every declared
 * kind, plus the payload-key comparison the exact-key proof runs. The frames are
 * produced by `createEventProjector`, never scripted from the declaration, so a
 * hand-coded payload in the projection is compared against the declaration's own
 * field lists instead of against itself.
 */
import type { StateRecord } from "../../../packages/core/src/contracts/state";
import {
  createEventProjector,
  type ProjectedEvent,
} from "../../../packages/core/src/domain/event-projection";

let ordinal = 0;

const record = (kind: string, key: string, payload: Record<string, unknown>): StateRecord => {
  ordinal += 1;
  return {
    schemaVersion: "delivery.state.v1",
    kind,
    key,
    sequence: ordinal,
    checksum: `checksum-${ordinal}`,
    payload: payload as never,
  };
};

/** The declared payload field name without its `?` / `[]` adornment. */
export const payloadKey = (field: string): string =>
  field.replace(/[?]$/u, "").replace(/\[\]$/u, "");

/** A required declared field: present on every emitted payload of its kind. */
export const requiredFields = (fields: readonly string[]): readonly string[] =>
  fields.filter((field) => !field.endsWith("?")).map(payloadKey);

/** The optional declared fields: present only when the source record carries them. */
export const optionalFields = (fields: readonly string[]): readonly string[] =>
  fields.filter((field) => field.endsWith("?")).map(payloadKey);

export const RECORDED_AT = "2026-11-12T10:00:00.000Z";

/**
 * One record per declared source family, in one view, covering all sixteen
 * emitted kinds under v2. `remove` has no producer in v1, so no record here can
 * emit it (DEC-J). The peak-pause kinds project from seeded `queue.park`
 * episode records (GH-294): a parked-state peak-window record and its recovered
 * record, plus an owner-hold park for the classified-absence edge.
 */
export const projectionCaseRecords = (): readonly StateRecord[] => {
  ordinal = 0;
  const transitions = [
    {
      phaseId: "specification",
      operation: "complete",
      timestamp: "2026-11-12T10:00:01.000Z",
      outcome: "landed",
    },
    {
      phaseId: "specification",
      operation: "reopen",
      reason: "review-feedback",
      timestamp: "2026-11-12T10:00:02.000Z",
    },
  ];
  return [
    record("queue.entry", "queue.entries:GH-700", {
      schema: "delivery.queue.entry.v1",
      ref: "GH-700",
      repository: "github.com/example/repo",
      priority: 5,
      recordedAt: RECORDED_AT,
    }),
    record("queue.dependency", "queue.deps:GH-700:1", {
      schema: "delivery.queue.dependency.v1",
      ref: "GH-700",
      edges: ["GH-701"],
      recordedAt: RECORDED_AT,
    }),
    record("queue.lease", "queue.leases:L-1", {
      schema: "delivery.queue.lease.v1",
      leaseId: "L-1",
      repository: "github.com/example/repo",
      ref: "GH-700",
      holder: "lane-1",
      runner: "runner-1",
      weightClass: "standard",
      operation: "released",
      recordedAt: RECORDED_AT,
    }),
    record("queue.removal", "queue.removals:GH-700", {
      schema: "delivery.queue.removal.v1",
      ref: "GH-700",
      reason: "landed",
      recordedAt: RECORDED_AT,
    }),
    record("daemon.lane", "daemon.lanes:GH-700", {
      schema: "delivery.daemon.lane.v1",
      ref: "GH-700",
      state: "delivering",
      sessionId: "session-gh700",
      harnessKind: "opencode",
      spawnOrdinal: 1,
      recordedAt: RECORDED_AT,
    }),
    record("dispatch.attempt", "dispatch.attempt:ATT-700-refused", {
      schema: "delivery.dispatch.attempt.v1",
      attemptId: "ATT-700-refused",
      ref: "GH-700",
      repository: "github.com/example/repo",
      harness: "opencode",
      evidenceClass: "pilot",
      token: "failed",
      outcome: "refused",
      handoverState: "dual-run",
      comparison: { class: "not-applicable", token: null, outcome: "not-applicable" },
      falseSuccess: false,
      evidenceRefs: ["evidence-1"],
      startedAt: RECORDED_AT,
      finishedAt: RECORDED_AT,
      recordedAt: RECORDED_AT,
    }),
    record("dispatch.attempt", "dispatch.attempt:ATT-700-merged", {
      schema: "delivery.dispatch.attempt.v1",
      attemptId: "ATT-700-merged",
      ref: "GH-700",
      repository: "github.com/example/repo",
      harness: "opencode",
      evidenceClass: "pilot",
      token: "merged",
      outcome: "merged",
      handoverState: "dual-run",
      comparison: { class: "verify-change", token: "merged", outcome: "match" },
      falseSuccess: false,
      divergenceRef: "GH-701",
      evidenceRefs: ["evidence-1"],
      startedAt: RECORDED_AT,
      finishedAt: RECORDED_AT,
      recordedAt: RECORDED_AT,
    }),
    record("phase.transition", "phase.transitions:GH-290", {
      changeRef: "GH-290",
      phaseId: "specification",
      operation: "complete",
      timestamp: RECORDED_AT,
      outcome: "landed",
      transitions,
    }),
    record("blocker.question", "blocker.question:Q-1", {
      schemaId: "delivery.blocker.question.v1",
      id: "Q-1",
      type: "decision-needed",
      audience: "owner",
      lane: "GH-290",
      ref: null,
      question: "Which gate applies?",
      options: ["option-a", "option-b"],
      askedAt: RECORDED_AT,
    }),
    record("blocker.answer", "blocker.answer:Q-1", {
      schemaId: "delivery.blocker.answer.v1",
      questionId: "Q-1",
      answeringAudience: "owner",
      choice: "option-a",
      answeredAt: RECORDED_AT,
      applied: false,
      laneResume: {
        mode: "boundary-note",
        sessionReentry: false,
        capabilitySource: "adapter-declared",
      },
    }),
    record("daemon.lane", "daemon.lanes:GH-290", {
      schema: "delivery.daemon.lane.v1",
      ref: "GH-290",
      state: "delivering",
      sessionId: "session-gh290",
      harnessKind: "opencode",
      spawnOrdinal: 2,
      resumeIntent: { questionId: "Q-1", mode: "boundary-note" },
      recordedAt: RECORDED_AT,
    }),
    // GH-294 seeded episode records: the parked-state peak-window park emits
    // stop + parked + park-edge; the recovered record emits resumed.
    record("queue.park", "queue.parks:GH-700:peak", {
      schema: "delivery.queue.park.v1",
      ref: "GH-700",
      repository: "github.com/example/repo",
      cause: "peak-window",
      conditionType: "provider-window",
      condition: { kind: "peak-window", detail: "provider-a peak window active" },
      recheckMs: 60_000,
      evaluatedAt: RECORDED_AT,
      recoveryState: "parked",
      providerProfile: "profile-a",
      until: "2026-11-12T11:00:00.000Z",
      graceDeadline: "2026-11-12T10:05:00.000Z",
      windowEnd: "2026-11-12T11:00:00.000Z",
      stoppedAt: RECORDED_AT,
      preservation: "preserved",
      episodeId: "episode-700",
      recordedAt: RECORDED_AT,
    }),
    record("queue.park", "queue.parks:GH-701:hold", {
      schema: "delivery.queue.park.v1",
      ref: "GH-701",
      repository: "github.com/example/repo",
      cause: "owner-hold",
      conditionType: "preemption",
      condition: { kind: "owner-hold", detail: "owner hold active" },
      recheckMs: 60_000,
      evaluatedAt: RECORDED_AT,
      recoveryState: "parked",
      episodeId: "episode-701",
      recordedAt: RECORDED_AT,
    }),
  ];
};

/** The recovered peak-window park record: one view delta that emits `resumed`. */
export const recoveredParkRecord = (): readonly StateRecord[] => {
  // The ordinal continues from the case view (no reset): a park record's
  // recovery must carry a higher sequence than the parked-state record it
  // recovers, or the projection watermark would keep it pending.
  return [
    record("queue.park", "queue.parks:GH-700:peak", {
      schema: "delivery.queue.park.v1",
      ref: "GH-700",
      repository: "github.com/example/repo",
      cause: "peak-window",
      conditionType: "provider-window",
      condition: { kind: "peak-window", detail: "provider-a peak window active" },
      recheckMs: 60_000,
      evaluatedAt: RECORDED_AT,
      recoveryState: "recovered",
      recoveredAt: "2026-11-12T11:00:01.000Z",
      providerProfile: "profile-a",
      until: "2026-11-12T11:00:00.000Z",
      preservation: "preserved",
      sessionRef: "session-gh700",
      branch: "feat/GH-294/provider-peak-pausing",
      episodeId: "episode-700",
      recordedAt: RECORDED_AT,
    }),
  ];
};

/** Project the case view with the real projector (baseline then one projection). */
export const projectCaseEvents = (): readonly ProjectedEvent[] => {
  const projector = createEventProjector();
  projector.project([]);
  const first = projector.project(projectionCaseRecords());
  // The peak-pause episode's resumed frame projects from the recovered park
  // record in a second observation (the delivered watermark discipline).
  const second = projector.project(recoveredParkRecord());
  return [...first, ...second];
};

/** Index emitted events by `topic/kind`, keeping the first frame of each. */
export const eventsByKind = (
  events: readonly ProjectedEvent[],
): ReadonlyMap<string, ProjectedEvent> => {
  const byKind = new Map<string, ProjectedEvent>();
  for (const event of events) {
    const key = `${event.topic}/${event.kind}`;
    if (!byKind.has(key)) byKind.set(key, event);
  }
  return byKind;
};
