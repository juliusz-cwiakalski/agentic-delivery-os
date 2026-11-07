/**
 * Pure queue declaration and graph-folding policy (GH-237 F-1, DM-1, DM-2,
 * DM-12, DM-13; EVT-1, EVT-2).
 *
 * No I/O, clock, randomness, or ambient environment: entries and dependency
 * records arrive as already-verified facts from the state tier. Canonical-ref
 * identity, repository-key normalization, acyclicity, duplicate-edge handling,
 * superseding projection, and the deterministic graph fold live here.
 *
 * The recorded repository root stays on the entry record and is deliberately
 * absent from the graph projection: it is internal state used only for
 * deploy-expectation discovery (DM-12, DM-13).
 */

import {
  QUEUE_DEFAULT_PRIORITY,
  QUEUE_GRAPH_SCHEMA,
  QUEUE_MAX_EDGES_PER_ENTRY,
  QUEUE_MAX_REF_CHARS,
  QUEUE_RANK_CLASSES,
  QUEUE_WEIGHT_CLASSES,
  type QueueDependencyRecord,
  type QueueEntryRecord,
  type QueueGraphDocument,
  type QueueGraphEntry,
} from "#contracts";

const REF_PARTS = /^([A-Za-z][A-Za-z0-9]*)-([0-9]+)$/;

/** One directed consumer-to-producer edge in the folded graph. */
export type QueueGraphEdge = {
  readonly consumer: string;
  readonly producer: string;
};

/** The complete in-memory fold: entries, every edge, and the raw intent rows. */
export type QueueGraphFold = {
  readonly entries: readonly QueueGraphEntry[];
  readonly edges: readonly QueueGraphEdge[];
  readonly entryRecords: readonly QueueEntryRecord[];
  readonly dependencyRecords: readonly QueueDependencyRecord[];
};

/** The shared code-point comparator; never locale-sensitive. */
export const compareText = (left: string, right: string): number => {
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

/**
 * Canonical queue-ref identity: uppercase the ASCII prefix and normalize the
 * numeric suffix so `GH-010` and `GH-10` are one identity. Returns `undefined`
 * for a value outside the declared grammar or length bound.
 */
export const canonicalQueueRef = (value: string): string | undefined => {
  const match = REF_PARTS.exec(value.trim());
  if (match === null) return undefined;
  const prefix = (match[1] ?? "").toUpperCase();
  const digits = BigInt(match[2] ?? "0").toString();
  const canonical = `${prefix}-${digits}`;
  return canonical.length <= QUEUE_MAX_REF_CHARS ? canonical : undefined;
};

/**
 * Normalize a repository remote to the contention-domain key `host/owner/name`:
 * protocol, credentials, userinfo, and a `.git` suffix are removed; the result
 * is lowercased. Returns `undefined` when no host/owner/name can be derived.
 */
export const normalizeRepositoryKey = (remote: string): string | undefined => {
  let value = remote.trim();
  if (value.length === 0) return undefined;
  value = value.replace(/^[A-Za-z][A-Za-z0-9+.-]*:\/\//, "");
  value = value.replace(/^[^@/]+@/, "");
  value = value.replace(/^([^/:]+):(.+)$/, "$1/$2");
  value = value.replace(/\/+$/, "");
  value = value.replace(/\.git$/i, "");
  const segments = value.split("/").filter((segment) => segment.length > 0);
  if (segments.length < 3) return undefined;
  const host = segments[0];
  const name = segments[segments.length - 1];
  const owner = segments.slice(1, -1).join("/");
  if (host === undefined || owner.length === 0 || name === undefined) return undefined;
  return `${host}/${owner}/${name}`.toLowerCase();
};

/** Fold entry records to the latest record per canonical ref, sorted by ref. */
export const foldLatestEntries = (
  records: readonly QueueEntryRecord[],
): readonly QueueEntryRecord[] => {
  const latest = new Map<string, QueueEntryRecord>();
  for (const record of records) {
    const ref = canonicalQueueRef(record.ref);
    if (ref === undefined) continue;
    latest.set(ref, record);
  }
  return [...latest.values()].sort((left, right) => compareText(left.ref, right.ref));
};

/** Fold dependency records to the latest record per canonical ref. */
export const foldLatestDependencyRecords = (
  records: readonly QueueDependencyRecord[],
): ReadonlyMap<string, QueueDependencyRecord> => {
  const latest = new Map<string, QueueDependencyRecord>();
  for (const record of records) {
    const ref = canonicalQueueRef(record.ref);
    if (ref === undefined) continue;
    latest.set(ref, record);
  }
  return latest;
};

/** Fold dependency records to the latest edge set per canonical ref. */
export const foldLatestDependencies = (
  records: readonly QueueDependencyRecord[],
): ReadonlyMap<string, readonly string[]> => {
  const latest = new Map<string, readonly string[]>();
  for (const [ref, record] of foldLatestDependencyRecords(records)) {
    latest.set(ref, normalizeEdges(record.edges));
  }
  return latest;
};

/** Canonicalize, deduplicate, bound, and deterministically sort an edge set. */
export const normalizeEdges = (edges: readonly string[]): readonly string[] => {
  const canonical = new Set<string>();
  for (const edge of edges) {
    const ref = canonicalQueueRef(edge);
    if (ref !== undefined) canonical.add(ref);
  }
  return [...canonical].sort(compareText).slice(0, QUEUE_MAX_EDGES_PER_ENTRY);
};

/** Merge existing and newly declared edges, preserving the declared cap. */
export const mergeEdges = (
  existing: readonly string[],
  added: readonly string[],
): readonly string[] => normalizeEdges([...existing, ...added]);

/** Build the consumer -> producer adjacency map from the folded edge pairs. */
export const buildAdjacency = (
  edges: readonly QueueGraphEdge[],
): ReadonlyMap<string, readonly string[]> => {
  const map = new Map<string, Set<string>>();
  for (const edge of edges) {
    const current = map.get(edge.consumer) ?? new Set<string>();
    current.add(edge.producer);
    map.set(edge.consumer, current);
  }
  const frozen = new Map<string, readonly string[]>();
  for (const [consumer, producers] of map) {
    frozen.set(consumer, [...producers].sort(compareText));
  }
  return frozen;
};

const findPath = (
  adjacency: ReadonlyMap<string, readonly string[]>,
  start: string,
  goal: string,
): readonly string[] | undefined => {
  if (start === goal) return [start];
  const stack: Array<{ readonly ref: string; readonly path: readonly string[] }> = [
    { ref: start, path: [start] },
  ];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    if (visited.has(current.ref)) continue;
    visited.add(current.ref);
    for (const producer of adjacency.get(current.ref) ?? []) {
      const path = [...current.path, producer];
      if (producer === goal) return path;
      if (!visited.has(producer)) stack.push({ ref: producer, path });
    }
  }
  return undefined;
};

/**
 * Detect the cycle a new consumer-to-producer edge would close. The returned
 * token path starts and ends at `consumer`, e.g. `GH-301 -> GH-302 -> GH-301`.
 */
export const detectCycleForEdge = (
  currentEdges: readonly QueueGraphEdge[],
  consumer: string,
  producer: string,
): readonly string[] | undefined => {
  if (consumer === producer) return [consumer, consumer];
  const path = findPath(buildAdjacency(currentEdges), producer, consumer);
  return path === undefined ? undefined : [consumer, ...path];
};

const edgesOf = (
  entries: ReadonlyMap<string, QueueEntryRecord>,
  dependencies: ReadonlyMap<string, readonly string[]>,
): readonly QueueGraphEdge[] => {
  const edges: QueueGraphEdge[] = [];
  for (const ref of entries.keys()) {
    for (const producer of dependencies.get(ref) ?? []) {
      edges.push({ consumer: ref, producer });
    }
  }
  // Dependency records may name a producer with no entry; retain those edges so
  // readiness can evaluate them as `dependency-unobserved`.
  for (const [ref, producers] of dependencies) {
    if (entries.has(ref)) continue;
    for (const producer of producers) edges.push({ consumer: ref, producer });
  }
  return edges;
};

/**
 * The deterministic fold of verified entry and dependency records. Edges are
 * canonical, deduplicated, sorted, and bounded; entries are sorted by ref. The
 * effective weight and rank classes are the declaration defaults here and are
 * re-resolved per pass from artifacts.
 */
export const foldQueueGraph = (
  entryRecords: readonly QueueEntryRecord[],
  dependencyRecords: readonly QueueDependencyRecord[],
): QueueGraphFold => {
  const latestEntries = foldLatestEntries(entryRecords);
  const latestDependencyRecords = foldLatestDependencyRecords(dependencyRecords);
  const latestDependencies = new Map<string, readonly string[]>();
  for (const [ref, record] of latestDependencyRecords) {
    latestDependencies.set(ref, normalizeEdges(record.edges));
  }
  const byRef = new Map(latestEntries.map((entry) => [entry.ref, entry]));
  const edges = edgesOf(byRef, latestDependencies);
  const entries: QueueGraphEntry[] = latestEntries.map((entry) => ({
    ref: entry.ref,
    ...(entry.repository === undefined ? {} : { repository: entry.repository }),
    priority: entry.priority,
    edges: latestDependencies.get(entry.ref) ?? [],
    weightClass: QUEUE_WEIGHT_CLASSES[0],
    rankClass: QUEUE_RANK_CLASSES[3],
    recordedAt: entry.recordedAt,
  }));
  return {
    entries,
    edges,
    entryRecords: latestEntries,
    dependencyRecords: [...latestDependencyRecords.values()].sort((left, right) =>
      compareText(left.ref, right.ref),
    ),
  };
};

/** Project the fold into the rebuildable derived document (no root). */
export const queueGraphDocument = (fold: QueueGraphFold): QueueGraphDocument => ({
  schema: QUEUE_GRAPH_SCHEMA,
  entries: fold.entries,
});

/**
 * Deterministic projection of one entry: the normalized repository key and
 * edges only. The recorded root is never part of this projection.
 */
export const projectEntry = (
  record: QueueEntryRecord,
  edges: readonly string[],
): QueueGraphEntry => ({
  ref: record.ref,
  ...(record.repository === undefined ? {} : { repository: record.repository }),
  priority: record.priority,
  edges,
  weightClass: QUEUE_WEIGHT_CLASSES[0],
  rankClass: QUEUE_RANK_CLASSES[3],
  recordedAt: record.recordedAt,
});

/** The declared default priority for an entry that omits one. */
export const defaultQueuePriority = (value: number | undefined): number =>
  value ?? QUEUE_DEFAULT_PRIORITY;
