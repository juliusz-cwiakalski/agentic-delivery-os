/**
 * Bounded local PM-context read (GH-175 F-8, D6).
 *
 * The git-ignored `.ai/local/pm-context.yaml` is parsed through the same bounded
 * YAML 1.2 core parse as every other file read. Only `active_change` and
 * `parked_changes` are projected; `notes` and unrelated fields never enter the
 * returned value, and the file is never written.
 */
import type {
  ConfigValue,
  StatusActiveChange,
  StatusLocalContextRead,
  StatusParkedWorkEntry,
} from "@delivery-os/core/contracts";
import type { FileSystemFacts } from "./config-source.js";
import { parseConfigYaml } from "./yaml-parser.js";

type ConfigRecord = { readonly [key: string]: ConfigValue };

const isRecord = (value: unknown): value is ConfigRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (
  record: ConfigRecord,
  key: string,
): { readonly ok: true; readonly value: string | undefined } | { readonly ok: false } => {
  const value = record[key];
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value === "string" && value.length > 0) return { ok: true, value };
  return { ok: false };
};

const projectActiveChange = (
  value: ConfigValue,
):
  | { readonly ok: true; readonly value: StatusActiveChange | undefined }
  | { readonly ok: false } => {
  if (!isRecord(value)) return { ok: false };
  const workItemRef = readString(value, "workItemRef");
  const branch = readString(value, "branch");
  const changeFolder = readString(value, "change_folder");
  if (!workItemRef.ok || !branch.ok || !changeFolder.ok) return { ok: false };
  if (workItemRef.value === undefined) return { ok: false };
  return {
    ok: true,
    value: {
      workItemRef: workItemRef.value,
      ...(branch.value === undefined ? {} : { branch: branch.value }),
      ...(changeFolder.value === undefined ? {} : { changeFolder: changeFolder.value }),
    },
  };
};

const projectParkedEntry = (
  value: ConfigValue,
): { readonly ok: true; readonly value: StatusParkedWorkEntry } | { readonly ok: false } => {
  if (!isRecord(value)) return { ok: false };
  const workItemRef = readString(value, "workItemRef");
  const branch = readString(value, "branch");
  const changeFolder = readString(value, "change_folder");
  const reason = readString(value, "reason");
  const parkedAt = readString(value, "parkedAt");
  if (!workItemRef.ok || !branch.ok || !changeFolder.ok || !reason.ok || !parkedAt.ok) {
    return { ok: false };
  }
  return {
    ok: true,
    value: {
      ...(workItemRef.value === undefined ? {} : { workItemRef: workItemRef.value }),
      ...(branch.value === undefined ? {} : { branch: branch.value }),
      ...(changeFolder.value === undefined ? {} : { changeFolder: changeFolder.value }),
      ...(reason.value === undefined ? {} : { reason: reason.value }),
      ...(parkedAt.value === undefined ? {} : { parkedAt: parkedAt.value }),
    },
  };
};

/** Read and project the local PM context; never expose raw parser text. */
export const readLocalPmContext = (input: {
  readonly path: string;
  readonly fs: FileSystemFacts;
}): StatusLocalContextRead => {
  if (!input.fs.exists(input.path)) {
    return { ok: false, reason: "missing", path: input.path };
  }
  let text: string;
  try {
    text = input.fs.readText(input.path);
  } catch {
    return { ok: false, reason: "malformed", path: input.path };
  }
  const parsed = parseConfigYaml(text, "project-local", input.path);
  if (!parsed.ok) return { ok: false, reason: "malformed", path: input.path };
  const values = parsed.facts.values;

  let activeChange: StatusActiveChange | undefined;
  const rawActive = values.active_change;
  if (rawActive !== undefined) {
    const projected = projectActiveChange(rawActive);
    if (!projected.ok) return { ok: false, reason: "malformed", path: input.path };
    activeChange = projected.value;
  }

  const rawParked = values.parked_changes;
  if (!Array.isArray(rawParked)) return { ok: false, reason: "malformed", path: input.path };
  const parkedChanges: StatusParkedWorkEntry[] = [];
  for (const entry of rawParked) {
    const projected = projectParkedEntry(entry);
    if (!projected.ok) return { ok: false, reason: "malformed", path: input.path };
    parkedChanges.push(projected.value);
  }

  return {
    ok: true,
    context: {
      path: input.path,
      tracked: false,
      ...(activeChange === undefined ? {} : { activeChange }),
      parkedChanges,
    },
  };
};
