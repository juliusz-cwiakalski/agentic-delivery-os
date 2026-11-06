/**
 * `@delivery-os/adapters/session` harness one-shot transport (GH-227 F-4, OQ-1).
 *
 * A CLI-level headless invocation in a fresh empty project directory. The
 * temporary context contains only the constrained prompt, receives a sanitized
 * environment (no delivery-session facts, no project configuration), and is
 * removed after the attempt, including on failure. The one-shot is never run
 * inside a delivery session.
 */
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  CommitMessageDraft,
  CommitTokenSpend,
  CommitTransportOutcome,
  CommitTransportPort,
  CommitTransportRequest,
} from "@delivery-os/core/contracts";

/** One bounded harness invocation result; a non-zero exit is data. */
export type HarnessOneShotResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number;
  readonly timedOut: boolean;
};

/** The injectable harness child-process seam (production default: `execFile`). */
export type HarnessOneShotRunner = (
  file: string,
  args: readonly string[],
  options: {
    readonly cwd: string;
    readonly env: Readonly<Record<string, string>>;
    readonly timeout: number;
  },
) => Promise<HarnessOneShotResult>;

/** Construction input for the harness one-shot transport. */
export type CommitOneShotOptions = {
  readonly command: string;
  readonly args?: readonly string[];
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly timeoutMs?: number;
  readonly runner?: HarnessOneShotRunner;
  /** The base directory for the temporary empty project; tests may pin it. */
  readonly temporaryRoot?: string;
};

const DEFAULT_TIMEOUT_MS = 60_000;

const execFileRunner: HarnessOneShotRunner = (file, args, options) =>
  new Promise((resolve) => {
    execFile(
      file,
      [...args],
      { cwd: options.cwd, env: options.env, timeout: options.timeout, encoding: "utf8" },
      (error, stdout, stderr) => {
        const status =
          error === null
            ? 0
            : typeof (error as { readonly code?: unknown }).code === "number"
              ? (error as { readonly code: number }).code
              : 1;
        resolve({
          stdout,
          stderr,
          status,
          timedOut: error !== null && (error as { readonly killed?: boolean }).killed === true,
        });
      },
    );
  });

const sanitizedEnvironment = (
  environment: Readonly<Record<string, string | undefined>>,
): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(environment)) {
    if (value !== undefined) result[key] = value;
  }
  return result;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const messageFrom = (value: unknown): CommitMessageDraft | undefined => {
  if (!isRecord(value)) return undefined;
  const candidate = isRecord(value.message) ? value.message : value;
  if (typeof candidate.subject !== "string" || candidate.subject.length === 0) return undefined;
  if (typeof candidate.breaking !== "boolean") return undefined;
  if (candidate.body !== undefined && typeof candidate.body !== "string") return undefined;
  return {
    subject: candidate.subject,
    ...(candidate.body === undefined ? {} : { body: candidate.body }),
    breaking: candidate.breaking,
  };
};

const spendFrom = (value: unknown): CommitTokenSpend => {
  if (!isRecord(value)) return { inputTokens: 0, outputTokens: 0 };
  const usage = isRecord(value.usage) ? value.usage : value;
  const input = typeof usage.inputTokens === "number" ? usage.inputTokens : 0;
  const output = typeof usage.outputTokens === "number" ? usage.outputTokens : 0;
  return { inputTokens: input, outputTokens: output };
};

const failure = (code: string, detail?: string): CommitTransportOutcome => ({
  ok: false,
  transport: "harness-one-shot",
  code,
  ...(detail === undefined ? {} : { detail }),
});

/** Build the harness one-shot transport over an injected child seam. */
export const createHarnessOneShotTransport = (
  options: CommitOneShotOptions,
): CommitTransportPort => ({
  generate: async (request: CommitTransportRequest): Promise<CommitTransportOutcome> => {
    const runner = options.runner ?? execFileRunner;
    const root = mkdtempSync(join(options.temporaryRoot ?? tmpdir(), "commit-one-shot-"));
    const promptPath = join(root, "prompt.json");
    try {
      writeFileSync(
        promptPath,
        `${JSON.stringify({
          schemaId: request.schemaId,
          skeleton: request.skeleton,
          bundle: request.bundle,
          temperature: request.temperature,
          maxOutputTokens: request.maxOutputTokens,
          validationErrors: request.validationErrors ?? [],
        })}\n`,
      );
      const result = await runner(options.command, [...(options.args ?? []), promptPath], {
        cwd: root,
        env: sanitizedEnvironment(options.environment ?? {}),
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      });
      if (result.status !== 0) {
        return failure(
          result.timedOut ? "harness.timeout" : "harness.failed",
          result.timedOut ? "harness timed out" : "harness exited non-zero",
        );
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(result.stdout) as unknown;
      } catch {
        return failure("harness.invalid-output");
      }
      const message = messageFrom(parsed);
      if (message === undefined) return failure("harness.invalid-output");
      return {
        ok: true,
        message,
        transport: "harness-one-shot",
        tokenSpend: spendFrom(parsed),
      };
    } catch {
      return failure("harness.failed");
    } finally {
      try {
        rmSync(root, { recursive: true, force: true });
      } catch {
        // Best effort: the temp context is disposable and never evidence.
      }
    }
  },
});

/** Read the prompt file of a completed one-shot attempt (adapter probe helper). */
export const readOneShotPrompt = (path: string): unknown =>
  JSON.parse(readFileSync(path, "utf8")) as unknown;
