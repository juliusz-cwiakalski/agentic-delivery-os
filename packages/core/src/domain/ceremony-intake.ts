/**
 * Ceremony intake (GH-296 F-1, F-2, F-4, F-9; DEC-16, DEC-17, DEC-18).
 *
 * Pure resolution of the four values a run identity needs — the declaration's
 * scope key, the run's window, the validated note, and the recorded trigger
 * provenance — plus the explicit-run resolution rule. Every input arrives
 * through the request; no clock, randomness, environment, or I/O lives here.
 */
import {
  CEREMONY_CADENCE_WINDOW_DAYS,
  CEREMONY_NOTE_SCHEMA,
  CEREMONY_LEVELS,
  CEREMONY_SCOPE_KEY_KINDS,
  type CeremonyCadence,
  type CeremonyDeclaration,
  type CeremonyLevel,
  type CeremonyNote,
  type CeremonyRecordedTrigger,
  type CeremonyScopeKeyKind,
  type CeremonyTierVerdict,
  type CeremonyTriggerResolution,
  type CeremonyWindow,
} from "#contracts";
import {
  ceremonySingleTriggerLabel,
  ceremonyTriggerLabels,
  validateCeremonyDeclaration,
} from "./ceremony-declaration.js";

/** The refusal identity one intake refusal carries. */
export type CeremonyIntakeFailureCode =
  | "input.value.rejected"
  | "ceremony.note-invalid"
  | "ceremony.declaration.invalid";

/** One intake refusal naming the field when the contract requires it. */
export type CeremonyIntakeFailure = {
  readonly code: CeremonyIntakeFailureCode;
  readonly summary: string;
  readonly field?: string;
};

/** The resolved run identity. */
export type CeremonyRunIdentity = {
  readonly ceremonyId: string;
  readonly scopeKey: string;
  readonly windowStart: string;
  readonly windowEnd: string;
};

/** Everything a validated intake resolves. */
export type CeremonyIntake = {
  readonly declaration: CeremonyDeclaration;
  readonly note?: CeremonyNote;
  readonly scopeKey: { readonly value: string; readonly derivation: CeremonyScopeKeyKind };
  readonly window: CeremonyWindow;
  readonly identity: CeremonyRunIdentity;
  readonly trigger: CeremonyRecordedTrigger;
  readonly tier?: CeremonyTierVerdict;
};

/** One intake request; every fact is injected. */
export type CeremonyIntakeRequest = {
  readonly declaration: CeremonyDeclaration;
  readonly note?: CeremonyNote;
  readonly noteSupplied: boolean;
  readonly window?: CeremonyWindow;
  readonly repositoryId: string;
  readonly nowMs: number;
  readonly tier?: CeremonyTierVerdict;
};

export type CeremonyIntakeOutcome =
  | { readonly ok: true; readonly value: CeremonyIntake }
  | { readonly ok: false; readonly error: CeremonyIntakeFailure };

const reject = (summary: string, field?: string): CeremonyIntakeOutcome => ({
  ok: false,
  error: {
    code: "input.value.rejected",
    summary,
    ...(field === undefined ? {} : { field }),
  },
});

const noteInvalid = (summary: string, field: string): CeremonyIntakeOutcome => ({
  ok: false,
  error: { code: "ceremony.note-invalid", summary, field },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isWindow = (value: unknown): value is CeremonyWindow => {
  if (!isRecord(value)) return false;
  if (!isNonEmptyString(value.start) || !isNonEmptyString(value.end)) return false;
  if (value.start.length === 0 || value.end.length === 0) return false;
  return value.start <= value.end;
};

const sameWindow = (left: CeremonyWindow, right: CeremonyWindow): boolean =>
  left.start === right.start && left.end === right.end;

const iso = (ms: number): string => new Date(ms).toISOString();

const DAY_MS = 86_400_000;

/**
 * Derive the declared cadence's current UTC window from the injected clock.
 * Daily is the UTC day; weekly is the ISO week (Monday start); iteration and
 * milestone use the declared fixed-length window anchored at the Unix epoch.
 */
export const deriveCeremonyCadenceWindow = (
  cadence: CeremonyCadence,
  nowMs: number,
): CeremonyWindow => {
  if (cadence === "daily") {
    const startMs = Math.floor(nowMs / DAY_MS) * DAY_MS;
    return { start: iso(startMs), end: iso(startMs + DAY_MS - 1) };
  }
  if (cadence === "weekly") {
    const date = new Date(nowMs);
    const day = (date.getUTCDay() + 6) % 7;
    const midnight =
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - day * DAY_MS;
    return { start: iso(midnight), end: iso(midnight + 7 * DAY_MS - 1) };
  }
  const length = CEREMONY_CADENCE_WINDOW_DAYS[cadence] * DAY_MS;
  const startMs = Math.floor(nowMs / length) * length;
  return { start: iso(startMs), end: iso(startMs + length - 1) };
};

/** Match a note's `trigger` member to one of the declaration's trigger labels. */
export const matchDeclaredTrigger = (
  declaration: CeremonyDeclaration,
  noteTrigger: string,
): string | undefined => {
  const labels = ceremonyTriggerLabels(declaration);
  if (labels.includes(noteTrigger)) return noteTrigger;
  const eventMatch = declaration.triggers.find(
    (trigger) => trigger.kind === "event" && trigger.event === noteTrigger,
  );
  if (eventMatch !== undefined) return `event:${noteTrigger}`;
  const scheduleMatch = declaration.triggers.find(
    (trigger) =>
      trigger.kind === "schedule" &&
      (noteTrigger === trigger.cadence || noteTrigger === `schedule:${trigger.cadence}`),
  );
  if (scheduleMatch !== undefined && scheduleMatch.kind === "schedule") {
    return `schedule:${scheduleMatch.cadence}`;
  }
  return undefined;
};

const RETRO_FIXED_MEMBERS = [
  "participants",
  "evidenceRefs",
  "facts",
  "interpretations",
  "wins",
  "gaps",
  "candidateLessons",
  "actions",
  "confidence",
] as const;

const validateRetroNote = (note: CeremonyNote): CeremonyIntakeFailure | undefined => {
  for (const member of RETRO_FIXED_MEMBERS) {
    if (note[member] === undefined) {
      return {
        code: "ceremony.note-invalid",
        summary: `ceremony note is missing its required member "${member}"`,
        field: member,
      };
    }
  }
  if (!Array.isArray(note.wins)) {
    return {
      code: "ceremony.note-invalid",
      summary: 'ceremony note member "wins" must be an array',
      field: "wins",
    };
  }
  for (const win of note.wins) {
    if (!isRecord(win) || !isNonEmptyString(win.text) || !isNonEmptyString(win.mechanism)) {
      return {
        code: "ceremony.note-invalid",
        summary: 'ceremony note member "wins" must carry text and mechanism',
        field: "wins",
      };
    }
  }
  return undefined;
};

const validateNoteFacts = (facts: CeremonyNote["facts"]): CeremonyIntakeFailure | undefined => {
  if (facts === undefined) return undefined;
  if (!Array.isArray(facts)) {
    return {
      code: "ceremony.note-invalid",
      summary: 'ceremony note member "facts" must be an array',
      field: "facts",
    };
  }
  for (const entry of facts) {
    if (typeof entry === "string") {
      if (entry.length === 0) {
        return {
          code: "ceremony.note-invalid",
          summary: 'ceremony note "facts" entries must be non-empty',
          field: "facts",
        };
      }
      continue;
    }
    if (!isRecord(entry) || !isNonEmptyString(entry.text)) {
      return {
        code: "ceremony.note-invalid",
        summary: 'ceremony note "facts" entries must carry non-empty text',
        field: "facts",
      };
    }
    if (entry.evidenceRef !== undefined && !isNonEmptyString(entry.evidenceRef)) {
      return {
        code: "ceremony.note-invalid",
        summary: 'a note fact\'s "evidenceRef" must be a non-empty string',
        field: "facts",
      };
    }
  }
  return undefined;
};

export const validateCeremonyNoteForDeclaration = (
  declaration: CeremonyDeclaration,
  note: CeremonyNote,
): CeremonyIntakeFailure | undefined => {
  if (note.schemaId !== CEREMONY_NOTE_SCHEMA) {
    return {
      code: "ceremony.note-invalid",
      summary: `ceremony note schema must equal "${CEREMONY_NOTE_SCHEMA}"`,
      field: "schemaId",
    };
  }
  if (note.ceremony !== declaration.id) {
    return {
      code: "ceremony.note-invalid",
      summary: `ceremony note names ceremony "${note.ceremony}" but the run is "${declaration.id}"`,
      field: "ceremony",
    };
  }
  if (!isNonEmptyString(note.scopeKey)) {
    return {
      code: "ceremony.note-invalid",
      summary: 'ceremony note is missing its idempotent "scopeKey"',
      field: "scopeKey",
    };
  }
  if (!isWindow(note.window)) {
    return {
      code: "ceremony.note-invalid",
      summary: 'ceremony note "window" must declare start <= end',
      field: "window",
    };
  }
  const factsFailure = validateNoteFacts(note.facts);
  if (factsFailure !== undefined) return factsFailure;
  if (note.level !== undefined) {
    if (!(CEREMONY_LEVELS as readonly string[]).includes(note.level)) {
      return {
        code: "ceremony.note-invalid",
        summary: `ceremony note level "${String(note.level)}" is not declared`,
        field: "level",
      };
    }
    const retroFailure = validateRetroNote(note);
    if (retroFailure !== undefined) return retroFailure;
    if (note.trigger === undefined) {
      return {
        code: "ceremony.note-invalid",
        summary: 'a retro note must name the declared trigger in its "trigger" member',
        field: "trigger",
      };
    }
  }
  return undefined;
};

const resolveTrigger = (
  declaration: CeremonyDeclaration,
  note: CeremonyNote | undefined,
): CeremonyRecordedTrigger | CeremonyIntakeFailure => {
  const declaredSet = ceremonyTriggerLabels(declaration);
  const single = ceremonySingleTriggerLabel(declaration);
  if (note?.trigger !== undefined) {
    const matched = matchDeclaredTrigger(declaration, note.trigger);
    if (matched === undefined) {
      return {
        code: "input.value.rejected",
        summary: `note trigger "${note.trigger}" is not declared by ceremony "${declaration.id}"; declared: ${declaredSet.join(", ")}`,
        field: "trigger",
      };
    }
    return {
      kind: "explicit",
      resolution: "note",
      declared: matched,
      declaredWindow: note.window,
      actualWindow: note.window,
    };
  }
  if (single !== undefined) {
    return {
      kind: "explicit",
      resolution: "declaration",
      declared: single,
      declaredWindow: note?.window ?? { start: "", end: "" },
      actualWindow: note?.window ?? { start: "", end: "" },
    };
  }
  return {
    kind: "explicit",
    resolution: "unspecified",
    declaredSet,
    declaredWindow: note?.window ?? { start: "", end: "" },
    actualWindow: note?.window ?? { start: "", end: "" },
  };
};

/** Resolve one run's intake: declaration, scope key, window, note, trigger. */
export const resolveCeremonyIntake = (request: CeremonyIntakeRequest): CeremonyIntakeOutcome => {
  const validated = validateCeremonyDeclaration(request.declaration);
  if (!validated.ok) {
    return {
      ok: false,
      error: {
        code: "ceremony.declaration.invalid",
        summary: validated.error.summary,
        field: validated.error.field,
      },
    };
  }
  const declaration = validated.value;
  const requiresNote = declaration.note?.required === true;
  if (requiresNote && !request.noteSupplied) {
    return reject(`ceremony "${declaration.id}" requires --note and none was supplied`, "note");
  }
  const note = request.note;
  if (note !== undefined) {
    const noteFailure = validateCeremonyNoteForDeclaration(declaration, note);
    if (noteFailure !== undefined) return { ok: false, error: noteFailure };
  }

  // Scope key: the declaration's derivation wins; a note supplies it only where
  // the declaration derives from the note, and disagreement is refused.
  let scopeValue: string | undefined;
  const derivation = declaration.scopeKey.kind;
  if (declaration.scopeKey.kind === "note") {
    scopeValue = note?.scopeKey;
  } else if (declaration.scopeKey.kind === "literal") {
    scopeValue = declaration.scopeKey.value;
  } else {
    scopeValue = request.repositoryId;
  }
  if (scopeValue === undefined || scopeValue.length === 0) {
    return noteInvalid(
      `ceremony "${declaration.id}" could not resolve its scopeKey from its "${derivation}" derivation`,
      "scopeKey",
    );
  }
  if (note !== undefined && declaration.scopeKey.kind !== "note" && note.scopeKey !== scopeValue) {
    return noteInvalid(
      `ceremony note scopeKey "${note.scopeKey}" disagrees with the declaration's "${derivation}" key "${scopeValue}"`,
      "scopeKey",
    );
  }

  // Window: note > --window > the single declared cadence; event-only requires it.
  const schedule = declaration.triggers.find((trigger) => trigger.kind === "schedule");
  let window: CeremonyWindow;
  if (note !== undefined) {
    window = note.window;
    if (request.window !== undefined && !sameWindow(request.window, note.window)) {
      return reject(
        `note window ${note.window.start}..${note.window.end} disagrees with --window ${request.window.start}..${request.window.end}`,
        "window",
      );
    }
  } else if (schedule !== undefined && schedule.kind === "schedule") {
    window = request.window ?? deriveCeremonyCadenceWindow(schedule.cadence, request.nowMs);
  } else if (request.window !== undefined) {
    window = request.window;
  } else {
    return reject(
      `ceremony "${declaration.id}" is event-triggered and declares no window; supply --window`,
      "--window",
    );
  }
  if (!isWindow(window)) {
    return reject('the resolved window must declare "start" <= "end"', "window");
  }

  const trigger = resolveTrigger(declaration, note);
  if ("code" in trigger) return { ok: false, error: { ...trigger } };
  const resolvedTrigger: CeremonyRecordedTrigger = {
    ...trigger,
    declaredWindow: trigger.resolution === "unspecified" ? window : (note?.window ?? window),
    actualWindow: window,
  };

  return {
    ok: true,
    value: {
      declaration,
      ...(note === undefined ? {} : { note }),
      scopeKey: { value: scopeValue, derivation },
      window,
      identity: {
        ceremonyId: declaration.id,
        scopeKey: scopeValue,
        windowStart: window.start,
        windowEnd: window.end,
      },
      trigger: resolvedTrigger,
      ...(request.tier === undefined ? {} : { tier: request.tier }),
    },
  };
};

/** Whether a scope-key derivation is one of the declared three (exported check). */
export const isCeremonyScopeKeyDerivation = (value: string): value is CeremonyScopeKeyKind =>
  (CEREMONY_SCOPE_KEY_KINDS as readonly string[]).includes(value);

/** The declared trigger resolution of an explicit run, for summary rendering. */
export const explicitTriggerResolution = (
  trigger: CeremonyRecordedTrigger,
): CeremonyTriggerResolution => trigger.resolution;

/** A retro note's level, if one is declared. */
export const ceremonyNoteLevel = (note: CeremonyNote | undefined): CeremonyLevel | undefined =>
  note?.level;
