/**
 * The `events` reference surface (GH-290 F-2, DM-7; DEC-E, DEC-K, DEC-M).
 *
 * `events list [--json]` and `events describe <topic> [--json]` are pure data
 * rendering over the one authored declaration: no store, configuration, git,
 * network, or filesystem read, and no write. The surface is generated, never
 * hand-authored, so a declaration mutation moves the page and the frames
 * together.
 */
import {
  EVENT_ENVELOPE_FIELDS,
  TAXONOMY,
  TAXONOMY_VERSION,
  type TaxonomyDeclaration,
  validateTaxonomy,
} from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";
import { renderEventsDescribeText, renderEventsListText } from "../output/events-text.js";

/** One kind record on the machine surface. */
export type EventsKindRecord = {
  readonly name: string;
  readonly emitted: boolean;
  readonly payloadFields: readonly string[];
};

/** One topic record on the machine surface (DM-7, DEC-K). */
export type EventsTopicRecord = {
  readonly name: string;
  readonly version: string;
  readonly shape: string;
  readonly parent?: string;
  readonly frame: readonly string[];
  readonly lane: string;
  readonly kinds: readonly EventsKindRecord[];
  readonly payloadFields: readonly string[];
  readonly ordering: string;
  readonly overflow: string;
};

/** The machine payload both verbs return. */
export type EventsData = {
  readonly command: "events list" | "events describe";
  readonly taxonomyVersion: string;
  readonly envelope: readonly string[];
  readonly topics: readonly EventsTopicRecord[];
};

/** Everything the handler reads; the declaration is the only input. */
export type EventsCommandRuntime = {
  readonly taxonomy?: TaxonomyDeclaration;
};

const VERBS = ["list", "describe"] as const;

/** The declared topic names, in declared order. */
const topicNames = (taxonomy: TaxonomyDeclaration): readonly string[] =>
  taxonomy.topics.map((topic) => topic.name as string);

/** The first-seen union of a topic's kind payload fields (never authored twice). */
const derivedUnion = (kinds: readonly EventsKindRecord[]): readonly string[] => {
  const seen = new Set<string>();
  const fields: string[] = [];
  for (const kind of kinds) {
    for (const field of kind.payloadFields) {
      if (seen.has(field)) continue;
      seen.add(field);
      fields.push(field);
    }
  }
  return fields;
};

/** Project one declared topic onto its machine record. */
export const toTopicRecord = (topic: TaxonomyDeclaration["topics"][number]): EventsTopicRecord => {
  const kinds: readonly EventsKindRecord[] = topic.kinds.map((kind) => ({
    name: kind.name,
    emitted: kind.emitted,
    payloadFields: [...kind.payloadFields],
  }));
  return {
    name: topic.name,
    version: topic.version,
    shape: topic.shape,
    ...(topic.parent === undefined ? {} : { parent: topic.parent }),
    frame: [...topic.frame],
    lane: topic.lane,
    kinds,
    payloadFields: derivedUnion(kinds),
    ordering: topic.ordering,
    overflow: topic.overflow,
  };
};

const verbRefusal = (verb: string | undefined): { readonly error: Record<string, string> } => ({
  error: {
    kind: "events",
    code: "events.verb-unknown",
    summary:
      verb === undefined || verb.length === 0
        ? "result=refused; reason=missing-verb; expected `events list` or `events describe <topic>`"
        : `result=refused; reason=unknown-verb; "${verb}" is not an events verb; expected list or describe`,
  },
});

/**
 * Refuse a missing or unexpected positional on a valid verb.
 *
 * The delivered identity set carries no argument-arity code, so both refuse with
 * `events.verb-unknown` (the row that already covers how a verb may be invoked)
 * and the message names the argument that is missing or extra.
 */
const argumentRefusal = (summary: string): { readonly error: Record<string, string> } => ({
  error: {
    kind: "events",
    code: "events.verb-unknown",
    summary: `result=refused; ${summary}`,
  },
});

/** The one wording for a `describe` with no topic, shared by both guards. */
const MISSING_TOPIC_REFUSAL =
  "reason=missing-topic; the describe verb requires a <topic> argument; expected `events describe <topic>` (use `events list` for every topic)";

const topicRefusal = (
  requested: string,
  names: readonly string[],
): { readonly error: Record<string, string> } => ({
  error: {
    kind: "events",
    code: "events.topic-unknown",
    summary: `result=refused; reason=topic-unknown; "${requested}" is not a declared topic; declared: ${names.join(", ")}`,
  },
});

/** Build the `events` command definition over the injected declaration. */
export const createEventsCommandDefinition = (
  runtime: EventsCommandRuntime = {},
): CommandDefinition => {
  const taxonomy = runtime.taxonomy ?? TAXONOMY;
  return {
    positionals: { max: 2 },
    humanText: (data: unknown, brand): string =>
      (data as EventsData).command === "events describe"
        ? renderEventsDescribeText(data as EventsData, brand)
        : renderEventsListText(data as EventsData),
    handler: (invocation) => {
      const violations = validateTaxonomy(taxonomy);
      if (violations.length > 0) {
        return {
          error: {
            kind: "events",
            code: "events.taxonomy-unavailable",
            summary: `result=refused; reason=taxonomy-integrity; ${violations
              .slice(0, 3)
              .map((violation) => `${violation.topic}:${violation.field}`)
              .join("; ")}`,
          },
        };
      }
      const [verb, topic, ...extra] = invocation.positionals;
      if (verb === undefined || !(VERBS as readonly string[]).includes(verb) || extra.length > 0) {
        return verbRefusal(verb);
      }
      if (verb === "list" && topic !== undefined) {
        return argumentRefusal(
          `reason=unexpected-argument; "list" takes no topic argument, but "${topic}" was given; expected \`events list\` (or \`events describe <topic>\`)`,
        );
      }
      if (verb === "describe" && (topic === undefined || topic.length === 0)) {
        return argumentRefusal(MISSING_TOPIC_REFUSAL);
      }
      const names = topicNames(taxonomy);
      const envelope = [...EVENT_ENVELOPE_FIELDS];
      if (verb === "list") {
        return {
          data: {
            command: "events list",
            taxonomyVersion: TAXONOMY_VERSION,
            envelope,
            topics: taxonomy.topics.map(toTopicRecord),
          } satisfies EventsData,
        };
      }
      if (topic === undefined || topic.length === 0) {
        return argumentRefusal(MISSING_TOPIC_REFUSAL);
      }
      if (!names.includes(topic)) return topicRefusal(topic, names);
      const declared = taxonomy.topics.find((candidate) => candidate.name === topic);
      if (declared === undefined) return topicRefusal(topic, names);
      return {
        data: {
          command: "events describe",
          taxonomyVersion: TAXONOMY_VERSION,
          envelope,
          topics: [toTopicRecord(declared)],
        } satisfies EventsData,
      };
    },
  };
};
