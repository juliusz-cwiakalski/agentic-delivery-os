/**
 * GH-365 F-3 — the backup manifest document and its two validators (pure).
 *
 * The manifest (`install.migration.manifest.v1`) is structurally distinct from
 * the CLI plan payload (`install.migration.plan.v1`): a validator keyed on one
 * id accepts only its own shape. It covers every moved non-derived file with
 * size and SHA-256, and carries no derived entry.
 */
import {
  INSTALL_MIGRATION_MANIFEST_SCHEMA,
  INSTALL_MIGRATION_PLAN_SCHEMA,
  type InstallArtifactIdentity,
  MIGRATION_DISPOSITIONS,
  MIGRATION_ROOT_LABELS,
  MIGRATION_ROOT_SCOPES,
  MIGRATION_VERDICTS,
  type MigrationDisposition,
  type MigrationManifestEntry,
  type MigrationManifestPayload,
  type MigrationPlanPayload,
  type MigrationVerdict,
} from "#contracts";
import type { MigrationPlan, PlannedEntry, PlannedRoot } from "./install-migration-plan.js";

export type MovedEntry = {
  readonly root: PlannedRoot;
  readonly entry: PlannedEntry;
};

/** The moved non-derived entries, in root then entry order. */
export const movedEntries = (plan: MigrationPlan): readonly MovedEntry[] =>
  plan.roots
    .filter((root) => root.scope === "scoped")
    .flatMap((root) =>
      root.entries
        .filter((entry) => entry.disposition === "moved" && entry.derived !== true)
        .map((entry) => ({ root, entry })),
    );

/** Build the manifest the backup writer commits before the first move. */
export const buildMigrationManifest = (input: {
  readonly plan: MigrationPlan;
  readonly runId: string;
  readonly createdAt: string;
  readonly artifactIdentity?: InstallArtifactIdentity;
}): MigrationManifestPayload => {
  const entries: MigrationManifestEntry[] = movedEntries(input.plan).map(({ root, entry }) => ({
    rootLabel: root.label,
    relativePath: entry.relativePath,
    files: entry.facts?.fileCount ?? 0,
    bytes: entry.facts?.byteCount ?? 0,
    fileEntries: entry.facts?.files ?? [],
  }));
  return {
    schemaId: INSTALL_MIGRATION_MANIFEST_SCHEMA,
    runId: input.runId,
    createdAt: input.createdAt,
    ...(input.artifactIdentity === undefined ? {} : { artifactIdentity: input.artifactIdentity }),
    roots: input.plan.roots
      .filter(
        (root) =>
          root.scope === "scoped" && root.source !== undefined && root.destination !== undefined,
      )
      .map((root) => ({
        label: root.label,
        source: root.source as string,
        destination: root.destination as string,
      })),
    entries,
    verdict: input.plan.verdict,
  };
};

/** Serialize the manifest with the key order the document declares. */
export const serializeMigrationManifest = (manifest: MigrationManifestPayload): string =>
  `${JSON.stringify(manifest, null, 2)}\n`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === "string";
const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const isRootLabel = (value: unknown): boolean =>
  typeof value === "string" && (MIGRATION_ROOT_LABELS as readonly string[]).includes(value);
const isDisposition = (value: unknown): value is MigrationDisposition =>
  typeof value === "string" && (MIGRATION_DISPOSITIONS as readonly string[]).includes(value);
const isVerdict = (value: unknown): value is MigrationVerdict =>
  typeof value === "string" && (MIGRATION_VERDICTS as readonly string[]).includes(value);

/** Validate the CLI plan payload shape; a manifest never satisfies it. */
export const validateMigrationPlanPayload = (value: unknown): string[] => {
  if (!isRecord(value)) return ["the plan payload must be an object"];
  if (value.schemaId !== INSTALL_MIGRATION_PLAN_SCHEMA) {
    return [`schemaId must be ${INSTALL_MIGRATION_PLAN_SCHEMA}`];
  }
  const failures: string[] = [];
  if (!isText(value.runId)) failures.push("runId must be a string");
  if (!isVerdict(value.verdict)) failures.push("verdict must be a closed migration verdict");
  if (!["unchecked", "stopped", "running"].includes(String(value.daemon))) {
    failures.push("daemon must be unchecked, stopped or running");
  }
  if (!Array.isArray(value.roots)) {
    failures.push("roots must be an array");
  } else {
    for (const root of value.roots) {
      if (!isRecord(root) || !isRootLabel(root.label)) {
        failures.push("every root must carry a declared label");
        continue;
      }
      if (!(MIGRATION_ROOT_SCOPES as readonly string[]).includes(String(root.scope))) {
        failures.push(`root ${String(root.label)} carries an unknown scope`);
      }
      if (root.scope === "unscoped") {
        if (
          root.source !== undefined ||
          root.destination !== undefined ||
          root.verdict !== undefined
        ) {
          failures.push("an unscoped root carries no source, destination or verdict");
        }
        if (!Array.isArray(root.entries) || root.entries.length > 0) {
          failures.push("an unscoped root carries no entries");
        }
      }
      if (Array.isArray(root.entries)) {
        for (const entry of root.entries) {
          if (!isRecord(entry) || !isDisposition(entry.disposition)) {
            failures.push("every entry disposition must be one of the closed six");
          }
        }
      }
    }
  }
  for (const key of ["conflicts", "residuals", "retiredRoots"] as const) {
    if (!Array.isArray(value[key])) failures.push(`${key} must be an array`);
  }
  return failures;
};

/** Validate the backup manifest shape; a plan payload never satisfies it. */
export const validateMigrationManifestPayload = (value: unknown): string[] => {
  if (!isRecord(value)) return ["the manifest must be an object"];
  if (value.schemaId !== INSTALL_MIGRATION_MANIFEST_SCHEMA) {
    return [`schemaId must be ${INSTALL_MIGRATION_MANIFEST_SCHEMA}`];
  }
  const failures: string[] = [];
  if (!isText(value.runId)) failures.push("runId must be a string");
  if (!isText(value.createdAt)) failures.push("createdAt must be a string");
  if (!isVerdict(value.verdict)) failures.push("verdict must be a closed migration verdict");
  if (!Array.isArray(value.roots)) {
    failures.push("roots must be an array");
  } else {
    for (const root of value.roots) {
      if (
        !isRecord(root) ||
        !isRootLabel(root.label) ||
        !isText(root.source) ||
        !isText(root.destination)
      ) {
        failures.push("every manifest root carries a label, source and destination");
      }
    }
  }
  if (!Array.isArray(value.entries)) {
    failures.push("entries must be an array");
  } else {
    for (const entry of value.entries) {
      if (
        !isRecord(entry) ||
        !isRootLabel(entry.rootLabel) ||
        !isText(entry.relativePath) ||
        !isCount(entry.files) ||
        !isCount(entry.bytes) ||
        !Array.isArray(entry.fileEntries)
      ) {
        failures.push("every manifest entry must carry its root, path, counts and files");
        continue;
      }
      for (const file of entry.fileEntries as unknown[]) {
        if (
          !isRecord(file) ||
          !isText(file.relativePath) ||
          !isCount(file.size) ||
          !/^[0-9a-f]{64}$/u.test(String(file.sha256))
        ) {
          failures.push("every manifest file entry carries path, size and sha256");
        }
      }
    }
  }
  return failures;
};

/** Project a validated plan payload onto the human renderer's data contract. */
export type HumanMigrationPlan = MigrationPlanPayload;
