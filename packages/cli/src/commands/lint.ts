/**
 * `lint` command — read-only schema and format conformance (GH-179 C-3, PIN-1).
 *
 * The handler resolves the positional change ref and the additive target flags,
 * runs the pure rules over edge-parsed values, and returns data or a classified
 * failure. It never writes streams, never chooses an exit code, and never
 * mutates a target. The brand arrives through the injected invocation.
 */
import { lintPmNotes, type PmNotesLintFinding } from "@delivery-os/core";
import type { PmNotesParseFailure, StateFailure } from "@delivery-os/core/contracts";
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

/**
 * Build the lint command definition. Target selection follows PIN-1: a bare
 * invocation targets pm-notes; `--registry` targets the registry; both flags
 * target both, checked pm-notes first so the first failure wins.
 */
export const createLintCommandDefinition = (runtime: LintCommandRuntime): CommandDefinition => ({
  flags: ["--pm-notes", "--registry"],
  positionals: { max: 1 },
  humanSuccess: true,
  handler: ({ flags, positionals }) => {
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
