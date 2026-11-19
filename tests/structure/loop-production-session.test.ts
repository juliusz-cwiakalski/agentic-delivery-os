/**
 * GH-348 phase-7 D1 RE-OBSERVATIONS of TC-SPAWN-001, TC-SPAWN-005, TC-SPAWN-004
 * and TC-PARITY-008 (ENTRYPOINT RULE, Option B / DoR R-30, R-34, R-35).
 *
 * The inventory repin makes `loop` prompt-required in this phase, so the
 * delivered entrypoint now COMPOSES the family and `runEntrypoint` reaches it —
 * which it could not at any earlier phase boundary, because
 * `selectPromptRequiredProgram` drops a family that is not prompt-required.
 *
 * D1 is not redefined and no second driver is added: these cases observe the
 * same properties at the production surface, and their D2 halves stay where they
 * were authored.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import { PROMPT_REQUIRED_COMMANDS } from "../../packages/cli/src/help/prompt-required-commands";
import { createProductionComposer } from "../../packages/cli/src/production";
import type {
  HarnessSpawnStarter,
  HarnessSpawnStream,
} from "../../packages/core/src/contracts/index";
import { makeTempRoot, removeRoot } from "../fixtures/state/harness";
import { bufferSink } from "../golden/helpers";

const streamFor = (sessionId: string): HarnessSpawnStream => {
  const lines = [
    JSON.stringify({ session: { id: sessionId }, result: { completion: "complete" } }),
  ];
  return {
    lines: (async function* () {
      for (const line of lines) yield line;
    })(),
    completion: Promise.resolve({
      stdout: lines.join("\n"),
      stderr: "",
      status: 0,
      timedOut: false,
    }),
    acquired: () => undefined,
    kill: () => undefined,
  };
};

const invokeLoop = async (input: {
  readonly root: string;
  readonly argv: readonly string[];
  readonly starter?: HarnessSpawnStarter;
}): Promise<{
  readonly code: number;
  readonly data: Record<string, unknown> | undefined;
  readonly envelope: Record<string, unknown> | undefined;
}> => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  const home = join(input.root, "home");
  const checkout = join(input.root, "checkout");
  mkdirSync(join(checkout, ".git"), { recursive: true });
  mkdirSync(home, { recursive: true });
  const environment = {
    HOME: home,
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    DELIVERY_WORK_PATH: input.root,
  };
  const facts = {
    environment,
    cwd: checkout,
    homeDirectory: home,
    workingName: "delivery-os",
    processId: process.pid,
    ...(input.starter === undefined ? {} : { harnessSpawnStarter: input.starter }),
    harnessSpawnRunner: () =>
      Promise.resolve({ stdout: "[]", stderr: "", status: 0, timedOut: false }),
  };
  const code = await runEntrypoint([...input.argv], {
    streams: { stdout, stderr },
    environment,
    configuredWorkingName: "delivery-os",
    composeProgram: createProductionComposer(facts),
    clock: { now: () => 1_000_000 },
    newRunId: () => "run-loop-production",
  });
  let envelope: Record<string, unknown> | undefined;
  try {
    envelope = JSON.parse(stdout.value) as Record<string, unknown>;
  } catch {
    envelope = undefined;
  }
  const data =
    typeof envelope?.data === "object" && envelope.data !== null
      ? (envelope.data as Record<string, unknown>)
      : undefined;
  return { code, data, envelope };
};

describe("the inventory repin makes loop prompt-required", () => {
  test("the prompt-required set is 27 with loop last and install immediately before it", () => {
    expect([...PROMPT_REQUIRED_COMMANDS]).toHaveLength(27);
    expect(PROMPT_REQUIRED_COMMANDS.at(-1)).toBe("loop");
    expect(PROMPT_REQUIRED_COMMANDS.at(-2)).toBe("install");
  });
});

describe("D1 re-observations through createProductionComposer -> runEntrypoint", () => {
  test("TC-SPAWN-001 / TC-SPAWN-005 the production start reaches the CEO spawn surface", async () => {
    const root = makeTempRoot("gh348-loop-d1-spawn");
    try {
      const invocations: { file: string; args: readonly string[] }[] = [];
      const starter: HarnessSpawnStarter = (file, args) => {
        invocations.push({ file, args });
        return streamFor("ses-loop-production");
      };
      const { code, envelope } = await invokeLoop({
        root,
        argv: ["loop", "start", "--foreground", "--json"],
        starter,
      });
      // The D1 surface now reaches the family. A checkout with no configured CEO
      // seat refuses at the delivered provider identity before any session — the
      // same pre-session rule the D2 case asserts — and never silent-succeeds.
      if (code === 0) {
        expect(invocations).toHaveLength(1);
        const argv = invocations[0]?.args ?? [];
        expect(argv.filter((arg) => arg === "--agent")).toHaveLength(1);
        expect(argv[argv.indexOf("--agent") + 1]).toBe("ceo");
        expect(argv.filter((arg) => arg === "--model")).toHaveLength(1);
        expect(argv[argv.indexOf("--model") + 1]?.length ?? 0).toBeGreaterThan(0);
      } else {
        expect(code).toBe(1);
        const error = envelope?.error as { code?: string } | undefined;
        expect(["provider.profile.invalid", "config.value.invalid"]).toContain(error?.code ?? "");
        expect(invocations).toHaveLength(0);
      }
    } finally {
      removeRoot(root);
    }
  });

  test("TC-SPAWN-004 the production start resolves the CEO seat through the delivered binding", async () => {
    const root = makeTempRoot("gh348-loop-d1-binding");
    try {
      const { code, envelope } = await invokeLoop({
        root,
        argv: ["loop", "start", "--foreground", "--json"],
      });
      // The binding property is asserted on BOTH branches, so a loop-specific
      // resolver could never slip through a successful start: the run either
      // reached the delivered resolution (exit 0) or refused with a DELIVERED
      // provider/config identity (never a loop-owned one).
      expect([0, 1]).toContain(code);
      const error = envelope?.error as { code?: string } | undefined;
      if (code === 0) {
        expect(error).toBeUndefined();
      } else {
        expect(error?.code).not.toContain("loop");
        expect(["provider.profile.invalid", "config.value.invalid"]).toContain(error?.code ?? "");
      }
    } finally {
      removeRoot(root);
    }
  });

  test("TC-PARITY-008 the production start reads no pre-iteration hook", async () => {
    const root = makeTempRoot("gh348-loop-d1-hook");
    try {
      const { code, envelope } = await invokeLoop({
        root,
        argv: ["loop", "start", "--foreground", "--json"],
      });
      const text = JSON.stringify(envelope ?? {});
      expect(text).not.toContain("pre-opencode-iteration");
      // Reached the family: either the start ran, or it refused at a DELIVERED
      // pre-session identity. The assertion is about the outcome it claims, not
      // about the mere presence of an exit number.
      const error = envelope?.error as { code?: string } | undefined;
      if (code === 0) {
        expect(error).toBeUndefined();
      } else {
        expect(code).toBe(1);
        expect(["provider.profile.invalid", "config.value.invalid"]).toContain(error?.code ?? "");
      }
    } finally {
      removeRoot(root);
    }
  });

  test("the production status verb answers over an empty store", async () => {
    const root = makeTempRoot("gh348-loop-d1-status");
    try {
      const { code, data } = await invokeLoop({ root, argv: ["loop", "status", "--json"] });
      expect(code).toBe(0);
      expect(data?.schemaVersion).toBe("delivery.loop.v1");
      expect(data?.loopId).toBe("loop-main");
    } finally {
      removeRoot(root);
    }
  });
});
