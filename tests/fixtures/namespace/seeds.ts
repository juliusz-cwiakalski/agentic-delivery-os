/**
 * GH-365 P3 fixtures: the prior-namespace seed corpus and the per-class sower
 * over a temp-copy repository.
 *
 * The sower writes one line into a file owned by the named scope class and
 * anchors the live-shaped registry at the temp repository's own baseline. The
 * shim registry written beside it is intentionally minimal: each test declares
 * only the sites it needs, so an undeclared occurrence is unambiguous.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createTempRepo,
  liveRegistry,
  SHIM_LITERALS,
  SHIM_REGISTRY_PATH,
  type TempRepo,
  writeFiles,
  writeRegistry,
} from "../../checks/fixture-repo";

export { SHIM_LITERALS, SHIM_REGISTRY_PATH };

export type ShimId = keyof typeof SHIM_LITERALS;
export const SHIM_IDS = Object.keys(SHIM_LITERALS) as readonly ShimId[];

export type SownClass =
  | "packageTree"
  | "rootManifests"
  | "rootWorkspaceFiles"
  | "ignoreRules"
  | "promptSurface"
  | "scriptSurface"
  | "userFacingDocs";

export const CLASS_TARGETS: Readonly<Record<SownClass, string>> = {
  packageTree: "packages/core/src/domain/namespace-seed.ts",
  rootManifests: "package.json",
  rootWorkspaceFiles: "tsconfig.base.json",
  ignoreRules: ".gitignore",
  promptSurface: ".opencode/agent/namespace-seed.md",
  scriptSurface: "scripts/namespace-seed.sh",
  userFacingDocs: "doc/guides/namespace-seed.md",
};

/** The two registry documents self-declare every shim (budgeted). */
const REGISTRY_SELF_SITES = [
  { file: "scripts/checks/forbidden-literals.registry.json", maxOccurrences: 12 },
  { file: SHIM_REGISTRY_PATH, maxOccurrences: 12 },
];

export type SiteSpec = {
  readonly file: string;
  readonly maxOccurrences?: number;
};

export const writeShimRegistry = (
  repo: TempRepo,
  extraSites: Partial<Record<ShimId, readonly SiteSpec[]>> = {},
): void => {
  const shims = SHIM_IDS.map((id) => ({
    id,
    literal: SHIM_LITERALS[id],
    lineage: id.startsWith("pre-freeze") ? "pre-freeze" : "delivery-os",
    sites: [...REGISTRY_SELF_SITES, ...(extraSites[id] ?? [])],
  }));
  writeFiles(repo.root, {
    [SHIM_REGISTRY_PATH]: `${JSON.stringify(
      {
        schemaId: "namespace.shims.v1",
        window: { declaredIn: "0.1.0", removalRelease: "0.2.0" },
        shims,
      },
      null,
      2,
    )}\n`,
  });
};

export const writeScanRegistry = (repo: TempRepo, registered: readonly string[] = []): void => {
  writeRegistry(repo.root, {
    ...liveRegistry(),
    corpusBaseline: repo.baseline,
    registered: [...registered],
  });
};

/** A temp repo with a baseline-anchored registry and a minimal shim registry. */
export const prepareRepo = (
  options: {
    readonly registered?: readonly string[];
    readonly sites?: Partial<Record<ShimId, readonly SiteSpec[]>>;
  } = {},
): TempRepo => {
  const repo = createTempRepo();
  writeShimRegistry(repo, options.sites ?? {});
  writeScanRegistry(repo, options.registered ?? []);
  return repo;
};

const read = (repo: TempRepo, file: string): string => readFileSync(join(repo.root, file), "utf8");

/** Append one prior-namespace line to the class's target file and return it. */
export const sow = (repo: TempRepo, classId: SownClass, line: string): string => {
  const target = CLASS_TARGETS[classId];
  let existing = "";
  try {
    existing = read(repo, target);
  } catch {
    existing = "";
  }
  const separator = existing.length === 0 || existing.endsWith("\n") ? "" : "\n";
  writeFiles(repo.root, { [target]: `${existing}${separator}${line}\n` });
  return target;
};

/** Write the user-facing seed doc and register it at the temp baseline. */
export const sowDoc = (repo: TempRepo, line: string): string => {
  const target = sow(repo, "userFacingDocs", line);
  writeScanRegistry(repo, [target]);
  return target;
};

/** Rewrite one file in the temp repo. */
export const writeAt = (repo: TempRepo, file: string, content: string): void => {
  writeFiles(repo.root, { [file]: content });
};

export type LiveShim = {
  readonly id: string;
  readonly literal: string;
  readonly sites: readonly SiteSpec[];
};

/** The live shim registry's shim list (the P2 authority). */
export const liveShims = (root: string): readonly LiveShim[] =>
  (
    JSON.parse(readFileSync(join(root, SHIM_REGISTRY_PATH), "utf8")) as {
      shims: readonly LiveShim[];
    }
  ).shims;
