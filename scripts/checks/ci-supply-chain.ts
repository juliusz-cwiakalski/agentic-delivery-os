/**
 * TC-SCAFFOLD-038 — CI supply-chain hygiene: SHA-pinned actions, job-scoped
 * least-privilege permissions, no privileged fork exposure.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const GATE_PREFIX = "ts-";
const SHA_PINNED = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/;

type Step = { uses?: string; run?: string; with?: Record<string, unknown>; name?: string };
type Job = { permissions?: Record<string, string>; steps?: Step[] };
type Workflow = {
  on?: Record<string, unknown>;
  jobs?: Record<string, Job>;
};

export const scanText = (text: string): string[] => {
  const failures: string[] = [];
  const workflow = parse(text) as Workflow;
  if (workflow.on && "pull_request_target" in workflow.on) {
    failures.push("workflow must not use pull_request_target");
  }
  for (const [name, job] of Object.entries(workflow.jobs ?? {})) {
    if (!name.startsWith(GATE_PREFIX)) continue;
    const permissions = job.permissions ?? {};
    if (permissions.contents !== "read") {
      failures.push(`${name}: must declare job-scoped permissions with contents: read`);
    }
    for (const [index, step] of (job.steps ?? []).entries()) {
      const label = `${name} step ${index + 1}`;
      if (step.uses !== undefined && !SHA_PINNED.test(step.uses)) {
        failures.push(`${label}: uses ${step.uses} is not pinned to a full commit SHA`);
      }
      const serialized = JSON.stringify(step);
      if (serialized.includes("secrets.")) {
        failures.push(`${label}: must not expose secrets (fork PR exposure)`);
      }
    }
  }
  return failures;
};

export const validate = (root: string): string[] =>
  scanText(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"));

if (import.meta.main) {
  const failures = validate(process.cwd());
  if (failures.length > 0) {
    for (const message of failures) console.error(`FAIL ci-supply-chain: ${message}`);
    process.exit(1);
  }
  console.log("OK ci-supply-chain: all ts- job actions SHA-pinned, permissions least-privilege");
}
