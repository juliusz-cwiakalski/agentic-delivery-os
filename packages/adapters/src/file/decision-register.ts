/**
 * The decision-record register and mirror adapter (GH-296 F-3, NFR-12).
 *
 * Reads the invoking repository's committed decision-record set
 * (`doc/decisions/`), resolves the declared affected-repository target set and
 * local checkout roots from the invoking checkout's own operator-local,
 * git-ignored `projects.yaml` members, and
 * lands the declared write set by copying the named record files into the
 * target checkout's decisions directory. Idempotent, declared targets only,
 * no force path; the landing is a byte copy, never a command or a commit in
 * the ceremony path. Filesystem facts are injected.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";

/** The decision-record id grammar a mirror set compares (record files only). */
export const DECISION_RECORD_ID_PATTERN = /^(ADR|PDR|TDR|BDR|ODR)-\d{4}/;

/** The injected filesystem facts; production wraps `node:fs`. */
export type DecisionRecordFileSystem = {
  readonly pathExists: (path: string) => boolean;
  readonly isDirectory: (path: string) => boolean;
  readonly listDirectory: (path: string) => readonly string[];
  readonly readText: (path: string) => string;
  readonly writeText: (path: string, text: string) => void;
  readonly ensureDirectory: (path: string) => void;
};

/** The production filesystem facts over `node:fs`. */
export const nodeDecisionRecordFileSystem = (): DecisionRecordFileSystem => ({
  pathExists: (path) => {
    try {
      return existsSync(path);
    } catch {
      return false;
    }
  },
  isDirectory: (path) => {
    try {
      return statSync(path).isDirectory();
    } catch {
      return false;
    }
  },
  listDirectory: (path) => {
    try {
      return readdirSync(path);
    } catch {
      return [];
    }
  },
  readText: (path) => readFileSync(path, "utf8"),
  writeText: (path, text) => writeFileSync(path, text, "utf8"),
  ensureDirectory: (path) => {
    mkdirSync(path, { recursive: true });
  },
});

/** The decision-record id a file name carries, when it names a record at all. */
export const decisionRecordIdOf = (fileName: string): string | undefined => {
  const match = DECISION_RECORD_ID_PATTERN.exec(fileName);
  return match?.[0];
};

/** The sorted decision-record ids one decisions directory holds. */
export const decisionRecordIds = (
  directory: string,
  fs: DecisionRecordFileSystem,
): readonly string[] => {
  if (!fs.pathExists(directory) || !fs.isDirectory(directory)) return [];
  const ids = new Set<string>();
  for (const entry of fs.listDirectory(directory)) {
    const id = decisionRecordIdOf(entry);
    if (id !== undefined) ids.add(id);
  }
  return [...ids].sort();
};

/** One register read: the invoking repository's committed record set. */
export type DecisionRegisterRead = {
  readonly state: "present" | "absent";
  readonly directory: string;
  readonly ids: readonly string[];
};

/** Read the invoking repository's committed decision-register set. */
export const readDecisionRegister = (input: {
  readonly gitRoot: string;
  readonly fs: DecisionRecordFileSystem;
}): DecisionRegisterRead => {
  const directory = `${input.gitRoot.replace(/[\\/]+$/, "")}/doc/decisions`;
  return {
    state: input.fs.pathExists(directory) && input.fs.isDirectory(directory) ? "present" : "absent",
    directory,
    ids: decisionRecordIds(directory, input.fs),
  };
};

/**
 * One declared affected repository: its identity (`repoKey`) and, when the
 * configuration declares one, the local checkout root the mirror reads and
 * lands into.
 */
export type AffectedRepositoryTarget = {
  readonly target: string;
  readonly root?: string;
};

/**
 * Narrow the invoking checkout's own operator-local `projects.yaml` value
 * leniently into the
 * affected-repository target set: every declared member's `repoKey` except the
 * invoking repository itself, with the member's `root` as the local checkout
 * when declared. No group and no member yields the empty target set.
 */
export const affectedRepositoryTargets = (
  document: unknown,
  invokingRepositoryId: string,
): readonly AffectedRepositoryTarget[] => {
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
  if (!isRecord(document) || !Array.isArray(document.groups)) return [];
  const seen = new Map<string, AffectedRepositoryTarget>();
  for (const group of document.groups) {
    if (!isRecord(group) || !Array.isArray(group.members)) continue;
    for (const member of group.members) {
      if (!isRecord(member)) continue;
      if (typeof member.repoKey !== "string" || member.repoKey.length === 0) continue;
      if (member.repoKey === invokingRepositoryId) continue;
      if (seen.has(member.repoKey)) continue;
      seen.set(member.repoKey, {
        target: member.repoKey,
        ...(typeof member.root === "string" && member.root.length > 0 ? { root: member.root } : {}),
      });
    }
  }
  return [...seen.values()].sort((left, right) => left.target.localeCompare(right.target));
};

/** One landing outcome for the declared write set. */
export type DecisionMirrorApplyResult =
  | { readonly ok: true; readonly landed: readonly string[] }
  | { readonly ok: false; readonly detail: string };

/**
 * Land the declared write set: copy each named record file from the source
 * decisions directory into the target checkout's decisions directory.
 * Idempotent (an identical record is rewritten byte-for-byte), no force path,
 * and the record set is exactly the declared write set.
 */
export const copyDecisionRecords = (input: {
  readonly targetRoot: string;
  readonly ids: readonly string[];
  readonly sourceDirectory: string;
  readonly fs: DecisionRecordFileSystem;
}): DecisionMirrorApplyResult => {
  if (!input.fs.pathExists(input.targetRoot) || !input.fs.isDirectory(input.targetRoot)) {
    return { ok: false, detail: `target checkout "${input.targetRoot}" is absent` };
  }
  const targetDirectory = `${input.targetRoot.replace(/[\\/]+$/, "")}/doc/decisions`;
  const sourceFiles = new Map<string, string>();
  if (input.fs.pathExists(input.sourceDirectory) && input.fs.isDirectory(input.sourceDirectory)) {
    for (const entry of input.fs.listDirectory(input.sourceDirectory)) {
      const id = decisionRecordIdOf(entry);
      if (id !== undefined) sourceFiles.set(id, entry);
    }
  }
  const landed: string[] = [];
  for (const id of input.ids) {
    const file = sourceFiles.get(id);
    if (file === undefined) {
      return { ok: false, detail: `register has no record file for "${id}"` };
    }
    let text: string;
    try {
      text = input.fs.readText(`${input.sourceDirectory}/${file}`);
    } catch {
      return { ok: false, detail: `register record "${file}" is unreadable` };
    }
    try {
      input.fs.ensureDirectory(targetDirectory);
      input.fs.writeText(`${targetDirectory}/${file}`, text);
    } catch {
      return { ok: false, detail: `target record "${file}" is not writable` };
    }
    landed.push(id);
  }
  return { ok: true, landed };
};
