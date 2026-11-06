/**
 * TC-BRIEF-002 — command surface, grammar rejection before any read, and the
 * handler's data-only contract over the shared status reader set.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createBriefCommandDefinition } from "../../packages/cli/src/commands/brief";
import {
  baseFacts,
  briefRuntime,
  createStatusRecorder,
  runBriefCli,
} from "../fixtures/brief/harness";
import { runStatusCli, statusRuntime } from "../fixtures/status/harness";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

describe("TC-BRIEF-002 command surface", () => {
  test("the definition is exactly brief with no flags and no positionals", () => {
    const definition = createBriefCommandDefinition(briefRuntime(baseFacts()));
    expect(definition.flags).toEqual([]);
    expect(definition.requiresValue).toBeUndefined();
    expect(definition.conflicts).toBeUndefined();
    expect(definition.positionals).toEqual({ max: 0 });
  });

  test("every malformed invocation fails before any read with one failure envelope", async () => {
    for (const argv of [
      ["brief", "extra"],
      ["brief", "GH-228"],
      ["brief", "--bogus"],
      ["--json", "brief", "--json", "extra"],
    ]) {
      const recorder = createStatusRecorder();
      const run = await runBriefCli(argv, briefRuntime(baseFacts(), recorder), { recorder });
      expect(run.exitCode, argv.join(" ")).toBe(1);
      expect(recorder.calls, argv.join(" ")).toEqual([]);
      if (argv.includes("--json")) {
        const envelope = JSON.parse(run.stdout) as unknown;
        expect(isRecord(envelope) && isRecord(envelope.error)).toBe(true);
        if (isRecord(envelope) && isRecord(envelope.error)) {
          expect(envelope.error.code).toBe("fallback.invocation");
        }
        expect(run.stdout).not.toContain('"data"');
      } else {
        expect(run.stderr.length).toBeGreaterThan(0);
      }
    }
  });

  test("valid human and machine modes render and perform at least one read", async () => {
    const humanRecorder = createStatusRecorder();
    const human = await runBriefCli(["brief"], briefRuntime(baseFacts(), humanRecorder), {
      recorder: humanRecorder,
    });
    expect(human.exitCode).toBe(0);
    expect(humanRecorder.calls.length).toBeGreaterThan(0);
    expect(human.stdout).toContain("brief");
    expect(human.stdout.trimStart().startsWith("{")).toBe(false);

    const jsonRecorder = createStatusRecorder();
    const json = await runBriefCli(["--json", "brief"], briefRuntime(baseFacts(), jsonRecorder), {
      recorder: jsonRecorder,
    });
    expect(json.exitCode).toBe(0);
    const envelope = JSON.parse(json.stdout) as unknown;
    expect(isRecord(envelope)).toBe(true);
    if (isRecord(envelope)) expect(envelope).not.toHaveProperty("error");
  });

  test("the handler owns no stream write and chooses no exit code", () => {
    const source = readFileSync("packages/cli/src/commands/brief.ts", "utf8");
    expect(source).not.toContain(".write(");
    expect(source).not.toContain("exitCode");
    expect(source).not.toContain("projection");
  });

  test("the brief reader member set is exactly the status member set", async () => {
    const statusRecorder = createStatusRecorder();
    await runStatusCli(["--json", "status"], statusRuntime(baseFacts(), statusRecorder), {
      recorder: statusRecorder,
    });
    const briefRecorder = createStatusRecorder();
    await runBriefCli(["--json", "brief"], briefRuntime(baseFacts(), briefRecorder), {
      recorder: briefRecorder,
    });
    expect(new Set(briefRecorder.calls)).toEqual(new Set(statusRecorder.calls));
    const briefMembers = new Set(briefRecorder.calls);
    for (const member of statusRecorder.calls) expect(briefMembers.has(member)).toBe(true);
  });
});
