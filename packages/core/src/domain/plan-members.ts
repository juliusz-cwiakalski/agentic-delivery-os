/**
 * Pure plan member-declaration parsing and member-ref identity (GH-310 F-1,
 * DM-1, DM-6, DEC-1, DEC-2, DEC-9, DEC-10, DEC-15).
 *
 * No I/O, clock, randomness, or configuration access: gate identifiers are
 * shape-checked only and capability resolution belongs to `verify gates`. The
 * module is the single source of the `<canonicalChangeRef>@<repoKey>` identity
 * reused by the queue.
 */
import {
  PLAN_MAX_MEMBER_DEPENDS_ON,
  PLAN_MAX_MEMBER_GATE_CHARS,
  PLAN_MAX_MEMBER_GATES,
  PLAN_MAX_MEMBERS,
  PLAN_MEMBER_FIELDS,
  PLAN_MEMBER_REQUIRED_FIELDS,
  type PlanMemberDeclaration,
  type PlanValidationError,
  PROJECT_KEY_PATTERN,
  QUEUE_MAX_REF_CHARS,
} from "#contracts";

/** The single member-ref separator literal (DEC-2, DM-6). */
export const MEMBER_REF_SEPARATOR = "@" as const;

const REF_PARTS = /^([A-Za-z][A-Za-z0-9]*)-([0-9]+)$/;

const memberError = (
  field: string,
  problem: PlanValidationError["problem"],
  detail: string,
): PlanValidationError => ({ code: "plan.schema.invalid", field, problem, detail });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

/** Canonicalize the change-ref part exactly as the delivered queue form does. */
export const canonicalChangeRef = (value: string): string | undefined => {
  const match = REF_PARTS.exec(value.trim());
  if (match === null) return undefined;
  const prefix = (match[1] ?? "").toUpperCase();
  const digits = BigInt(match[2] ?? "0").toString();
  const canonical = `${prefix}-${digits}`;
  return canonical.length <= QUEUE_MAX_REF_CHARS ? canonical : undefined;
};

/** The derived member ref `<canonicalChangeRef>@<repoKey>` (DEC-2). */
export const memberRefFor = (changeRef: string, repoKey: string): string =>
  `${changeRef}${MEMBER_REF_SEPARATOR}${repoKey}`;

/** One parsed member ref: the canonical change ref and the preserved repoKey. */
export type ParsedMemberRef = {
  readonly changeRef: string;
  readonly repoKey: string;
};

/**
 * Recognize a member ref. The change-ref part canonicalizes exactly as the
 * delivered form does; the repoKey is preserved verbatim and must match the
 * delivered repo-key grammar. Anything else is `undefined`.
 */
export const parseMemberRef = (value: string): ParsedMemberRef | undefined => {
  const text = value.trim();
  const at = text.indexOf(MEMBER_REF_SEPARATOR);
  if (at <= 0 || at !== text.lastIndexOf(MEMBER_REF_SEPARATOR)) return undefined;
  const changeRef = canonicalChangeRef(text.slice(0, at));
  const repoKey = text.slice(at + 1);
  if (changeRef === undefined || !PROJECT_KEY_PATTERN.test(repoKey)) return undefined;
  return memberRefFor(changeRef, repoKey).length <= QUEUE_MAX_REF_CHARS
    ? { changeRef, repoKey }
    : undefined;
};

/** True when the value names a declared member ref rather than the plain form. */
export const isMemberRef = (value: string): boolean => parseMemberRef(value) !== undefined;

type StringListParse = {
  readonly values: readonly string[] | undefined;
  readonly errors: readonly PlanValidationError[];
};

const parseGateList = (raw: unknown, field: string): StringListParse => {
  if (!Array.isArray(raw)) {
    return {
      values: undefined,
      errors: [memberError(field, "invalid", "expected an array of gate identifiers")],
    };
  }
  const errors: PlanValidationError[] = [];
  if (raw.length === 0) {
    errors.push(memberError(field, "missing", "at least one gate identifier is required"));
  }
  if (raw.length > PLAN_MAX_MEMBER_GATES) {
    errors.push(memberError(field, "invalid", "too many gate identifiers"));
  }
  const values: string[] = [];
  for (const entry of raw.slice(0, PLAN_MAX_MEMBER_GATES)) {
    const value = nonEmptyString(entry);
    if (value === undefined) {
      errors.push(memberError(field, "invalid", "expected a non-empty string"));
      continue;
    }
    if (Array.from(value).length > PLAN_MAX_MEMBER_GATE_CHARS) {
      errors.push(memberError(field, "invalid", "gate identifier is too long"));
      continue;
    }
    values.push(value);
  }
  return { values, errors };
};

const parseDependencyList = (raw: unknown, field: string): StringListParse => {
  if (!Array.isArray(raw)) {
    return { values: undefined, errors: [memberError(field, "invalid", "expected an array")] };
  }
  const errors: PlanValidationError[] = [];
  if (raw.length > PLAN_MAX_MEMBER_DEPENDS_ON) {
    errors.push(memberError(field, "invalid", "too many dependency entries"));
  }
  const values: string[] = [];
  for (const entry of raw.slice(0, PLAN_MAX_MEMBER_DEPENDS_ON)) {
    const value = nonEmptyString(entry);
    if (value === undefined) {
      errors.push(memberError(field, "invalid", "expected a non-empty repoKey"));
      continue;
    }
    values.push(value);
  }
  return { values, errors };
};

/**
 * Parse the additive document-level `members` declaration.
 *
 * Absent means "not a cross-repository change" and is never an error. Every
 * defect is `plan.schema.invalid` naming `members[i].<field>`; the returned
 * `members` is present only when the declaration itself is defect-free.
 */
export const parsePlanMembers = (
  raw: unknown,
  changeRef: string,
): {
  readonly members?: readonly PlanMemberDeclaration[];
  readonly errors: readonly PlanValidationError[];
} => {
  if (raw === undefined) return { errors: [] };
  if (!Array.isArray(raw)) {
    return { errors: [memberError("members", "invalid", "expected an array of member entries")] };
  }
  const errors: PlanValidationError[] = [];
  if (raw.length > PLAN_MAX_MEMBERS) {
    errors.push(memberError("members", "invalid", "too many member entries"));
  }
  const entries: PlanMemberDeclaration[] = [];
  const declared = new Set<string>();
  const bounded = raw.slice(0, PLAN_MAX_MEMBERS);
  bounded.forEach((value, index) => {
    const position = `members[${index}]`;
    if (!isRecord(value)) {
      errors.push(memberError(position, "invalid", "expected a member mapping"));
      return;
    }
    for (const key of Object.keys(value)) {
      if (!(PLAN_MEMBER_FIELDS as readonly string[]).includes(key)) {
        errors.push(memberError(`${position}.${key}`, "invalid", "unknown member field"));
      }
    }
    const repoKey = nonEmptyString(value.repoKey);
    const slice = nonEmptyString(value.slice);
    const branch = nonEmptyString(value.branch);
    const pullRequest =
      value.pullRequest === undefined ? undefined : nonEmptyString(value.pullRequest);
    for (const required of PLAN_MEMBER_REQUIRED_FIELDS) {
      if (!Object.hasOwn(value, required)) {
        errors.push(memberError(`${position}.${required}`, "missing", "required member field"));
      }
    }
    if (Object.hasOwn(value, "repoKey") && repoKey === undefined) {
      errors.push(memberError(`${position}.repoKey`, "invalid", "expected a non-empty string"));
    }
    if (Object.hasOwn(value, "slice") && slice === undefined) {
      errors.push(memberError(`${position}.slice`, "invalid", "expected a non-empty string"));
    }
    if (Object.hasOwn(value, "branch") && branch === undefined) {
      errors.push(memberError(`${position}.branch`, "invalid", "expected a non-empty string"));
    }
    if (value.pullRequest !== undefined && pullRequest === undefined) {
      errors.push(memberError(`${position}.pullRequest`, "invalid", "expected a non-empty string"));
    }
    if (repoKey !== undefined && !PROJECT_KEY_PATTERN.test(repoKey)) {
      errors.push(
        memberError(`${position}.repoKey`, "invalid", "expected the delivered repo-key grammar"),
      );
    }
    if (repoKey !== undefined && declared.has(repoKey)) {
      errors.push(memberError(`${position}.repoKey`, "invalid", "duplicate member repoKey"));
    }
    if (repoKey !== undefined) declared.add(repoKey);
    if (repoKey !== undefined) {
      const canonical = canonicalChangeRef(changeRef) ?? changeRef;
      if (memberRefFor(canonical, repoKey).length > QUEUE_MAX_REF_CHARS) {
        errors.push(
          memberError(`${position}.repoKey`, "invalid", "derived member ref is too long"),
        );
      }
    }
    const gates = parseGateList(value.gates, `${position}.gates`);
    errors.push(...gates.errors);
    const dependsOn =
      value.dependsOn === undefined
        ? undefined
        : parseDependencyList(value.dependsOn, `${position}.dependsOn`);
    if (dependsOn !== undefined) errors.push(...dependsOn.errors);
    entries.push({
      repoKey: repoKey ?? "",
      slice: slice ?? "",
      branch: branch ?? "",
      ...(pullRequest === undefined ? {} : { pullRequest }),
      ...(dependsOn?.values === undefined ? {} : { dependsOn: dependsOn.values }),
      gates: gates.values ?? [],
    });
  });

  // Dependency targets, self edges, and cycles are checked against the whole
  // declared set, so a forward reference is not a defect.
  const declaredKeys = new Set(entries.map((entry) => entry.repoKey).filter((key) => key !== ""));
  const edges = new Map<string, readonly string[]>();
  bounded.forEach((value, index) => {
    if (!isRecord(value) || value.dependsOn === undefined) return;
    const parsed = parseDependencyList(value.dependsOn, `members[${index}].dependsOn`);
    const owner = nonEmptyString(value.repoKey);
    if (owner === undefined) return;
    for (const dependency of parsed.values ?? []) {
      if (!declaredKeys.has(dependency)) {
        errors.push(
          memberError(
            `members[${index}].dependsOn`,
            "invalid",
            "dependsOn names no declared member",
          ),
        );
        continue;
      }
      if (dependency === owner) {
        errors.push(memberError(`members[${index}].dependsOn`, "invalid", "self dependency"));
        continue;
      }
      edges.set(owner, [...(edges.get(owner) ?? []), dependency]);
    }
  });
  for (const member of cycleMembers(edges)) {
    const index = entries.findIndex((entry) => entry.repoKey === member);
    if (index < 0) continue;
    errors.push(memberError(`members[${index}].dependsOn`, "invalid", "dependency cycle"));
  }

  return errors.length === 0 ? { members: entries, errors } : { errors };
};

/** The deterministic set of declared members that belong to a cycle. */
const cycleMembers = (edges: ReadonlyMap<string, readonly string[]>): readonly string[] => {
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const involved = new Set<string>();
  const visit = (node: string): void => {
    state.set(node, 1);
    stack.push(node);
    for (const next of edges.get(node) ?? []) {
      const mark = state.get(next) ?? 0;
      if (mark === 0) visit(next);
      else if (mark === 1) {
        const start = stack.lastIndexOf(next);
        for (const member of stack.slice(Math.max(start, 0))) involved.add(member);
      }
    }
    stack.pop();
    state.set(node, 2);
  };
  for (const node of [...edges.keys()].sort()) {
    if ((state.get(node) ?? 0) === 0) visit(node);
  }
  return [...involved].sort();
};
