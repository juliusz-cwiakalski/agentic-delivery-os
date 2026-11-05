/**
 * Shared plan fixture harness (GH-226 test plan §6).
 *
 * Fixtures are read from `tests/fixtures/plan/**`; every port is injected and
 * every call is recorded. Nothing here reads the wall clock, the network, the
 * real repository, or the change artifacts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseConfigYaml } from "../../../../packages/adapters/src/file/yaml-parser";
import type {
  PlanArtifactRead,
  PlanArtifactRef,
  PlanDiffPort,
  PlanDiffRead,
  PlanDocument,
  PlanReadPort,
  PlanValidateData,
  PlanYamlParser,
} from "../../../../packages/core/src/contracts/index";
import {
  planDocumentFromValidateData,
  validatePlan,
} from "../../../../packages/core/src/domain/plan-validate";

const PLAN_ROOT = join(import.meta.dir, "..");

/** Read one committed fixture as UTF-8 text. */
export const fixture = (relative: string): string =>
  readFileSync(join(PLAN_ROOT, relative), "utf8");

export type PlanFixture = {
  readonly kind: "yaml" | "markdown";
  readonly path: string;
  readonly text: string;
};

/** A ref's candidate artifacts; the reader applies YAML-before-markdown. */
export type PlanWorld = {
  readonly artifacts: Readonly<Record<string, readonly PlanFixture[]>>;
  readonly absent?: readonly string[];
  readonly unreadable?: readonly string[];
  readonly diff?: Readonly<Record<string, readonly string[]>>;
};

export type Recorder = {
  readonly reads: string[];
  writes: number;
  fences: number;
  mutations: number;
  spawns: number;
  credentialReads: number;
  networkCalls: number;
};

export const createRecorder = (): Recorder => ({
  reads: [],
  writes: 0,
  fences: 0,
  mutations: 0,
  spawns: 0,
  credentialReads: 0,
  networkCalls: 0,
});

const rank = (kind: PlanFixture["kind"]): number => (kind === "yaml" ? 0 : 1);

/**
 * Deterministic precedence: the machine-readable YAML plan wins when both
 * formats exist (OQ-4); ties inside one format resolve by path.
 */
export const selectArtifact = (candidates: readonly PlanFixture[]): PlanFixture | undefined => {
  const sorted = [...candidates].sort((left, right) => {
    const byKind = rank(left.kind) - rank(right.kind);
    return byKind === 0 ? left.path.localeCompare(right.path) : byKind;
  });
  return sorted[0];
};

/** An in-memory plan-read port with the OQ-4 precedence rule. */
export const planReadPort = (world: PlanWorld, recorder: Recorder): PlanReadPort => (workItemRef) => {
  recorder.reads.push(`plan:${workItemRef}`);
  if ((world.absent ?? []).includes(workItemRef)) {
    return { ok: false, reason: "absent", workItemRef };
  }
  if ((world.unreadable ?? []).includes(workItemRef)) {
    return {
      ok: false,
      reason: "unreadable",
      workItemRef,
      path: `chg-${workItemRef}-plan.yaml`,
    } satisfies PlanArtifactRead;
  }
  const selected = selectArtifact(world.artifacts[workItemRef] ?? []);
  if (selected === undefined) {
    return { ok: false, reason: "absent", workItemRef };
  }
  return { ok: true, artifact: { kind: selected.kind, path: selected.path }, text: selected.text };
};

/** An in-memory repository-diff port that records the requested base. */
export const planDiffPort =
  (world: PlanWorld, recorder: Recorder): PlanDiffPort =>
  (workItemRef, base) => {
    recorder.reads.push(`diff:${workItemRef}:${base}`);
    const paths = world.diff?.[workItemRef];
    if (paths === undefined) {
      return { ok: false, reason: "unreadable", workItemRef } satisfies PlanDiffRead;
    }
    return { ok: true, paths };
  };

/** Build the candidate artifact for a committed YAML fixture. */
export const yamlFixture = (workItemRef: string, relative: string): PlanFixture => ({
  kind: "yaml",
  path: `chg-${workItemRef}-plan.yaml`,
  text: fixture(relative),
});

/** Build the candidate artifact for a committed legacy markdown fixture. */
export const markdownFixture = (workItemRef: string, relative: string): PlanFixture => ({
  kind: "markdown",
  path: `chg-${workItemRef}-plan.md`,
  text: fixture(relative),
});

/** A single-artifact world. */
export const singlePlanWorld = (workItemRef: string, candidate: PlanFixture): PlanWorld => ({
  artifacts: { [workItemRef]: [candidate] },
});

/** Assert the recorder observed only the declared read set. */
export const expectReadOnly = (recorder: Recorder, reads: readonly string[]): string[] => {
  const problems: string[] = [];
  if (JSON.stringify(recorder.reads) !== JSON.stringify(reads)) {
    problems.push(`reads ${JSON.stringify(recorder.reads)} != ${JSON.stringify(reads)}`);
  }
  for (const field of [
    "writes",
    "fences",
    "mutations",
    "spawns",
    "credentialReads",
    "networkCalls",
  ] as const) {
    if (recorder[field] !== 0) problems.push(`${field} was ${recorder[field]}`);
  }
  return problems;
};

/** The artifact ref a fixture declares, for disclosure assertions. */
export const artifactRef = (kind: "yaml" | "markdown", workItemRef: string): PlanArtifactRef => ({
  kind,
  path: `chg-${workItemRef}-plan.${kind === "yaml" ? "yaml" : "md"}`,
});

/**
 * The real YAML parse path: the adapters precedent, not a mock. Its bounded
 * node/depth/document guards run before any plan value is inspected.
 */
export const planYamlParser: PlanYamlParser = (text) => {
  const parsed = parseConfigYaml(text, "project", "plan.yaml");
  return parsed.ok
    ? { ok: true, value: parsed.facts.values }
    : { ok: false, reason: "unparseable" };
};

/** Validate one committed YAML fixture through the real parse path. */
export const validateYamlFixture = (
  workItemRef: string,
  relative: string,
): PlanValidateData =>
  validatePlan({
    workItemRef,
    read: {
      ok: true,
      artifact: { kind: "yaml", path: `chg-${workItemRef}-plan.yaml` },
      text: fixture(relative),
    },
    parseYaml: planYamlParser,
  });

/** Validate one committed markdown fixture through format detection. */
export const validateMarkdownFixture = (
  workItemRef: string,
  relative: string,
): PlanValidateData =>
  validatePlan({
    workItemRef,
    read: {
      ok: true,
      artifact: { kind: "markdown", path: `chg-${workItemRef}-plan.md` },
      text: fixture(relative),
    },
    parseYaml: planYamlParser,
  });

/** Validate a fixture and recover the declared document for downstream logic. */
export const planDocumentFor = (workItemRef: string, relative: string): PlanDocument => {
  const verdict = validateYamlFixture(workItemRef, relative);
  const document = planDocumentFromValidateData(verdict);
  if (document === undefined) {
    throw new Error(`${relative} did not validate: ${JSON.stringify(verdict.errors)}`);
  }
  return document;
};

/** The committed actual-diff path list and its recorded base. */
export const diffFixture = (
  relative: string,
): { readonly paths: readonly string[]; readonly against: string } => {
  const paths = JSON.parse(fixture(`${relative}/paths.json`)) as string[];
  const meta = JSON.parse(fixture(`${relative}/meta.json`)) as { readonly against: string };
  return { paths, against: meta.against };
};
