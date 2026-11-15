/**
 * The declared suite-to-job map and the breadth rule (GH-300 F-1, F-3, F-4).
 *
 * Pure domain code: no I/O, clock, randomness, or environment. The declaration
 * resolver is the only validator for the `verify.suite-map` node; the breadth
 * resolver is total over the declared outcomes; the two renderers produce the
 * pinned narrowed header and the bounded identifier-only cause line.
 */
import {
  VERIFY_GATES_MAX_CITATION_NAMES,
  VERIFY_GATES_MAX_EXPECTED_JOB_NAME_CHARS,
  VERIFY_GATES_MAX_EXPECTED_JOBS,
  VERIFY_GATES_MAX_SUMMARY_BYTES,
  VERIFY_SUITE_ID_PATTERN,
  VERIFY_SUITE_MAP_CONFIG_KEY,
  VERIFY_SUITE_MAP_MAX_JOBS,
  VERIFY_SUITE_MAP_MAX_SUITES_PER_JOB,
  VERIFY_SUITE_MAP_SCHEMA_VERSION,
  VERIFY_SUITE_MAX_BREADTH,
  VERIFY_SUITE_MAX_ID_CHARS,
  type VerifyGateRecord,
  type VerifyGatesSummary,
  type VerifySuiteMap,
  type VerifySuiteMapJob,
  type VerifySuiteMapRead,
} from "#contracts";
import { verifyGateSummaryLine, verifyGatesSummaryHeader } from "./verify-gates.js";

const SUITE_ID = new RegExp(VERIFY_SUITE_ID_PATTERN);

/** True when the value carries a control character or a line break (rows 4, 26). */
const hasControlCharacter = (value: string): boolean => {
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    if (point <= 0x1f || (point >= 0x7f && point <= 0x9f)) return true;
  }
  return false;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const invalid = (detail: string): VerifySuiteMapRead => ({
  ok: false,
  code: "config.value.invalid",
  detail,
});

const hasExactKeys = (
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): boolean => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
};

const validIdentifier = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length >= 1 &&
  value.length <= VERIFY_SUITE_MAX_ID_CHARS &&
  SUITE_ID.test(value);

/** The single-line printable job-name class (Appendix A rows 4 and 26). */
const validJobName = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length >= 1 &&
  value.length <= VERIFY_GATES_MAX_EXPECTED_JOB_NAME_CHARS &&
  !hasControlCharacter(value) &&
  value.trim() === value;

const identifiersOf = (value: unknown, cap: number): readonly string[] | undefined => {
  if (!Array.isArray(value) || value.length === 0 || value.length > cap) return undefined;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    if (!validIdentifier(entry)) return undefined;
    if (seen.has(entry)) return undefined;
    seen.add(entry);
    result.push(entry);
  }
  return result;
};

const jobsOf = (value: unknown): readonly VerifySuiteMapJob[] | undefined => {
  if (!Array.isArray(value) || value.length === 0 || value.length > VERIFY_SUITE_MAP_MAX_JOBS) {
    return undefined;
  }
  const seen = new Set<string>();
  const jobs: VerifySuiteMapJob[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || !hasExactKeys(entry, ["job", "suites"])) return undefined;
    const job = entry.job;
    if (!validJobName(job) || seen.has(job)) return undefined;
    const suites = identifiersOf(entry.suites, VERIFY_SUITE_MAP_MAX_SUITES_PER_JOB);
    if (suites === undefined) return undefined;
    seen.add(job);
    jobs.push({ job, suites });
  }
  return jobs;
};

/**
 * Resolve one raw `verify.suite-map` node. Absent is never a defect; every
 * closed-shape, cap, grammar, duplicate, or job-class violation is
 * `config.value.invalid` with no invented default map (DM-1, DEC-2).
 */
export const resolveVerifySuiteMap = (raw: unknown): VerifySuiteMapRead => {
  if (!isRecord(raw)) return invalid("suite-map.not-an-object");
  if (!hasExactKeys(raw, ["schemaVersion", "jobs", "local"])) {
    return invalid("suite-map.undeclared-or-missing-key");
  }
  if (raw.schemaVersion !== VERIFY_SUITE_MAP_SCHEMA_VERSION) {
    return invalid("suite-map.schema-version");
  }
  const jobs = jobsOf(raw.jobs);
  if (jobs === undefined) return invalid("suite-map.jobs");
  const local = identifiersOf(raw.local, VERIFY_SUITE_MAX_BREADTH);
  if (local === undefined) return invalid("suite-map.local");
  return {
    ok: true,
    declared: true,
    value: { schemaVersion: VERIFY_SUITE_MAP_SCHEMA_VERSION, jobs, local },
  };
};

/** The pure node extraction outcome over a parsed configuration document. */
export type VerifySuiteMapNode =
  | { readonly kind: "absent" }
  | { readonly kind: "present"; readonly node: unknown };

/**
 * Extract `verify["suite-map"]` and interpret nothing else (DM-9, DEC-18).
 *
 * No sibling branch, key, or value is validated, so a schema or semantic defect
 * elsewhere in the document neither refuses the run nor removes a valid
 * declaration. The parser boundary rejects an unparseable document before this
 * helper is reached; it performs no I/O.
 */
export const extractVerifySuiteMapNode = (document: unknown): VerifySuiteMapNode => {
  if (!isRecord(document)) return { kind: "absent" };
  const branch = document.verify;
  if (!isRecord(branch)) return { kind: "absent" };
  if (!Object.hasOwn(branch, "suite-map")) return { kind: "absent" };
  return { kind: "present", node: branch["suite-map"] };
};

/** Resolve the map from a parsed configuration document's `verify` branch. */
export const resolveVerifySuiteMapFromConfig = (values: unknown): VerifySuiteMapRead => {
  const extracted = extractVerifySuiteMapNode(values);
  return extracted.kind === "absent"
    ? { ok: true, declared: false }
    : resolveVerifySuiteMap(extracted.node);
};

/** The workflow facts the breadth rule consumes, structurally typed. */
export type VerifySuiteBreadthWorkflowFacts = {
  readonly outcome: "read" | "failed" | "absent";
  readonly names: readonly string[];
};

/**
 * The closed breadth evaluation (DM-4). `not-evaluated` is the workflow
 * precondition, not a fifth breadth outcome.
 */
export type VerifySuiteBreadthEvaluation =
  | { readonly kind: "not-evaluated" }
  | {
      readonly kind: "equal";
      readonly mirrorsJob: string;
      readonly suiteBreadth: readonly string[];
    }
  | {
      readonly kind: "narrower";
      readonly mirrorsJob: string;
      readonly mirrorBreadth: readonly string[];
    }
  | { readonly kind: "unmirrored" }
  | { readonly kind: "uncorroborated"; readonly mirrorsJob: string };

const corroboratedNames = (
  workflow: VerifySuiteBreadthWorkflowFacts,
): readonly string[] | undefined => {
  if (workflow.outcome !== "read") return undefined;
  const names = workflow.names;
  if (names.length === 0 || names.length > VERIFY_GATES_MAX_EXPECTED_JOBS) return undefined;
  const seen = new Set<string>();
  for (const name of names) {
    if (typeof name !== "string" || name.length === 0) return undefined;
    if (name.length > VERIFY_GATES_MAX_EXPECTED_JOB_NAME_CHARS) return undefined;
    if (seen.has(name)) return undefined;
    seen.add(name);
  }
  return names;
};

const covers = (job: VerifySuiteMapJob, local: ReadonlySet<string>): boolean =>
  local.size <= job.suites.length && [...local].every((id) => job.suites.includes(id));

const equalsSet = (job: VerifySuiteMapJob, local: ReadonlySet<string>): boolean =>
  job.suites.length === local.size && covers(job, local);

/**
 * Resolve one declaration against one validly read workflow (DEC-3, DEC-5).
 *
 * Declared order is the only precedence: the first exact set match is the
 * mirror; otherwise the first strict-superset job is the narrowed mirror;
 * otherwise the local set is unmirrored. The resolved mirror must appear in the
 * read job-name set by exact string match or the declaration is uncorroborated.
 */
export const resolveVerifySuiteBreadth = (input: {
  readonly map: VerifySuiteMap;
  readonly workflow: VerifySuiteBreadthWorkflowFacts;
}): VerifySuiteBreadthEvaluation => {
  const names = corroboratedNames(input.workflow);
  if (names === undefined) return { kind: "not-evaluated" };
  const local = new Set(input.map.local);
  const equal = input.map.jobs.find((job) => equalsSet(job, local));
  if (equal !== undefined) {
    return names.includes(equal.job)
      ? { kind: "equal", mirrorsJob: equal.job, suiteBreadth: [...equal.suites] }
      : { kind: "uncorroborated", mirrorsJob: equal.job };
  }
  const narrower = input.map.jobs.find(
    (job) => job.suites.length > local.size && covers(job, local),
  );
  if (narrower !== undefined) {
    return names.includes(narrower.job)
      ? { kind: "narrower", mirrorsJob: narrower.job, mirrorBreadth: [...narrower.suites] }
      : { kind: "uncorroborated", mirrorsJob: narrower.job };
  }
  return { kind: "unmirrored" };
};

/** The report-root citation a resolved equality produces (DM-2). */
export type VerifySuiteBreadthCitation = {
  readonly suiteBreadth: readonly string[];
  readonly mirrorsJob: string;
};

/** Project one breadth outcome onto the report fields, or nothing. */
export const suiteBreadthCitationOf = (
  outcome: VerifySuiteBreadthEvaluation,
): VerifySuiteBreadthCitation | undefined =>
  outcome.kind === "equal"
    ? { suiteBreadth: [...outcome.suiteBreadth], mirrorsJob: outcome.mirrorsJob }
    : undefined;

const renderedIdentifiers = (identifiers: readonly string[]): string => {
  if (identifiers.length <= VERIFY_GATES_MAX_CITATION_NAMES) return identifiers.join(",");
  const printed = identifiers.slice(0, VERIFY_GATES_MAX_CITATION_NAMES).join(",");
  return `${printed} omitted=${identifiers.length - VERIFY_GATES_MAX_CITATION_NAMES}`;
};

/** The delivered header formula, kept byte-identical (Appendix A row 9). */
const summaryHeader = (
  overall: "pass" | "fail" | "unknown",
  summary: VerifyGatesSummary,
  narrowed?: { readonly mirrorsJob: string; readonly mirrorBreadth: readonly string[] },
): string => verifyGatesSummaryHeader({ overall, summary }, narrowed);

/**
 * The bounded narrowed summary block (DEC-15): the delivered header tokens plus
 * the pinned `scope=narrowed mirror=… breadth=…[ omitted=…]` segment, one gate
 * line per evaluated gate, never a truncated header.
 */
export const renderVerifyGatesNarrowedFailureSummary = (
  evaluation: {
    readonly overall: "pass" | "fail" | "unknown";
    readonly summary: VerifyGatesSummary;
    readonly gates: readonly VerifyGateRecord[];
  },
  narrowed: { readonly mirrorsJob: string; readonly mirrorBreadth: readonly string[] },
): string => {
  const header = summaryHeader(evaluation.overall, evaluation.summary, narrowed);
  const render = (valueBudget?: number): string =>
    [header, ...evaluation.gates.map((entry) => verifyGateSummaryLine(entry, valueBudget))].join(
      "\n",
    );
  const full = render();
  if (full.length <= VERIFY_GATES_MAX_SUMMARY_BYTES) return full;
  for (let budget = VERIFY_GATES_MAX_CITATION_NAMES - 1; budget >= 0; budget -= 1) {
    const candidate = render(budget);
    if (candidate.length <= VERIFY_GATES_MAX_SUMMARY_BYTES) return candidate;
    if (budget === 0) return candidate;
  }
  return full;
};

/**
 * Render the one bounded identifier-only cause payload (DEC-16): `mirror=<job>`
 * for an uncorroborated mirror, `breadth=<local ids>[ omitted=<n>]` for an
 * unmirrored local breadth, and nothing for any other outcome.
 */
export const renderSuiteMapCauseLine = (
  outcome: VerifySuiteBreadthEvaluation,
  localBreadth: readonly string[],
): string | undefined => {
  if (outcome.kind === "uncorroborated") return `mirror=${outcome.mirrorsJob}`;
  if (outcome.kind === "unmirrored") return `breadth=${renderedIdentifiers(localBreadth)}`;
  return undefined;
};

/** The declared key path of the map node, used by the configuration surface. */
export const VERIFY_SUITE_MAP_BRANCH_KEY = VERIFY_SUITE_MAP_CONFIG_KEY;
