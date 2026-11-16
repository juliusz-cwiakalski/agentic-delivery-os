/**
 * TC-CEREMONY-001..006 — the mounted family, grammar refusals before any read
 * or write, the undeclared-name refusal, envelope and exit continuity across
 * every outcome class, the inert `--apply`, and the bounded `list` render.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type CeremonyCommandResult,
  type CeremonyCommandRuntime,
  createCeremonyCommandDefinition,
} from "../../packages/cli/src/commands/ceremony";
import { allHelpEntries, helpEntryFor } from "../../packages/cli/src/help";
import { PROMPT_REQUIRED_COMMANDS } from "../../packages/cli/src/help/prompt-required-commands";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import { runHelpGuideCoverage } from "../../scripts/checks/help-guide-coverage";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";

type Call = { readonly verb: string; readonly input?: unknown };

const recordingRuntime = (
  handler: (verb: string, input?: unknown) => CeremonyCommandResult,
): { readonly runtime: CeremonyCommandRuntime; readonly calls: Call[] } => {
  const calls: Call[] = [];
  const record = (verb: string, input?: unknown) => {
    calls.push({ verb, ...(input === undefined ? {} : { input }) });
    return handler(verb, input);
  };
  return {
    calls,
    runtime: {
      list: () => record("list"),
      run: (input) => record("run", input),
      resume: (input) => record("resume", input),
      catchUp: (input) => record("catch-up", input),
    },
  };
};

const run = async (
  args: readonly string[],
  runtime: CeremonyCommandRuntime,
): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  const deps: CliDependencies = {
    brand: SYNTHETIC_BRAND,
    clock: { now: () => 1_000 },
    newRunId: () => "run-ceremony-cli",
    secrets: [],
    program: { commands: { ceremony: createCeremonyCommandDefinition(runtime) } },
  };
  const exitCode = await runCli(["ceremony", ...args], { stdout, stderr }, deps);
  return { exitCode, stdout: stdout.value, stderr: stderr.value };
};

const envelopeOf = (stdout: string): Record<string, unknown> =>
  JSON.parse(stdout) as Record<string, unknown>;

const listData = (count = 2) => ({
  ceremonies: Array.from({ length: count }, (_, index) => ({
    id: `ceremony-${String(index)}`,
    origin: index % 2 === 0 ? "built-in" : "project",
    tiers: ["full", "lite"],
    triggers: ["schedule:daily"],
    catchUp: "once",
    lastRun: { runId: `run-${String(index)}`, verdict: "verified", startedAtMs: 1 },
  })),
});

describe("TC-CEREMONY-001 the family is mounted and advertised", () => {
  test("the prompt-required set carries ceremony once and root help names it", () => {
    expect(PROMPT_REQUIRED_COMMANDS.filter((command) => command === "ceremony")).toHaveLength(1);
    expect(PROMPT_REQUIRED_COMMANDS).toHaveLength(22);
    expect(helpEntryFor(["ceremony"])).toBeDefined();
    for (const verb of ["list", "run", "resume", "catch-up"]) {
      expect(helpEntryFor(["ceremony", verb]), verb).toBeDefined();
    }
    expect(
      allHelpEntries().filter((entry) => entry.path[0] === "ceremony").length,
    ).toBeGreaterThanOrEqual(5);
  });

  test("the coverage inventory names ceremony and its M2 page documents the four verbs", () => {
    expect(runHelpGuideCoverage()).toEqual([]);
    const page = readFileSync(
      join(process.cwd(), "doc/planning/oss-tooling/milestones/m2/commands/ceremony.md"),
      "utf8",
    );
    for (const verb of ["list", "run", "resume", "catch-up"]) {
      expect(page).toContain(verb);
    }
    expect(page).toContain("--help");
    expect(page).toContain("--version");
  });
});

describe("TC-CEREMONY-002 grammar refusals happen before any runtime call", () => {
  test.each([
    { name: "missing verb", args: [] as string[], code: "fallback.invocation" },
    { name: "unknown verb", args: ["watch"], code: "fallback.invocation" },
    {
      name: "unexpected positional",
      args: ["run", "morning-brief", "extra"],
      code: "fallback.invocation",
    },
    {
      name: "unknown flag",
      args: ["run", "morning-brief", "--unknown"],
      code: "fallback.invocation",
    },
    {
      name: "missing flag value",
      args: ["run", "morning-brief", "--note"],
      code: "fallback.invocation",
    },
  ])("$name is $code at exit 1", async ({ args, code }) => {
    const { runtime, calls } = recordingRuntime(() => ({ ok: true, data: {} }));
    const result = await run([...args, "--json"], runtime);
    expect(result.exitCode).toBe(1);
    expect(envelopeOf(result.stdout).error).toMatchObject({ code });
    expect(calls).toEqual([]);
  });

  test("a malformed --window is input.value.rejected before the runtime call", async () => {
    const { runtime, calls } = recordingRuntime(() => ({ ok: true, data: {} }));
    const result = await run(["run", "morning-brief", "--window", "bad", "--json"], runtime);
    expect(result.exitCode).toBe(1);
    expect(envelopeOf(result.stdout).error).toMatchObject({
      code: "input.value.rejected",
    });
    expect(calls).toEqual([]);
  });

  test("the paired accepted invocation reaches the runtime", async () => {
    const { runtime, calls } = recordingRuntime(() => ({
      ok: true,
      data: { ceremony: "morning-brief", runId: "run-1", verdict: "verified", steps: [] },
    }));
    const result = await run(["run", "morning-brief", "--json"], runtime);
    expect(result.exitCode).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.verb).toBe("run");
  });
});

describe("TC-CEREMONY-003 an undeclared ceremony name is refused distinctly", () => {
  test("input.value.rejected names the requested name and the declared set", async () => {
    const { runtime } = recordingRuntime(() => ({
      ok: false,
      error: {
        code: "input.value.rejected",
        summary: 'ceremony "typo" is not declared; declared: morning-brief, night-watch',
        field: "name",
      },
    }));
    const result = await run(["run", "typo", "--json"], runtime);
    expect(result.exitCode).toBe(1);
    const envelope = envelopeOf(result.stdout);
    expect(envelope.error).toMatchObject({ code: "input.value.rejected" });
    expect(JSON.stringify(envelope.error)).toContain("typo");
    expect(JSON.stringify(envelope.error)).toContain("morning-brief");
  });
});

describe("TC-CEREMONY-004 envelope and exit continuity across outcome classes", () => {
  const cases: readonly {
    readonly name: string;
    readonly result: CeremonyCommandResult;
    readonly exit: number;
  }[] = [
    {
      name: "verified",
      result: {
        ok: true,
        data: { ceremony: "morning-brief", runId: "r", verdict: "verified", steps: [] },
      },
      exit: 0,
    },
    {
      name: "dry-run",
      result: { ok: true, data: { ceremony: "mirror", runId: "r", verdict: "dry-run", steps: [] } },
      exit: 0,
    },
    {
      name: "unverified",
      result: {
        ok: true,
        data: {
          ceremony: "morning-brief",
          runId: "r",
          verdict: "unverified",
          steps: [{ index: 1 }],
        },
      },
      exit: 1,
    },
    {
      name: "nothing-missed",
      result: { ok: true, data: { outcome: "nothing-missed", ceremonies: [], appendedRuns: 0 } },
      exit: 0,
    },
    {
      name: "declared-gap",
      result: { ok: true, data: { outcome: "declared-gap", ceremonies: [], appendedRuns: 0 } },
      exit: 0,
    },
    {
      name: "refusal",
      result: { ok: false, error: { code: "input.value.rejected", summary: "refused" } },
      exit: 1,
    },
    {
      name: "torn state",
      result: {
        ok: false,
        error: { code: "state.store.torn", summary: "torn", kind: "state" },
      },
      exit: 2,
    },
    {
      name: "tier finding",
      result: {
        ok: true,
        data: {
          ceremony: "morning-brief",
          runId: "r",
          verdict: "verified",
          steps: [],
          tier: { findings: [{ kind: "tier-mismatch", subject: "lite/full" }] },
        },
      },
      exit: 0,
    },
  ];

  test.each(cases)(
    "$name writes exactly one five-key envelope at exit $exit",
    async ({ name, result, exit }) => {
      const { runtime } = recordingRuntime((verb) =>
        name === "nothing-missed" || name === "declared-gap"
          ? result
          : verb === "type"
            ? result
            : result,
      );
      const result_ = await run(["list", "--json"], runtime);
      expect(result_.exitCode).toBe(exit);
      const envelope = envelopeOf(result_.stdout);
      expect(assertEnvelopeContract(envelope)).toEqual([]);
      expect(Object.keys(envelope).sort()).toEqual(
        [
          "exitCode",
          "runId",
          "schemaVersion",
          "timing",
          ...(Object.hasOwn(envelope, "data") ? ["data"] : ["error"]),
        ].sort(),
      );
      expect(Object.hasOwn(envelope, "ok")).toBe(false);
      expect(Object.hasOwn(envelope, "command")).toBe(false);
      expect(envelope.error === undefined || envelope.data === undefined).toBe(true);
      if (envelope.error !== undefined) {
        expect((envelope.error as { detail?: unknown }).detail).toBeUndefined();
      }
    },
  );
});

describe("TC-CEREMONY-005 --apply is inert without a sync step", () => {
  test("the verdict and data payload are identical with and without the flag", async () => {
    const data = {
      ceremony: "morning-brief",
      runId: "run-1",
      verdict: "verified",
      steps: [{ index: 1, kind: "collect", outcome: "verified", verification: "verified" }],
    };
    const { runtime } = recordingRuntime(() => ({ ok: true, data }));
    const without = await run(["run", "morning-brief", "--json"], runtime);
    const withApply = await run(["run", "morning-brief", "--apply", "--json"], runtime);
    expect(withApply.exitCode).toBe(without.exitCode);
    expect(envelopeOf(withApply.stdout).data).toEqual(envelopeOf(without.stdout).data);
  });
});

describe("TC-CEREMONY-006 list content and bounded deterministic render", () => {
  test("the list data carries the declared fields and the runtime is read once", async () => {
    const { runtime, calls } = recordingRuntime(() => ({ ok: true, data: listData(2) }));
    const result = await run(["list", "--json"], runtime);
    expect(result.exitCode).toBe(0);
    const data = envelopeOf(result.stdout).data as {
      ceremonies: {
        id: string;
        origin: string;
        tiers: string[];
        triggers: string[];
        catchUp: string;
      }[];
    };
    expect(data.ceremonies).toHaveLength(2);
    expect(data.ceremonies[0]).toMatchObject({
      id: "ceremony-0",
      origin: "built-in",
      tiers: ["full", "lite"],
      triggers: ["schedule:daily"],
      catchUp: "once",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.verb).toBe("list");
  });

  test("the human render is bounded to 32 lines and 6 144 bytes with an omission marker", async () => {
    const { runtime } = recordingRuntime(() => ({ ok: true, data: listData(60) }));
    const result = await run(["list"], runtime);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.split("\n").filter((line) => line.length > 0).length).toBeLessThanOrEqual(
      32,
    );
    expect(Buffer.byteLength(result.stdout, "utf8")).toBeLessThanOrEqual(6_144);
    expect(result.stdout).toContain("omitted:");
  });

  test("the human run render is one line per step plus a verdict line", async () => {
    const { runtime } = recordingRuntime(() => ({
      ok: true,
      data: {
        ceremony: "morning-brief",
        runId: "run-1",
        window: { start: "a", end: "b" },
        verdict: "verified",
        steps: [
          { index: 1, kind: "collect", outcome: "verified", verification: "verified" },
          { index: 2, kind: "render", outcome: "verified", verification: "verified" },
        ],
      },
    }));
    const result = await run(["run", "morning-brief"], runtime);
    const lines = result.stdout.split("\n").filter((line) => line.length > 0);
    expect(lines).toHaveLength(4);
    expect(lines[lines.length - 1]).toBe("verdict: verified");
  });
});
