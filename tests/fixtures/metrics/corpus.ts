/**
 * The committed-corpus document builders (GH-299 test plan §6, §4.1.9).
 *
 * Every row is committed-path-shaped; the negative cells plant prohibited
 * paths on purpose so the curation rule is exercised rather than described.
 * One document carries the `metrics_corpus` block the bounded scan reads.
 */

export type CiObservationInput = {
  readonly ref: string;
  readonly path?: string;
  readonly observed: boolean;
  readonly outcome?: "green" | "red" | "mixed" | null;
  readonly observedAt?: string | null;
};

export type EvidenceInput = {
  readonly path: string;
  readonly anchor?: string | null;
  readonly class?: string | null;
  readonly observedAt?: string | null;
  readonly ref?: string | null;
};

const yamlString = (value: string): string => `'${value.replace(/'/gu, "''")}'`;

const scalar = (value: string | null | undefined, fallback: string): string =>
  value === undefined ? fallback : value === null ? "null" : yamlString(value);

const ciBlock = (rows: readonly CiObservationInput[]): string[] => {
  if (rows.length === 0) return [];
  const lines = ["  ci_observations:"];
  for (const row of rows) {
    lines.push(`    - ref: ${row.ref}`);
    lines.push(
      `      path: ${yamlString(row.path ?? `doc/changes/${row.ref}/chg-${row.ref}-pm-notes.yaml`)}`,
    );
    lines.push(`      observed: ${String(row.observed)}`);
    lines.push(`      outcome: ${scalar(row.outcome === undefined ? null : row.outcome, "null")}`);
    lines.push(
      `      observed_at: ${scalar(row.observedAt === undefined ? null : row.observedAt, "null")}`,
    );
  }
  return lines;
};

const evidenceBlock = (rows: readonly EvidenceInput[]): string[] => {
  if (rows.length === 0) return [];
  const lines = ["  evidence:"];
  for (const row of rows) {
    lines.push(`    - path: ${yamlString(row.path)}`);
    lines.push(`      anchor: ${scalar(row.anchor === undefined ? null : row.anchor, "null")}`);
    lines.push(`      class: ${scalar(row.class === undefined ? null : row.class, "null")}`);
    lines.push(
      `      observed_at: ${scalar(row.observedAt === undefined ? null : row.observedAt, "null")}`,
    );
    lines.push(`      ref: ${scalar(row.ref === undefined ? null : row.ref, "null")}`);
  }
  return lines;
};

/** Render one committed corpus document with the declared block. */
export const corpusDocument = (input: {
  readonly ci?: readonly CiObservationInput[];
  readonly evidence?: readonly EvidenceInput[];
}): string =>
  `${["metrics_corpus:", ...ciBlock(input.ci ?? []), ...evidenceBlock(input.evidence ?? [])].join("\n")}\n`;

/** A committed path inside the fixture checkout. */
export const committedPath = (name: string): string => `doc/changes/2026-11/${name}`;
