/**
 * TC-SESS-004 — the harness one-shot keeps its sanitized, temporary empty
 * project context, injects no delivery-session fact, and removes the context on
 * both the success and failure paths.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHarnessOneShotTransport } from "../../packages/adapters/src/session/commit-one-shot";
import type { CommitSkeleton } from "../../packages/core/src/contracts/index";
import {
  COMMIT_MAX_OUTPUT_TOKENS,
  COMMIT_TEMPERATURE,
} from "../../packages/core/src/contracts/index";

const skeleton: CommitSkeleton = {
  ref: "GH-310",
  refSource: "argument",
  type: "feat",
  scope: "GH-310",
  breaking: false,
};

const request = {
  skeleton,
  bundle: {
    skeleton,
    files: [],
    lastCommitSubjects: [],
    totalInputChars: 0,
    trimmed: false,
  },
  schemaId: "delivery.commit.message.v1",
  temperature: COMMIT_TEMPERATURE,
  maxOutputTokens: COMMIT_MAX_OUTPUT_TOKENS,
} as const;

describe("TC-SESS-004 sanitized one-shot context", () => {
  test("a fresh temporary directory receives a sanitized environment and is removed", async () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), "gh242-oneshot-root-"));
    const seen: { cwd?: string; env?: Record<string, string> } = {};
    try {
      const transport = createHarnessOneShotTransport({
        command: "fixture-harness",
        temporaryRoot,
        environment: { SAFE_KEY: "safe-value" },
        runner: async (_file, _args, options) => {
          seen.cwd = options.cwd;
          seen.env = { ...options.env };
          return {
            stdout: JSON.stringify({ subject: "feat(GH-310): one-shot", breaking: false }),
            stderr: "",
            status: 0,
            timedOut: false,
          };
        },
      });
      const outcome = await transport.generate(request);
      expect(outcome.ok).toBe(true);
      expect(seen.cwd).toBeDefined();
      expect(seen.cwd).not.toBe(process.cwd());
      expect(seen.cwd?.startsWith(temporaryRoot)).toBe(true);
      expect(seen.env).toEqual({ SAFE_KEY: "safe-value" });
      expect(seen.env).not.toHaveProperty("DELIVERY_SESSION_ID");
      expect(seen.env).not.toHaveProperty("UNDECLARED_PARENT_TOKEN");
      expect(seen.cwd === undefined ? false : existsSync(seen.cwd)).toBe(false);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  test("the temporary context is removed on the failure path too", async () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), "gh242-oneshot-fail-"));
    let observedCwd: string | undefined;
    try {
      const transport = createHarnessOneShotTransport({
        command: "fixture-harness",
        temporaryRoot,
        environment: { DELIVERY_SESSION_ID: "ses_canary" },
        runner: async (_file, _args, options) => {
          observedCwd = options.cwd;
          return { stdout: "not-json", stderr: "boom", status: 7, timedOut: false };
        },
      });
      const outcome = await transport.generate(request);
      expect(outcome.ok).toBe(false);
      expect(observedCwd).toBeDefined();
      expect(observedCwd === undefined ? false : existsSync(observedCwd)).toBe(false);
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});
