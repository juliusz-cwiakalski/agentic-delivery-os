/**
 * The bounded committed-corpus scan (GH-299 F-3, F-7; NFR-7, §20).
 *
 * One pass over committed change documents under the project's change
 * directory. Only documents that declare the `metrics_corpus` block contribute
 * rows, only committed paths are read (`tmp/**` and `.ai/local/**` never), and
 * the scan is bounded in files and bytes. The rows are data: no document
 * content can direct the scan or count itself.
 */
import type {
  EscapedDefectClass,
  MetricsCiObservationRow,
  MetricsCorpusRead,
  MetricsCorpusRow,
  MetricsEvidenceRow,
} from "@delivery-os/core/contracts";
import { ESCAPED_DEFECT_CLASSES } from "@delivery-os/core/contracts";
import type { FileSystemFacts } from "./config-source.js";
import { parseConfigYaml } from "./yaml-parser.js";

/** The declared block key a committed document opts in with. */
export const METRICS_CORPUS_BLOCK = "metrics_corpus" as const;

/** The bounded scan limits: files visited and directory depth. */
export const METRICS_CORPUS_MAX_FILES = 512 as const;
export const METRICS_CORPUS_MAX_DEPTH = 6 as const;

/** The filesystem facts the scan consumes: read-only existence, read, and list. */
export type MetricsCorpusFileSystemFacts = FileSystemFacts & {
  /** Directory entry names; an entry without a dot is a directory by convention. */
  readonly list?: (path: string) => readonly string[];
};

export type MetricsCorpusReadInput = {
  readonly projectRoot: string;
  readonly changesDirectory: string;
  readonly fs: MetricsCorpusFileSystemFacts;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isClass = (value: unknown): value is EscapedDefectClass =>
  typeof value === "string" && (ESCAPED_DEFECT_CLASSES as readonly string[]).includes(value);

const isCommittedRelative = (path: string): boolean =>
  path.length > 0 &&
  !path.startsWith("/") &&
  !path.startsWith("../") &&
  !path.split("/").includes("..") &&
  !/^tmp\//u.test(path) &&
  !path.startsWith(".ai/local/");

const ciRowOf = (value: unknown): MetricsCiObservationRow | undefined => {
  if (!isRecord(value)) return undefined;
  if (typeof value.ref !== "string" || !isCommittedRelative(String(value.path ?? ""))) {
    return undefined;
  }
  const observed = value.observed;
  if (typeof observed !== "boolean") return undefined;
  const outcome =
    value.outcome === "green" || value.outcome === "red" || value.outcome === "mixed"
      ? value.outcome
      : null;
  return {
    kind: "ci-observation",
    path: String(value.path),
    ref: value.ref,
    observed,
    outcome,
    observedAt: typeof value.observed_at === "string" ? value.observed_at : null,
  };
};

const evidenceRowOf = (value: unknown): MetricsEvidenceRow | undefined => {
  if (!isRecord(value)) return undefined;
  if (typeof value.path !== "string") return undefined;
  return {
    kind: "evidence",
    path: value.path,
    anchor: typeof value.anchor === "string" ? value.anchor : null,
    class: isClass(value.class) ? value.class : null,
    observedAt: typeof value.observed_at === "string" ? value.observed_at : null,
    ref: typeof value.ref === "string" ? value.ref : null,
  };
};

/** Interpret one parsed committed document; absent block yields no rows. */
export const corpusRowsOfDocument = (document: unknown): readonly MetricsCorpusRow[] => {
  if (!isRecord(document)) return [];
  const block = document[METRICS_CORPUS_BLOCK];
  if (!isRecord(block)) return [];
  const rows: MetricsCorpusRow[] = [];
  const ci = block.ci_observations;
  if (Array.isArray(ci)) {
    for (const row of ci) {
      const parsed = ciRowOf(row);
      if (parsed !== undefined) rows.push(parsed);
    }
  }
  const evidence = block.evidence;
  if (Array.isArray(evidence)) {
    for (const row of evidence) {
      const parsed = evidenceRowOf(row);
      if (parsed !== undefined) rows.push(parsed);
    }
  }
  return rows;
};

/**
 * A curated citation must resolve: the cited artifact is a readable committed
 * document and the anchor appears in it. An unresolvable citation is never
 * counted (F-7, DEC-2); the scan drops it rather than counting an unevidenced
 * claim.
 */
const citesResolvableArtifact = (
  input: MetricsCorpusReadInput,
  artifact: string,
  anchor: string | null,
): boolean => {
  if (anchor === null || anchor.trim().length === 0) return false;
  if (!isCommittedRelative(artifact)) return false;
  const path = `${input.projectRoot.replace(/\/+$/u, "")}/${artifact}`;
  let text: string;
  try {
    if (!input.fs.exists(path)) return false;
    text = input.fs.readText(path);
  } catch {
    return false;
  }
  return text.includes(anchor);
};

/**
 * Walk the committed change directory and collect the declared corpus rows.
 *
 * A directory that cannot be listed contributes no rows (absence is never a
 * failure for the corpus); the scan never leaves the change directory and never
 * reads a prohibited path.
 */
export const scanMetricsCorpus = (input: MetricsCorpusReadInput): MetricsCorpusRead => {
  const listDirectory = input.fs.list ?? (() => []);
  const root = `${input.projectRoot.replace(/\/+$/u, "")}/${input.changesDirectory.replace(
    /^\.?\/+/u,
    "",
  )}`;
  const rows: MetricsCorpusRow[] = [];
  let visited = 0;
  const walk = (directory: string, depth: number): void => {
    if (depth > METRICS_CORPUS_MAX_DEPTH || visited >= METRICS_CORPUS_MAX_FILES) return;
    let entries: readonly string[];
    try {
      entries = listDirectory(directory);
    } catch {
      return;
    }
    for (const entry of [...entries].sort((left, right) => (left < right ? -1 : 1))) {
      if (visited >= METRICS_CORPUS_MAX_FILES) return;
      const path = `${directory}/${entry}`;
      if (!isCommittedRelative(path.slice(root.length + 1))) continue;
      if (!entry.includes(".")) {
        walk(path, depth + 1);
        continue;
      }
      if (!entry.endsWith(".yaml") && !entry.endsWith(".yml")) continue;
      visited += 1;
      let text: string;
      try {
        text = input.fs.readText(path);
      } catch {
        continue;
      }
      const parsed = parseConfigYaml(text, "project-committed", path);
      if (!parsed.ok) continue;
      for (const row of corpusRowsOfDocument(parsed.facts.values)) {
        if (row.kind === "evidence") {
          rows.push({
            ...row,
            citation: citesResolvableArtifact(input, row.path, row.anchor)
              ? "resolved"
              : "unresolved",
          });
          continue;
        }
        rows.push(row);
      }
    }
  };
  walk(root, 0);
  return { rows };
};
