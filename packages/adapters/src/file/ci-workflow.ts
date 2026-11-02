/**
 * One bounded CI-workflow read at the runtime edge (GH-178 F-4).
 *
 * The workflow is parsed with the existing YAML substrate and only job display
 * names (falling back to the job id) leave this module. No raw workflow body,
 * step, environment value, or secret crosses the boundary. Validation of the
 * resulting set belongs to the pure CI gate.
 */
import {
  VERIFY_GATES_CI_WORKFLOW_PATH,
  VERIFY_GATES_WORKFLOW_MAX_BYTES,
} from "@delivery-os/core/contracts";
import type { FileSystemFacts } from "./config-source.js";
import { parseConfigYaml } from "./yaml-parser.js";

/** The declared expected-job-set outcome; never raw workflow content. */
export type CiWorkflowJobNamesRead = {
  readonly path: string;
  readonly outcome: "read" | "failed" | "absent";
  readonly names: readonly string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const joinPath = (baseDirectory: string, path: string): string => {
  const base = baseDirectory.replace(/[\\/]+$/, "");
  return base.length === 0 ? path : `${base}/${path}`;
};

/** Read the top-level `jobs` map in declaration order. */
export const readCiWorkflowJobNames = (input: {
  readonly baseDirectory: string;
  readonly fs: FileSystemFacts;
  readonly path?: string;
}): CiWorkflowJobNamesRead => {
  const path = input.path ?? VERIFY_GATES_CI_WORKFLOW_PATH;
  const file = joinPath(input.baseDirectory, path);
  if (!input.fs.exists(file)) return { path, outcome: "absent", names: [] };
  let text: string;
  try {
    text = input.fs.readText(file);
  } catch {
    return { path, outcome: "failed", names: [] };
  }
  if (text.length > VERIFY_GATES_WORKFLOW_MAX_BYTES) {
    return { path, outcome: "failed", names: [] };
  }
  const parsed = parseConfigYaml(text, "project-committed", file);
  if (!parsed.ok) return { path, outcome: "failed", names: [] };
  const jobs = parsed.facts.values.jobs;
  if (!isRecord(jobs)) return { path, outcome: "failed", names: [] };
  const names: string[] = [];
  for (const [jobId, value] of Object.entries(jobs)) {
    if (!isRecord(value)) return { path, outcome: "failed", names: [] };
    const displayName = value.name;
    names.push(typeof displayName === "string" && displayName.length > 0 ? displayName : jobId);
  }
  return { path, outcome: "read", names };
};
