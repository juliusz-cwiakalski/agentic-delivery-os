/**
 * Envelope conformance validator (TC-RESULT-006).
 *
 * Dev-only helper: takes plain parsed JSON and returns violations. It imports
 * only the runtime-neutral `@delivery-os/core/contracts` surface — never the CLI
 * surface — so tests can validate bytes without handing the helper a CLI object.
 */

import type { BrandIdentity, ErrorCategory, ErrorConsequence } from "@delivery-os/core/contracts";
import {
  COMMAND_FAILURE_DETAIL_MAX_CHARS,
  RESULT_SCHEMA_VERSION,
} from "@delivery-os/core/contracts";

export const RULES = [
  { id: "envelope.non-object", description: "the envelope must be a plain object" },
  { id: "envelope.keys.success", description: "a success envelope has exactly the v1 keys" },
  { id: "envelope.keys.failure", description: "a failure envelope has exactly the v1 keys" },
  { id: "envelope.mandatory", description: "schemaVersion, runId, exitCode, timing are present" },
  { id: "envelope.exclusivity", description: "exactly one of data or error is present" },
  { id: "envelope.exit-code", description: "exitCode is an integer in {0, 1, 2}" },
  { id: "envelope.error.keys", description: "the error object has the contracted keys" },
  { id: "envelope.error.enums", description: "error fields are valid and non-empty" },
  { id: "envelope.schema-version", description: "schemaVersion equals delivery.result.v1" },
  { id: "envelope.run-id", description: "runId is a non-empty opaque string" },
  { id: "envelope.timing", description: "timing.totalMs is a non-negative finite number" },
] as const;

export type RuleId = (typeof RULES)[number]["id"];

/** Scripted-projection rules (DEC-2, AC-F3-4): the trim has its own contract. */
export const SCRIPTED_RULES = [
  { id: "scripted.line", description: "the projection is exactly one newline-terminated line" },
  { id: "scripted.object", description: "the line parses as a plain object" },
  { id: "scripted.exclusivity", description: "exactly one of data or error is present" },
  { id: "scripted.success.keys", description: "a scripted success carries exactly data" },
  {
    id: "scripted.failure.keys",
    description: "a scripted failure carries exactly error and runId",
  },
  { id: "scripted.trimmed-absent", description: "schemaVersion, exitCode, and timing are absent" },
  {
    id: "scripted.error.keys",
    description: "the error object keeps full fields and no nested runId",
  },
] as const;

export type ScriptedRuleId = (typeof SCRIPTED_RULES)[number]["id"];

export type ScriptedViolation = {
  readonly rule: ScriptedRuleId;
  readonly field: string;
  readonly message: string;
};

export type Violation = {
  readonly rule: RuleId;
  readonly field: string;
  readonly message: string;
};

const SUCCESS_KEYS = ["schemaVersion", "runId", "exitCode", "timing", "data"] as const;
const FAILURE_KEYS = ["schemaVersion", "runId", "exitCode", "timing", "error"] as const;
/** The optional failure-envelope member (TDR-0027); present only when declared. */
const FAILURE_OPTIONAL_KEYS = ["detail"] as const;
const MANDATORY_KEYS = ["schemaVersion", "runId", "exitCode", "timing"] as const;
const ERROR_REQUIRED_KEYS = [
  "code",
  "category",
  "retryable",
  "consequence",
  "remediationHint",
] as const;
const ERROR_ALLOWED_KEYS = [...ERROR_REQUIRED_KEYS, "summary"] as const;
/** The only declared failure-envelope detail member (TDR-0027). */
const FAILURE_OPTIONAL_DETAIL_MEMBERS = ["holder"] as const;
const CATEGORIES: readonly string[] = ["user", "platform", "transient", "permanent"];
const CONSEQUENCES: readonly string[] = ["landed", "not_landed", "unknown"];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sameKeySet = (actual: readonly string[], expected: readonly string[]): boolean =>
  actual.length === expected.length && expected.every((key) => actual.includes(key));

const opaque = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length === 0) return false;
  return [...value].every((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 0x21 && code <= 0x7e;
  });
};

export const assertEnvelopeContract = (parsed: unknown): Violation[] => {
  if (!isPlainObject(parsed)) {
    return [
      {
        rule: "envelope.non-object",
        field: "envelope",
        message: "the envelope must be a plain object",
      },
    ];
  }

  const violations: Violation[] = [];
  const keys = Object.keys(parsed).filter((key) => parsed[key] !== undefined);
  const hasData = Object.hasOwn(parsed, "data") && parsed.data !== undefined;
  const hasError = Object.hasOwn(parsed, "error") && parsed.error !== undefined;

  for (const key of MANDATORY_KEYS) {
    if (!Object.hasOwn(parsed, key) || parsed[key] === undefined) {
      violations.push({
        rule: "envelope.mandatory",
        field: key,
        message: `mandatory field ${key} is missing`,
      });
    }
  }

  if (hasData === hasError) {
    violations.push({
      rule: "envelope.exclusivity",
      field: hasData ? "data" : "error",
      message: "exactly one of data or error must be present (never both, never neither)",
    });
  }

  const expectedKeys = hasData ? SUCCESS_KEYS : FAILURE_KEYS;
  const optionalKeys: readonly string[] = hasData ? [] : FAILURE_OPTIONAL_KEYS;
  const extra = keys.filter(
    (key) => !expectedKeys.includes(key as never) && !optionalKeys.includes(key),
  );
  const missing = expectedKeys.filter((key) => !keys.includes(key));
  if (extra.length > 0 || missing.length > 0) {
    violations.push({
      rule: hasData ? "envelope.keys.success" : "envelope.keys.failure",
      field: extra[0] ?? missing[0] ?? "envelope",
      message: `keys must be exactly ${expectedKeys.join(", ")}; extra=${JSON.stringify(extra)} missing=${JSON.stringify(missing)}`,
    });
  }

  if (
    Object.hasOwn(parsed, "schemaVersion") &&
    parsed.schemaVersion !== undefined &&
    parsed.schemaVersion !== RESULT_SCHEMA_VERSION
  ) {
    violations.push({
      rule: "envelope.schema-version",
      field: "schemaVersion",
      message: `schemaVersion must be ${RESULT_SCHEMA_VERSION}`,
    });
  }

  if (Object.hasOwn(parsed, "runId") && parsed.runId !== undefined && !opaque(parsed.runId)) {
    violations.push({
      rule: "envelope.run-id",
      field: "runId",
      message: "runId must be a non-empty opaque string",
    });
  }

  if (Object.hasOwn(parsed, "exitCode") && parsed.exitCode !== undefined) {
    const exitCode = parsed.exitCode;
    if (
      typeof exitCode !== "number" ||
      !Number.isInteger(exitCode) ||
      exitCode < 0 ||
      exitCode > 2
    ) {
      violations.push({
        rule: "envelope.exit-code",
        field: "exitCode",
        message: "exitCode must be an integer in {0, 1, 2}",
      });
    }
  }

  if (Object.hasOwn(parsed, "timing") && parsed.timing !== undefined) {
    const timing = parsed.timing;
    const totalMs = isPlainObject(timing) ? timing.totalMs : undefined;
    if (
      !isPlainObject(timing) ||
      typeof totalMs !== "number" ||
      !Number.isFinite(totalMs) ||
      totalMs < 0
    ) {
      violations.push({
        rule: "envelope.timing",
        field: "timing",
        message: "timing.totalMs must be a non-negative finite number",
      });
    }
  }

  if (hasError) {
    const error = parsed.error;
    if (!isPlainObject(error)) {
      violations.push({
        rule: "envelope.error.keys",
        field: "error",
        message: "error must be a plain object",
      });
    } else {
      const errorKeys = Object.keys(error);
      for (const key of ERROR_REQUIRED_KEYS) {
        if (!Object.hasOwn(error, key) || error[key] === undefined) {
          violations.push({
            rule: "envelope.error.keys",
            field: `error.${key}`,
            message: `error field ${key} is missing`,
          });
        }
      }
      for (const key of errorKeys) {
        if (!ERROR_ALLOWED_KEYS.includes(key as never)) {
          violations.push({
            rule: "envelope.error.keys",
            field: `error.${key}`,
            message: `unexpected error field ${key}`,
          });
        }
      }

      if (typeof error.code !== "string" || error.code.length === 0) {
        violations.push({
          rule: "envelope.error.enums",
          field: "error.code",
          message: "error.code must be a non-empty string",
        });
      }
      if (typeof error.category !== "string" || !CATEGORIES.includes(error.category)) {
        violations.push({
          rule: "envelope.error.enums",
          field: "error.category",
          message: "error.category must be user|platform|transient|permanent",
        });
      }
      if (typeof error.retryable !== "boolean") {
        violations.push({
          rule: "envelope.error.enums",
          field: "error.retryable",
          message: "error.retryable must be a boolean",
        });
      }
      if (typeof error.consequence !== "string" || !CONSEQUENCES.includes(error.consequence)) {
        violations.push({
          rule: "envelope.error.enums",
          field: "error.consequence",
          message: "error.consequence must be landed|not_landed|unknown",
        });
      }
      if (typeof error.remediationHint !== "string" || error.remediationHint.length === 0) {
        violations.push({
          rule: "envelope.error.enums",
          field: "error.remediationHint",
          message: "error.remediationHint must be a non-empty string",
        });
      }
      if (
        Object.hasOwn(error, "summary") &&
        error.summary !== undefined &&
        (typeof error.summary !== "string" || error.summary.length === 0)
      ) {
        violations.push({
          rule: "envelope.error.enums",
          field: "error.summary",
          message: "error.summary, when present, must be a non-empty string",
        });
      }
    }
  }

  // The optional envelope-root detail (TDR-0027): a closed, bounded contract.
  // The member is admitted only on a failure envelope; `holder` is single line
  // and within the declared cap, and no other member exists.
  if (hasError && Object.hasOwn(parsed, "detail")) {
    const detail = parsed.detail;
    if (!isPlainObject(detail)) {
      violations.push({
        rule: "envelope.keys.failure",
        field: "detail",
        message: "detail, when present, must be a plain object",
      });
    } else {
      for (const key of Object.keys(detail)) {
        if (!(FAILURE_OPTIONAL_DETAIL_MEMBERS as readonly string[]).includes(key)) {
          violations.push({
            rule: "envelope.keys.failure",
            field: `detail.${key}`,
            message: `unexpected detail field ${key}`,
          });
        }
      }
      if (Object.hasOwn(detail, "holder")) {
        const holder = detail.holder;
        const invalid =
          typeof holder !== "string" ||
          holder.length === 0 ||
          holder.length > COMMAND_FAILURE_DETAIL_MAX_CHARS ||
          /[\r\n]/u.test(holder);
        if (invalid) {
          violations.push({
            rule: "envelope.keys.failure",
            field: "detail.holder",
            message: `detail.holder must be a non-empty single line of at most ${COMMAND_FAILURE_DETAIL_MAX_CHARS} characters`,
          });
        }
      }
    }
  }

  return violations;
};

export type { ErrorCategory, ErrorConsequence };

/** Shape of a golden case's `injected.json` (A-T3, A-T4). */
export type GoldenMode = "interactive" | "scripted";

export type GoldenInjected = {
  readonly ticks: readonly [number, number];
  readonly startTicks?: readonly [number, number];
  readonly runId: string;
  readonly brand: BrandIdentity;
  readonly program: string;
  readonly secrets?: readonly string[];
  readonly mode?: GoldenMode;
  readonly environment?: Readonly<Record<string, string>>;
};

/** Shape of a golden case's `meta.json`. */
export type GoldenMeta = {
  readonly outcome: "success" | "classified-failure" | "unknown-failure" | "broken-invocation";
  readonly secrets: boolean;
  readonly mode?: GoldenMode;
};

/** One discovered golden case. */
export type GoldenCase = {
  readonly id: string;
  readonly directory: string;
  readonly argv: readonly string[];
  readonly injected: GoldenInjected;
  readonly stdout: string;
  readonly stderr: string;
  readonly meta: GoldenMeta;
};

const readText = async (path: string): Promise<string> => {
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`golden file is missing: ${path}`);
  return file.text();
};

const readJson = async <T>(path: string): Promise<T> => JSON.parse(await readText(path)) as T;

/**
 * Discover golden cases from disk. A case with no golden fails rather than being
 * skipped; there is no auto-accept/update path.
 */
export const loadGoldenCases = async (root: string): Promise<GoldenCase[]> => {
  const matches = [...new Bun.Glob("*/argv.json").scanSync({ cwd: root })];
  if (matches.length === 0) throw new Error(`golden root has no cases: ${root}`);
  const cases: GoldenCase[] = [];
  for (const match of matches) {
    const id = match.slice(0, -"/argv.json".length);
    const directory = `${root}/${id}`;
    const argv = await readJson<readonly string[]>(`${directory}/argv.json`);
    const injected = await readJson<GoldenInjected>(`${directory}/injected.json`);
    const meta = await readJson<GoldenMeta>(`${directory}/meta.json`);
    if (!Array.isArray(argv) || argv.length === 0) {
      throw new Error(`${id}: argv.json must be a non-empty array`);
    }
    if (
      !Array.isArray(injected.ticks) ||
      injected.ticks.length !== 2 ||
      typeof injected.ticks[0] !== "number" ||
      typeof injected.ticks[1] !== "number"
    ) {
      throw new Error(`${id}: injected.json must declare a two-tick clock`);
    }
    if (typeof injected.runId !== "string" || injected.runId.length === 0) {
      throw new Error(`${id}: injected.json must declare a runId`);
    }
    const mode = injected.mode ?? "interactive";
    if (mode !== "interactive" && mode !== "scripted") {
      throw new Error(`${id}: injected.json declares an unsupported mode`);
    }
    if (meta.mode !== undefined && meta.mode !== mode) {
      throw new Error(`${id}: meta.json mode disagrees with injected.json`);
    }
    const stdout = await readText(`${directory}/stdout.json`);
    const stderrFile = Bun.file(`${directory}/stderr.txt`);
    const stderr = (await stderrFile.exists()) ? await stderrFile.text() : "";
    cases.push({
      id,
      directory,
      argv,
      injected,
      stdout,
      stderr,
      meta,
    });
  }
  return cases.sort((left, right) => left.id.localeCompare(right.id));
};

/**
 * Validate the scripted-mode machine projection: exactly one minified line,
 * success `data` only, failure `error` + top-level `runId`, and no trimmed
 * context tokens anywhere.
 */
export const assertScriptedProjection = (text: string): ScriptedViolation[] => {
  const violations: ScriptedViolation[] = [];
  const oneLine = text.endsWith("\n") && text.indexOf("\n") === text.length - 1;
  if (!oneLine) {
    violations.push({
      rule: "scripted.line",
      field: "stdout",
      message: "scripted output must be exactly one newline-terminated line",
    });
  }
  const trimmed = text.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    violations.push({
      rule: "scripted.object",
      field: "stdout",
      message: "the scripted line must parse as JSON",
    });
    return violations;
  }
  if (!isPlainObject(parsed)) {
    violations.push({
      rule: "scripted.object",
      field: "stdout",
      message: "the scripted line must be a plain object",
    });
    return violations;
  }

  const hasData = Object.hasOwn(parsed, "data");
  const hasError = Object.hasOwn(parsed, "error");
  if (hasData === hasError) {
    violations.push({
      rule: "scripted.exclusivity",
      field: hasData ? "data" : "error",
      message: "exactly one of data or error must be present",
    });
  }

  for (const token of ["schemaVersion", "exitCode", "timing"]) {
    if (Object.hasOwn(parsed, token)) {
      violations.push({
        rule: "scripted.trimmed-absent",
        field: token,
        message: `${token} must not appear on a scripted line`,
      });
    }
  }

  if (hasData) {
    if (!sameKeySet(Object.keys(parsed), ["data"])) {
      violations.push({
        rule: "scripted.success.keys",
        field: "stdout",
        message: "a scripted success line carries exactly data",
      });
    }
    if (Object.hasOwn(parsed, "runId")) {
      violations.push({
        rule: "scripted.trimmed-absent",
        field: "runId",
        message: "runId must not appear on a scripted success line",
      });
    }
  }

  if (hasError) {
    if (!sameKeySet(Object.keys(parsed), ["error", "runId"])) {
      violations.push({
        rule: "scripted.failure.keys",
        field: "stdout",
        message: "a scripted failure line carries exactly error and top-level runId",
      });
    }
    const location = parsed.runId;
    if (!opaque(location)) {
      violations.push({
        rule: "scripted.failure.keys",
        field: "runId",
        message: "a scripted failure line carries a non-empty top-level runId",
      });
    }
    const error = parsed.error;
    if (!isPlainObject(error)) {
      violations.push({
        rule: "scripted.error.keys",
        field: "error",
        message: "error must be a plain object",
      });
    } else {
      for (const key of ERROR_REQUIRED_KEYS) {
        if (!Object.hasOwn(error, key) || error[key] === undefined) {
          violations.push({
            rule: "scripted.error.keys",
            field: `error.${key}`,
            message: `error field ${key} is missing`,
          });
        }
      }
      for (const key of Object.keys(error)) {
        if (!ERROR_ALLOWED_KEYS.includes(key as never)) {
          violations.push({
            rule: "scripted.error.keys",
            field: `error.${key}`,
            message: `unexpected error field ${key}`,
          });
        }
      }
      if (Object.hasOwn(error, "runId")) {
        violations.push({
          rule: "scripted.error.keys",
          field: "error.runId",
          message: "runId must be top-level, not nested in error",
        });
      }
    }
  }
  return violations;
};
