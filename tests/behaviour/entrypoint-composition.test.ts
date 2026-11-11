/**
 * TC-ENTRY-009 — the composition is exactly the §8.1 prompt-required set;
 * `state` and `mcp` are absent while `dispatch` and `daemon` are present; an invocation outside
 * the set fails closed through the existing `fallback.internal` identity.
 */
import { describe, expect, test } from "bun:test";
import {
  PROMPT_REQUIRED_COMMANDS,
  type PromptRequiredCommand,
  runEntrypoint,
  selectPromptRequiredProgram,
} from "../../packages/cli/src/entrypoint";
import type { CommandProgram } from "../../packages/cli/src/index";
import { syntheticPromptProgram } from "../fixtures/entrypoint/programs";
import { bufferSink } from "../golden/helpers";

const EXPECTED: readonly PromptRequiredCommand[] = [
  "status",
  "brief",
  "queue",
  "lanes",
  "blockers",
  "phase",
  "commit",
  "lint",
  "plan",
  "verify",
  "merge",
  "closeout",
  "spend",
  "retro",
  "dispatch",
  "coordinator",
  "daemon",
];

const withExtras = (): CommandProgram => {
  const base = syntheticPromptProgram();
  return {
    commands: {
      ...base.commands,
      config: { handler: () => ({ data: {} }) },
      doctor: { handler: () => ({ data: {} }) },
      provider: { handler: () => ({ data: {} }) },
      db: { handler: () => ({ data: {} }) },
      watchdog: { handler: () => ({ data: {} }) },
      board: { handler: () => ({ data: {} }) },
    },
  };
};

const invoke = async (argv: readonly string[]) => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  const exitCode = await runEntrypoint(argv, {
    streams: { stdout, stderr },
    environment: {},
    configuredWorkingName: "example-product",
    composeProgram: withExtras,
    clock: { now: () => 1 },
    newRunId: () => "run-composition",
  });
  return { exitCode, stdout: stdout.value, stderr: stderr.value };
};

describe("TC-ENTRY-009 composition honesty", () => {
  test("the declared set equals spec section 8.1 exactly", () => {
    expect([...PROMPT_REQUIRED_COMMANDS].sort()).toEqual([...EXPECTED].sort());
  });

  test("extra registrations are dropped, not advertised", () => {
    const selected = selectPromptRequiredProgram(withExtras());
    expect(Object.keys(selected.commands).sort()).toEqual([...EXPECTED].sort());
    for (const absent of ["state", "mcp", "config", "doctor"]) {
      expect(Object.keys(selected.commands)).not.toContain(absent);
    }
  });

  test("a composition gap throws instead of shipping a partial surface", () => {
    const partial: CommandProgram = {
      commands: { status: syntheticPromptProgram().commands.status ?? { handler: () => ({}) } },
    };
    expect(() => selectPromptRequiredProgram(partial)).toThrow(/not composed/);
  });

  test("an uncomposed command fails closed through fallback.internal", async () => {
    for (const command of ["state", "mcp", "frobnicate"]) {
      const run = await invoke(["--json", command]);
      expect(run.exitCode).toBe(2);
      const envelope = JSON.parse(run.stdout) as {
        error: {
          code: string;
          category: string;
          retryable: boolean;
          consequence: string;
          summary?: string;
        };
      };
      expect(envelope.error.code).toBe("fallback.internal");
      expect(envelope.error.category).toBe("platform");
      expect(envelope.error.retryable).toBe(false);
      expect(envelope.error.consequence).toBe("unknown");
      expect(envelope.error.summary ?? "").toContain("not part of the composed");
    }
  });

  test("an uncomposed invocation never returns a silent success", async () => {
    const run = await invoke(["--json", "state"]);
    const envelope = JSON.parse(run.stdout) as { data?: unknown; error?: { code?: string } };
    expect(envelope.data).toBeUndefined();
    expect(envelope.error?.code).toBe("fallback.internal");
  });

  test("the composed command dispatch still works for a prompt-required command", async () => {
    const run = await invoke(["--json", "status"]);
    expect(run.exitCode).toBe(0);
    const envelope = JSON.parse(run.stdout) as { data?: unknown };
    expect(envelope.data).toEqual({});
  });
});
