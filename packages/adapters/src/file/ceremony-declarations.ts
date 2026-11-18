/**
 * The project ceremony declaration document reader (GH-296 F-6; DEC-6, DEC-15).
 *
 * One bounded read of `<gitRoot>/<configDirectoryName>/ceremonies.yaml` in the
 * project-committed configuration slot. Absence is the built-ins-only path;
 * readable bytes that fail the parse are malformed; an unreadable path is the
 * unreadable boundary. The adapter performs no product-tier validation and
 * imports no core root beyond contracts: the pure registry validator classifies
 * the value.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { CEREMONY_DECLARATION_LIMITS } from "@delivery-os/core/contracts";
import { parse } from "yaml";

/** The committed ceremony declaration document file name (F-6). */
export const CEREMONY_DECLARATIONS_FILE_NAME = "ceremonies.yaml" as const;

/** The injected filesystem facts; tests supply deterministic maps. */
export type CeremonyDeclarationFileSystem = {
  readonly pathExists: (path: string) => boolean;
  readonly isDirectory: (path: string) => boolean;
  readonly readText: (path: string) => string;
};

/** The production filesystem facts over `node:fs`. */
export const nodeCeremonyDeclarationFileSystem = (): CeremonyDeclarationFileSystem => ({
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
  readText: (path) => readFileSync(path, "utf8"),
});

const trimTrailingSeparators = (path: string): string => path.replace(/[\\/]+$/, "");

/** The declared document path in the project-committed configuration slot. */
export const ceremonyDeclarationDocumentPath = (
  gitRoot: string,
  configurationDirectoryName: string,
): string =>
  join(
    trimTrailingSeparators(gitRoot),
    configurationDirectoryName,
    CEREMONY_DECLARATIONS_FILE_NAME,
  );

const utf8ByteLength = (value: string): number => {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    if (point <= 0x7f) bytes += 1;
    else if (point <= 0x7ff) bytes += 2;
    else if (point <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
};

/** Parse one ceremony note document from readable bytes (the caller bounds size). */
export const parseCeremonyNoteText = (text: string): unknown => parse(text);

/** One bounded declaration-document read. */
export type CeremonyDeclarationDocumentRead =
  | { readonly state: "absent"; readonly path: string }
  | { readonly state: "document"; readonly path: string; readonly value: unknown }
  | { readonly state: "malformed"; readonly path: string }
  | { readonly state: "unreadable"; readonly path: string };

/** Read the committed declaration document for one invoking checkout root. */
export const readCeremonyDeclarationDocument = (input: {
  readonly gitRoot: string;
  readonly configurationDirectoryName: string;
  readonly fs?: CeremonyDeclarationFileSystem;
}): CeremonyDeclarationDocumentRead => {
  const fs = input.fs ?? nodeCeremonyDeclarationFileSystem();
  const path = ceremonyDeclarationDocumentPath(input.gitRoot, input.configurationDirectoryName);
  const parent = dirname(path);
  const parentUsable = (() => {
    try {
      return fs.pathExists(parent) ? fs.isDirectory(parent) : true;
    } catch {
      return false;
    }
  })();
  if (!parentUsable) return { state: "unreadable", path };
  const exists = (() => {
    try {
      return fs.pathExists(path);
    } catch {
      return false;
    }
  })();
  if (!exists) return { state: "absent", path };
  let text: string;
  try {
    text = fs.readText(path);
  } catch {
    return { state: "unreadable", path };
  }
  if (utf8ByteLength(text) > CEREMONY_DECLARATION_LIMITS.documentBytes) {
    return { state: "malformed", path };
  }
  try {
    return { state: "document", path, value: parse(text) };
  } catch {
    return { state: "malformed", path };
  }
};
