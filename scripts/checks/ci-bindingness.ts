/**
 * TC-SCAFFOLD-024 — CI gate bindingness: no advisory or bypass constructs in
 * any `ts-` gate job.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const GATE_PREFIX = "ts-";
const FORBIDDEN: Array<[RegExp, string]> = [
  [/continue-on-error/, "continue-on-error"],
  [/\|\|\s*true/, "|| true"],
  [/set \+e/, "set +e"],
  [/if:\s*always\(\)/, "if: always()"],
  [/\bexit 0\b/, "exit 0 wrap"],
];

export const scanText = (text: string): string[] => {
  const failures: string[] = [];
  let currentJob = "";
  text.split("\n").forEach((line, index) => {
    const jobMatch = /^ {2}([a-z0-9-]+):\s*$/.exec(line);
    if (jobMatch) currentJob = jobMatch[1] as string;
    if (!currentJob.startsWith(GATE_PREFIX)) return;
    for (const [pattern, label] of FORBIDDEN) {
      if (pattern.test(line)) {
        failures.push(`${currentJob}:${index + 1}: forbidden bypass construct ${label}`);
      }
    }
  });
  return failures;
};

export const validate = (root: string): string[] =>
  scanText(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"));

if (import.meta.main) {
  const failures = validate(process.cwd());
  if (failures.length > 0) {
    for (const message of failures) console.error(`FAIL ci-bindingness: ${message}`);
    process.exit(1);
  }
  console.log("OK ci-bindingness: no advisory or bypass constructs in ts- gate jobs");
}
