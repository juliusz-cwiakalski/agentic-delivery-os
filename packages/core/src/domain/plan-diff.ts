/**
 * Pure declared-versus-actual scope observation (GH-226 F-9, F-2).
 *
 * Every actual path appears exactly once; declared concrete files that were not
 * touched are named with their phase. Wildcards resolve with the same boundary
 * rules as validation. No I/O, clock, randomness, or environment access.
 */
import {
  PLAN_MAX_DIFF_PATHS,
  type PlanDiffData,
  type PlanDiffEntry,
  type PlanDiffFinding,
  type PlanDocument,
} from "#contracts";
import { normalizeRepoPath, scopeCoversPath } from "./plan-paths.js";

/** The injected facts for one diff observation. */
export type PlanDiffInput = {
  readonly workItemRef: string;
  readonly document: PlanDocument;
  readonly actualPaths: readonly string[];
  readonly against: string;
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

/** Compute the per-path table and classified findings. */
export const computePlanDiff = (input: PlanDiffInput): PlanDiffData => {
  const actual = [...new Set(input.actualPaths.map(normalizeRepoPath))].sort(compareText);
  const actualSet = new Set(actual);
  const entries: PlanDiffEntry[] = [];
  const findings: PlanDiffFinding[] = [];

  for (const path of actual) {
    const phases = input.document.phases
      .filter((phase) => scopeCoversPath(phase.scope, path))
      .map((phase) => phase.id);
    const first = phases[0];
    if (first === undefined) {
      entries.push({ path, classification: "outside-declared" });
      findings.push({
        classification: "outside-declared",
        path,
        code: "plan.scope.undeclared-paths",
      });
    } else {
      entries.push({ path, classification: "within", phase: first });
    }
  }

  const declaredFiles = new Map<string, number>();
  for (const phase of input.document.phases) {
    for (const file of phase.scope.files ?? []) {
      const normalized = normalizeRepoPath(file);
      if (!declaredFiles.has(normalized)) declaredFiles.set(normalized, phase.id);
    }
  }
  for (const [path, phase] of declaredFiles) {
    if (actualSet.has(path)) continue;
    entries.push({ path, classification: "undeclared-missing", phase });
    findings.push({ classification: "undeclared-missing", path, phase });
  }

  entries.sort((left, right) => compareText(left.path, right.path));
  findings.sort((left, right) => compareText(left.path, right.path));
  const boundedEntries = entries.slice(0, PLAN_MAX_DIFF_PATHS);
  const boundedFindings = findings.slice(0, PLAN_MAX_DIFF_PATHS);
  return {
    verdict: findings.length === 0 ? "within" : "findings",
    against: input.against,
    entries: boundedEntries,
    findings: boundedFindings,
    truncated: entries.length > boundedEntries.length || findings.length > boundedFindings.length,
    totalEntries: entries.length,
  };
};
