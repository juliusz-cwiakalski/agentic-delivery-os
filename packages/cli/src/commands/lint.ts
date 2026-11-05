/**
 * `lint` command — read-only schema and format conformance (GH-179 C-3, PIN-1).
 *
 * The handler resolves the positional change ref and the additive target flags,
 * runs the pure rules over edge-parsed values, and returns data or a classified
 * failure. It never writes streams, never chooses an exit code, and never
 * mutates a target. The brand arrives through the injected invocation.
 */
import { lintPmNotes, type PmNotesLintFinding, validatePlan } from "@delivery-os/core";
import {
  LINT_DOCUMENT_UNREADABLE_CODE,
  type PlanArtifactRead,
  type PlanYamlParser,
  type PmNotesParseFailure,
  type StateFailure,
} from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";

/** A pm-notes target read: values, absence, or a safe parse failure. */
export type LintPmNotesRead =
  | { readonly ok: true; readonly file: string; readonly value: unknown }
  | { readonly ok: false; readonly reason: "missing" }
  | {
      readonly ok: false;
      readonly reason: "malformed";
      readonly file: string;
      readonly parseFailure: PmNotesParseFailure;
    };

/** A registry target read: verified evidence, or a classified state failure. */
export type LintRegistryRead =
  | {
      readonly ok: true;
      readonly verifiedEmpty: boolean;
      readonly recordCount: number;
      readonly verification: readonly string[];
      readonly projection: { readonly present: boolean };
    }
  | { readonly ok: false; readonly error: StateFailure };

/** Everything the lint surface reads; all I/O and state access is injected. */
export type LintCommandRuntime = {
  readonly readPmNotes: (changeRef: string) => LintPmNotesRead;
  readonly readRegistry: (changeRef: string) => LintRegistryRead;
  /** The additive plan target: absent when the surface is not configured. */
  readonly readPlan?: (changeRef: string) => PlanArtifactRead;
  readonly parseYaml?: PlanYamlParser;
};

type TargetSuccess = { readonly ok: true; readonly data: Record<string, unknown> };
type TargetFailure = { readonly ok: false; readonly error: Record<string, unknown> };

const locationText = (finding: PmNotesLintFinding): string => {
  const { location } = finding;
  switch (location.kind) {
    case "document":
      return "document";
    case "top-level":
      return location.key;
    case "phase":
      return `phases.${location.phaseId}${location.field === undefined ? "" : `.${location.field}`}`;
    case "collection": {
      const base = `${location.collection}[${location.index}]`;
      return location.field === undefined ? base : `${base}.${location.field}`;
    }
  }
};

const findingError = (finding: PmNotesLintFinding): TargetFailure => ({
  ok: false,
  error: {
    kind: "lint",
    code: finding.code,
    summary: `${finding.detail} (at ${locationText(finding)})`,
  },
});

const pmNotesTarget = (
  runtime: LintCommandRuntime,
  changeRef: string,
): TargetSuccess | TargetFailure => {
  const read = runtime.readPmNotes(changeRef);
  if (!read.ok && read.reason === "missing") {
    return {
      ok: false,
      error: {
        kind: "lint",
        code: "lint.target.missing",
        summary: `pm-notes target is missing for ${changeRef}`,
      },
    };
  }
  if (!read.ok) {
    const verdict = lintPmNotes({ ok: false, parseFailure: read.parseFailure });
    return verdict.ok ? { ok: true, data: {} } : findingError(verdict.finding);
  }
  const verdict = lintPmNotes({ ok: true, value: read.value });
  if (!verdict.ok) return findingError(verdict.finding);
  return {
    ok: true,
    data: {
      changeRef,
      target: "pm-notes",
      variant: verdict.variant,
      evidence: { class: "conforms", file: read.file },
    },
  };
};

const registryTarget = (
  runtime: LintCommandRuntime,
  changeRef: string,
): TargetSuccess | TargetFailure => {
  const read = runtime.readRegistry(changeRef);
  if (!read.ok) return { ok: false, error: { ...read.error } };
  return {
    ok: true,
    data: {
      changeRef,
      target: "registry",
      evidence: {
        class: read.verifiedEmpty ? "verified-empty" : "verified",
        target: "registry",
        recordCount: read.recordCount,
        verification: read.verification,
        projection: read.projection,
      },
    },
  };
};

const invocationError = (summary: string): { readonly error: Record<string, unknown> } => ({
  error: { kind: "input", code: "input.value.rejected", summary },
});

type PlanDocumentReport = {
  readonly path: string;
  readonly verdict: "valid" | "invalid" | "unreadable";
  readonly errors: readonly Record<string, unknown>[];
};

const planTarget = (
  runtime: LintCommandRuntime,
  changeRef: string,
): TargetSuccess | TargetFailure => {
  if (runtime.readPlan === undefined || runtime.parseYaml === undefined) {
    return {
      ok: false,
      error: {
        kind: "input",
        code: "input.value.rejected",
        summary: "the plan lint target is not configured",
      },
    };
  }
  const read = runtime.readPlan(changeRef);
  const path = read.ok
    ? read.artifact.path
    : (read.path ?? `chg-${changeRef}-plan.yaml`);
  if (!read.ok && read.reason === "unreadable") {
    const document: PlanDocumentReport = {
      path,
      verdict: "unreadable",
      errors: [
        {
          code: LINT_DOCUMENT_UNREADABLE_CODE,
          location: { field: "artifact" },
          detail: "the plan document could not be read or decoded",
        },
      ],
    };
    return { ok: true, data: { changeRef, target: "plan", documents: [document] } };
  }
  const verdict = validatePlan({
    workItemRef: changeRef,
    read,
    parseYaml: runtime.parseYaml,
  });
  const document: PlanDocumentReport = {
    path,
    verdict: verdict.verdict,
    errors: verdict.errors.map((error) => ({
      code: error.code,
      location: {
        ...(error.phase === undefined ? {} : { phase: error.phase }),
        field: error.field,
      },
      detail: error.problem,
    })),
  };
  return { ok: true, data: { changeRef, target: "plan", documents: [document] } };
};

/**
 * Build the lint command definition. Target selection follows PIN-1: a bare
 * invocation targets pm-notes; `--registry` targets the registry; both flags
 * target both, checked pm-notes first so the first failure wins.
 */
export const createLintCommandDefinition = (runtime: LintCommandRuntime): CommandDefinition => ({
  flags: ["--pm-notes", "--registry"],
  positionals: { max: 2 },
  humanSuccess: true,
  exitProjection: (data) => {
    if (typeof data !== "object" || data === null || Array.isArray(data)) return "success";
    const record = data as { readonly target?: unknown; readonly documents?: unknown };
    if (record.target !== "plan" || !Array.isArray(record.documents)) return "success";
    const verdicts = record.documents
      .filter((entry): entry is { readonly verdict?: unknown } => typeof entry === "object" && entry !== null)
      .map((entry) => entry.verdict);
    if (verdicts.includes("unreadable")) return "platform-provider";
    return verdicts.includes("invalid") ? "user-validation" : "success";
  },
  handler: ({ flags, positionals }) => {
    if (positionals[0] === "plan") {
      if (positionals.length !== 2) {
        return invocationError("lint plan requires exactly one change ref");
      }
      if (flags["--registry"] === true || flags["--pm-notes"] === true) {
        return invocationError("lint plan cannot be combined with another target");
      }
      return planTarget(runtime, positionals[1] as string);
    }
    if (positionals.length !== 1) {
      return invocationError("lint requires exactly one change ref");
    }
    const changeRef = positionals[0] as string;
    const registrySelected = flags["--registry"] === true;
    const pmNotesSelected = flags["--pm-notes"] === true || !registrySelected;
    const targets: Record<string, unknown>[] = [];
    if (pmNotesSelected) {
      const result = pmNotesTarget(runtime, changeRef);
      if (!result.ok) return { error: result.error };
      targets.push(result.data);
    }
    if (registrySelected) {
      const result = registryTarget(runtime, changeRef);
      if (!result.ok) return { error: result.error };
      targets.push(result.data);
    }
    return {
      data: targets.length === 1 ? targets[0] : { changeRef, targets },
    };
  },
});
