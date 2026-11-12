/**
 * TC-EVT-060 — `events` is prompt-required (19), composed unconditionally with no
 * runtime input, selectable without the containment throw, and reaches its
 * handler through the real entrypoint.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  PROMPT_REQUIRED_COMMANDS,
  runEntrypoint,
  selectPromptRequiredProgram,
} from "../../packages/cli/src/entrypoint";
import { helpEntryFor } from "../../packages/cli/src/help";
import { createProductionComposer } from "../../packages/cli/src/production";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";

const tempRoot = (): string => {
  mkdirSync(join(process.cwd(), "tmp", "tmpdir"), { recursive: true });
  return mkdtempSync(join(process.cwd(), "tmp", "tmpdir", "gh290-compose-"));
};

const DELIVERED = [
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
  "projects",
] as const;

describe("TC-EVT-060 events production composition", () => {
  test("events is prompt-required exactly once and the delivered eighteen survive", () => {
    expect(PROMPT_REQUIRED_COMMANDS).toHaveLength(19);
    expect(PROMPT_REQUIRED_COMMANDS.filter((name) => name === "events")).toHaveLength(1);
    for (const name of DELIVERED) expect(PROMPT_REQUIRED_COMMANDS).toContain(name);
    expect(PROMPT_REQUIRED_COMMANDS[PROMPT_REQUIRED_COMMANDS.length - 1]).toBe("events");
  });

  test("the production composer supplies the runtime with every optional input absent", () => {
    const root = tempRoot();
    try {
      const program = createProductionComposer({
        environment: { HOME: root, PATH: "/usr/bin" },
        cwd: root,
        homeDirectory: root,
        workingName: SYNTHETIC_BRAND.binaryName,
      })(SYNTHETIC_BRAND);
      const events = program.commands.events;
      expect(events).toBeDefined();
      expect(events?.positionals).toEqual({ max: 2 });
      expect(events?.flags).toBeUndefined();
      const selected = selectPromptRequiredProgram(program);
      expect(Object.keys(selected.commands)).toHaveLength(19);
      expect(selected.commands.events).toBeDefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("runEntrypoint reaches the handler with nothing composed", async () => {
    const root = tempRoot();
    try {
      const stdout = bufferSink();
      const stderr = bufferSink();
      const composer = createProductionComposer({
        environment: { HOME: root, PATH: "/usr/bin" },
        cwd: root,
        homeDirectory: root,
        workingName: SYNTHETIC_BRAND.binaryName,
      });
      const exitCode = await runEntrypoint(["events", "list", "--json"], {
        streams: { stdout, stderr },
        environment: { HOME: root },
        configuredWorkingName: SYNTHETIC_BRAND.binaryName,
        composeProgram: composer,
        clock: { now: () => 1 },
        newRunId: () => "run-events-compose",
      });
      expect(exitCode).toBe(0);
      const envelope = JSON.parse(stdout.value) as {
        data?: { command?: string; topics?: unknown[] };
      };
      expect(envelope.data?.command).toBe("events list");
      expect(envelope.data?.topics).toHaveLength(6);
      expect(stderr.value).toBe("");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a conditional registration fails selection by name", () => {
    const partial = {
      commands: Object.fromEntries(
        DELIVERED.map((name) => [name, helpEntryFor([name]) === undefined ? undefined : {}]),
      ) as Record<string, unknown>,
    };
    expect(() =>
      selectPromptRequiredProgram({
        commands: Object.fromEntries(
          DELIVERED.map((name) => [name, { handler: () => ({ data: {} }) }]),
        ),
      }),
    ).toThrow(/events/);
    expect(partial.commands.events).toBeUndefined();
  });
});
