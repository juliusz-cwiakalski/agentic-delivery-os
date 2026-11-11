/**
 * The event projection (GH-290 F-3, F-4; DM-2, DM-5, DM-9; DEC-D, DEC-I, DEC-J, DEC-O).
 *
 * Pure over the store view it is handed: one `readRecords()` result in, the
 * projected events out. It performs no read, no write, no clock call, and no
 * I/O. Sequence values are allocated once per emitted event per `(topic, lane)`
 * by this process, so a restart is a declared discontinuity. A per-
 * `(topic, lane, source family)` watermark keeps an unemitted delta pending
 * rather than dropped or buffered, and the `phase.state` family's identity is a
 * position inside the change's cumulative verified artifact.
 */
import {
  BLOCKER_MAX_ANSWER_CHARS,
  BLOCKER_MAX_OPTION_CHARS,
  BLOCKER_MAX_OPTIONS,
  BLOCKER_MAX_QUESTION_CHARS,
  DISPATCH_MAX_EVIDENCE_REFS,
  QUEUE_MAX_EDGES_PER_ENTRY,
  QUEUE_MAX_REF_CHARS,
  type StateRecord,
  TAXONOMY_VERSION,
} from "#contracts";

/** The four event topics. */
export const EVENT_TOPICS = [
  "queue.graph",
  "dispatch.attempt",
  "phase.state",
  "blockers.state",
] as const;
export type EventTopic = (typeof EVENT_TOPICS)[number];

/** The declared per-topic per-publish-tick cap (NFR-3). */
export const EVENT_PROJECTION_MAX_PER_TOPIC_PER_TICK = 64;

/** One projected event: exactly the eight declared frame fields, in order. */
export type ProjectedEvent = {
  readonly topic: EventTopic;
  readonly kind: string;
  readonly lane: string;
  readonly ref: string | null;
  readonly sequence: number;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly taxonomyVersion: string;
};

/** One observed watermark position: the last emitted source position. */
export type ProjectionWatermarkEntry = {
  readonly topic: EventTopic;
  readonly lane: string;
  readonly family: string;
  /** The source record's key (or the cumulative artifact's key). */
  readonly key: string;
  /** The record's sequence position, or the last emitted transition index. */
  readonly position: number;
};

/** The projection surface the publish path drives. */
export type EventProjector = {
  /** Project every change observed after the previous call (first call baselines). */
  readonly project: (records: readonly StateRecord[]) => readonly ProjectedEvent[];
  /** The current bounded watermark, one entry per observed pair. */
  readonly watermark: () => readonly ProjectionWatermarkEntry[];
  /** Whether the first (baseline) observation already happened. */
  readonly baselined: () => boolean;
};

export type EventProjectorOptions = {
  readonly maxPerTopicPerTick?: number;
  readonly workingMemory?: { readonly _?: never };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const str = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const optionalStr = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const strings = (value: unknown, cap: number): readonly string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string").slice(0, cap)
    : [];

const bounded = (value: string, max: number): string => value.slice(0, max);

type Candidate = {
  readonly order: number;
  readonly sub: number;
  readonly topic: EventTopic;
  readonly family: string;
  readonly lane: string;
  readonly key: string;
  readonly position: number;
  readonly kind: string;
  readonly ref: string | null;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
  /** How many frames this unit emits atomically (a phase pair emits two). */
  readonly groupSize?: number;
  /** Applied only when the candidate is emitted or deliberately skipped. */
  readonly commit: () => void;
};

type Family = {
  readonly topic: EventTopic;
  readonly family: string;
  readonly lane: string;
  readonly key: string;
};

const watermarkKey = (family: Family): string => `${family.topic}|${family.lane}|${family.family}`;

const sequenceKey = (topic: EventTopic, lane: string): string => `${topic}|${lane}`;

/** The canonical `{topic, kind, lane, ref, sequence, occurredAt, payload, taxonomyVersion}` shape. */
const frameOf = (candidate: Candidate, sequence: number): ProjectedEvent => ({
  topic: candidate.topic,
  kind: candidate.kind,
  lane: candidate.lane,
  ref: candidate.ref,
  sequence,
  occurredAt: candidate.occurredAt,
  payload: candidate.payload,
  taxonomyVersion: TAXONOMY_VERSION,
});

const sameEdgeSet = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((edge) => right.includes(edge));

/**
 * Build one projector. Every call is a publish-tick observation; the first call
 * initialises the watermark to the view's tail so a populated store is a
 * baseline, never a replay.
 */
export const createEventProjector = (options: EventProjectorOptions = {}): EventProjector => {
  const maxPerTopic = options.maxPerTopicPerTick ?? EVENT_PROJECTION_MAX_PER_TOPIC_PER_TICK;
  const sequences = new Map<string, number>();
  const watermark = new Map<string, { key: string; position: number }>();
  const lastEdges = new Map<string, readonly string[]>();
  let primed = false;

  const positionsOf = (): readonly ProjectionWatermarkEntry[] =>
    [...watermark.entries()]
      .map(([composite, value]) => {
        const [topic, lane, family] = composite.split("|") as [EventTopic, string, string];
        return { topic, lane, family, key: value.key, position: value.position };
      })
      .sort((left, right) => {
        const topicOrder = EVENT_TOPICS.indexOf(left.topic) - EVENT_TOPICS.indexOf(right.topic);
        if (topicOrder !== 0) return topicOrder;
        if (left.lane !== right.lane) return left.lane < right.lane ? -1 : 1;
        return left.family < right.family ? -1 : 1;
      });

  const known = (family: Family): { key: string; position: number } | undefined =>
    watermark.get(watermarkKey(family));

  const remember = (family: Family, key: string, position: number): void => {
    watermark.set(watermarkKey(family), { key, position });
  };

  const nextSequence = (topic: EventTopic, lane: string): number => {
    const key = sequenceKey(topic, lane);
    const next = (sequences.get(key) ?? 0) + 1;
    sequences.set(key, next);
    return next;
  };

  return {
    baselined: () => primed,
    watermark: positionsOf,
    project: (records) => {
      const questions = new Map<string, Record<string, unknown>>();
      for (const record of records) {
        if (record.kind === "blocker.question" && isRecord(record.payload)) {
          const id = str(record.payload.id);
          if (id.length > 0) questions.set(id, record.payload);
        }
      }

      const entering: Candidate[] = [];
      for (const record of records) {
        const address = (topic: EventTopic, family: string, lane: string): Family => ({
          topic,
          family,
          lane,
          key: record.key,
        });
        const payload = isRecord(record.payload) ? record.payload : {};

        if (record.kind === "queue.entry") {
          const lane = bounded(str(payload.ref), QUEUE_MAX_REF_CHARS);
          if (lane.length === 0) continue;
          const family = address("queue.graph", "queue.entry", lane);
          entering.push({
            order: record.sequence,
            sub: 0,
            topic: "queue.graph",
            family: "queue.entry",
            lane,
            key: record.key,
            position: record.sequence,
            kind: "entry",
            ref: lane,
            occurredAt: str(payload.recordedAt),
            payload: {
              ref: lane,
              ...(optionalStr(payload.repository) === undefined
                ? {}
                : { repository: optionalStr(payload.repository) }),
              priority: typeof payload.priority === "number" ? payload.priority : 0,
              recordedAt: str(payload.recordedAt),
            },
            commit: () => remember(family, record.key, record.sequence),
          });
          continue;
        }

        if (record.kind === "queue.dependency") {
          const lane = bounded(str(payload.ref), QUEUE_MAX_REF_CHARS);
          if (lane.length === 0) continue;
          const edges = strings(payload.edges, QUEUE_MAX_EDGES_PER_ENTRY).map((edge) =>
            bounded(edge, QUEUE_MAX_REF_CHARS),
          );
          const family = address("queue.graph", "queue.dependency", lane);
          const prior = lastEdges.get(lane) ?? [];
          const previous = [...prior];
          const added = edges.filter((edge) => !previous.includes(edge));
          const removed = previous.filter((edge) => !edges.includes(edge));
          const unchanged = sameEdgeSet(edges, previous);
          entering.push({
            order: record.sequence,
            sub: 1,
            topic: "queue.graph",
            family: "queue.dependency",
            lane,
            key: record.key,
            position: record.sequence,
            kind: "dependency-edge",
            ref: lane,
            occurredAt: str(payload.recordedAt),
            payload: {
              ref: lane,
              edges,
              added,
              removed,
              recordedAt: str(payload.recordedAt),
            },
            commit: () => {
              lastEdges.set(lane, edges);
              remember(family, record.key, record.sequence);
            },
            // An identical folded edge set publishes nothing but still advances
            // the watermark, so the same record is not reconsidered.
            ...(unchanged ? { suppressed: true } : {}),
          } as Candidate & { suppressed?: boolean });
          continue;
        }

        if (record.kind === "queue.lease") {
          if (payload.operation !== "released") continue;
          const lane = bounded(str(payload.ref), QUEUE_MAX_REF_CHARS);
          if (lane.length === 0) continue;
          const family = address("queue.graph", "queue.lease", lane);
          entering.push({
            order: record.sequence,
            sub: 2,
            topic: "queue.graph",
            family: "queue.lease",
            lane,
            key: record.key,
            position: record.sequence,
            kind: "release",
            ref: lane,
            occurredAt: str(payload.recordedAt),
            payload: {
              leaseId: str(payload.leaseId),
              repository: str(payload.repository),
              ref: lane,
              holder: str(payload.holder),
              runner: str(payload.runner),
              weightClass: str(payload.weightClass),
              operation: "released",
              recordedAt: str(payload.recordedAt),
            },
            commit: () => remember(family, record.key, record.sequence),
          });
          continue;
        }

        if (record.kind === "daemon.lane") {
          const lane = bounded(str(payload.ref), QUEUE_MAX_REF_CHARS);
          if (payload.state === "delivering" && lane.length > 0) {
            const family = address("dispatch.attempt", "daemon.lane", lane);
            entering.push({
              order: record.sequence,
              sub: 3,
              topic: "dispatch.attempt",
              family: "daemon.lane",
              lane,
              key: record.key,
              position: record.sequence,
              kind: "started",
              ref: lane,
              occurredAt: str(payload.recordedAt),
              payload: {
                ref: lane,
                spawnOrdinal: typeof payload.spawnOrdinal === "number" ? payload.spawnOrdinal : 0,
                ...(optionalStr(payload.sessionId) === undefined
                  ? {}
                  : { sessionId: optionalStr(payload.sessionId) }),
                ...(optionalStr(payload.harnessKind) === undefined
                  ? {}
                  : { harnessKind: optionalStr(payload.harnessKind) }),
                recordedAt: str(payload.recordedAt),
              },
              commit: () => remember(family, record.key, record.sequence),
            });
          }
          if (isRecord(payload.resumeIntent)) {
            const question = questions.get(str(payload.resumeIntent.questionId));
            if (question !== undefined) {
              const questionLane = bounded(str(question.lane), QUEUE_MAX_REF_CHARS);
              if (questionLane.length > 0) {
                const clearedFamily = address("blockers.state", "daemon.lane", questionLane);
                entering.push({
                  order: record.sequence,
                  sub: 8,
                  topic: "blockers.state",
                  family: "daemon.lane",
                  lane: questionLane,
                  key: record.key,
                  position: record.sequence,
                  kind: "cleared",
                  ref: optionalStr(question.ref) ?? null,
                  occurredAt: str(payload.recordedAt),
                  payload: {
                    id: str(payload.resumeIntent.questionId),
                    lane: questionLane,
                    resumeMode: str(payload.resumeIntent.mode),
                    clearedAt: str(payload.recordedAt),
                  },
                  commit: () => remember(clearedFamily, record.key, record.sequence),
                });
              }
            }
          }
          continue;
        }

        if (record.kind === "dispatch.attempt") {
          const lane = bounded(str(payload.ref), QUEUE_MAX_REF_CHARS);
          if (lane.length === 0) continue;
          const family = address("dispatch.attempt", "dispatch.attempt", lane);
          const refused = payload.outcome === "refused";
          const evidenceRefs = strings(payload.evidenceRefs, DISPATCH_MAX_EVIDENCE_REFS);
          const comparison = isRecord(payload.comparison) ? payload.comparison : {};
          entering.push({
            order: record.sequence,
            sub: 4,
            topic: "dispatch.attempt",
            family: "dispatch.attempt",
            lane,
            key: record.key,
            position: record.sequence,
            kind: refused ? "refused" : "completed",
            ref: lane,
            occurredAt: str(payload.recordedAt),
            payload: refused
              ? {
                  attemptId: str(payload.attemptId),
                  ref: lane,
                  repository: str(payload.repository),
                  harness: str(payload.harness),
                  evidenceClass: str(payload.evidenceClass),
                  token: str(payload.token),
                  startedAt: str(payload.startedAt),
                  finishedAt: str(payload.finishedAt),
                  evidenceRefs,
                }
              : {
                  attemptId: str(payload.attemptId),
                  ref: lane,
                  token: str(payload.token),
                  outcome: str(payload.outcome),
                  handoverState: str(payload.handoverState),
                  comparisonClass: str(comparison.class),
                  falseSuccess: payload.falseSuccess === true,
                  ...(optionalStr(payload.divergenceRef) === undefined
                    ? {}
                    : { divergenceRef: optionalStr(payload.divergenceRef) }),
                  finishedAt: str(payload.finishedAt),
                },
            commit: () => remember(family, record.key, record.sequence),
          });
          continue;
        }

        if (record.kind === "phase.transition" && Array.isArray(payload.transitions)) {
          const changeRef = bounded(str(payload.changeRef), QUEUE_MAX_REF_CHARS);
          const transitions = payload.transitions;
          const lane = changeRef.length > 0 ? changeRef : "";
          if (lane.length === 0) continue;
          const family = address("phase.state", "phase.transition", lane);
          const before = known(family);
          const start = before === undefined || before.key !== record.key ? 0 : before.position + 1;
          const lastIndex = transitions.length - 1;
          for (let index = start; index <= lastIndex; index += 1) {
            const transition = transitions[index];
            if (!isRecord(transition)) continue;
            const phaseId = str(transition.phaseId);
            const operation = str(transition.operation);
            const timestamp = str(transition.timestamp);
            const position = index;
            const commit = (): void => remember(family, record.key, position);
            const base = { lane, key: record.key, position };
            if (operation === "reopen") {
              entering.push({
                order: record.sequence,
                sub: 5 + index,
                topic: "phase.state",
                family: "phase.transition",
                ...base,
                kind: "reopened",
                ref: lane,
                occurredAt: timestamp,
                payload: { changeRef: lane, phaseId, reason: str(transition.reason), timestamp },
                commit,
              });
              continue;
            }
            if (operation !== "complete") continue;
            const firstCompletion = !hasPriorCompletion(transitions, index, phaseId);
            if (firstCompletion) {
              entering.push({
                order: record.sequence,
                sub: 5 + index,
                topic: "phase.state",
                family: "phase.transition",
                ...base,
                kind: "began",
                ref: lane,
                occurredAt: timestamp,
                payload: { changeRef: lane, phaseId, timestamp },
                groupSize: 2,
                commit,
              });
            }
            entering.push({
              order: record.sequence,
              sub: 5 + index + 0.5,
              topic: "phase.state",
              family: "phase.transition",
              ...base,
              kind: "completed",
              ref: lane,
              occurredAt: timestamp,
              payload: {
                changeRef: lane,
                phaseId,
                ...(optionalStr(transition.commitIntent) === undefined
                  ? {}
                  : { commitIntent: optionalStr(transition.commitIntent) }),
                ...(optionalStr(transition.commitIntentBasis) === undefined
                  ? {}
                  : { commitIntentBasis: optionalStr(transition.commitIntentBasis) }),
                ...(optionalStr(transition.commitSha) === undefined
                  ? {}
                  : { commitSha: optionalStr(transition.commitSha) }),
                timestamp,
              },
              commit,
            });
          }
          if (transitions.length === 0) remember(family, record.key, 0);
          continue;
        }

        if (record.kind === "blocker.question") {
          const lane = bounded(str(payload.lane), QUEUE_MAX_REF_CHARS);
          if (lane.length === 0) continue;
          const family = address("blockers.state", "blocker.question", lane);
          entering.push({
            order: record.sequence,
            sub: 6,
            topic: "blockers.state",
            family: "blocker.question",
            lane,
            key: record.key,
            position: record.sequence,
            kind: "published",
            ref: optionalStr(payload.ref) ?? null,
            occurredAt: str(payload.askedAt),
            payload: {
              id: str(payload.id),
              type: str(payload.type),
              audience: str(payload.audience),
              question: bounded(str(payload.question), BLOCKER_MAX_QUESTION_CHARS),
              options: strings(payload.options, BLOCKER_MAX_OPTIONS).map((option) =>
                bounded(option, BLOCKER_MAX_OPTION_CHARS),
              ),
              askedAt: str(payload.askedAt),
            },
            commit: () => remember(family, record.key, record.sequence),
          });
          continue;
        }

        if (record.kind === "blocker.answer") {
          const question = questions.get(str(payload.questionId));
          if (question === undefined) continue;
          const lane = bounded(str(question.lane), QUEUE_MAX_REF_CHARS);
          if (lane.length === 0) continue;
          const family = address("blockers.state", "blocker.answer", lane);
          const resume = isRecord(payload.laneResume) ? payload.laneResume : {};
          entering.push({
            order: record.sequence,
            sub: 7,
            topic: "blockers.state",
            family: "blocker.answer",
            lane,
            key: record.key,
            position: record.sequence,
            kind: "updated",
            ref: optionalStr(question.ref) ?? null,
            occurredAt: str(payload.answeredAt),
            payload: {
              id: str(payload.questionId),
              answeringAudience: str(payload.answeringAudience),
              ...(optionalStr(payload.choice) === undefined
                ? {}
                : { choice: optionalStr(payload.choice) }),
              ...(optionalStr(payload.text) === undefined
                ? {}
                : { text: bounded(str(payload.text), BLOCKER_MAX_ANSWER_CHARS) }),
              answeredAt: str(payload.answeredAt),
              resumeMode: str(resume.mode),
            },
            commit: () => remember(family, record.key, record.sequence),
          });
        }
      }

      // First observation is a baseline: the watermark starts at the view's tail.
      if (!primed) {
        primed = true;
        const firstSeen = new Map<string, Candidate>();
        for (const candidate of entering) {
          const family: Family = {
            topic: candidate.topic,
            family: candidate.family,
            lane: candidate.lane,
            key: candidate.key,
          };
          const prior = firstSeen.get(watermarkKey(family));
          if (prior === undefined || candidate.position >= prior.position) {
            firstSeen.set(watermarkKey(family), candidate);
          }
          if (candidate.topic === "queue.graph" && candidate.family === "queue.dependency") {
            lastEdges.set(candidate.lane, (candidate.payload.edges as readonly string[]) ?? []);
          }
        }
        for (const [key, candidate] of firstSeen) {
          watermark.set(key, { key: candidate.key, position: candidate.position });
        }
        return [];
      }

      const fresh = entering.filter((candidate) => {
        const prior = watermark.get(
          watermarkKey({
            topic: candidate.topic,
            family: candidate.family,
            lane: candidate.lane,
            key: candidate.key,
          }),
        );
        if (candidate.family === "phase.transition") {
          return (
            prior === undefined ||
            prior.key !== candidate.key ||
            candidate.position > prior.position
          );
        }
        return candidate.position > (prior?.position ?? 0);
      });

      fresh.sort((left, right) => left.order - right.order || left.sub - right.sub);

      const budget = new Map<EventTopic, number>();
      const skippedTopics = new Set<EventTopic>();
      const emitted: ProjectedEvent[] = [];
      for (const candidate of fresh) {
        if (skippedTopics.has(candidate.topic)) continue;
        const used = budget.get(candidate.topic) ?? 0;
        const groupSize = candidate.groupSize ?? 1;
        if (used + groupSize > maxPerTopic) {
          skippedTopics.add(candidate.topic);
          continue;
        }
        budget.set(candidate.topic, used + groupSize);
        candidate.commit();
        const suppressed = (candidate as Candidate & { suppressed?: boolean }).suppressed === true;
        if (suppressed) continue;
        emitted.push(frameOf(candidate, nextSequence(candidate.topic, candidate.lane)));
      }
      return emitted;
    },
  };
};

/** Whether a prior `complete` for the same phase exists earlier in the artifact. */
const hasPriorCompletion = (
  transitions: readonly unknown[],
  index: number,
  phaseId: string,
): boolean => {
  for (let cursor = 0; cursor < index; cursor += 1) {
    const entry = transitions[cursor];
    if (!isRecord(entry)) continue;
    if (str(entry.phaseId) === phaseId && entry.operation === "complete") return true;
  }
  return false;
};
