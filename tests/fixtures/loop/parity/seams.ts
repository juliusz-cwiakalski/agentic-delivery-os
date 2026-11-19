/**
 * The battery's seam manifest and anti-reimplementation controls (GH-348 AC-F8-1,
 * AC-F8-2; TC-BATTLE-002).
 *
 * Three independent mechanisms prove no battery file reimplements a production
 * seam: the import-identity manifest below, a forbidden-signature scan over the
 * battery sources, and a planted reimplementation that the scan rejects BY NAME.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The production modules a battery file may CONSUME and must never rebuild. */
export const LOOP_SEAM_MODULES = [
  "packages/core/src/app/loop-supervisor.ts",
  "packages/core/src/app/loop-corroborator.ts",
  "packages/core/src/domain/loop-verdict.ts",
  "packages/core/src/domain/loop-backoff.ts",
  "packages/core/src/domain/loop-log.ts",
  "packages/core/src/domain/loop-status.ts",
  "packages/cli/src/commands/loop.ts",
  "scripts/checks/no-shell-dispatch.ts",
] as const;

/** The battery sources under scan. */
export const LOOP_BATTERY_FILES = [
  "tests/conformance/loop/loop-parity-battery.test.ts",
  "tests/conformance/loop/loop-pick-deliver-merge.test.ts",
  "tests/fixtures/loop/parity/cases.ts",
  "tests/fixtures/loop/parity/evidence.ts",
  "tests/fixtures/loop/parity/e2e.ts",
] as const;

/** Signatures that mean a battery file rebuilt a seam instead of consuming it. */
export const LOOP_FORBIDDEN_SIGNATURES = [
  "function restartDelayMs",
  "function corroborateDelivery",
  "function evaluateLoopVerdict",
  "function renderLogLine",
  "function projectLoopStatus",
  "function decideCoordinatorClaim",
  "function evaluateCoordinatorRestartAdmission",
  "function killCoordinatorProcess",
] as const;

/** The violations one battery source carries, by signature. */
export const seamViolations = (text: string): readonly string[] =>
  LOOP_FORBIDDEN_SIGNATURES.filter((signature) => text.includes(signature));

/** Scan the declared battery sources under `root`. */
export const scanBatterySeams = (root: string): readonly string[] => {
  const failures: string[] = [];
  for (const file of LOOP_BATTERY_FILES) {
    let text: string;
    try {
      text = readFileSync(join(root, file), "utf8");
    } catch {
      failures.push(`${file}: missing battery source`);
      continue;
    }
    for (const signature of seamViolations(text)) failures.push(`${file}: ${signature}`);
  }
  return failures;
};

/** A planted reimplementation the scan MUST reject, with its named signature. */
export const PLANTED_REIMPLEMENTATION = "function restartDelayMs(n: number) { return n; }";
