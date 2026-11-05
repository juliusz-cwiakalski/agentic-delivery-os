/**
 * Pure delivery-plan validation and the ready-for-development verdict
 * (GH-226 F-8, F-12, F-13; DEC-1, DEC-6).
 *
 * Parsing arrives through an injected port; every other input is a plain
 * value. No I/O, clock, randomness, or environment access.
 */
import {
  leaseClassForPhaseKind,
  PLAN_DONE_ARTIFACT_SLOTS,
  PLAN_INTERACTION_KINDS,
  PLAN_INTERACTION_ROLES,
  PLAN_KNOWN_TIERS,
  PLAN_LEASE_CLASSES,
  PLAN_MAX_DOCUMENT_BYTES,
  PLAN_MAX_ERRORS,
  PLAN_MAX_INTERACTIONS,
  PLAN_MAX_LEASE_NAMES,
  PLAN_MAX_PATH_CHARS,
  PLAN_MAX_PHASES,
  PLAN_MAX_SCOPE_PATHS,
  PLAN_PHASE_KINDS,
  PLAN_SCHEMA_VERSION,
  PLAN_SCOPE_KEYS,
  PLAN_SUPPORTED_SCHEMA_VERSIONS,
  planArtifactPath,
  type PlanArtifactRead,
  type PlanArtifactRef,
  type PlanDocument,
  type PlanDoneArtifacts,
  type PlanInteraction,
  type PlanPhaseKind,
  type PlanPhaseVerdict,
  type PlanScopeEcho,
  type PlanTierDeclaration,
  type PlanValidateData,
  type PlanValidationError,
  type PlanYamlParser,
} from "#contracts";
import { scopeCoversPath } from "./plan-paths.js";

/** The injected facts for one validation. */
export type PlanValidateInput = {
  readonly workItemRef: string;
  readonly read: PlanArtifactRead;
  readonly parseYaml: PlanYamlParser;
};

const compareText = (left: string, right: string): number => {
  const a = Array.from(left);
  const b = Array.from(right);
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const leftPoint = a[index]?.codePointAt(0) ?? 0;
    const rightPoint = b[index]?.codePointAt(0) ?? 0;
    if (leftPoint !== rightPoint) return leftPoint < rightPoint ? -1 : 1;
  }
  return a.length === b.length ? 0 : a.length < b.length ? -1 : 1;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const isMember = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);

const schemaError = (
  field: string,
  problem: PlanValidationError["problem"],
  options: { readonly phase?: number | undefined; readonly detail?: string | undefined } = {},
): PlanValidationError => ({
  code: "plan.schema.invalid",
  field,
  problem,
  ...(options.phase === undefined ? {} : { phase: options.phase }),
  ...(options.detail === undefined ? {} : { detail: options.detail }),
});

const tierError = (name: string, phase: number | undefined): PlanValidationError => ({
  code: "plan.tier.unknown",
  field: "tier.name",
  problem: "invalid",
  ...(phase === undefined ? {} : { phase }),
  detail: name,
});

const compareErrors = (left: PlanValidationError, right: PlanValidationError): number => {
  const leftPhase = left.phase ?? Number.MAX_SAFE_INTEGER;
  const rightPhase = right.phase ?? Number.MAX_SAFE_INTEGER;
  if (leftPhase !== rightPhase) return leftPhase - rightPhase;
  const field = compareText(left.field, right.field);
  return field === 0 ? compareText(left.code, right.code) : field;
};

type ParseArray = {
  readonly values: readonly string[];
  readonly errors: readonly PlanValidationError[];
};

const parseStringArray = (
  raw: unknown,
  field: string,
  phase: number | undefined,
  maxEntries: number,
): ParseArray => {
  if (!Array.isArray(raw)) {
    return {
      values: [],
      errors: [schemaError(field, "invalid", { phase, detail: "expected an array of strings" })],
    };
  }
  const values: string[] = [];
  const errors: PlanValidationError[] = [];
  if (raw.length > maxEntries) {
    errors.push(schemaError(field, "invalid", { phase, detail: "too many entries" }));
  }
  for (const entry of raw.slice(0, maxEntries)) {
    const value = nonEmptyString(entry);
    if (value === undefined) {
      errors.push(schemaError(field, "invalid", { phase, detail: "expected a non-empty string" }));
      continue;
    }
    if (Array.from(value).length > PLAN_MAX_PATH_CHARS) {
      errors.push(schemaError(field, "invalid", { phase, detail: "path is too long" }));
      continue;
    }
    values.push(value);
  }
  return { values, errors };
};

const emptyScope = (): PlanScopeEcho => ({ files: [], packages: [], folders: [] });

type ScopeParse = {
  readonly scope: PlanScopeEcho;
  readonly errors: readonly PlanValidationError[];
};

const parseScope = (raw: unknown, phase: number): ScopeParse => {
  if (!isRecord(raw)) {
    return {
      scope: emptyScope(),
      errors: [schemaError("scope.files", "missing", { phase, detail: "phase declares no scope" })],
    };
  }
  const errors: PlanValidationError[] = [];
  const keys = Object.keys(raw);
  for (const key of keys) {
    if (!(PLAN_SCOPE_KEYS as readonly string[]).includes(key)) {
      errors.push(
        schemaError(`scope.${key}`, "invalid", { phase, detail: "unknown scope key" }),
      );
    }
  }
  const parsed: { readonly files?: readonly string[]; readonly packages?: readonly string[]; readonly folders?: readonly string[] } = {};
  for (const key of PLAN_SCOPE_KEYS) {
    if (!Object.hasOwn(raw, key)) continue;
    const result = parseStringArray(raw[key], `scope.${key}`, phase, PLAN_MAX_SCOPE_PATHS);
    errors.push(...result.errors);
    const sorted = [...result.values].sort(compareText);
    if (key === "files") Object.assign(parsed, { files: sorted });
    if (key === "packages") Object.assign(parsed, { packages: sorted });
    if (key === "folders") Object.assign(parsed, { folders: sorted });
  }
  const declared = PLAN_SCOPE_KEYS.some((key) => (parsed[key] ?? []).length > 0);
  if (!declared && errors.length === 0) {
    errors.push(schemaError("scope.files", "missing", { phase, detail: "phase declares no scope" }));
  }
  return {
    scope: {
      files: parsed.files ?? [],
      packages: parsed.packages ?? [],
      folders: parsed.folders ?? [],
    },
    errors,
  };
};

const parseDoneArtifacts = (
  raw: unknown,
  phase: number,
): { readonly value?: PlanDoneArtifacts; readonly errors: readonly PlanValidationError[] } => {
  if (raw === undefined) return { errors: [] };
  if (!isRecord(raw)) {
    return {
      errors: [schemaError("doneArtifacts", "invalid", { phase, detail: "expected a mapping" })],
    };
  }
  const errors: PlanValidationError[] = [];
  const declared: Record<string, string> = {};
  for (const key of Object.keys(raw)) {
    if (!(PLAN_DONE_ARTIFACT_SLOTS as readonly string[]).includes(key)) {
      errors.push(
        schemaError(`doneArtifacts.${key}`, "invalid", { phase, detail: "unknown artifact slot" }),
      );
      continue;
    }
    const value = nonEmptyString(raw[key]);
    if (value === undefined) {
      errors.push(
        schemaError(`doneArtifacts.${key}`, "invalid", { phase, detail: "expected a string" }),
      );
      continue;
    }
    declared[key] = value;
  }
  const value: PlanDoneArtifacts = {
    ...(declared.mergeRequestUrl === undefined
      ? {}
      : { mergeRequestUrl: declared.mergeRequestUrl }),
    ...(declared.pipelineId === undefined ? {} : { pipelineId: declared.pipelineId }),
    ...(declared.deployedEnvironment === undefined
      ? {}
      : { deployedEnvironment: declared.deployedEnvironment }),
    ...(declared.trackerTransition === undefined
      ? {}
      : { trackerTransition: declared.trackerTransition }),
  };
  const any = Object.keys(declared).length > 0;
  return any ? { value, errors } : { errors };
};

const parseInteractions = (
  raw: unknown,
  phase: number,
  scope: PlanScopeEcho,
): { readonly value: readonly PlanInteraction[]; readonly errors: readonly PlanValidationError[] } => {
  if (raw === undefined) return { value: [], errors: [] };
  if (!Array.isArray(raw)) {
    return {
      value: [],
      errors: [schemaError("interactions", "invalid", { phase, detail: "expected an array" })],
    };
  }
  const value: PlanInteraction[] = [];
  const errors: PlanValidationError[] = [];
  const bounded = raw.slice(0, PLAN_MAX_INTERACTIONS);
  if (raw.length > PLAN_MAX_INTERACTIONS) {
    errors.push(
      schemaError("interactions", "invalid", { phase, detail: "too many interactions" }),
    );
  }
  bounded.forEach((entry, index) => {
    const field = `interactions[${index}]`;
    if (!isRecord(entry)) {
      errors.push(schemaError(field, "invalid", { phase, detail: "expected a mapping" }));
      return;
    }
    const kind = entry.kind;
    const role = entry.role;
    if (!isMember(PLAN_INTERACTION_KINDS, kind)) {
      errors.push(schemaError(`${field}.kind`, "invalid", { phase, detail: "unknown kind" }));
      return;
    }
    if (!isMember(PLAN_INTERACTION_ROLES, role)) {
      errors.push(schemaError(`${field}.role`, "invalid", { phase, detail: "unknown role" }));
      return;
    }
    const target = nonEmptyString(entry.target);
    if (target === undefined || Array.from(target).length > PLAN_MAX_PATH_CHARS) {
      errors.push(
        schemaError(`${field}.target`, "invalid", { phase, detail: "expected a path string" }),
      );
      return;
    }
    if (!scopeCoversPath(scope, target)) {
      errors.push(
        schemaError(`${field}.target`, "invalid", {
          phase,
          detail: "interaction target is not declared by the phase scope",
        }),
      );
      return;
    }
    value.push({ kind, target, role });
  });
  return { value, errors };
};

const parsePhase = (
  raw: unknown,
  index: number,
  defaults: { readonly leases: readonly string[]; readonly weightClass?: string },
  tierName: string | undefined,
  errors: PlanValidationError[],
): PlanPhaseVerdict | undefined => {
  const position = index + 1;
  if (!isRecord(raw)) {
    errors.push(schemaError("phase", "invalid", { phase: position, detail: "expected a mapping" }));
    return undefined;
  }
  const idRaw = raw.id;
  const id =
    typeof idRaw === "number" && Number.isInteger(idRaw) && idRaw > 0 ? idRaw : position;
  if (!(typeof idRaw === "number" && Number.isInteger(idRaw) && idRaw > 0)) {
    errors.push(schemaError("id", "invalid", { phase: id, detail: "expected a positive integer" }));
  }
  const title = nonEmptyString(raw.title);
  if (title === undefined) {
    errors.push(schemaError("title", "missing", { phase: id }));
  }
  const kindRaw = raw.kind;
  if (!isMember(PLAN_PHASE_KINDS, kindRaw)) {
    errors.push(
      schemaError("kind", "invalid", { phase: id, detail: "expected planning or delivery" }),
    );
    return undefined;
  }
  const kind: PlanPhaseKind = kindRaw;
  const scopeResult = parseScope(raw.scope, id);
  errors.push(...scopeResult.errors);

  const leaseClass = raw.leaseClass;
  if (leaseClass !== undefined && !isMember(PLAN_LEASE_CLASSES, leaseClass)) {
    errors.push(schemaError("leaseClass", "invalid", { phase: id }));
  } else if (leaseClass !== undefined && leaseClass !== leaseClassForPhaseKind(kind)) {
    errors.push(
      schemaError("leaseClass", "invalid", {
        phase: id,
        detail: `${kind} phases are ${leaseClassForPhaseKind(kind)}`,
      }),
    );
  }

  const leases = raw.leases === undefined ? undefined : parseStringArray(raw.leases, "leases", id, PLAN_MAX_LEASE_NAMES);
  if (leases !== undefined) errors.push(...leases.errors);
  const weightClass = raw.weightClass;
  if (weightClass !== undefined && nonEmptyString(weightClass) === undefined) {
    errors.push(schemaError("weightClass", "invalid", { phase: id, detail: "expected a string" }));
  }

  const done = parseDoneArtifacts(raw.doneArtifacts, id);
  errors.push(...done.errors);
  const interactions = parseInteractions(raw.interactions, id, scopeResult.scope);
  errors.push(...interactions.errors);

  const effectiveLeases = leases?.values ?? defaults.leases;
  const effectiveWeight =
    nonEmptyString(weightClass) ?? defaults.weightClass;

  return {
    id,
    title: title ?? "",
    kind,
    leaseClass: leaseClassForPhaseKind(kind),
    scope: scopeResult.scope,
    leases: effectiveLeases,
    interactions: interactions.value,
    tier: tierName ?? "",
    ...(done.value === undefined ? {} : { doneArtifacts: done.value }),
    ...(effectiveWeight === undefined ? {} : { weightClass: effectiveWeight }),
  };
};

type ValidatedDocument = {
  readonly schemaVersion?: string;
  readonly tier?: string;
  readonly tierDeclaration?: PlanTierDeclaration;
  readonly perPhase: readonly PlanPhaseVerdict[];
  readonly errors: readonly PlanValidationError[];
};

/** Validate a parsed plan value; pure and total. */
export const validatePlanValue = (value: unknown): ValidatedDocument => {
  const errors: PlanValidationError[] = [];
  const perPhase: PlanPhaseVerdict[] = [];
  if (!isRecord(value)) {
    return {
      errors: [schemaError("document", "invalid", { detail: "expected a top-level mapping" })],
      perPhase: [],
    };
  }

  let schemaVersion: string | undefined;
  const versionRaw = value.schemaVersion;
  if (versionRaw === undefined) {
    errors.push(schemaError("schemaVersion", "missing"));
  } else if (typeof versionRaw !== "string" || versionRaw.length === 0) {
    errors.push(schemaError("schemaVersion", "invalid", { detail: "expected a string" }));
  } else if (!(PLAN_SUPPORTED_SCHEMA_VERSIONS as readonly string[]).includes(versionRaw)) {
    errors.push(
      schemaError("schemaVersion", "unsupported", {
        detail: `unsupported schemaVersion ${versionRaw}`,
      }),
    );
  } else {
    schemaVersion = versionRaw;
  }

  if (value.workItemRef !== undefined && typeof value.workItemRef !== "string") {
    errors.push(schemaError("workItemRef", "invalid", { detail: "expected a string" }));
  }

  let tierName: string | undefined;
  let tierDeclaration: PlanTierDeclaration | undefined;
  const tierRaw = value.tier;
  if (!isRecord(tierRaw)) {
    errors.push(schemaError("tier", "missing", { detail: "a ceremony tier must be declared" }));
  } else {
    const nameRaw = nonEmptyString(tierRaw.name);
    if (nameRaw === undefined) {
      errors.push(schemaError("tier.name", "missing"));
    } else if (!(PLAN_KNOWN_TIERS as readonly string[]).includes(nameRaw)) {
      errors.push(tierError(nameRaw, undefined));
    } else {
      tierName = nameRaw;
      const phases =
        Array.isArray(tierRaw.phases) &&
        tierRaw.phases.every((entry) => typeof entry === "number" && Number.isInteger(entry))
          ? (tierRaw.phases as readonly number[])
          : undefined;
      const triggers =
        Array.isArray(tierRaw.escalationTriggers) &&
        tierRaw.escalationTriggers.every((entry) => nonEmptyString(entry) !== undefined)
          ? (tierRaw.escalationTriggers as readonly string[])
          : undefined;
      tierDeclaration = {
        name: nameRaw,
        ...(phases === undefined ? {} : { phases }),
        ...(triggers === undefined ? {} : { escalationTriggers: triggers }),
      };
    }
    if (tierRaw.phases !== undefined) {
      if (!Array.isArray(tierRaw.phases) || tierRaw.phases.some((entry) => typeof entry !== "number" || !Number.isInteger(entry))) {
        errors.push(
          schemaError("tier.phases", "invalid", { detail: "expected an array of integers" }),
        );
      }
    }
    if (tierRaw.escalationTriggers !== undefined) {
      const triggers = tierRaw.escalationTriggers;
      if (
        !Array.isArray(triggers) ||
        triggers.some((entry) => nonEmptyString(entry) === undefined)
      ) {
        errors.push(
          schemaError("tier.escalationTriggers", "invalid", {
            detail: "expected an array of strings",
          }),
        );
      }
    }
  }

  let defaultLeases: readonly string[] = [];
  if (value.defaultLeases !== undefined) {
    const parsed = parseStringArray(value.defaultLeases, "defaultLeases", undefined, PLAN_MAX_LEASE_NAMES);
    errors.push(...parsed.errors);
    defaultLeases = parsed.values;
  }
  const defaultWeightClass = nonEmptyString(value.defaultWeightClass);
  if (value.defaultWeightClass !== undefined && defaultWeightClass === undefined) {
    errors.push(schemaError("defaultWeightClass", "invalid", { detail: "expected a string" }));
  }

  const phasesRaw = value.phases;
  if (!Array.isArray(phasesRaw)) {
    errors.push(schemaError("phases", "missing", { detail: "expected a non-empty array" }));
  } else if (phasesRaw.length === 0) {
    errors.push(schemaError("phases", "missing", { detail: "at least one phase is required" }));
  } else if (phasesRaw.length > PLAN_MAX_PHASES) {
    errors.push(schemaError("phases", "invalid", { detail: "too many phases" }));
  } else {
    const seen = new Set<number>();
    phasesRaw.forEach((raw, index) => {
      const parsed = parsePhase(
        raw,
        index,
        {
          leases: defaultLeases,
          ...(defaultWeightClass === undefined ? {} : { weightClass: defaultWeightClass }),
        },
        tierName,
        errors,
      );
      if (parsed === undefined) return;
      if (seen.has(parsed.id)) {
        errors.push(schemaError("id", "invalid", { phase: parsed.id, detail: "duplicate phase id" }));
      }
      seen.add(parsed.id);
      perPhase.push(parsed);
    });
  }

  const sorted = [...errors].sort(compareErrors);
  return {
    ...(schemaVersion === undefined ? {} : { schemaVersion }),
    ...(tierName === undefined ? {} : { tier: tierName }),
    ...(tierDeclaration === undefined ? {} : { tierDeclaration }),
    perPhase: perPhase.sort((left, right) => left.id - right.id),
    errors: sorted,
  };
};

const bounded = (errors: readonly PlanValidationError[]): {
  readonly errors: readonly PlanValidationError[];
  readonly truncated: boolean;
  readonly totalErrors: number;
} => ({
  errors: errors.slice(0, PLAN_MAX_ERRORS),
  truncated: errors.length > PLAN_MAX_ERRORS,
  totalErrors: errors.length,
});

const invalid = (
  errors: readonly PlanValidationError[],
  options: {
    readonly artifact?: PlanArtifactRef;
    readonly schemaVersion?: string;
    readonly tier?: string;
    readonly tierDeclaration?: PlanTierDeclaration;
    readonly perPhase?: readonly PlanPhaseVerdict[];
  } = {},
): PlanValidateData => {
  const shape = bounded(errors);
  return {
    verdict: "invalid",
    readyForDevelopment: false,
    perPhase: options.perPhase ?? [],
    errors: shape.errors,
    truncated: shape.truncated,
    totalErrors: shape.totalErrors,
    ...(options.artifact === undefined ? {} : { artifact: options.artifact }),
    ...(options.schemaVersion === undefined ? {} : { schemaVersion: options.schemaVersion }),
    ...(options.tier === undefined ? {} : { tier: options.tier }),
    ...(options.tierDeclaration === undefined
      ? {}
      : { tierDeclaration: options.tierDeclaration }),
  };
};

/** Compute the validate verdict for one artifact read. */
export const validatePlan = (input: PlanValidateInput): PlanValidateData => {
  const { read } = input;
  if (!read.ok) {
    if (read.reason === "absent") {
      return invalid([
        {
          code: "plan.artifact.missing",
          field: "artifact",
          problem: "missing",
          detail: `no plan artifact for ${read.workItemRef}`,
        },
      ]);
    }
    const artifact: PlanArtifactRef = {
      kind: "yaml",
      path: read.path ?? planArtifactPath(read.workItemRef, "yaml"),
    };
    return invalid(
      [
        schemaError("artifact", "invalid", {
          detail: `unreadable plan artifact ${artifact.path}`,
        }),
      ],
      { artifact },
    );
  }

  if (read.artifact.kind === "markdown") {
    return invalid(
      [
        {
          code: "plan.format.legacy-markdown",
          field: "artifact",
          problem: "invalid",
          detail: `legacy markdown plan ${read.artifact.path}`,
        },
      ],
      { artifact: read.artifact },
    );
  }

  if (Array.from(read.text).length > PLAN_MAX_DOCUMENT_BYTES) {
    return invalid(
      [
        schemaError("document", "invalid", {
          detail: `plan document exceeds ${PLAN_MAX_DOCUMENT_BYTES} characters`,
        }),
      ],
      { artifact: read.artifact },
    );
  }

  const parsed = input.parseYaml(read.text);
  if (!parsed.ok) {
    return invalid(
      [
        schemaError("document", "invalid", {
          detail:
            parsed.reason === "bounded"
              ? "plan document exceeds the parse bound"
              : "plan document is not parseable YAML",
        }),
      ],
      { artifact: read.artifact },
    );
  }

  const validated = validatePlanValue(parsed.value);
  if (validated.errors.length === 0) {
    const shape = bounded(validated.errors);
    return {
      verdict: "valid",
      readyForDevelopment: true,
      perPhase: validated.perPhase,
      errors: shape.errors,
      truncated: shape.truncated,
      totalErrors: shape.totalErrors,
      artifact: read.artifact,
      ...(validated.schemaVersion === undefined ? {} : { schemaVersion: validated.schemaVersion }),
      ...(validated.tier === undefined ? {} : { tier: validated.tier }),
      ...(validated.tierDeclaration === undefined
        ? {}
        : { tierDeclaration: validated.tierDeclaration }),
    };
  }
  return invalid(validated.errors, {
    artifact: read.artifact,
    ...(validated.schemaVersion === undefined ? {} : { schemaVersion: validated.schemaVersion }),
    ...(validated.tier === undefined ? {} : { tier: validated.tier }),
    ...(validated.tierDeclaration === undefined
      ? {}
      : { tierDeclaration: validated.tierDeclaration }),
    perPhase: validated.perPhase,
  });
};

/**
 * Recover the declared document shape from a valid verdict for downstream
 * overlap/diff consumers. Undefined when the plan did not validate.
 */
export const planDocumentFromValidateData = (data: PlanValidateData): PlanDocument | undefined => {
  if (data.verdict !== "valid" || data.tier === undefined) return undefined;
  return {
    schemaVersion: data.schemaVersion ?? PLAN_SCHEMA_VERSION,
    tier:
      data.tierDeclaration === undefined ? { name: data.tier } : { ...data.tierDeclaration },
    phases: data.perPhase.map((phase) => ({
      id: phase.id,
      title: phase.title,
      kind: phase.kind,
      scope: {
        files: phase.scope.files,
        packages: phase.scope.packages,
        folders: phase.scope.folders,
      },
      interactions: phase.interactions,
      ...(phase.doneArtifacts === undefined ? {} : { doneArtifacts: phase.doneArtifacts }),
      ...(phase.weightClass === undefined ? {} : { weightClass: phase.weightClass }),
      leases: phase.leases,
    })),
  };
};
