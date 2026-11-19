/**
 * The artifact-family materializer (GH-354 §6.1, §6.2).
 *
 * It builds a reference's directory from declared file contents, so a case can
 * plant exact byte sizes, a boundary-spanning value, a torn tail, a single
 * retained file, an unreadable file, or an over-retained third file. The
 * snapshot reader is the posture measurement: path, bytes, mode, and mtimeMs.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  dispatchLogFileName,
  type DispatchLogNameInput,
} from "../../../../packages/core/src/domain/dispatch-log";

export type FamilyFile = { readonly name: string; readonly text: string };

export type FamilySnapshot = {
  readonly name: string;
  readonly bytes: number;
  readonly mode: number;
  readonly mtimeMs: number;
};

/** One declared segment file name, derived from the production naming inputs. */
export const segmentName = (input: DispatchLogNameInput): string => dispatchLogFileName(input);

/** Create the family root and one reference's directory; returns the directory. */
export const materializeFamily = (input: {
  readonly familyRoot: string;
  readonly ref: string;
  readonly files: readonly FamilyFile[];
}): string => {
  const directory = join(input.familyRoot, input.ref);
  mkdirSync(directory, { recursive: true });
  for (const file of input.files) {
    writeFileSync(join(directory, file.name), file.text, { mode: 0o600 });
  }
  return directory;
};

/** Write one file with an unreadable mode (`0o000`). */
export const materializeUnreadable = (input: {
  readonly familyRoot: string;
  readonly ref: string;
  readonly name: string;
  readonly text: string;
}): string => {
  const directory = materializeFamily({ ...input, files: [] });
  const path = join(directory, input.name);
  writeFileSync(path, input.text, { mode: 0o000 });
  return path;
};

/** Every file's bytes/mode/mtime in one reference's directory, name-sorted. */
export const familySnapshot = (familyRoot: string, ref: string): readonly FamilySnapshot[] => {
  const directory = join(familyRoot, ref);
  try {
    return readdirSync(directory)
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((name) => {
        const path = join(directory, name);
        const stat = statSync(path);
        return {
          name,
          bytes: readFileSync(path).byteLength,
          mode: stat.mode & 0o777,
          mtimeMs: stat.mtimeMs,
        };
      });
  } catch {
    return [];
  }
};

/** The plain text of one family file. */
export const familyText = (familyRoot: string, ref: string, name: string): string =>
  readFileSync(join(familyRoot, ref, name), "utf8");

/** `count` LF-terminated lines with one declared prefix. */
export const numberedLines = (input: {
  readonly prefix: string;
  readonly from: number;
  readonly count: number;
  readonly suffix?: string;
}): string =>
  `${Array.from(
    { length: input.count },
    (_, index) => `${input.prefix}${input.from + index}${input.suffix ?? ""}`,
  ).join("\n")}\n`;

/** Remove a whole family root (fixture disposal). */
export const disposeFamily = (familyRoot: string): void => {
  rmSync(familyRoot, { recursive: true, force: true });
};
