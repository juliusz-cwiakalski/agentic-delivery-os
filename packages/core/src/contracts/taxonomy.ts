/**
 * The public event-taxonomy v1 declaration (GH-290 F-1, DM-1, DM-7; DEC-E, DEC-K, DEC-M).
 *
 * One authored source for six topics: the delivered `queue` and `lanes`
 * snapshot topics (which declare no kind), and the four event topics
 * `queue.graph`, `dispatch.attempt`, `phase.state`, and `blockers.state`. Each
 * topic declares its shape, frame field list, lane rule, kind records with their
 * `emitted` flag and payload fields, the derived payload-field union, the
 * ordering rule, and the overflow policy.
 *
 * Runtime-neutral by construction: types and `as const` data only. The module's
 * one executable export is the pure integrity validator below; it reads no
 * clock, environment, I/O, or module-scope call expression.
 */
import type { ControlTopic } from "./control.js";

/** The served taxonomy version. A kind, ordering, overflow, envelope, or parentage change is a new version. */
export const TAXONOMY_VERSION = "v1" as const;

/** The closed topic shapes (DEC-B). */
export const TAXONOMY_SHAPES = ["snapshot", "event"] as const;
export type TaxonomyShape = (typeof TAXONOMY_SHAPES)[number];

/** The closed lane-selection rules. */
export const TAXONOMY_LANE_RULES = ["none", "ref", "change-ref", "blocker-lane"] as const;
export type TaxonomyLaneRule = (typeof TAXONOMY_LANE_RULES)[number];

/** The closed ordering values (DEC-D). */
export const ORDERING_VALUES = ["sequence-per-lane", "snapshot-revision"] as const;
export type TaxonomyOrdering = (typeof ORDERING_VALUES)[number];

/** The closed overflow values (DEC-C). */
export const OVERFLOW_VALUES = ["repoll"] as const;
export type TaxonomyOverflow = (typeof OVERFLOW_VALUES)[number];

/** The one overflow value the surface and the degraded frame both render. */
export const TAXONOMY_OVERFLOW: TaxonomyOverflow = OVERFLOW_VALUES[0];

/** The eight event-frame `data` fields, in declared order (DM-2, EVT-1). */
export const EVENT_ENVELOPE_FIELDS = [
  "topic",
  "kind",
  "lane",
  "ref",
  "sequence",
  "occurredAt",
  "payload",
  "taxonomyVersion",
] as const;

/** The three snapshot-frame `data` fields, in delivered order (DM-3, EVT-3). */
export const SNAPSHOT_FRAME_FIELDS = ["topic", "cursor", "snapshot"] as const;

/** One declared kind: its name, whether a v1 path emits it, and its payload fields. */
export type TaxonomyKindDeclaration = {
  readonly name: string;
  readonly emitted: boolean;
  readonly payloadFields: readonly string[];
};

/** One declared topic record (DM-1, DM-7). */
export type TaxonomyTopicDeclaration = {
  readonly name: ControlTopic;
  readonly version: typeof TAXONOMY_VERSION;
  readonly shape: TaxonomyShape;
  readonly parent?: ControlTopic;
  readonly frame: readonly string[];
  readonly lane: TaxonomyLaneRule;
  readonly kinds: readonly TaxonomyKindDeclaration[];
  readonly payloadFields: readonly string[];
  readonly ordering: TaxonomyOrdering;
  readonly overflow: TaxonomyOverflow;
};

/** The whole authored declaration. */
export type TaxonomyDeclaration = {
  readonly version: typeof TAXONOMY_VERSION;
  readonly envelope: readonly string[];
  readonly topics: readonly TaxonomyTopicDeclaration[];
};

/**
 * The six-topic declaration, transcribed from the M2 contract section's
 * §Event taxonomy v1 enumeration (DEC-A). `payloadFields` is the first-seen
 * union of the topic's per-kind lists; the validator rejects a hand-authored
 * union that disagrees with its kinds.
 */
export const TAXONOMY = {
  version: TAXONOMY_VERSION,
  envelope: EVENT_ENVELOPE_FIELDS,
  topics: [
    {
      name: "queue",
      version: TAXONOMY_VERSION,
      shape: "snapshot",
      frame: SNAPSHOT_FRAME_FIELDS,
      lane: "none",
      kinds: [],
      payloadFields: [],
      ordering: "snapshot-revision",
      overflow: TAXONOMY_OVERFLOW,
    },
    {
      name: "lanes",
      version: TAXONOMY_VERSION,
      shape: "snapshot",
      frame: SNAPSHOT_FRAME_FIELDS,
      lane: "none",
      kinds: [],
      payloadFields: [],
      ordering: "snapshot-revision",
      overflow: TAXONOMY_OVERFLOW,
    },
    {
      name: "queue.graph",
      version: TAXONOMY_VERSION,
      shape: "event",
      parent: "queue",
      frame: EVENT_ENVELOPE_FIELDS,
      lane: "ref",
      kinds: [
        {
          name: "entry",
          emitted: true,
          payloadFields: ["ref", "repository?", "priority", "recordedAt"],
        },
        {
          name: "dependency-edge",
          emitted: true,
          payloadFields: ["ref", "edges[]", "added[]", "removed[]", "recordedAt"],
        },
        {
          name: "release",
          emitted: true,
          payloadFields: [
            "leaseId",
            "repository",
            "ref",
            "holder",
            "runner",
            "weightClass",
            "operation",
            "recordedAt",
          ],
        },
        {
          name: "remove",
          emitted: false,
          payloadFields: ["ref", "reason", "recordedAt"],
        },
      ],
      payloadFields: [
        "ref",
        "repository?",
        "priority",
        "recordedAt",
        "edges[]",
        "added[]",
        "removed[]",
        "leaseId",
        "repository",
        "holder",
        "runner",
        "weightClass",
        "operation",
        "reason",
      ],
      ordering: "sequence-per-lane",
      overflow: TAXONOMY_OVERFLOW,
    },
    {
      name: "dispatch.attempt",
      version: TAXONOMY_VERSION,
      shape: "event",
      frame: EVENT_ENVELOPE_FIELDS,
      lane: "ref",
      kinds: [
        {
          name: "started",
          emitted: true,
          payloadFields: ["ref", "spawnOrdinal", "sessionId?", "harnessKind?", "recordedAt"],
        },
        {
          name: "refused",
          emitted: true,
          payloadFields: [
            "attemptId",
            "ref",
            "repository",
            "harness",
            "evidenceClass",
            "token",
            "startedAt",
            "finishedAt",
            "evidenceRefs[]",
          ],
        },
        {
          name: "completed",
          emitted: true,
          payloadFields: [
            "attemptId",
            "ref",
            "token",
            "outcome",
            "handoverState",
            "comparisonClass",
            "falseSuccess",
            "divergenceRef?",
            "finishedAt",
          ],
        },
      ],
      payloadFields: [
        "ref",
        "spawnOrdinal",
        "sessionId?",
        "harnessKind?",
        "recordedAt",
        "attemptId",
        "repository",
        "harness",
        "evidenceClass",
        "token",
        "startedAt",
        "finishedAt",
        "evidenceRefs[]",
        "outcome",
        "handoverState",
        "comparisonClass",
        "falseSuccess",
        "divergenceRef?",
      ],
      ordering: "sequence-per-lane",
      overflow: TAXONOMY_OVERFLOW,
    },
    {
      name: "phase.state",
      version: TAXONOMY_VERSION,
      shape: "event",
      frame: EVENT_ENVELOPE_FIELDS,
      lane: "change-ref",
      kinds: [
        {
          name: "began",
          emitted: true,
          payloadFields: ["changeRef", "phaseId", "timestamp"],
        },
        {
          name: "completed",
          emitted: true,
          payloadFields: [
            "changeRef",
            "phaseId",
            "commitIntent?",
            "commitIntentBasis?",
            "commitSha?",
            "timestamp",
          ],
        },
        {
          name: "reopened",
          emitted: true,
          payloadFields: ["changeRef", "phaseId", "reason", "timestamp"],
        },
      ],
      payloadFields: [
        "changeRef",
        "phaseId",
        "timestamp",
        "commitIntent?",
        "commitIntentBasis?",
        "commitSha?",
        "reason",
      ],
      ordering: "sequence-per-lane",
      overflow: TAXONOMY_OVERFLOW,
    },
    {
      name: "blockers.state",
      version: TAXONOMY_VERSION,
      shape: "event",
      frame: EVENT_ENVELOPE_FIELDS,
      lane: "blocker-lane",
      kinds: [
        {
          name: "published",
          emitted: true,
          payloadFields: ["id", "type", "audience", "question", "options[]", "askedAt"],
        },
        {
          name: "updated",
          emitted: true,
          payloadFields: [
            "id",
            "answeringAudience",
            "choice?",
            "text?",
            "answeredAt",
            "resumeMode",
          ],
        },
        {
          name: "cleared",
          emitted: true,
          payloadFields: ["id", "lane", "resumeMode", "clearedAt"],
        },
      ],
      payloadFields: [
        "id",
        "type",
        "audience",
        "question",
        "options[]",
        "askedAt",
        "answeringAudience",
        "choice?",
        "text?",
        "answeredAt",
        "resumeMode",
        "lane",
        "clearedAt",
      ],
      ordering: "sequence-per-lane",
      overflow: TAXONOMY_OVERFLOW,
    },
  ],
} as const satisfies TaxonomyDeclaration;

/** One integrity violation, naming the offending topic and field (DEC-M). */
export type TaxonomyViolation = {
  readonly topic: string;
  readonly field: string;
  readonly detail: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The first-seen union of a kind list's payload fields. */
const unionOf = (kinds: readonly { readonly payloadFields?: unknown }[]): readonly string[] => {
  const seen = new Set<string>();
  const fields: string[] = [];
  for (const kind of kinds) {
    if (!Array.isArray(kind.payloadFields)) continue;
    for (const field of kind.payloadFields) {
      if (typeof field !== "string" || seen.has(field)) continue;
      seen.add(field);
      fields.push(field);
    }
  }
  return fields;
};

const sameList = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

/**
 * Check the declaration's own integrity (DEC-M, AC-F1-4).
 *
 * Pure over its argument: unique topic names, a non-empty kind list on every
 * event topic and an empty one on every snapshot topic, unique kinds per topic,
 * a declared payload field list per kind, a known `shape`/`lane`/`ordering`/
 * `overflow` value, every frame field present, and a topic union equal to its
 * kinds' first-seen union. Returns one violation per fault; an empty list means
 * the declaration is servable.
 */
export const validateTaxonomy = (declaration: unknown): readonly TaxonomyViolation[] => {
  const violations: TaxonomyViolation[] = [];
  const declaredTopicNames = TAXONOMY.topics.map((topic) => topic.name as string);
  const push = (topic: string, field: string, detail: string): void => {
    violations.push({ topic, field, detail });
  };
  if (!isRecord(declaration)) {
    return [{ topic: "*", field: "declaration", detail: "the declaration is not an object" }];
  }
  if (declaration.version !== TAXONOMY_VERSION) {
    push("*", "version", `version must be ${TAXONOMY_VERSION}`);
  }
  if (!Array.isArray(declaration.envelope) || declaration.envelope.length === 0) {
    push("*", "envelope", "the envelope field list is absent or empty");
  } else if (!sameList(declaration.envelope as readonly string[], EVENT_ENVELOPE_FIELDS)) {
    push("*", "envelope", "the envelope field list must equal the declared eight fields");
  }
  if (!Array.isArray(declaration.topics)) {
    return [...violations, { topic: "*", field: "topics", detail: "topics must be an array" }];
  }
  const names = new Set<string>();
  for (const topic of declaration.topics) {
    if (!isRecord(topic)) {
      push("*", "topic", "a topic record is not an object");
      continue;
    }
    const name = typeof topic.name === "string" ? topic.name : "*";
    if (typeof topic.name !== "string" || topic.name.length === 0) {
      push(name, "name", "the topic name is absent or empty");
    } else if (names.has(topic.name)) {
      push(name, "name", "the topic name is declared twice");
    } else {
      names.add(topic.name);
    }
    if (topic.version !== TAXONOMY_VERSION) {
      push(name, "version", `version must be ${TAXONOMY_VERSION}`);
    }
    const shape = topic.shape;
    if (!(TAXONOMY_SHAPES as readonly unknown[]).includes(shape)) {
      push(name, "shape", `an unknown shape value is declared`);
    }
    if (!(TAXONOMY_LANE_RULES as readonly unknown[]).includes(topic.lane)) {
      push(name, "lane", "an unknown lane rule is declared");
    }
    if (!(ORDERING_VALUES as readonly unknown[]).includes(topic.ordering)) {
      push(name, "ordering", "an unknown ordering value is declared");
    }
    if (!(OVERFLOW_VALUES as readonly unknown[]).includes(topic.overflow)) {
      push(name, "overflow", "an unknown overflow value is declared");
    }
    if (topic.parent !== undefined && !declaredTopicNames.includes(topic.parent as string)) {
      push(name, "parent", "the declared parent is not a declared topic");
    }
    const expectedFrame = shape === "event" ? EVENT_ENVELOPE_FIELDS : SNAPSHOT_FRAME_FIELDS;
    if (!Array.isArray(topic.frame)) {
      push(name, "frame", "the frame field list is absent");
    } else {
      for (const field of expectedFrame) {
        if (!(topic.frame as readonly unknown[]).includes(field)) {
          push(name, "frame", `the frame is missing the declared field "${field}"`);
        }
      }
    }
    if (!Array.isArray(topic.kinds)) {
      push(name, "kinds", "the kind list is absent");
      continue;
    }
    const kinds = topic.kinds as readonly unknown[];
    if (shape === "event" && kinds.length === 0) {
      push(name, "kinds", "an event topic declares no kind");
    }
    if (shape === "snapshot" && kinds.length > 0) {
      push(name, "kinds", "a snapshot topic declares a kind");
    }
    const kindNames = new Set<string>();
    for (const kind of kinds) {
      if (!isRecord(kind)) {
        push(name, "kinds", "a kind record is not an object");
        continue;
      }
      const kindName = typeof kind.name === "string" ? kind.name : "*";
      if (typeof kind.name !== "string" || kind.name.length === 0) {
        push(name, "kinds", "a kind name is absent or empty");
      } else if (kindNames.has(kind.name)) {
        push(name, "kinds", `the kind "${kind.name}" is declared twice`);
      } else {
        kindNames.add(kind.name);
      }
      if (typeof kind.emitted !== "boolean") {
        push(name, kindName, "the kind's emitted flag is not a boolean");
      }
      if (!Array.isArray(kind.payloadFields) || kind.payloadFields.length === 0) {
        push(name, kindName, "the kind declares no payload field list");
      }
    }
    if (Array.isArray(topic.payloadFields)) {
      const derived = unionOf(kinds as readonly { readonly payloadFields?: unknown }[]);
      if (!sameList(topic.payloadFields as readonly string[], derived)) {
        push(name, "payloadFields", "the topic union disagrees with its kinds' union");
      }
    } else {
      push(name, "payloadFields", "the topic payload field list is absent");
    }
  }
  if (!sameList([...names].sort(), [...declaredTopicNames].sort())) {
    push("*", "topics", "the declared topic set differs from the six-topic set");
  }
  return violations;
};
