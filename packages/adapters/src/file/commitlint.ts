/**
 * `@delivery-os/adapters/file` commitlint probe (GH-227 F-3, GAP-4).
 *
 * Discovers the repository's commitlint configuration from the root and probes
 * the installed binary over an injected child runner. Absent configuration is
 * reported as `absent` so validation degrades to the deterministic checks only;
 * a configured repository whose probe fails reports the concrete lint errors.
 */
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  CommitMessageDraft,
  CommitlintOutcome,
  CommitlintPort,
} from "@delivery-os/core/contracts";

/** One bounded commitlint probe result. */
export type CommitlintProbeChildResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number;
};

/** The injectable child seam (production default: `execFile`). */
export type CommitlintProbeRunner = (
  file: string,
  args: readonly string[],
  options: { readonly cwd: string; readonly timeout: number },
) => Promise<CommitlintProbeChildResult>;

/** The probe construction input. */
export type CommitlintProbeOptions = {
  readonly cwd: string;
  readonly timeoutMs?: number;
  readonly runner?: CommitlintProbeRunner;
  readonly configFiles?: readonly string[];
};

/** The configuration files the discovery admits, in deterministic order. */
export const COMMITLINT_CONFIG_FILES: readonly string[] = [
  ".commitlintrc",
  ".commitlintrc.json",
  ".commitlintrc.yaml",
  ".commitlintrc.yml",
  ".commitlintrc.js",
  ".commitlintrc.cjs",
  ".commitlintrc.mjs",
  "commitlint.config.js",
  "commitlint.config.cjs",
  "commitlint.config.mjs",
  "commitlint.config.ts",
];

const DEFAULT_TIMEOUT_MS = 15_000;

const execFileRunner: CommitlintProbeRunner = (file, args, options) =>
  new Promise((resolve) => {
    execFile(
      file,
      [...args],
      { cwd: options.cwd, timeout: options.timeout, encoding: "utf8" },
      (error, stdout, stderr) => {
        const status =
          error === null
            ? 0
            : typeof (error as { readonly code?: unknown }).code === "number"
              ? (error as { readonly code: number }).code
              : 1;
        resolve({ stdout, stderr, status });
      },
    );
  });

const packageJsonHasCommitlint = (cwd: string): boolean => {
  const path = join(cwd, "package.json");
  if (!existsSync(path)) return false;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { readonly commitlint?: unknown };
    return parsed.commitlint !== undefined;
  } catch {
    return false;
  }
};

/** Whether the repository configures commitlint at its root. */
export const hasCommitlintConfig = (
  cwd: string,
  configFiles: readonly string[] = COMMITLINT_CONFIG_FILES,
): boolean =>
  configFiles.some((file) => existsSync(join(cwd, file))) || packageJsonHasCommitlint(cwd);

const errorsOf = (value: string): readonly string[] =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 20);

/** Build the commitlint probe over an injected child runner. */
export const createCommitlintProbe = (options: CommitlintProbeOptions): CommitlintPort => {
  const runner = options.runner ?? execFileRunner;
  const present = hasCommitlintConfig(options.cwd, options.configFiles);
  return {
    check: async (message: CommitMessageDraft): Promise<CommitlintOutcome> => {
      if (!present) return { status: "absent", errors: [] };
      const root = mkdtempSync(join(tmpdir(), "commitlint-probe-"));
      const path = join(root, "message.txt");
      try {
        writeFileSync(
          path,
          message.body === undefined ? message.subject : `${message.subject}\n\n${message.body}`,
        );
        const result = await runner("commitlint", ["--edit", path], {
          cwd: options.cwd,
          timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        });
        if (result.status === 0) return { status: "valid", errors: [] };
        const errors = [...errorsOf(result.stderr), ...errorsOf(result.stdout)];
        return {
          status: "invalid",
          errors: errors.length === 0 ? ["commitlint rejected the message"] : errors,
        };
      } catch {
        return { status: "invalid", errors: ["commitlint could not be executed"] };
      } finally {
        try {
          rmSync(root, { recursive: true, force: true });
        } catch {
          // Best effort: the probe file is disposable and never evidence.
        }
      }
    },
  };
};
