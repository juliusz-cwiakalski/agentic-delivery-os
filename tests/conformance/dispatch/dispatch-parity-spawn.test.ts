/**
 * TC-SPAWN-001..004 — the production spawn identity, the deterministic title,
 * and the lifecycle prompt (GH-347 F-7; API-6; DEC-8; TDR-0054).
 *
 * The fresh/resume rows come from the single registry; the role-less and
 * grammar cases drive the command-level harness and the shipped CLI.
 */
import { describe, expect, test } from "bun:test";
import { readDispatchAttempts } from "../../../packages/core/src/app/dispatch-ledger";
import { CLOSEOUT_INTEGRATION_BASE } from "../../../packages/core/src/contracts/index";
import { DISPATCH_LIFECYCLE_SECTION_TITLES } from "../../../packages/core/src/domain/dispatch-prompt";
import { createCommandScenario } from "../../fixtures/dispatch/golden/harness";
import { parityCasesOf } from "../../fixtures/dispatch/parity/cases";
import {
  spawnFreshObservation,
  spawnResumeObservation,
} from "../../fixtures/dispatch/parity/harness";

const argsOf = (observation: Awaited<ReturnType<typeof spawnFreshObservation>>) =>
  observation.invocations.filter((invocation) => invocation.seam === "harness").map((i) => i.args);

const countOf = (args: readonly string[], flag: string): number =>
  args.filter((arg) => arg === flag).length;

const after = (args: readonly string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
};

describe("TC-SPAWN-001 a fresh spawn renders one --agent pm and one resolved --model", () => {
  test("exactly one --agent pm and one --model provider-a/model-large", async () => {
    const observation = await spawnFreshObservation();
    const [args] = argsOf(observation);
    if (args === undefined) throw new Error("no harness invocation recorded");
    expect(countOf(args, "--agent")).toBe(1);
    expect(after(args, "--agent")).toBe("pm");
    expect(countOf(args, "--model")).toBe(1);
    expect(after(args, "--model")).toBe("provider-a/model-large");
    const attempt = observation.attempts[0];
    expect(attempt?.binding).toEqual({
      agent: "pm",
      seat: "pm",
      resolvedModel: "provider-a/model-large",
    });
    // Fixed argv, never a shell: the guard records no violation.
    expect(observation.violations).toEqual([]);
  });
});

describe("TC-SPAWN-002 exactly one deterministic ticket-<REF> title on a fresh spawn", () => {
  test("fresh carries one --title ticket-GH-347; the value is one token", async () => {
    const observation = await spawnFreshObservation();
    const [args] = argsOf(observation);
    if (args === undefined) throw new Error("no harness invocation recorded");
    expect(countOf(args, "--title")).toBe(1);
    const title = after(args, "--title") ?? "";
    expect(title).toBe("ticket-GH-347");
    expect(title).toMatch(/^ticket-[A-Z][A-Z0-9]*-[0-9]+$/);
    expect(title.includes(" ")).toBe(false);
  });

  test("the title is deterministic across refs and a second run", async () => {
    const first = await spawnFreshObservation();
    const second = await spawnFreshObservation();
    const third = await spawnFreshObservation({ ref: "PDEV-12" });
    expect(after(argsOf(first)[0] ?? [], "--title")).toBe("ticket-GH-347");
    expect(after(argsOf(second)[0] ?? [], "--title")).toBe("ticket-GH-347");
    expect(after(argsOf(third)[0] ?? [], "--title")).toBe("ticket-PDEV-12");
  });

  test("a resume carries no title", async () => {
    const observation = await spawnResumeObservation();
    const args = argsOf(observation)[0] ?? [];
    expect(countOf(args, "--title")).toBe(0);
    expect(args).toContain("--session");
  });

  test("the registered spawn rows are the same scenarios", async () => {
    const rows = parityCasesOf("spawn");
    expect(rows.map((row) => row.id)).toEqual(["spawn-fresh", "spawn-resume"]);
    for (const row of rows) expect(row.declaredSeam).toBe("spawn");
  });
});

describe("TC-SPAWN-003 the prompt is the lifecycle prompt parameterized by ref and base branch", () => {
  test("the fresh prompt carries the ref, the RESOLVED base branch, and the five sections", async () => {
    const observation = await spawnFreshObservation();
    const invocation = observation.invocations.find((entry) => entry.stdin !== undefined);
    const prompt = invocation?.stdin ?? "";
    expect(prompt).toContain("GH-347");
    // DELIVERED EXPECTATION UPDATE (GH-347 review m2; AC-F7-3, F-7, DM-6): the
    // delivered assertion pinned the literal "main-tools", which proved the
    // constant rather than the resolution. The value is the resolved base branch
    // (its delivered default), and the case below proves it FOLLOWS a
    // non-default resolution. The assertion is updated, never deleted.
    expect(prompt).toContain(CLOSEOUT_INTEGRATION_BASE);
    for (const title of Object.values(DISPATCH_LIFECYCLE_SECTION_TITLES)) {
      expect(prompt).toContain(`## ${title}`);
    }
    // Not the delivered constant sentence.
    expect(prompt.trim()).not.toBe("Deliver change GH-347 through the delivery lifecycle.");
  });

  test("a non-default resolved base branch reaches the prompt", async () => {
    const observation = await spawnFreshObservation({ baseBranch: "release/2" });
    const prompt = observation.invocations.find((entry) => entry.stdin !== undefined)?.stdin ?? "";
    expect(prompt).toContain("release/2");
    expect(prompt).not.toContain(CLOSEOUT_INTEGRATION_BASE);
    for (const title of Object.values(DISPATCH_LIFECYCLE_SECTION_TITLES)) {
      expect(prompt).toContain(`## ${title}`);
    }
  });

  test("two refs produce different prompts", async () => {
    const a = await spawnFreshObservation({ ref: "GH-347" });
    const b = await spawnFreshObservation({ ref: "PDEV-12" });
    const promptOf = (observation: typeof a) =>
      observation.invocations.find((entry) => entry.stdin !== undefined)?.stdin ?? "";
    expect(promptOf(a)).not.toBe(promptOf(b));
  });

  test("a resume uses the operator text verbatim", async () => {
    const resumePrompts: string[] = [];
    const base = createCommandScenario({ label: "spawn-003-text-base" });
    try {
      // A recording session port: spawn/resume behave as the scripted port, and
      // the resume prompt is captured as data.
      const recording = {
        ...base.scripted.port,
        resume: async (input: Parameters<typeof base.scripted.port.resume>[0]) => {
          resumePrompts.push(input.prompt);
          return { ok: true, value: input.handle } as const;
        },
      };
      const scenario = createCommandScenario({
        label: "spawn-003-text",
        harnessPort: recording,
        lane: { adapterSupportsResumeInjection: true, restartCount: 0 },
      });
      try {
        await scenario.invoke(["dispatch", "GH-301", "--resume-prompt", "operator text", "--json"]);
        expect(resumePrompts).toEqual(["operator text"]);
      } finally {
        scenario.dispose();
      }
    } finally {
      base.dispose();
    }
  });
});

describe("TC-SPAWN-004 role-less stays role-less; agent and title are not operator overrides", () => {
  test("a role-less composition records no binding and renders no agent or title", async () => {
    const scenario = createCommandScenario({ label: "spawn-004-roleless" });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(0);
      const read = readDispatchAttempts(scenario.state.store);
      if (!read.ok) throw new Error("attempt read failed");
      expect(read.records).toHaveLength(1);
      expect(read.records[0]?.binding).toBeUndefined();
      expect(scenario.scripted.spawnInputs[0]?.agent).toBeUndefined();
      expect(scenario.scripted.spawnInputs[0]?.title).toBeUndefined();
    } finally {
      scenario.dispose();
    }
  });

  test("the shipped CLI rejects --agent and --title as unknown options", async () => {
    const scenario = createCommandScenario({ label: "spawn-004-grammar" });
    try {
      const run = await scenario.invoke([
        "dispatch",
        "GH-301",
        "--agent",
        "reviewer",
        "--title",
        "custom",
        "--json",
      ]);
      expect(run.exit).toBe(1);
      expect(scenario.scripted.calls).toHaveLength(0);
      expect(run.stderr.length + run.stdout.length).toBeGreaterThan(0);
    } finally {
      scenario.dispose();
    }
  });
});
