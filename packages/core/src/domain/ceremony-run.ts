/**
 * The ceremony runner engine (GH-296 F-4, F-8; DM-2..DM-7).
 *
 * Executes one validated declaration deterministically over injected ports:
 * intake and idempotency, ordered agenda execution with per-step slot write and
 * read-back verification, per-step durable records, compaction at declared
 * boundaries, and the step-fold verdict. This module is pure: time, ids, input
 * reads, artifacts, records, memory, and mirror targets all arrive through the
 * environment. No model, network, child process, or ambient read exists here.
 */
import {
  BRIEF_ANCHOR_GROUPS,
  BRIEF_PLACEHOLDER_CATALOG,
  BRIEF_SURFACE_ORDER,
  CEREMONY_ASSESS_VERDICTS,
  CEREMONY_CARRY_OVER_REASONS,
  CEREMONY_CHECK_STATES,
  CEREMONY_FOLLOW_THROUGH_VERDICTS,
  CEREMONY_COMPACTION_MAX_BYTES,
  CEREMONY_COMPACTION_MAX_LINES,
  CEREMONY_NOTE_SCHEMA,
  CEREMONY_RUN_PAYLOAD_SCHEMA,
  type CeremonyArtifactPort,
  type CeremonyArtifactRead,
  type CeremonyDeclaration,
  type CeremonyInputRead,
  type CeremonyInputReader,
  type CeremonyInputSource,
  type CeremonyMemoryPort,
  type CeremonyMirrorPort,
  type CeremonyNote,
  type CeremonyOutputSlot,
  type CeremonyRecordPort,
  type CeremonyRecordedTrigger,
  type CeremonyRunOrigin,
  type CeremonyRunRecord,
  type CeremonyRunVerdict,
  type CeremonyScopeKeyKind,
  type CeremonyStepDeclaration,
  type CeremonyStepKind,
  type CeremonyStepRecord,
  type CeremonyTierVerdict,
  type CeremonyVerificationMode,
  type CeremonyWindow,
  PM_NOTES_REQUIRED_PHASES_BY_VARIANT,
} from "#contracts";
import {
  CEREMONY_BUILTIN_SCHEMAS,
  CEREMONY_FOLLOW_THROUGH_SCHEMA,
  CEREMONY_RETRO_ACTIONS_SCHEMA,
  CEREMONY_RETRO_EVIDENCE_SCHEMA,
  CEREMONY_RETRO_INSIGHTS_SCHEMA,
  ceremonyBuiltinConforms,
  renderCeremonyFollowThrough,
  renderCeremonyRetroActions,
  renderCeremonyRetroEvidence,
  renderCeremonyRetroInsights,
} from "./ceremony-builtins.js";
import { ceremonyDeclarationDigest } from "./ceremony-declaration.js";
import { planCeremonyMirror } from "./ceremony-mirror.js";
import {
  resolveCeremonyIntake,
  type CeremonyIntake,
  type CeremonyRunIdentity,
} from "./ceremony-intake.js";

/** The night-watch declared checks (pinned closed set, GAP-2). */
export const CEREMONY_NIGHT_WATCH_CHECKS = [
  "audit-ledger",
  "harness-telemetry",
  "lanes",
  "gates",
] as const;

/** The engine-facing environment; every fact is injected. */
export type CeremonyRunEnvironment = {
  readonly clock: { readonly nowMs: () => number };
  readonly ids: { readonly nextRunId: () => string };
  readonly input: CeremonyInputReader;
  readonly artifacts: CeremonyArtifactPort;
  readonly records: CeremonyRecordPort;
  readonly memory?: CeremonyMemoryPort;
  readonly mirror?: CeremonyMirrorPort;
  readonly repositoryId: string;
  readonly origin?: CeremonyRunOrigin;
};

/** One run request. */
export type CeremonyRunRequest = {
  readonly declaration: CeremonyDeclaration;
  readonly env: CeremonyRunEnvironment;
  readonly note?: CeremonyNote;
  readonly noteSupplied: boolean;
  readonly window?: CeremonyWindow;
  readonly apply: boolean;
  readonly tier?: CeremonyTierVerdict;
  readonly catchUp?: {
    readonly missedWindow: CeremonyWindow;
    readonly executionWindow: CeremonyWindow;
  };
};

/** One failure identity the engine can report. */
export type CeremonyEngineFailure = {
  readonly code: string;
  readonly summary: string;
  readonly field?: string;
};

/** One executed step's report. */
export type CeremonyStepOutcome = {
  readonly index: number;
  readonly phaseIndex: number;
  readonly kind: CeremonyStepKind;
  readonly outcome: CeremonyStepRecord["outcome"];
  readonly artifactRef: string;
  readonly verification: "verified" | "unverified";
  readonly durationMs: number;
  readonly reason?: string;
};

/** One compacted phase summary. */
export type CeremonyCarriedSummary = {
  readonly phaseIndex: number;
  readonly summary: string;
  readonly bytes: number;
  readonly lines: number;
  readonly omitted: number;
};

/** The successful run data carried under the envelope's `data`. */
export type CeremonyRunData = {
  readonly ceremony: string;
  readonly runId: string;
  readonly verdict: CeremonyRunVerdict;
  readonly reused: boolean;
  readonly origin: CeremonyRunOrigin;
  readonly trigger: CeremonyRecordedTrigger;
  readonly scopeKey: { readonly value: string; readonly derivation: CeremonyScopeKeyKind };
  readonly window: CeremonyWindow;
  readonly steps: readonly CeremonyStepOutcome[];
  readonly applied: boolean;
  readonly carried: readonly CeremonyCarriedSummary[];
  readonly tier?: CeremonyTierVerdict;
  readonly catchUp?: {
    readonly missedWindow: CeremonyWindow;
    readonly executionWindow: CeremonyWindow;
  };
};

export type CeremonyRunOutcome =
  | { readonly ok: true; readonly data: CeremonyRunData }
  | { readonly ok: false; readonly error: CeremonyEngineFailure };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const utf8Bytes = (value: string): number => {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    if (point <= 0x7f) bytes += 1;
    else if (point <= 0x7ff) bytes += 2;
    else if (point <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
};

/** Flatten the declared agenda in declared order. */
export const flattenCeremonyAgenda = (
  declaration: CeremonyDeclaration,
): readonly {
  readonly phaseIndex: number;
  readonly step: CeremonyStepDeclaration;
  readonly index: number;
}[] => {
  const flattened: { phaseIndex: number; step: CeremonyStepDeclaration; index: number }[] = [];
  let index = 0;
  for (let phaseIndex = 0; phaseIndex < declaration.agenda.length; phaseIndex += 1) {
    const phase = declaration.agenda[phaseIndex];
    if (phase === undefined) continue;
    for (const step of phase.steps) {
      index += 1;
      flattened.push({ phaseIndex, step, index });
    }
  }
  return flattened;
};

const primaryOutput = (step: CeremonyStepDeclaration) =>
  step.outputs[0] ?? {
    slot: "ceremony-artifact" as CeremonyOutputSlot,
    schema: "delivery.ceremony.artifact.v1",
  };

const readDeclaredInputs = (
  sources: readonly CeremonyInputSource[],
  window: CeremonyWindow,
  env: CeremonyRunEnvironment,
): {
  readonly facts: Readonly<Record<string, unknown>>;
  readonly degraded: readonly { source: string; reason: string }[];
} => {
  const facts: Record<string, unknown> = {};
  const degraded: { source: string; reason: string }[] = [];
  for (const source of sources) {
    const read: CeremonyInputRead = env.input(source, window);
    if (read.state === "present") facts[source] = read.facts;
    else degraded.push({ source, reason: read.reason });
  }
  return { facts, degraded };
};

const stepSources = (
  step: CeremonyStepDeclaration,
  declaration: CeremonyDeclaration,
): readonly CeremonyInputSource[] => step.inputs ?? declaration.inputs.map((input) => input.source);

const BRIEF_SURFACE_SOURCES: Readonly<Record<string, readonly string[]>> = {
  tracker: ["status-facts"],
  "changes-and-prs": ["status-facts"],
  ci: ["status-facts"],
  "lanes-or-queue": ["status-facts"],
  providers: ["status-facts", "provider-parks"],
  "parked-work": ["status-facts"],
  "typed-questions": ["status-facts", "open-questions"],
  spend: ["status-facts", "spend-citation"],
  "gate-sla-states": [],
  "lane-queue-engine": [],
};

const renderBrief = (
  facts: Readonly<Record<string, unknown>>,
  degraded: readonly { source: string; reason: string }[],
): unknown => ({
  schemaId: "delivery.brief.v1",
  surfaces: BRIEF_SURFACE_ORDER.map((id) => {
    const sources = BRIEF_SURFACE_SOURCES[id] ?? [];
    const degradedEntry = degraded.find((entry) => sources.includes(entry.source));
    return {
      id,
      title: id,
      state: degradedEntry === undefined ? "present" : "unavailable",
      counts: { total: 0, ready: 0, blocked: 0, parked: 0, attention: 0 },
      truncated: false,
      ...(degradedEntry === undefined ? {} : { reason: degradedEntry.reason }),
    };
  }),
  anchorGroups: BRIEF_ANCHOR_GROUPS.map((id) => ({ id, entries: [] })),
  placeholders: BRIEF_PLACEHOLDER_CATALOG.map((entry) => ({ ...entry })),
  degraded,
  facts,
});

const carryOverEntries = (facts: Readonly<Record<string, unknown>>): readonly unknown[] => {
  const source = facts["queue-state"] ?? facts["tracker-milestone"] ?? facts["measurement-metrics"];
  if (!isRecord(source)) return [];
  const entries = source.carryOver ?? source.entries;
  return Array.isArray(entries) ? entries : [];
};

const renderRollover = (facts: Readonly<Record<string, unknown>>): unknown => ({
  schemaId: "delivery.ceremony.rollover.v1",
  entries: carryOverEntries(facts).map((entry) => {
    const record = isRecord(entry) ? entry : {};
    const reason =
      typeof record.reason === "string" &&
      (CEREMONY_CARRY_OVER_REASONS as readonly string[]).includes(record.reason)
        ? record.reason
        : "carried-by-owner";
    return {
      ref: typeof record.ref === "string" ? record.ref : "unknown",
      reason,
      nextMilestone: typeof record.nextMilestone === "string" ? record.nextMilestone : "unknown",
    };
  }),
});

const renderNightWatch = (
  facts: Readonly<Record<string, unknown>>,
  degraded: readonly { source: string; reason: string }[],
): unknown => ({
  schemaId: "delivery.ceremony.night-watch.v1",
  checks: CEREMONY_NIGHT_WATCH_CHECKS.map((id) => {
    const source = id === "lanes" ? "lane-queue-facts" : id === "gates" ? "gate-verification" : id;
    const degradedEntry = degraded.find(
      (entry) => entry.source === source || entry.source.includes(source),
    );
    const fact = facts[source];
    if (degradedEntry !== undefined) {
      return { id, state: "unavailable", reason: degradedEntry.reason, verifiedEmpty: false };
    }
    if (isRecord(fact) && Array.isArray(fact.anomalies) && fact.anomalies.length > 0) {
      // The check cites only an evidence reference an anomaly itself carries.
      // No citation is synthesised for the declared input read: an anomaly the
      // collector delivered without one is reported with the missing citation
      // named, never with a fabricated reference (AC-F3-6, P1 integrity rule).
      const anomalies = fact.anomalies;
      const cited = anomalies.find(
        (entry) => isRecord(entry) && isNonEmptyString(entry.evidenceRef),
      );
      const evidenceRef = isRecord(cited) ? cited.evidenceRef : undefined;
      return {
        id,
        state: "anomaly",
        anomalies,
        verifiedEmpty: false,
        ...(isNonEmptyString(evidenceRef) ? { evidenceRef } : {}),
        ...(evidenceRef === undefined
          ? { reason: "no anomaly of this check cites an evidence reference" }
          : {}),
      };
    }
    return { id, state: "clean", verifiedEmpty: true };
  }),
});

type AssessmentItem = {
  readonly item: string;
  readonly verdict: string;
  readonly evidenceRef?: string;
};

const assessmentItems = (
  facts: Readonly<Record<string, unknown>>,
  note: CeremonyNote | undefined,
): readonly AssessmentItem[] => {
  const source = facts["owner-note"];
  const rawItems = isRecord(source) && Array.isArray(source.items) ? source.items : [];
  return rawItems
    .map((entry) => {
      const record = isRecord(entry) ? entry : {};
      const item =
        typeof record.text === "string"
          ? record.text
          : typeof record.item === "string"
            ? record.item
            : "unnamed item";
      const evidenceRef = typeof record.evidenceRef === "string" ? record.evidenceRef : undefined;
      return {
        item,
        verdict: evidenceRef === undefined ? "uncovered" : "covered",
        ...(evidenceRef === undefined ? {} : { evidenceRef }),
      };
    })
    .concat((note?.actions ?? []).map((item) => ({ item, verdict: "not-applicable" })));
};

const renderAssessment = (
  facts: Readonly<Record<string, unknown>>,
  note: CeremonyNote | undefined,
): unknown => {
  const items = assessmentItems(facts, note);
  return {
    schemaId: "delivery.ceremony.assessment.v1",
    items,
    unassessedCount: 0,
  };
};

const sourceSets = (
  facts: Readonly<Record<string, unknown>>,
): Readonly<Record<string, readonly string[]>> => {
  const source = facts["decision-register"];
  if (!isRecord(source)) return {};
  const repos = source.repositories ?? source.records;
  if (!isRecord(repos)) return {};
  const result: Record<string, readonly string[]> = {};
  for (const [target, value] of Object.entries(repos)) {
    if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
      result[target] = value;
    }
  }
  return result;
};

const targetList = (facts: Readonly<Record<string, unknown>>): readonly string[] => {
  const source = facts["affected-repositories"];
  if (!isRecord(source)) return [];
  const targets = source.targets;
  return Array.isArray(targets) && targets.every((entry) => typeof entry === "string")
    ? targets
    : [];
};

const mirrorReport = (
  facts: Readonly<Record<string, unknown>>,
  env: CeremonyRunEnvironment,
  apply: boolean,
): { readonly content: unknown; readonly failure?: string } => {
  const sources = sourceSets(facts);
  const targets = targetList(facts);
  const planned = planCeremonyMirror({
    targets,
    sources,
    inspect: (target) =>
      env.mirror === undefined
        ? { state: "absent", mirrorSet: [], sourceSet: sources[target] ?? [] }
        : env.mirror.inspect(target),
    ...(env.mirror === undefined
      ? {}
      : { applyTarget: (target, records) => env.mirror?.apply(target, records) ?? { ok: false } }),
    apply,
  });
  return {
    content: {
      schemaId: "delivery.ceremony.mirror-report.v1",
      targets: planned.targets,
      applied: apply,
    },
    ...(planned.failure === undefined ? {} : { failure: planned.failure }),
  };
};

const noteContent = (note: CeremonyNote, level: string | undefined): unknown => ({
  ...note,
  ...(level === undefined ? {} : { level }),
});

const defaultContent = (
  step: CeremonyStepDeclaration,
  facts: Readonly<Record<string, unknown>>,
  degraded: readonly { source: string; reason: string }[],
): unknown => ({
  schemaId: primaryOutput(step).schema,
  facts,
  degraded,
});

const renderForSchema = (input: {
  readonly step: CeremonyStepDeclaration;
  readonly declaration: CeremonyDeclaration;
  readonly facts: Readonly<Record<string, unknown>>;
  readonly degraded: readonly { source: string; reason: string }[];
  readonly note: CeremonyNote | undefined;
  readonly apply: boolean;
  readonly env: CeremonyRunEnvironment;
  readonly window: CeremonyWindow;
}): { readonly content: unknown; readonly failure?: string; readonly applied: boolean } => {
  const schema = primaryOutput(input.step).schema;
  if (schema === "delivery.brief.v1") {
    return { content: renderBrief(input.facts, input.degraded), applied: false };
  }
  if (schema === "delivery.ceremony.rollover.v1") {
    return { content: renderRollover(input.facts), applied: false };
  }
  if (schema === "delivery.ceremony.night-watch.v1") {
    return { content: renderNightWatch(input.facts, input.degraded), applied: false };
  }
  if (schema === "delivery.ceremony.assessment.v1") {
    return { content: renderAssessment(input.facts, input.note), applied: false };
  }
  if (schema === CEREMONY_FOLLOW_THROUGH_SCHEMA) {
    return { content: renderCeremonyFollowThrough(input.facts), applied: false };
  }
  if (schema === CEREMONY_RETRO_EVIDENCE_SCHEMA) {
    return { content: renderCeremonyRetroEvidence(input.facts, input.note), applied: false };
  }
  if (schema === CEREMONY_RETRO_INSIGHTS_SCHEMA) {
    return { content: renderCeremonyRetroInsights(input.note), applied: false };
  }
  if (schema === CEREMONY_RETRO_ACTIONS_SCHEMA) {
    return { content: renderCeremonyRetroActions(input.note), applied: false };
  }
  if (schema === "delivery.ceremony.mirror-report.v1") {
    const report = mirrorReport(input.facts, input.env, false);
    return {
      content: report.content,
      applied: false,
      ...(report.failure === undefined ? {} : { failure: report.failure }),
    };
  }
  if (input.step.kind === "sync") {
    const report = mirrorReport(input.facts, input.env, input.apply);
    return {
      content: report.content,
      applied: input.apply,
      ...(report.failure === undefined ? {} : { failure: report.failure }),
    };
  }
  if (schema === CEREMONY_NOTE_SCHEMA && input.note !== undefined) {
    return { content: noteContent(input.note, input.note.level), applied: false };
  }
  return { content: defaultContent(input.step, input.facts, input.degraded), applied: false };
};

const artifactContent = (value: unknown): string => JSON.stringify(value);

const writeOutput = (
  step: CeremonyStepDeclaration,
  runId: string,
  scopeKey: string,
  content: string,
  env: CeremonyRunEnvironment,
):
  | { readonly ref: string; readonly slot: CeremonyOutputSlot }
  | { readonly failure: string; readonly slot: CeremonyOutputSlot } => {
  const output = primaryOutput(step);
  if (output.slot === "memory") {
    if (env.memory === undefined)
      return { failure: "memory slot port is absent", slot: output.slot };
    return { ref: `memory:${scopeKey}`, slot: output.slot };
  }
  const written = env.artifacts.write({
    runId,
    slot: output.slot,
    schema: output.schema,
    content,
  });
  return written.ok
    ? { ref: written.ref, slot: output.slot }
    : { failure: written.detail, slot: output.slot };
};

const readBack = (
  step: CeremonyStepDeclaration,
  runId: string,
  ref: string,
  env: CeremonyRunEnvironment,
): CeremonyArtifactRead => {
  const output = primaryOutput(step);
  if (output.slot === "memory") {
    if (env.memory === undefined) return { ok: false, detail: "memory slot port is absent" };
    const read = env.memory.readNote(ref.replace(/^memory:/, ""));
    return read.state === "present"
      ? { ok: true, content: read.body }
      : { ok: false, detail: "note absent" };
  }
  return env.artifacts.read({ runId, slot: output.slot, ref });
};

const hasVerdict = (value: unknown): boolean =>
  typeof value === "string" && (CEREMONY_ASSESS_VERDICTS as readonly string[]).includes(value);

const hasCheckState = (value: unknown): boolean =>
  typeof value === "string" && (CEREMONY_CHECK_STATES as readonly string[]).includes(value);

const hasFollowThroughVerdict = (value: unknown): boolean =>
  typeof value === "string" &&
  (CEREMONY_FOLLOW_THROUGH_VERDICTS as readonly string[]).includes(value);

const conformsForSchema = (schema: string, document: Record<string, unknown>): boolean => {
  if (document.schemaId !== schema) return false;
  if ((CEREMONY_BUILTIN_SCHEMAS as readonly string[]).includes(schema)) {
    return ceremonyBuiltinConforms(schema, document);
  }
  if (schema === "delivery.brief.v1") {
    const surfaces = document.surfaces;
    const anchors = document.anchorGroups;
    const placeholders = document.placeholders;
    return (
      Array.isArray(surfaces) &&
      surfaces.length === BRIEF_SURFACE_ORDER.length &&
      Array.isArray(anchors) &&
      anchors.length === BRIEF_ANCHOR_GROUPS.length &&
      Array.isArray(placeholders) &&
      placeholders.length === BRIEF_PLACEHOLDER_CATALOG.length
    );
  }
  if (schema === "delivery.ceremony.rollover.v1") {
    const entries = document.entries;
    return (
      Array.isArray(entries) &&
      entries.every(
        (entry) =>
          isRecord(entry) &&
          isNonEmptyString(entry.ref) &&
          (CEREMONY_CARRY_OVER_REASONS as readonly string[]).includes(String(entry.reason)) &&
          isNonEmptyString(entry.nextMilestone),
      )
    );
  }
  if (schema === "delivery.ceremony.night-watch.v1") {
    const checks = document.checks;
    if (!Array.isArray(checks) || checks.length !== CEREMONY_NIGHT_WATCH_CHECKS.length)
      return false;
    const ids = checks.map((entry) => (isRecord(entry) ? entry.id : undefined));
    return (
      CEREMONY_NIGHT_WATCH_CHECKS.every((id) => ids.filter((entry) => entry === id).length === 1) &&
      checks.every((entry) => isRecord(entry) && hasCheckState(entry.state))
    );
  }
  if (schema === "delivery.ceremony.assessment.v1") {
    const items = document.items;
    return (
      Array.isArray(items) &&
      items.every(
        (entry) => isRecord(entry) && isNonEmptyString(entry.item) && hasVerdict(entry.verdict),
      ) &&
      document.unassessedCount === 0
    );
  }
  if (schema === "delivery.ceremony.mirror-report.v1") {
    const targets = document.targets;
    return (
      Array.isArray(targets) &&
      targets.length > 0 &&
      targets.every(
        (entry) =>
          isRecord(entry) &&
          isNonEmptyString(entry.target) &&
          typeof entry.equal === "boolean" &&
          Array.isArray(entry.extra) &&
          Array.isArray(entry.missing),
      )
    );
  }
  if (schema === CEREMONY_NOTE_SCHEMA) {
    return true;
  }
  return true;
};

const verifyContent = (
  mode: CeremonyVerificationMode,
  schema: string,
  content: string,
): { readonly ok: true } | { readonly ok: false; readonly reason: string } => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, reason: "artifact is not valid JSON" };
  }
  if (!isRecord(parsed)) return { ok: false, reason: "artifact is not an object" };
  if (mode === "artifact-conforms") {
    return conformsForSchema(schema, parsed)
      ? { ok: true }
      : { ok: false, reason: `artifact does not conform to ${schema}` };
  }
  if (mode === "artifact-covers-items") {
    const items = Array.isArray(parsed.items)
      ? parsed.items
      : Array.isArray(parsed.checks)
        ? parsed.checks
        : undefined;
    if (items === undefined) {
      return { ok: false, reason: "artifact carries no covered items" };
    }
    if (items.length === 0) {
      return parsed.verifiedEmpty === true
        ? { ok: true }
        : { ok: false, reason: "an empty item set is not declared verified-empty" };
    }
    if (schema === "delivery.ceremony.night-watch.v1") {
      const ids = items.map((entry) => (isRecord(entry) ? entry.id : undefined));
      const exact = CEREMONY_NIGHT_WATCH_CHECKS.every(
        (id) => ids.filter((entry) => entry === id).length === 1,
      );
      if (!exact) return { ok: false, reason: "a declared check is missing or duplicated" };
    }
    if (schema === CEREMONY_FOLLOW_THROUGH_SCHEMA) {
      const unearned = items.find(
        (entry) =>
          !isRecord(entry) ||
          !isNonEmptyString(entry.evidenceRef) ||
          !hasFollowThroughVerdict(entry.verdict),
      );
      if (unearned !== undefined) {
        const item =
          isRecord(unearned) && isNonEmptyString(unearned.item) ? unearned.item : "an action";
        return {
          ok: false,
          reason: `follow-through action "${item}" carries no artifact-verified verdict`,
        };
      }
    }
    const covered = items.every(
      (entry) =>
        isRecord(entry) &&
        (hasVerdict(entry.verdict) ||
          hasCheckState(entry.state) ||
          hasFollowThroughVerdict(entry.verdict)) &&
        (entry.verdict !== undefined || entry.state !== undefined),
    );
    return covered ? { ok: true } : { ok: false, reason: "an item carries no closed-set verdict" };
  }
  const targets = parsed.targets;
  if (!Array.isArray(targets) || targets.length === 0) {
    return { ok: false, reason: "artifact carries no targets to compare" };
  }
  const equal = targets.every(
    (entry) =>
      isRecord(entry) &&
      entry.equal === true &&
      Array.isArray(entry.extra) &&
      entry.extra.length === 0 &&
      Array.isArray(entry.missing) &&
      entry.missing.length === 0,
  );
  return equal ? { ok: true } : { ok: false, reason: "target set differs from source set" };
};

const nowFor = (env: CeremonyRunEnvironment): number => env.clock.nowMs();

const executeStep = (input: {
  readonly step: CeremonyStepDeclaration;
  readonly phaseIndex: number;
  readonly index: number;
  readonly declaration: CeremonyDeclaration;
  readonly intake: CeremonyIntake;
  readonly runId: string;
  readonly env: CeremonyRunEnvironment;
  readonly apply: boolean;
}): { readonly record: CeremonyStepRecord; readonly content?: string } => {
  const startedAtMs = nowFor(input.env);
  const sources = stepSources(input.step, input.declaration);
  const { facts, degraded } = readDeclaredInputs(sources, input.intake.window, input.env);
  const rendered = renderForSchema({
    step: input.step,
    declaration: input.declaration,
    facts,
    degraded,
    note: input.intake.note,
    apply: input.apply,
    env: input.env,
    window: input.intake.window,
  });
  if (rendered.failure !== undefined) {
    const endedAtMs = nowFor(input.env);
    return {
      record: {
        schemaId: "delivery.ceremony.step.v1",
        runId: input.runId,
        index: input.index,
        phaseIndex: input.phaseIndex,
        kind: input.step.kind,
        outcome: "unverified",
        startedAtMs,
        endedAtMs,
        durationMs: Math.max(0, endedAtMs - startedAtMs),
        slot: primaryOutput(input.step).slot,
        artifactRef: "",
        verification: "unverified",
        reason: rendered.failure,
      },
    };
  }
  const content = artifactContent(rendered.content);
  const written = writeOutput(
    input.step,
    input.runId,
    input.intake.scopeKey.value,
    content,
    input.env,
  );
  if ("failure" in written) {
    const endedAtMs = nowFor(input.env);
    return {
      record: {
        schemaId: "delivery.ceremony.step.v1",
        runId: input.runId,
        index: input.index,
        phaseIndex: input.phaseIndex,
        kind: input.step.kind,
        outcome: "unverified",
        startedAtMs,
        endedAtMs,
        durationMs: Math.max(0, endedAtMs - startedAtMs),
        slot: written.slot,
        artifactRef: "",
        verification: "unverified",
        reason: written.failure,
      },
    };
  }
  if (
    primaryOutput(input.step).slot === "memory" &&
    input.env.memory !== undefined &&
    input.intake.note !== undefined
  ) {
    const existing = input.env.memory.readNote(input.intake.scopeKey.value);
    const wrote = input.env.memory.writeNote({
      scopeKey: input.intake.scopeKey.value,
      ...(input.intake.note.level === undefined ? {} : { level: input.intake.note.level }),
      body: content,
      append: existing.state === "present",
    });
    if (!wrote.ok) {
      const endedAtMs = nowFor(input.env);
      return {
        record: {
          schemaId: "delivery.ceremony.step.v1",
          runId: input.runId,
          index: input.index,
          phaseIndex: input.phaseIndex,
          kind: input.step.kind,
          outcome: "unverified",
          startedAtMs,
          endedAtMs,
          durationMs: Math.max(0, endedAtMs - startedAtMs),
          slot: "memory",
          artifactRef: written.ref,
          verification: "unverified",
          reason: wrote.detail,
        },
      };
    }
  }
  const read = readBack(input.step, input.runId, written.ref, input.env);
  const verified = read.ok
    ? verifyContent(input.step.verify, primaryOutput(input.step).schema, read.content)
    : { ok: false as const, reason: read.detail };
  const endedAtMs = nowFor(input.env);
  const outcome: CeremonyStepRecord["outcome"] = verified.ok
    ? input.step.kind === "sync" && !input.apply
      ? "dry-run"
      : "verified"
    : "unverified";
  return {
    record: {
      schemaId: "delivery.ceremony.step.v1",
      runId: input.runId,
      index: input.index,
      phaseIndex: input.phaseIndex,
      kind: input.step.kind,
      outcome,
      startedAtMs,
      endedAtMs,
      durationMs: Math.max(0, endedAtMs - startedAtMs),
      slot: primaryOutput(input.step).slot,
      artifactRef: written.ref,
      verification: verified.ok ? "verified" : "unverified",
      ...(verified.ok ? {} : { reason: verified.reason }),
    },
    content,
  };
};

/** Bound one compacted phase summary with an explicit truncation count (F-4). */
export const compactCeremonyCarried = (
  entries: readonly { readonly index: number; readonly kind: string; readonly content: string }[],
  maxBytes: number = CEREMONY_COMPACTION_MAX_BYTES,
  maxLines: number = CEREMONY_COMPACTION_MAX_LINES,
): {
  readonly summary: string;
  readonly bytes: number;
  readonly lines: number;
  readonly omitted: number;
} => {
  const lines = entries.map(
    (entry) =>
      `- step ${String(entry.index)} ${entry.kind}: ${entry.content.replaceAll("\n", " ").slice(0, 120)}`,
  );
  let omitted = 0;
  while (lines.length > maxLines) {
    lines.pop();
    omitted += 1;
  }
  let summary = lines.join("\n");
  if (omitted > 0) {
    while (lines.length >= maxLines) {
      lines.pop();
      omitted += 1;
    }
    lines.push(`omitted: ${String(omitted)}`);
    summary = lines.join("\n");
  }
  while (utf8Bytes(summary) > maxBytes && lines.length > 0) {
    lines.pop();
    omitted += 1;
    lines.push(`omitted: ${String(omitted)}`);
    summary = lines.join("\n");
  }
  return { summary, bytes: utf8Bytes(summary), lines: summary.split("\n").length, omitted };
};

const failureFrom = (code: string, summary: string, field?: string): CeremonyEngineFailure => ({
  code,
  summary,
  ...(field === undefined ? {} : { field }),
});

const recordedVerdict = (steps: readonly CeremonyStepRecord[]): CeremonyRunVerdict => {
  if (steps.some((step) => step.outcome === "unverified")) return "unverified";
  if (steps.some((step) => step.outcome === "dry-run")) return "dry-run";
  return "verified";
};

const reasonForRead = (verdict: string): string =>
  verdict === "torn" ? "state.store.torn" : "state.store.unknown";

const runRecordFor = (input: {
  readonly intake: CeremonyIntake;
  readonly runId: string;
  readonly origin: CeremonyRunOrigin;
  readonly startedAtMs: number;
  readonly tier: CeremonyTierVerdict | undefined;
  readonly declaration: CeremonyDeclaration;
}): CeremonyRunRecord => ({
  schemaId: CEREMONY_RUN_PAYLOAD_SCHEMA,
  ceremonyId: input.declaration.id,
  runId: input.runId,
  origin: input.origin,
  declarationDigest: ceremonyDeclarationDigest(input.declaration),
  trigger: input.intake.trigger,
  scopeKey: input.intake.scopeKey,
  tier:
    input.tier === undefined
      ? {
          effectiveTier: "full",
          phaseSetSize: PM_NOTES_REQUIRED_PHASES_BY_VARIANT.full.length,
          escalations: [],
        }
      : {
          effectiveTier: input.tier.effectiveTier,
          phaseSetSize: input.tier.phaseSet.length,
          escalations: input.tier.escalations,
        },
  startedAtMs: input.startedAtMs,
  phaseCount: input.declaration.agenda.length,
});

const stepOutcomeOf = (record: CeremonyStepRecord): CeremonyStepOutcome => ({
  index: record.index,
  phaseIndex: record.phaseIndex,
  kind: record.kind,
  outcome: record.outcome,
  artifactRef: record.artifactRef,
  verification: record.verification,
  durationMs: record.durationMs,
  ...(record.reason === undefined ? {} : { reason: record.reason }),
});

/** Execute the declared agenda from one flattened index, appending every record. */
export const executeCeremonyAgenda = (input: {
  readonly declaration: CeremonyDeclaration;
  readonly intake: CeremonyIntake;
  readonly runId: string;
  readonly env: CeremonyRunEnvironment;
  readonly apply: boolean;
  readonly startIndex?: number;
}):
  | {
      readonly ok: true;
      readonly records: readonly CeremonyStepRecord[];
      readonly carried: readonly CeremonyCarriedSummary[];
    }
  | { readonly ok: false; readonly error: CeremonyEngineFailure } => {
  const flattened = flattenCeremonyAgenda(input.declaration);
  const startIndex = input.startIndex ?? 1;
  const records: CeremonyStepRecord[] = [];
  const carried: CeremonyCarriedSummary[] = [];
  let phaseEntries: { index: number; kind: string; content: string }[] = [];
  let previousPhase = -1;
  for (const entry of flattened) {
    if (entry.index < startIndex) continue;
    if (entry.phaseIndex !== previousPhase && previousPhase >= 0) {
      if (input.declaration.compaction.atPhases.includes(previousPhase)) {
        const summary = compactCeremonyCarried(
          phaseEntries,
          input.declaration.compaction.maxBytes,
          input.declaration.compaction.maxLines,
        );
        carried.push({ phaseIndex: previousPhase, ...summary });
      }
      phaseEntries = [];
    }
    previousPhase = entry.phaseIndex;
    const executed = executeStep({
      step: entry.step,
      phaseIndex: entry.phaseIndex,
      index: entry.index,
      declaration: input.declaration,
      intake: input.intake,
      runId: input.runId,
      env: input.env,
      apply: input.apply,
    });
    const appended = input.env.records.appendStep(executed.record);
    if (!appended.ok) {
      return {
        ok: false,
        error: failureFrom(appended.code, appended.detail ?? "step append failed"),
      };
    }
    records.push(executed.record);
    if (executed.content !== undefined) {
      phaseEntries.push({ index: entry.index, kind: entry.step.kind, content: executed.content });
    }
    if (executed.record.outcome === "unverified") {
      return { ok: true, records, carried };
    }
  }
  if (previousPhase >= 0 && input.declaration.compaction.atPhases.includes(previousPhase)) {
    const summary = compactCeremonyCarried(
      phaseEntries,
      input.declaration.compaction.maxBytes,
      input.declaration.compaction.maxLines,
    );
    carried.push({ phaseIndex: previousPhase, ...summary });
  }
  return { ok: true, records, carried };
};

/** Run one ceremony: intake, idempotency, agenda, records, verdict. */
export const runCeremony = (request: CeremonyRunRequest): CeremonyRunOutcome => {
  const nowMs = request.env.clock.nowMs();
  const intake = resolveCeremonyIntake({
    declaration: request.declaration,
    ...(request.note === undefined ? {} : { note: request.note }),
    noteSupplied: request.noteSupplied,
    ...(request.window === undefined ? {} : { window: request.window }),
    repositoryId: request.env.repositoryId,
    nowMs,
    ...(request.tier === undefined ? {} : { tier: request.tier }),
  });
  if (!intake.ok) {
    return {
      ok: false,
      error: failureFrom(intake.error.code, intake.error.summary, intake.error.field),
    };
  }
  const resolved: CeremonyIntake =
    request.catchUp === undefined
      ? intake.value
      : {
          ...intake.value,
          trigger: {
            kind: "catch-up",
            resolution: intake.value.trigger.declared === undefined ? "unspecified" : "declaration",
            ...(intake.value.trigger.declared === undefined
              ? { declaredSet: intake.value.trigger.declaredSet ?? [] }
              : { declared: intake.value.trigger.declared }),
            declaredWindow: request.catchUp.missedWindow,
            actualWindow: request.catchUp.missedWindow,
            executionWindow: request.catchUp.executionWindow,
            catchUp: true,
          },
        };

  const runsRead = request.env.records.readRuns();
  if (runsRead.verdict === "torn" || runsRead.verdict === "unknown") {
    return {
      ok: false,
      error: failureFrom(
        reasonForRead(runsRead.verdict),
        runsRead.detail ?? "ceremony records are unreadable",
        "runId",
      ),
    };
  }
  const identity: CeremonyRunIdentity = resolved.identity;
  const existing = runsRead.records.find(
    (run) =>
      run.ceremonyId === identity.ceremonyId &&
      run.scopeKey.value === identity.scopeKey &&
      run.trigger.actualWindow.start === identity.windowStart &&
      run.trigger.actualWindow.end === identity.windowEnd,
  );
  if (existing !== undefined) {
    const stepsRead = request.env.records.readSteps(existing.runId);
    if (stepsRead.verdict === "torn" || stepsRead.verdict === "unknown") {
      return {
        ok: false,
        error: failureFrom(
          reasonForRead(stepsRead.verdict),
          stepsRead.detail ?? "step records are unreadable",
          "runId",
        ),
      };
    }
    return {
      ok: true,
      data: {
        ceremony: request.declaration.id,
        runId: existing.runId,
        verdict: recordedVerdict(stepsRead.records),
        reused: true,
        origin: existing.origin,
        trigger: existing.trigger,
        scopeKey: existing.scopeKey,
        window: existing.trigger.actualWindow,
        steps: stepsRead.records.map(stepOutcomeOf),
        applied:
          request.apply &&
          stepsRead.records.some((step) => step.kind === "sync" && step.outcome === "verified"),
        carried: [],
        ...(request.tier === undefined ? {} : { tier: request.tier }),
        ...(request.catchUp === undefined ? {} : { catchUp: request.catchUp }),
      },
    };
  }

  const runId = request.env.ids.nextRunId();
  const startedAtMs = nowMs;
  const origin = request.env.origin ?? "built-in";
  const runRecord = runRecordFor({
    intake: resolved,
    runId,
    origin,
    startedAtMs,
    tier: request.tier,
    declaration: request.declaration,
  });
  const appendedRun = request.env.records.appendRun(runRecord);
  if (!appendedRun.ok) {
    return {
      ok: false,
      error: failureFrom(appendedRun.code, appendedRun.detail ?? "run append failed", "runId"),
    };
  }
  const agenda = executeCeremonyAgenda({
    declaration: request.declaration,
    intake: resolved,
    runId,
    env: request.env,
    apply: request.apply,
  });
  if (!agenda.ok) return { ok: false, error: agenda.error };
  const verdict = recordedVerdict(agenda.records);
  return {
    ok: true,
    data: {
      ceremony: request.declaration.id,
      runId,
      verdict,
      reused: false,
      origin,
      trigger: resolved.trigger,
      scopeKey: resolved.scopeKey,
      window: resolved.window,
      steps: agenda.records.map(stepOutcomeOf),
      applied:
        request.apply &&
        agenda.records.some((step) => step.kind === "sync" && step.outcome === "verified"),
      carried: agenda.carried,
      ...(request.tier === undefined ? {} : { tier: request.tier }),
      ...(request.catchUp === undefined ? {} : { catchUp: request.catchUp }),
    },
  };
};

/** Inert `--apply` control: a declaration with no `sync` step is identical. */
export const declarationHasSyncStep = (declaration: CeremonyDeclaration): boolean =>
  flattenCeremonyAgenda(declaration).some((entry) => entry.step.kind === "sync");
