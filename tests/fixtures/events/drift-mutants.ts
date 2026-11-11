/**
 * GH-290 drift and integrity fixtures (TC-EVT-003, TC-EVT-004).
 *
 * Every mutant is a deep clone of the shipped declaration edited in memory; the
 * live module's bytes are never touched. The comparators here are the test
 * oracles that make "the taxonomy is pinned by tests" a comparison: the
 * production surface and the production projection are the consumers, and these
 * functions compare their outputs against the one authored declaration.
 */
import {
  EVENT_ENVELOPE_FIELDS,
  ORDERING_VALUES,
  OVERFLOW_VALUES,
  TAXONOMY,
  TAXONOMY_LANE_RULES,
  TAXONOMY_SHAPES,
  type TaxonomyDeclaration,
  validateTaxonomy,
} from "../../../packages/core/src/contracts/taxonomy";

/** One violation from a surface or frame comparison. */
export type ComparatorViolation = {
  readonly topic: string;
  readonly field: string;
  readonly detail: string;
  readonly versionImplication: boolean;
};

type SurfaceKind = {
  readonly name: string;
  readonly emitted: boolean;
  readonly payloadFields: readonly string[];
};

/** The machine surface record shape (DM-7). */
export type SurfaceRecord = {
  readonly name: string;
  readonly version: string;
  readonly shape: string;
  readonly parent?: string;
  readonly frame: readonly string[];
  readonly lane: string;
  readonly kinds: readonly SurfaceKind[];
  readonly payloadFields: readonly string[];
  readonly ordering: string;
  readonly overflow: string;
};

/** Deep-clone the shipped declaration so a mutant never mutates the module. */
export const cloneTaxonomy = (): TaxonomyDeclaration =>
  JSON.parse(JSON.stringify(TAXONOMY)) as TaxonomyDeclaration;

/** The first-seen payload union of a record's kinds. */
export const unionOfKinds = (kinds: readonly SurfaceKind[]): readonly string[] => {
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

/** Project a declaration into the machine records the surface must return. */
export const scriptedRecords = (declaration: TaxonomyDeclaration): readonly SurfaceRecord[] =>
  declaration.topics.map((topic) => ({
    name: topic.name,
    version: topic.version,
    shape: topic.shape,
    ...(topic.parent === undefined ? {} : { parent: topic.parent }),
    frame: [...topic.frame],
    lane: topic.lane,
    kinds: topic.kinds.map((kind) => ({
      name: kind.name,
      emitted: kind.emitted,
      payloadFields: [...kind.payloadFields],
    })),
    payloadFields: [...topic.payloadFields],
    ordering: topic.ordering,
    overflow: topic.overflow,
  }));

const VERSION_FORCING = new Set([
  "version",
  "shape",
  "parent",
  "frame",
  "kinds",
  "payloadFields",
  "ordering",
  "overflow",
]);

const push = (
  violations: ComparatorViolation[],
  topic: string,
  field: string,
  detail: string,
): void => {
  violations.push({ topic, field, detail, versionImplication: VERSION_FORCING.has(field) });
};

const listText = (value: readonly string[]): string => JSON.stringify(value);

/**
 * Compare a rendered surface (one record per topic) against the declaration.
 *
 * Per-topic and per-field, so a drift never hides behind a whole-taxonomy
 * aggregate: each violation names the topic, the field, and both values.
 */
export const compareSurface = (
  declaration: TaxonomyDeclaration,
  records: readonly SurfaceRecord[],
): readonly ComparatorViolation[] => {
  const violations: ComparatorViolation[] = [];
  const declaredNames = declaration.topics.map((topic) => topic.name as string);
  for (const record of records) {
    if (!declaredNames.includes(record.name)) {
      push(
        violations,
        record.name,
        "name",
        `the surface renders an undeclared topic "${record.name}"`,
      );
    }
  }
  for (const topic of declaration.topics) {
    const record = records.find((candidate) => candidate.name === topic.name);
    if (record === undefined) {
      push(violations, topic.name, "name", "the surface renders no record for the declared topic");
      continue;
    }
    if (record.version !== topic.version) {
      push(
        violations,
        topic.name,
        "version",
        `version declared "${topic.version}" but rendered "${record.version}"`,
      );
    }
    if (record.shape !== topic.shape) {
      push(
        violations,
        topic.name,
        "shape",
        `shape declared "${topic.shape}" but rendered "${record.shape}"`,
      );
    }
    if ((record.parent ?? undefined) !== (topic.parent ?? undefined)) {
      push(
        violations,
        topic.name,
        "parent",
        `parent declared ${JSON.stringify(topic.parent ?? null)} but rendered ${JSON.stringify(record.parent ?? null)}`,
      );
    }
    if (listText(record.frame) !== listText(topic.frame)) {
      push(
        violations,
        topic.name,
        "frame",
        `frame declared ${listText(topic.frame)} but rendered ${listText(record.frame)}`,
      );
    }
    if (record.lane !== topic.lane) {
      push(
        violations,
        topic.name,
        "lane",
        `lane declared "${topic.lane}" but rendered "${record.lane}"`,
      );
    }
    const declaredKinds = topic.kinds.map((kind) => kind.name as string);
    const renderedKinds = record.kinds.map((kind) => kind.name);
    if (listText(declaredKinds) !== listText(renderedKinds)) {
      push(
        violations,
        topic.name,
        "kinds",
        `kind list declared ${listText(declaredKinds)} but rendered ${listText(renderedKinds)}`,
      );
    }
    for (const kind of topic.kinds) {
      const rendered = record.kinds.find((candidate) => candidate.name === kind.name);
      if (rendered === undefined) {
        push(
          violations,
          topic.name,
          "kinds",
          `kind declared "${kind.name}" but rendered no record`,
        );
        continue;
      }
      if (rendered.emitted !== kind.emitted) {
        push(
          violations,
          topic.name,
          "kinds",
          `kind "${kind.name}" emitted declared ${String(kind.emitted)} but rendered ${String(rendered.emitted)}`,
        );
      }
      if (listText(rendered.payloadFields) !== listText(kind.payloadFields)) {
        push(
          violations,
          topic.name,
          `payloadFields`,
          `kind "${kind.name}" payloadFields declared ${listText(kind.payloadFields)} but rendered ${listText(rendered.payloadFields)}`,
        );
      }
    }
    if (listText(record.payloadFields) !== listText(unionOfKinds(record.kinds))) {
      push(
        violations,
        topic.name,
        "payloadFields",
        `the rendered union ${listText(record.payloadFields)} is not the kinds' union ${listText(unionOfKinds(record.kinds))}`,
      );
    }
    if (record.ordering !== topic.ordering) {
      push(
        violations,
        topic.name,
        "ordering",
        `ordering declared "${topic.ordering}" but rendered "${record.ordering}"`,
      );
    }
    if (!(ORDERING_VALUES as readonly string[]).includes(record.ordering)) {
      push(
        violations,
        topic.name,
        "ordering",
        `"${record.ordering}" is not a closed ordering value`,
      );
    }
    if (record.overflow !== topic.overflow) {
      push(
        violations,
        topic.name,
        "overflow",
        `overflow declared "${topic.overflow}" but rendered "${record.overflow}"`,
      );
    }
    if (!(OVERFLOW_VALUES as readonly string[]).includes(record.overflow)) {
      push(
        violations,
        topic.name,
        "overflow",
        `"${record.overflow}" is not a closed overflow value`,
      );
    }
    if (!(TAXONOMY_SHAPES as readonly string[]).includes(record.shape)) {
      push(violations, topic.name, "shape", `"${record.shape}" is not a closed shape value`);
    }
    if (!(TAXONOMY_LANE_RULES as readonly string[]).includes(record.lane)) {
      push(violations, topic.name, "lane", `"${record.lane}" is not a closed lane rule`);
    }
  }
  return violations;
};

/** One scripted event frame: the eight declared `data` keys and a payload. */
export type ScriptedFrame = {
  readonly kind: "event";
  readonly data: Record<string, unknown>;
};

const payloadKey = (field: string): string => field.replace(/[?]$/u, "").replace(/\[\]$/u, "");

/** Build one frame per declared emitted kind, in declared order. */
export const scriptedFrames = (declaration: TaxonomyDeclaration): readonly ScriptedFrame[] => {
  const frames: ScriptedFrame[] = [];
  let sequence = 0;
  for (const topic of declaration.topics) {
    if (topic.shape !== "event") continue;
    for (const kind of topic.kinds) {
      if (!kind.emitted) continue;
      sequence += 1;
      const payload: Record<string, unknown> = {};
      for (const field of kind.payloadFields) {
        payload[payloadKey(field)] = field.endsWith("[]") ? [] : "x";
      }
      frames.push({
        kind: "event",
        data: {
          topic: topic.name,
          kind: kind.name,
          lane: "GH-290",
          ref: "GH-290",
          sequence,
          occurredAt: "2026-11-12T00:00:00.000Z",
          payload,
          taxonomyVersion: declaration.version,
        },
      });
    }
  }
  return frames;
};

/** Compare scripted or emitted frames against the declaration. */
export const compareFrames = (
  declaration: TaxonomyDeclaration,
  frames: readonly ScriptedFrame[],
): readonly ComparatorViolation[] => {
  const violations: ComparatorViolation[] = [];
  for (const frame of frames) {
    const data = frame.data;
    const topicName = typeof data.topic === "string" ? data.topic : "*";
    const topic = declaration.topics.find((candidate) => candidate.name === topicName);
    if (topic === undefined) {
      push(violations, topicName, "topic", "the frame names an undeclared topic");
      continue;
    }
    const keys = Object.keys(data);
    if (listText(keys) !== listText(EVENT_ENVELOPE_FIELDS)) {
      push(
        violations,
        topicName,
        "envelope",
        `data keys ${listText(keys)} are not the declared eight fields`,
      );
    }
    const kindName = typeof data.kind === "string" ? data.kind : "*";
    const kind = topic.kinds.find((candidate) => candidate.name === kindName);
    if (kind === undefined) {
      push(violations, topicName, "kinds", `the frame carries undeclared kind "${kindName}"`);
      continue;
    }
    if (!kind.emitted) {
      push(violations, topicName, "kinds", `the frame carries non-emitted kind "${kindName}"`);
    }
    const payload = data.payload;
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      push(violations, topicName, "payload", "the frame's payload is not an object");
      continue;
    }
    const declared = new Set(kind.payloadFields.map(payloadKey));
    for (const key of Object.keys(payload)) {
      if (!declared.has(key)) {
        push(
          violations,
          topicName,
          "payloadFields",
          `the frame's payload carries undeclared field "${key}"`,
        );
      }
    }
    if (data.taxonomyVersion !== declaration.version) {
      push(
        violations,
        topicName,
        "version",
        `the frame stamps "${String(data.taxonomyVersion)}" but the declaration is "${declaration.version}"`,
      );
    }
  }
  return violations;
};

/** The five drift mutants (TC-EVT-003 steps 2-6). */
export const driftMutants = (): Readonly<Record<string, readonly SurfaceRecord[]>> => {
  const baseline = scriptedRecords(cloneTaxonomy());
  const edit = (
    topic: string,
    change: (record: SurfaceRecord) => SurfaceRecord,
  ): readonly SurfaceRecord[] =>
    baseline.map((record) => (record.name === topic ? change(record) : record));
  return {
    version: edit("queue.graph", (record) => ({ ...record, version: "v2" })),
    kind: edit("phase.state", (record) => ({
      ...record,
      kinds: record.kinds.map((kind) =>
        kind.name === "reopened" ? { ...kind, name: "reopened-v2" } : kind,
      ),
    })),
    payloadField: edit("dispatch.attempt", (record) => ({
      ...record,
      kinds: record.kinds.map((kind) =>
        kind.name === "refused"
          ? { ...kind, payloadFields: kind.payloadFields.filter((field) => field !== "token") }
          : kind,
      ),
    })),
    ordering: edit("blockers.state", (record) => ({ ...record, ordering: "snapshot-revision" })),
    overflow: edit("queue", (record) => ({ ...record, overflow: "drop" })),
  };
};

/** The seven integrity-violation mutants (TC-EVT-004 step 1). */
export const integrityMutants = (): Readonly<Record<string, unknown>> => {
  const clone = (): Record<string, unknown> =>
    JSON.parse(JSON.stringify(TAXONOMY)) as Record<string, unknown>;
  const topicsOf = (declaration: Record<string, unknown>): Record<string, unknown>[] =>
    declaration.topics as Record<string, unknown>[];
  const topicOf = (declaration: Record<string, unknown>, name: string): Record<string, unknown> =>
    topicsOf(declaration).find((topic) => topic.name === name) as Record<string, unknown>;

  const duplicateName = clone();
  const duplicateNames = topicsOf(duplicateName);
  duplicateNames[1] = { ...(duplicateNames[1] as Record<string, unknown>), name: "queue" };

  const emptyEventKinds = clone();
  topicOf(emptyEventKinds, "queue.graph").kinds = [];

  const snapshotKind = clone();
  topicOf(snapshotKind, "queue").kinds = [
    { name: "snapshot", emitted: true, payloadFields: ["topic"] },
  ];
  topicOf(snapshotKind, "queue").payloadFields = ["topic"];

  const duplicateKind = clone();
  const graph = topicOf(duplicateKind, "queue.graph");
  const graphKinds = graph.kinds as Record<string, unknown>[];
  graph.kinds = [...graphKinds, { ...(graphKinds[0] as Record<string, unknown>) }];

  const emptyPayloadFields = clone();
  const phase = topicOf(emptyPayloadFields, "phase.state");
  const phaseKinds = phase.kinds as Record<string, unknown>[];
  phase.kinds = phaseKinds.map((kind) =>
    kind.name === "reopened" ? { ...kind, payloadFields: [] } : kind,
  );

  const unknownValues = clone();
  const blockers = topicOf(unknownValues, "blockers.state");
  blockers.ordering = "per-lane";
  blockers.overflow = "drop";
  blockers.shape = "stream";

  const missingFrameField = clone();
  const lanes = topicOf(missingFrameField, "lanes");
  lanes.frame = ["topic", "snapshot"];

  return {
    duplicateName,
    emptyEventKinds,
    snapshotKind,
    duplicateKind,
    emptyPayloadFields,
    unknownValues,
    missingFrameField,
  };
};

/** The shipped declaration's integrity verdict (positive control). */
export const shippedIntegrity = (): readonly string[] =>
  validateTaxonomy(TAXONOMY).map(
    (violation) => `${violation.topic}:${violation.field}:${violation.detail}`,
  );
