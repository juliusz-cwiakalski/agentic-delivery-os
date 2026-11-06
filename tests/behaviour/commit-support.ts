/**
 * Shared assertions and tree helpers for the GH-227 behaviour suites.
 *
 * Every negative asserts the durable delta, not only the returned code: exit,
 * status bytes, HEAD, commit count, and ledger line count.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CommitEnvelopeData, CommitMessageDraft } from "../../packages/core/src/contracts/index";
import type { CommitHarness, CommitRun } from "../fixtures/commit/harness";
import { COMMIT_REF } from "../fixtures/commit/harness";

export { COMMIT_REF };

export const dataOf = (run: CommitRun): Record<string, unknown> => {
  const data = run.envelope?.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("expected success data");
  }
  return data as Record<string, unknown>;
};

export const commitDataOf = (run: CommitRun): CommitEnvelopeData =>
  dataOf(run) as unknown as CommitEnvelopeData;

export const errorCodeOf = (run: CommitRun): unknown => {
  const error = run.envelope?.error;
  return typeof error === "object" && error !== null
    ? (error as { readonly code?: unknown }).code
    : undefined;
};

export const errorOf = (run: CommitRun): Record<string, unknown> => {
  const error = run.envelope?.error;
  if (typeof error !== "object" || error === null || Array.isArray(error)) {
    throw new Error("expected error data");
  }
  return error as Record<string, unknown>;
};

export const excludedOf = (run: CommitRun): CommitEnvelopeData["excluded"] => {
  const excluded = dataOf(run).excluded;
  if (typeof excluded !== "object" || excluded === null || Array.isArray(excluded)) {
    throw new Error("expected excluded data");
  }
  return excluded as CommitEnvelopeData["excluded"];
};

export const seedDirtyTree = (
  harness: CommitHarness,
  input: {
    readonly tracked?: Readonly<Record<string, string>>;
    readonly untracked?: Readonly<Record<string, string>>;
  } = {},
): void => {
  for (const [path, content] of Object.entries(input.tracked ?? { "src/existing.ts": "export const v = 2;\n" })) {
    harness.repo.write(path, content);
  }
  for (const [path, content] of Object.entries(input.untracked ?? { "src/new-file.ts": "export const n = 1;\n" })) {
    harness.repo.write(path, content);
  }
};

export const validMessage = (
  subject = `feat(${COMMIT_REF}): deliver the fixture change`,
  body?: string,
): CommitMessageDraft => ({
  subject,
  ...(body === undefined ? {} : { body }),
  breaking: false,
});

export const head = (harness: CommitHarness): string => harness.repo.head();
export const commitCount = (harness: CommitHarness): number => harness.repo.commitCount();
export const status = (harness: CommitHarness): string => harness.repo.statusPorcelain();
export const stagedPaths = (harness: CommitHarness): readonly string[] =>
  harness.repo.stagedPaths();
export const lastMessage = (harness: CommitHarness): string =>
  harness.repo.run(["log", "-1", "--format=%B"]).stdout.trim();
export const commitPaths = (harness: CommitHarness): readonly string[] =>
  harness.repo
    .run(["show", "--name-only", "--format=", "HEAD"])
    .stdout.split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .sort();

export const ledgerLineCount = (harness: CommitHarness): number =>
  harness.transitionPayloads().length + harness.telemetryPayloads().length;

export const transitionPayloads = (harness: CommitHarness): Record<string, unknown>[] =>
  harness.transitionPayloads();

export const telemetryPayloads = (harness: CommitHarness): Record<string, unknown>[] =>
  harness.telemetryPayloads();

export const readRepoFile = (harness: CommitHarness, path: string): string =>
  readFileSync(join(harness.repo.root, path), "utf8");

export const gitEnv = (harness: CommitHarness): NodeJS.ProcessEnv => ({
  ...harness.repo.environment,
});

/** Run a read-only git command outside the harness for independent evidence. */
export const gitOutput = (harness: CommitHarness, args: readonly string[]): string =>
  execFileSync("git", [...args], {
    cwd: harness.repo.root,
    env: harness.repo.environment,
    encoding: "utf8",
  });
