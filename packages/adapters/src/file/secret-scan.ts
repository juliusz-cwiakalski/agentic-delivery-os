/**
 * `@delivery-os/adapters/file` deterministic secret scanner (GH-227 F-5, DEC-5).
 *
 * Content and filename patterns over committed corpora. A hit names the finding
 * class and the path only — never the material — so suspicion can STOP the
 * operation without leaking. A read failure is reported as unavailable and the
 * caller fails closed. No network, no AI, no ambient environment.
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  COMMIT_FORBIDDEN_PATH_PATTERNS,
  COMMIT_MAX_BINARY_BYTES,
  type CommitSafetyFinding,
  type CommitSafetyOutcome,
} from "@delivery-os/core/contracts";

/** The committed content corpus: deterministic secret-suspicion patterns. */
export const SECRET_CONTENT_PATTERNS: readonly RegExp[] = [
  /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[A-Za-z0-9_./+-]{16,}/i,
];

/** The committed filename corpus: secret-file classes, never content. */
export const SECRET_FILENAME_PATTERNS: readonly RegExp[] = [
  /(^|\/)\.env(\.[^/]+)?$/,
  /(^|\/)id_rsa$/,
  /(^|\/)id_ed25519$/,
  /(^|\/)[^/]+\.pem$/,
  /(^|\/)[^/]+\.p12$/,
];

/** The scanner construction input; every fact is injected. */
export type SecretScannerOptions = {
  readonly cwd?: string;
  readonly contentPatterns?: readonly RegExp[];
  readonly filenamePatterns?: readonly RegExp[];
  readonly forbiddenPathPatterns?: readonly string[];
  readonly maxBinaryBytes?: number;
  readonly readText?: (path: string) => string;
  readonly sizeOf?: (path: string) => number;
};

const FORBIDDEN = COMMIT_FORBIDDEN_PATH_PATTERNS.map((pattern) => new RegExp(pattern));

const defaultReadText = (path: string): string => readFileSync(path, "utf8");
const defaultSizeOf = (path: string): number => statSync(path).size;

const isMissingFile = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  ((error as { readonly code?: unknown }).code === "ENOENT" ||
    (error as { readonly code?: unknown }).code === "EISDIR");

/** Build the deterministic scanner over the working tree at the injected root. */
export const createSecretScanner = (
  options: SecretScannerOptions = {},
): ((files: readonly { readonly path: string }[]) => Promise<CommitSafetyOutcome>) => {
  const contentPatterns = options.contentPatterns ?? SECRET_CONTENT_PATTERNS;
  const filenamePatterns = options.filenamePatterns ?? SECRET_FILENAME_PATTERNS;
  const forbidden = [
    ...FORBIDDEN,
    ...(options.forbiddenPathPatterns ?? []).map((pattern) => new RegExp(pattern)),
  ];
  const readText = options.readText ?? defaultReadText;
  const sizeOf = options.sizeOf ?? defaultSizeOf;
  const maxBinaryBytes = options.maxBinaryBytes ?? COMMIT_MAX_BINARY_BYTES;
  const absolute = (path: string): string =>
    options.cwd === undefined ? path : join(options.cwd, path);

  return async (files) => {
    const findings: CommitSafetyFinding[] = [];
    for (const file of files) {
      if (forbidden.some((pattern) => pattern.test(file.path))) {
        findings.push({ class: "forbidden-path", path: file.path });
        continue;
      }
      const filename = file.path.split("/").pop() ?? file.path;
      if (filenamePatterns.some((pattern) => pattern.test(filename))) {
        findings.push({ class: "secret-filename", path: file.path });
      }
      let size: number;
      try {
        size = sizeOf(absolute(file.path));
      } catch (error) {
        if (!isMissingFile(error)) {
          return { ok: false, code: "commit.safety.scan-unavailable", detail: "size read failed" };
        }
        size = 0;
      }
      if (size > maxBinaryBytes) {
        findings.push({ class: "oversized-binary", path: file.path });
      }
      try {
        const text = readText(absolute(file.path));
        if (contentPatterns.some((pattern) => pattern.test(text))) {
          findings.push({ class: "secret-content", path: file.path });
        }
      } catch (error) {
        if (!isMissingFile(error)) {
          return { ok: false, code: "commit.safety.scan-unavailable", detail: "content read failed" };
        }
      }
    }
    return { ok: true, findings };
  };
};
