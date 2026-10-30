/**
 * Envelope conformance validator (TC-RESULT-006).
 *
 * Dev-only helper: takes plain parsed JSON and returns violations. It imports
 * only the runtime-neutral `@delivery-os/core/contracts` surface — never the CLI
 * surface — so tests can validate bytes without handing the helper a CLI object.
 */

import type { ErrorCategory, ErrorConsequence } from "@delivery-os/core/contracts";
import { RESULT_SCHEMA_VERSION } from "@delivery-os/core/contracts";

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

export type Violation = {
  readonly rule: RuleId;
  readonly field: string;
  readonly message: string;
};

const SUCCESS_KEYS = ["schemaVersion", "runId", "exitCode", "timing", "data"] as const;
const FAILURE_KEYS = ["schemaVersion", "runId", "exitCode", "timing", "error"] as const;
const MANDATORY_KEYS = ["schemaVersion", "runId", "exitCode", "timing"] as const;
const ERROR_REQUIRED_KEYS = [
  "code",
  "category",
  "retryable",
  "consequence",
  "remediationHint",
] as const;
const ERROR_ALLOWED_KEYS = [...ERROR_REQUIRED_KEYS, "summary"] as const;
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
  if (!sameKeySet(keys, [...expectedKeys])) {
    const extra = keys.filter((key) => !expectedKeys.includes(key as never));
    const missing = expectedKeys.filter((key) => !keys.includes(key));
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

  return violations;
};

export type { ErrorCategory, ErrorConsequence };
