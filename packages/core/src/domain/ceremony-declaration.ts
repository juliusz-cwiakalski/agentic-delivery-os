/**
 * The single ceremony declaration validator (GH-296 F-2, F-6; DM-1, DM-9).
 *
 * One pure validator serves the six built-in declarations and every project
 * declaration: the same vocabularies, the same bounds, the same refusals. It
 * never defaults, coerces, executes, or reads anything; a declaration is data
 * and a violation is `ceremony.declaration.invalid` naming the ceremony id and
 * the offending field. No clock, randomness, environment, network, or
 * filesystem access lives here.
 */
import {
  CEREMONY_AT_PATTERN,
  CEREMONY_CADENCES,
  CEREMONY_CATCH_UP_MODES,
  CEREMONY_DECLARATIONS_SCHEMA,
  CEREMONY_DECLARATION_LIMITS,
  CEREMONY_ID_PATTERN,
  CEREMONY_INPUT_SOURCES,
  CEREMONY_OUTPUT_SLOTS,
  CEREMONY_SCOPE_KEY_KINDS,
  CEREMONY_STEP_KINDS,
  CEREMONY_TRIGGER_EVENTS,
  CEREMONY_VERIFICATION_MODES,
  type CeremonyDeclaration,
  type CeremonyDocument,
} from "#contracts";
import { PLAN_KNOWN_TIERS } from "#contracts";

/** The refusal identity the validator reports (DM-9). */
export const CEREMONY_DECLARATION_INVALID = "ceremony.declaration.invalid" as const;

/** One validation refusal: the identity plus the named field (DM-9). */
export type CeremonyDeclarationFailure = {
  readonly code: typeof CEREMONY_DECLARATION_INVALID;
  readonly field: string;
  readonly summary: string;
};

/** The result of validating one declaration or document. */
export type CeremonyDeclarationValidation<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: CeremonyDeclarationFailure };

/** One validation option: ids a project declaration must never shadow (F-6). */
export type CeremonyDeclarationValidationOptions = {
  readonly reservedIds?: readonly string[];
  /** The document's measured UTF-8 byte length, when the caller has it. */
  readonly documentBytes?: number;
};

const ID_PATTERN = new RegExp(CEREMONY_ID_PATTERN);
const AT_PATTERN = new RegExp(CEREMONY_AT_PATTERN);
const STEP_KINDS: ReadonlySet<string> = new Set(CEREMONY_STEP_KINDS);
const OUTPUT_SLOTS: ReadonlySet<string> = new Set(CEREMONY_OUTPUT_SLOTS);
const VERIFICATION_MODES: ReadonlySet<string> = new Set(CEREMONY_VERIFICATION_MODES);
const TRIGGER_EVENTS: ReadonlySet<string> = new Set(CEREMONY_TRIGGER_EVENTS);
const CADENCES: ReadonlySet<string> = new Set(CEREMONY_CADENCES);
const CATCH_UP_MODES: ReadonlySet<string> = new Set(CEREMONY_CATCH_UP_MODES);
const SCOPE_KINDS: ReadonlySet<string> = new Set(CEREMONY_SCOPE_KEY_KINDS);
const INPUT_SOURCES: ReadonlySet<string> = new Set(CEREMONY_INPUT_SOURCES);
const TIERS: ReadonlySet<string> = new Set(PLAN_KNOWN_TIERS);
const EXECUTABLE_KEYS: ReadonlySet<string> = new Set([
  "command",
  "commands",
  "path",
  "paths",
  "model",
  "models",
  "script",
  "scripts",
  "instruction",
  "instructions",
  "exec",
  "shell",
  "handler",
  "function",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

/** UTF-8 byte length computed from code points (no runtime encoder). */
export const ceremonyUtf8Bytes = (value: string): number => {
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

/** The deterministic declaration digest: a pure FNV-1a hex over the JSON text. */
export const ceremonyDeclarationDigest = (declaration: CeremonyDeclaration): string => {
  const text = JSON.stringify(declaration);
  let hash = 0xcbf29ce484222325n;
  for (const character of text) {
    const point = character.codePointAt(0) ?? 0;
    hash ^= BigInt(point);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
};

const fail = (field: string, detail: string, id?: string): CeremonyDeclarationFailure => ({
  code: CEREMONY_DECLARATION_INVALID,
  field,
  summary:
    id === undefined
      ? `ceremony declaration ${field}: ${detail}`
      : `ceremony "${id}" ${field}: ${detail}`,
});

/** Walk every node and refuse any executable-content member (F-2, RSK-2). */
export const ceremonyExecutableField = (value: unknown, path = ""): string | undefined => {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = ceremonyExecutableField(value[index], `${path}[${String(index)}]`);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  for (const [key, entry] of Object.entries(value)) {
    const next = path.length === 0 ? key : `${path}.${key}`;
    if (EXECUTABLE_KEYS.has(key)) return next;
    const found = ceremonyExecutableField(entry, next);
    if (found !== undefined) return found;
  }
  return undefined;
};

const validateTriggers = (
  triggers: unknown,
  id: string,
): CeremonyDeclarationFailure | undefined => {
  if (!Array.isArray(triggers) || triggers.length === 0) {
    return fail("triggers[]", "must declare at least one trigger", id);
  }
  if (triggers.length > CEREMONY_DECLARATION_LIMITS.triggers) {
    return fail(
      "triggers[]",
      `declares ${String(triggers.length)} triggers; the bound is ${String(CEREMONY_DECLARATION_LIMITS.triggers)}`,
      id,
    );
  }
  let schedules = 0;
  for (let index = 0; index < triggers.length; index += 1) {
    const trigger = triggers[index];
    if (!isRecord(trigger)) return fail(`triggers[${String(index)}]`, "must be an object", id);
    if (trigger.kind === "schedule") {
      schedules += 1;
      if (schedules > 1) {
        return fail("triggers[]", "declares more than one schedule trigger", id);
      }
      if (typeof trigger.cadence !== "string" || !CADENCES.has(trigger.cadence)) {
        return fail(`triggers[${String(index)}].cadence`, "is not a declared cadence", id);
      }
      if (
        trigger.at !== undefined &&
        (typeof trigger.at !== "string" || !AT_PATTERN.test(trigger.at))
      ) {
        return fail(`triggers[${String(index)}].at`, "is not a valid UTC minute-of-day", id);
      }
      continue;
    }
    if (trigger.kind === "event") {
      if (typeof trigger.event !== "string" || !TRIGGER_EVENTS.has(trigger.event)) {
        return fail(`triggers[${String(index)}].event`, "is not a declared event", id);
      }
      continue;
    }
    return fail(`triggers[${String(index)}].kind`, "is not a declared trigger kind", id);
  }
  return undefined;
};

const validateInputs = (inputs: unknown, id: string): CeremonyDeclarationFailure | undefined => {
  if (!Array.isArray(inputs)) return fail("inputs[]", "must be an array", id);
  if (inputs.length > CEREMONY_DECLARATION_LIMITS.inputs) {
    return fail(
      "inputs[]",
      `declares ${String(inputs.length)} inputs; the bound is ${String(CEREMONY_DECLARATION_LIMITS.inputs)}`,
      id,
    );
  }
  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index];
    if (!isRecord(input)) return fail(`inputs[${String(index)}]`, "must be an object", id);
    if (typeof input.source !== "string" || !INPUT_SOURCES.has(input.source)) {
      return fail(`inputs[${String(index)}].source`, "is not a declared input source", id);
    }
    if (input.window !== undefined && typeof input.window !== "boolean") {
      return fail(`inputs[${String(index)}].window`, "must be a boolean", id);
    }
  }
  return undefined;
};

const validateAgenda = (agenda: unknown, id: string): CeremonyDeclarationFailure | undefined => {
  if (!Array.isArray(agenda) || agenda.length === 0) {
    return fail("agenda[]", "must declare at least one phase", id);
  }
  if (agenda.length > CEREMONY_DECLARATION_LIMITS.phases) {
    return fail(
      "agenda[]",
      `declares ${String(agenda.length)} phases; the bound is ${String(CEREMONY_DECLARATION_LIMITS.phases)}`,
      id,
    );
  }
  let steps = 0;
  let mirrorTargets = 0;
  for (let phaseIndex = 0; phaseIndex < agenda.length; phaseIndex += 1) {
    const phase = agenda[phaseIndex];
    if (!isRecord(phase)) return fail(`agenda[${String(phaseIndex)}]`, "must be an object", id);
    if (!isNonEmptyString(phase.id)) {
      return fail(`agenda[${String(phaseIndex)}].id`, "must be a non-empty identifier", id);
    }
    if (!Array.isArray(phase.steps) || phase.steps.length === 0) {
      return fail(`agenda[${String(phaseIndex)}].steps[]`, "must declare at least one step", id);
    }
    for (let stepIndex = 0; stepIndex < phase.steps.length; stepIndex += 1) {
      steps += 1;
      if (steps > CEREMONY_DECLARATION_LIMITS.steps) {
        return fail(
          "agenda[].steps[]",
          `declares more than ${String(CEREMONY_DECLARATION_LIMITS.steps)} steps`,
          id,
        );
      }
      const step = phase.steps[stepIndex];
      const label = `agenda[${String(phaseIndex)}].steps[${String(stepIndex)}]`;
      if (!isRecord(step)) return fail(label, "must be an object", id);
      if (typeof step.kind !== "string" || !STEP_KINDS.has(step.kind)) {
        return fail(`${label}.kind`, "is not a declared step kind", id);
      }
      if (typeof step.verify !== "string" || !VERIFICATION_MODES.has(step.verify)) {
        return fail(`${label}.verify`, "is not a declared verification mode", id);
      }
      if (step.inputs !== undefined) {
        if (!isStringArray(step.inputs))
          return fail(`${label}.inputs`, "must be a string array", id);
        for (const source of step.inputs) {
          if (!INPUT_SOURCES.has(source)) {
            return fail(`${label}.inputs[]`, `names undeclared input "${source}"`, id);
          }
        }
      }
      if (!Array.isArray(step.outputs) || step.outputs.length === 0) {
        return fail(`${label}.outputs[]`, "must declare at least one output", id);
      }
      for (let outputIndex = 0; outputIndex < step.outputs.length; outputIndex += 1) {
        const output = step.outputs[outputIndex];
        const outputLabel = `${label}.outputs[${String(outputIndex)}]`;
        if (!isRecord(output)) return fail(outputLabel, "must be an object", id);
        if (typeof output.slot !== "string" || !OUTPUT_SLOTS.has(output.slot)) {
          return fail(`${outputLabel}.slot`, "is not a declared output slot", id);
        }
        if (!isNonEmptyString(output.schema)) {
          return fail(`${outputLabel}.schema`, "must declare a schema identifier", id);
        }
        if (output.slot === "mirror-target") mirrorTargets += 1;
      }
    }
  }
  if (mirrorTargets > CEREMONY_DECLARATION_LIMITS.targets) {
    return fail(
      "agenda[].outputs[]",
      `declares ${String(mirrorTargets)} mirror targets; the bound is ${String(CEREMONY_DECLARATION_LIMITS.targets)}`,
      id,
    );
  }
  return undefined;
};

const validateScopeKey = (
  scopeKey: unknown,
  note: unknown,
  id: string,
): CeremonyDeclarationFailure | undefined => {
  if (!isRecord(scopeKey)) return fail("scopeKey", "is required", id);
  if (typeof scopeKey.kind !== "string" || !SCOPE_KINDS.has(scopeKey.kind)) {
    return fail("scopeKey", "is not a declared derivation", id);
  }
  if (scopeKey.kind === "literal") {
    if (!isNonEmptyString(scopeKey.value) || !ID_PATTERN.test(scopeKey.value)) {
      return fail("scopeKey", "declares a malformed literal token", id);
    }
    if (scopeKey.value.length > CEREMONY_DECLARATION_LIMITS.idLength) {
      return fail("scopeKey", "declares an over-length literal token", id);
    }
  }
  if (scopeKey.kind === "note") {
    const required = isRecord(note) && note.required === true;
    if (!required) {
      return fail("scopeKey", "derives from a note while requiring no note", id);
    }
  }
  return undefined;
};

const validateNote = (note: unknown, id: string): CeremonyDeclarationFailure | undefined => {
  if (note === undefined) return undefined;
  if (!isRecord(note)) return fail("note", "must be an object", id);
  if (typeof note.required !== "boolean") return fail("note.required", "must be a boolean", id);
  if (!isNonEmptyString(note.schema)) return fail("note.schema", "must be a schema identifier", id);
  if (note.scopeKey !== "required") return fail("note.scopeKey", 'must be "required"', id);
  return undefined;
};

const validateCatchUp = (catchUp: unknown, id: string): CeremonyDeclarationFailure | undefined => {
  if (!isRecord(catchUp)) return fail("catchUp", "is required", id);
  if (typeof catchUp.mode !== "string" || !CATCH_UP_MODES.has(catchUp.mode)) {
    return fail("catchUp.mode", "is not a declared catch-up mode", id);
  }
  if (catchUp.maxMissedWindows !== 1) {
    return fail("catchUp.maxMissedWindows", "must equal 1", id);
  }
  return undefined;
};

const validateCompaction = (
  compaction: unknown,
  phaseCount: number,
  id: string,
): CeremonyDeclarationFailure | undefined => {
  if (!isRecord(compaction)) return fail("compaction", "is required", id);
  if (!Array.isArray(compaction.atPhases)) {
    return fail("compaction.atPhases", "must be an array", id);
  }
  for (const phaseIndex of compaction.atPhases) {
    if (
      typeof phaseIndex !== "number" ||
      !Number.isInteger(phaseIndex) ||
      phaseIndex < 0 ||
      phaseIndex >= phaseCount
    ) {
      return fail("compaction.atPhases[]", "names an undeclared phase index", id);
    }
  }
  if (
    typeof compaction.maxBytes !== "number" ||
    !Number.isInteger(compaction.maxBytes) ||
    compaction.maxBytes <= 0 ||
    compaction.maxBytes > CEREMONY_DECLARATION_LIMITS.compactionBytes
  ) {
    return fail(
      "compaction.maxBytes",
      `must be a positive integer at or below ${String(CEREMONY_DECLARATION_LIMITS.compactionBytes)}`,
      id,
    );
  }
  if (
    typeof compaction.maxLines !== "number" ||
    !Number.isInteger(compaction.maxLines) ||
    compaction.maxLines <= 0 ||
    compaction.maxLines > CEREMONY_DECLARATION_LIMITS.compactionLines
  ) {
    return fail(
      "compaction.maxLines",
      `must be a positive integer at or below ${String(CEREMONY_DECLARATION_LIMITS.compactionLines)}`,
      id,
    );
  }
  return undefined;
};

/** Validate one declaration against the closed contract (F-2). */
export const validateCeremonyDeclaration = (
  value: unknown,
  options: CeremonyDeclarationValidationOptions = {},
): CeremonyDeclarationValidation<CeremonyDeclaration> => {
  if (!isRecord(value)) {
    return { ok: false, error: fail("declaration", "must be an object") };
  }
  const idValue = value.id;
  if (typeof idValue !== "string" || !ID_PATTERN.test(idValue)) {
    return { ok: false, error: fail("id", "must match ^[a-z][a-z0-9-]*$") };
  }
  if (idValue.length > CEREMONY_DECLARATION_LIMITS.idLength) {
    return { ok: false, error: fail("id", "is longer than 64 characters", idValue) };
  }
  if ((options.reservedIds ?? []).includes(idValue)) {
    return { ok: false, error: fail("id", "collides with a built-in declaration", idValue) };
  }
  if (!isNonEmptyString(value.title)) {
    return { ok: false, error: fail("title", "must be a non-empty one-line title", idValue) };
  }
  if (!isStringArray(value.tiers) || value.tiers.length === 0) {
    return { ok: false, error: fail("tiers[]", "must declare at least one tier", idValue) };
  }
  for (const tier of value.tiers) {
    if (!TIERS.has(tier)) {
      return { ok: false, error: fail("tiers[]", `names undeclared tier "${tier}"`, idValue) };
    }
  }
  const executable = ceremonyExecutableField(value);
  if (executable !== undefined) {
    return { ok: false, error: fail(executable, "carries executable content", idValue) };
  }
  const triggerFailure = validateTriggers(value.triggers, idValue);
  if (triggerFailure !== undefined) return { ok: false, error: triggerFailure };
  const inputFailure = validateInputs(value.inputs, idValue);
  if (inputFailure !== undefined) return { ok: false, error: inputFailure };
  const agendaFailure = validateAgenda(value.agenda, idValue);
  if (agendaFailure !== undefined) return { ok: false, error: agendaFailure };
  const noteFailure = validateNote(value.note, idValue);
  if (noteFailure !== undefined) return { ok: false, error: noteFailure };
  const scopeFailure = validateScopeKey(value.scopeKey, value.note, idValue);
  if (scopeFailure !== undefined) return { ok: false, error: scopeFailure };
  const catchUpFailure = validateCatchUp(value.catchUp, idValue);
  if (catchUpFailure !== undefined) return { ok: false, error: catchUpFailure };
  const agenda = Array.isArray(value.agenda) ? value.agenda : [];
  const compactionFailure = validateCompaction(value.compaction, agenda.length, idValue);
  if (compactionFailure !== undefined) return { ok: false, error: compactionFailure };
  return { ok: true, value: value as unknown as CeremonyDeclaration };
};

/** Validate one declaration document: schema, bound, uniqueness, every entry. */
export const validateCeremonyDocument = (
  value: unknown,
  options: CeremonyDeclarationValidationOptions = {},
): CeremonyDeclarationValidation<CeremonyDocument> => {
  if (!isRecord(value)) {
    return { ok: false, error: fail("document", "must be an object") };
  }
  if (value.schemaVersion !== CEREMONY_DECLARATIONS_SCHEMA) {
    return {
      ok: false,
      error: fail("schemaVersion", `must equal "${CEREMONY_DECLARATIONS_SCHEMA}"`),
    };
  }
  if (!Array.isArray(value.ceremonies)) {
    return { ok: false, error: fail("ceremonies[]", "must be an array") };
  }
  if (value.ceremonies.length > CEREMONY_DECLARATION_LIMITS.ceremoniesPerDocument) {
    return {
      ok: false,
      error: fail(
        "ceremonies[]",
        `declares ${String(value.ceremonies.length)} ceremonies; the bound is ${String(CEREMONY_DECLARATION_LIMITS.ceremoniesPerDocument)}`,
      ),
    };
  }
  const bytes = options.documentBytes ?? ceremonyUtf8Bytes(JSON.stringify(value));
  if (bytes > CEREMONY_DECLARATION_LIMITS.documentBytes) {
    return {
      ok: false,
      error: fail(
        "document",
        `is ${String(bytes)} bytes; the bound is ${String(CEREMONY_DECLARATION_LIMITS.documentBytes)}`,
      ),
    };
  }
  const seen = new Set<string>();
  const reserved = new Set(options.reservedIds ?? []);
  for (let index = 0; index < value.ceremonies.length; index += 1) {
    const entry = value.ceremonies[index];
    const validated = validateCeremonyDeclaration(entry, options);
    if (!validated.ok) return validated;
    const id = validated.value.id;
    if (seen.has(id)) {
      return { ok: false, error: fail("id", `duplicates ceremony id "${id}"`, id) };
    }
    if (reserved.has(id)) {
      return { ok: false, error: fail("id", "collides with a built-in declaration", id) };
    }
    seen.add(id);
  }
  return { ok: true, value: value as unknown as CeremonyDocument };
};

/** Resolve the declaration's single trigger label, when it declares exactly one. */
export const ceremonySingleTriggerLabel = (
  declaration: CeremonyDeclaration,
): string | undefined => {
  if (declaration.triggers.length !== 1) return undefined;
  const [trigger] = declaration.triggers;
  if (trigger === undefined) return undefined;
  if (trigger.kind === "schedule") {
    return `schedule:${trigger.cadence}${trigger.at === undefined ? "" : `@${trigger.at}`}`;
  }
  return `event:${trigger.event}`;
};

/** Render every declared trigger as its stable label (for `unspecified` runs). */
export const ceremonyTriggerLabels = (declaration: CeremonyDeclaration): readonly string[] =>
  declaration.triggers.map((trigger) =>
    trigger.kind === "schedule"
      ? `schedule:${trigger.cadence}${trigger.at === undefined ? "" : `@${trigger.at}`}`
      : `event:${trigger.event}`,
  );

/** The declaration's single schedule trigger, when it declares one (F-1). */
export const ceremonyScheduleTrigger = (
  declaration: CeremonyDeclaration,
): Extract<CeremonyDeclaration["triggers"][number], { kind: "schedule" }> | undefined =>
  declaration.triggers.find((trigger) => trigger.kind === "schedule") as
    | Extract<CeremonyDeclaration["triggers"][number], { kind: "schedule" }>
    | undefined;
