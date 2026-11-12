/**
 * TC-HDA-029 runtime half — `DispatchEnvelopeError` is the delivered
 * `CommandResultError` plus an additive bounded `detail`; the shared error type
 * and every other envelope keep their six-field shape.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import type { CliDependencies, CommandDefinition } from "../../packages/cli/src/index";
import { runCli } from "../../packages/cli/src/index";
import {
  COMMAND_FAILURE_DETAIL_MAX_CHARS,
  type CommandResultError,
  DISPATCH_MAX_ERROR_DETAIL_CHARS,
  DISPATCH_MAX_LAST_MESSAGE_CHARS,
} from "../../packages/core/src/contracts/index";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";

const ROOT = process.cwd();
const DISPATCH_CONTRACT = "packages/core/src/contracts/dispatch.ts";
const RESULT_CONTRACT = "packages/core/src/contracts/result.ts";
const CONTRACTS_INDEX = "packages/core/src/contracts/index.ts";

const COMMAND_RESULT_ERROR_KEYS = [
  "category",
  "code",
  "consequence",
  "remediationHint",
  "retryable",
  "summary",
] as const;

const sourceOf = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const parseOf = (relative: string): ts.SourceFile =>
  ts.createSourceFile(relative, sourceOf(relative), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const typeAliasText = (relative: string, name: string): string | undefined => {
  const parsed = parseOf(relative);
  for (const statement of parsed.statements) {
    if (ts.isTypeAliasDeclaration(statement) && statement.name.text === name) {
      return statement.getText(parsed);
    }
  }
  return undefined;
};

const depsFor = (command: CommandDefinition): CliDependencies => ({
  brand: SYNTHETIC_BRAND,
  clock: { now: () => 0 },
  newRunId: () => "run-fixed",
  secrets: [],
  program: { commands: { synthetic: command } },
});

const invoke = async (
  command: CommandDefinition,
  argv: readonly string[],
): Promise<{ readonly stdout: string; readonly exit: number }> => {
  const out = bufferSink();
  const err = bufferSink();
  const exit = await runCli(argv, { stdout: out, stderr: err }, depsFor(command));
  return { stdout: out.value, exit };
};

describe("TC-HDA-029 dispatch-specific additive error detail", () => {
  test("the dispatch envelope error names DispatchEnvelopeError, not CommandResultError", () => {
    const envelope = typeAliasText(DISPATCH_CONTRACT, "DispatchEnvelopeData");
    expect(envelope).toBeDefined();
    expect(envelope).toContain("readonly error?: DispatchEnvelopeError");
    expect(envelope).not.toContain("readonly error?: CommandResultError");

    const errorAlias = typeAliasText(DISPATCH_CONTRACT, "DispatchEnvelopeError");
    expect(errorAlias).toBeDefined();
    expect(errorAlias).toContain("CommandResultError");
    expect(errorAlias).toContain("detail?");
    expect(errorAlias).toContain('"harness" | "config"');
    expect(errorAlias).toContain("readonly code: string");
    expect(errorAlias).toContain("readonly field?: string");
  });

  test("the shared CommandResultError keeps exactly six fields and no detail", () => {
    const shared = typeAliasText(RESULT_CONTRACT, "CommandResultError");
    expect(shared).toBeDefined();
    for (const key of COMMAND_RESULT_ERROR_KEYS) {
      expect(shared).toContain(`readonly ${key}`);
    }
    expect(shared).not.toContain("detail");
    expect(shared).not.toContain("field");
  });

  test("the failure envelope declares the optional root detail beside the error (TDR-0027)", () => {
    const failure = typeAliasText(RESULT_CONTRACT, "CommandResultFailure");
    expect(failure).toBeDefined();
    expect(failure).toContain("readonly detail?: CommandResultDetail");
    const detail = typeAliasText(RESULT_CONTRACT, "CommandResultDetail");
    expect(detail).toBeDefined();
    expect(detail).toContain("readonly holder?: string");
    expect(detail).not.toContain("session");
    expect(COMMAND_FAILURE_DETAIL_MAX_CHARS).toBe(128);
    const index = sourceOf(CONTRACTS_INDEX);
    expect(index).toContain("COMMAND_FAILURE_DETAIL_MAX_CHARS");
    expect(index).toContain("type CommandResultDetail");
  });

  test("a single-flight refusal projects the holder at the envelope root", async () => {
    const command: CommandDefinition = {
      handler: () => ({
        error: {
          kind: "queue",
          code: "queue.single-flight",
          summary: "holder:lane-1; ref:GH-241",
          detail: { holder: "lane-1" },
        },
      }),
    };
    const run = await invoke(command, ["synthetic", "--json"]);
    expect(run.exit).toBe(1);
    const envelope = JSON.parse(run.stdout) as {
      readonly error: CommandResultError & Record<string, unknown>;
      readonly detail?: { readonly holder?: string };
    };
    expect(envelope.error.code).toBe("queue.single-flight");
    expect(envelope.detail?.holder).toBe("lane-1");
    expect(Object.keys(envelope.error).sort()).toEqual([...COMMAND_RESULT_ERROR_KEYS]);
    expect(Object.hasOwn(envelope.error, "detail")).toBe(false);
  });

  test("a string-valued app detail never reaches the envelope root", async () => {
    const command: CommandDefinition = {
      handler: () => ({
        error: {
          kind: "queue",
          code: "queue.lease-conflict",
          summary: "holder:lane-1; lease:l-1",
          detail: "holder:lane-1; lease:l-1",
        },
      }),
    };
    const run = await invoke(command, ["synthetic", "--json"]);
    expect(run.exit).toBe(1);
    const envelope = JSON.parse(run.stdout) as { readonly detail?: unknown };
    expect(Object.hasOwn(envelope, "detail")).toBe(false);
  });

  test("the additive surface is re-exported from the contracts entrypoint", () => {
    const index = sourceOf(CONTRACTS_INDEX);
    expect(index).toContain("DISPATCH_MAX_ERROR_DETAIL_CHARS");
    expect(index).toContain("type DispatchEnvelopeError");
  });

  test("the detail bound is the exported 256-character constant", () => {
    expect(DISPATCH_MAX_ERROR_DETAIL_CHARS).toBe(256);
    expect(DISPATCH_MAX_ERROR_DETAIL_CHARS).toBeLessThan(DISPATCH_MAX_LAST_MESSAGE_CHARS);
  });

  test("a non-dispatch failure envelope carries no detail and no field", async () => {
    const command: CommandDefinition = {
      handler: () => ({ error: { kind: "config", code: "config.value.invalid" } }),
    };
    const run = await invoke(command, ["synthetic", "--json"]);
    expect(run.exit).not.toBe(0);
    const envelope = JSON.parse(run.stdout) as {
      readonly error: CommandResultError & Record<string, unknown>;
    };
    const keys = Object.keys(envelope.error).sort();
    expect(keys).toEqual([...COMMAND_RESULT_ERROR_KEYS]);
    expect(Object.hasOwn(envelope.error, "detail")).toBe(false);
    expect(Object.hasOwn(envelope.error, "field")).toBe(false);
  });
});
