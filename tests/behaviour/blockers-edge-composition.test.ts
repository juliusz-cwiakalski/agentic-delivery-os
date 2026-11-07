/**
 * GH-230 F-3 — the production blockers composition seam.
 *
 * `createBlockersCommandRuntime` is the only place the caller-audience
 * environment fact, the shipped delegation policy, the real state ledger, and
 * the production id/fence factories meet. These tests call that seam directly
 * (and through `createConfigProgram`) rather than a hand-built runtime, so a
 * regression in the wiring fails here instead of passing every handler suite.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import {
  type BlockersCommandRuntime,
  createBlockersCommandDefinition,
} from "../../packages/cli/src/commands/blockers";
import {
  type BlockersComposition,
  createBlockersCommandRuntime,
  createConfigProgram,
} from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import type { BlockerDelegationPolicy } from "../../packages/core/src/contracts/index";
import { callerAudienceVariableName } from "../../packages/core/src/domain/blockers";
import { readBlockerLedger } from "../../packages/core/src/state/index";
import {
  ledgerPath,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
} from "../fixtures/state/harness";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";

const NOW_ISO = "2026-11-06T12:00:00Z";
const NOW_MS = Date.parse(NOW_ISO);
const CALLER_AUDIENCE_VARIABLE = callerAudienceVariableName(SYNTHETIC_BRAND);

type EdgeRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope?: Record<string, unknown>;
  readonly data?: Record<string, unknown>;
};

type EdgeFixture = {
  readonly root: string;
  readonly identity: ReturnType<typeof makeIdentity>;
  readonly store: ReturnType<typeof openStore>["store"];
  readonly fenceTokens: string[];
  readonly runtime: BlockersCommandRuntime;
  readonly run: (
    argv: readonly string[],
    options?: { readonly json?: boolean },
  ) => Promise<EdgeRun>;
  readonly cleanup: () => void;
};

type FixtureOptions = {
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly secrets?: readonly string[];
  readonly delegationPolicy?: BlockerDelegationPolicy;
  readonly newQuestionSuffix?: () => string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const runThrough = async (
  definition: ReturnType<typeof createBlockersCommandDefinition>,
  secrets: readonly string[],
  argv: readonly string[],
  options: { readonly json?: boolean } = {},
): Promise<EdgeRun> => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  let tick = 0;
  const deps: CliDependencies = {
    brand: SYNTHETIC_BRAND,
    clock: {
      now: () => {
        tick += 1;
        return tick === 1 ? 100 : 110;
      },
    },
    newRunId: () => "run-blockers-edge",
    secrets,
    program: { commands: { blockers: definition } },
  };
  const finalArgv =
    options.json === false ? ["blockers", ...argv] : ["--json", "blockers", ...argv];
  const exitCode = await runCli(finalArgv, { stdout, stderr }, deps);
  const trimmed = stdout.value.trim();
  const envelope = trimmed.startsWith("{")
    ? (JSON.parse(trimmed) as Record<string, unknown>)
    : undefined;
  const data = envelope?.data;
  return {
    exitCode,
    stdout: stdout.value,
    stderr: stderr.value,
    ...(envelope === undefined ? {} : { envelope }),
    ...(typeof data === "object" && data !== null && !Array.isArray(data)
      ? { data: data as Record<string, unknown> }
      : {}),
  };
};

const makeFixture = (options: FixtureOptions = {}): EdgeFixture => {
  const root = makeTempRoot("gh230-blockers-edge");
  const identity = makeIdentity(root, { workspaceId: "gh230-blockers-edge" });
  const store = openStore(identity).store;
  const fenceTokens: string[] = [];
  let fenceCounter = 0;
  const composition: BlockersComposition = {
    store,
    clock: { nowMs: () => NOW_MS, nowIso: () => NOW_ISO },
    ...(options.newQuestionSuffix === undefined
      ? {}
      : { newQuestionSuffix: options.newQuestionSuffix }),
    newFenceToken: () => {
      fenceCounter += 1;
      const token = `edge-fence-${fenceCounter}`;
      fenceTokens.push(token);
      return token;
    },
    ...(options.delegationPolicy === undefined
      ? {}
      : { delegationPolicy: options.delegationPolicy }),
  };
  const secrets = options.secrets ?? [];
  const runtime = createBlockersCommandRuntime(
    composition,
    SYNTHETIC_BRAND,
    secrets,
    options.environment ?? {},
  );
  const definition = createBlockersCommandDefinition(runtime);
  return {
    root,
    identity,
    store,
    fenceTokens,
    runtime,
    run: (argv, runOptions = {}) => runThrough(definition, secrets, argv, runOptions),
    cleanup: () => removeRoot(root),
  };
};

const PUBLISH_OWNER = [
  "publish",
  "spec-ambiguity",
  "--lane",
  "L2",
  "--audience",
  "owner",
  "owner-only question",
] as const;

describe("GH-230 F-3 production blockers composition", () => {
  test("the brand-named environment fact resolves a coordinator caller", async () => {
    const fixture = makeFixture({
      environment: { [CALLER_AUDIENCE_VARIABLE]: "coordinator" },
      newQuestionSuffix: () => "edge-1",
    });
    try {
      const published = await fixture.run([
        "publish",
        "decision-needed",
        "--lane",
        "L5",
        "--options",
        "full,lite",
        "pick a mode",
      ]);
      expect(published.exitCode).toBe(0);
      const answered = await fixture.run(["answer", "q-edge-1", "--choice", "1"]);
      expect(answered.exitCode).toBe(0);
      expect(answered.data).toMatchObject({ answered: "q-edge-1", audience: "coordinator" });
    } finally {
      fixture.cleanup();
    }
  });

  test("an absent caller-audience fact defaults the answering audience to owner", async () => {
    const fixture = makeFixture({ newQuestionSuffix: () => "edge-2" });
    try {
      expect((await fixture.run([...PUBLISH_OWNER])).exitCode).toBe(0);
      const answered = await fixture.run(["answer", "q-edge-2", "--text", "owner says yes"]);
      expect(answered.exitCode).toBe(0);
      expect(answered.data).toMatchObject({ answered: "q-edge-2", audience: "owner" });
    } finally {
      fixture.cleanup();
    }
  });

  test("an unrecognized caller-audience fact defaults the answering audience to owner", async () => {
    const fixture = makeFixture({
      environment: { [CALLER_AUDIENCE_VARIABLE]: "root" },
      newQuestionSuffix: () => "edge-3",
    });
    try {
      expect((await fixture.run([...PUBLISH_OWNER])).exitCode).toBe(0);
      const answered = await fixture.run(["answer", "q-edge-3", "--text", "owner says yes"]);
      expect(answered.exitCode).toBe(0);
      expect(answered.data).toMatchObject({ answered: "q-edge-3", audience: "owner" });
    } finally {
      fixture.cleanup();
    }
  });

  test("the shipped delegation policy refuses a coordinator answering an owner question", async () => {
    const fixture = makeFixture({
      environment: { [CALLER_AUDIENCE_VARIABLE]: "coordinator" },
      newQuestionSuffix: () => "edge-4",
    });
    try {
      expect((await fixture.run([...PUBLISH_OWNER])).exitCode).toBe(0);
      const before = fixture.store.readRecords();
      const answered = await fixture.run(["answer", "q-edge-4", "--text", "delegated"]);
      expect(answered.exitCode).toBe(1);
      expect(answered.envelope?.error).toMatchObject({
        code: "blockers.audience-mismatch",
        category: "user",
        consequence: "not_landed",
      });
      const error = answered.envelope?.error;
      if (!isRecord(error)) throw new Error("the refusal must carry an error envelope");
      expect(String(error.summary)).toContain("delegation policy: none");
      const after = fixture.store.readRecords();
      expect(after.ok).toBe(true);
      if (before.ok && after.ok) {
        expect(after.value.records.length).toBe(before.value.records.length);
      }
    } finally {
      fixture.cleanup();
    }
  });

  test("one publish and one answer land on the real fenced ledger with +1 coverage", async () => {
    const fixture = makeFixture({
      environment: { [CALLER_AUDIENCE_VARIABLE]: "owner" },
      newQuestionSuffix: () => "edge-5",
    });
    try {
      expect((await fixture.run([...PUBLISH_OWNER])).exitCode).toBe(0);
      expect((await fixture.run(["answer", "q-edge-5", "--text", "owner says yes"])).exitCode).toBe(
        0,
      );
      const read = readBlockerLedger(fixture.store);
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.recordCount).toBe(2);
        expect(read.value.questions).toHaveLength(1);
        expect(read.value.answers).toHaveLength(1);
        expect(read.value.answers[0]?.questionId).toBe("q-edge-5");
      }
      expect(fixture.fenceTokens).toHaveLength(2);
      const ledger = readTextOrEmpty(ledgerPath(fixture.identity));
      expect(ledger.split("\n").filter((line) => line !== "")).toHaveLength(2);
    } finally {
      fixture.cleanup();
    }
  });

  test("the default question suffix is a random UUID", async () => {
    const fixture = makeFixture({ environment: { [CALLER_AUDIENCE_VARIABLE]: "owner" } });
    try {
      const published = await fixture.run([...PUBLISH_OWNER]);
      expect(published.exitCode).toBe(0);
      const question = published.data?.question as Record<string, unknown> | undefined;
      expect(String(question?.id)).toMatch(
        /^q-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    } finally {
      fixture.cleanup();
    }
  });

  test("refusals and state faults keep their classified routing through the composition", async () => {
    const fixture = makeFixture({ newQuestionSuffix: () => "edge-6" });
    try {
      const unknown = await fixture.run(["answer", "q-missing", "--text", "nothing"]);
      expect(unknown.exitCode).toBe(1);
      expect(unknown.envelope?.error).toMatchObject({ code: "blockers.unknown-id" });

      const malformed = await fixture.run(["list", "--unknown"]);
      expect(malformed.exitCode).toBe(1);
      expect(malformed.envelope?.error).toMatchObject({ code: "fallback.invocation" });

      expect((await fixture.run([...PUBLISH_OWNER])).exitCode).toBe(0);
      const bytes = readBytesOrEmpty(ledgerPath(fixture.identity));
      writeFileSync(ledgerPath(fixture.identity), bytes.subarray(0, bytes.length - 3));

      const torn = await fixture.run(["list"]);
      expect(torn.exitCode).toBe(2);
      expect(torn.envelope?.error).toMatchObject({ code: "state.store.torn" });
      expect(torn.data).toBeUndefined();
    } finally {
      fixture.cleanup();
    }
  });
});

describe("GH-230 F-3 createConfigProgram blockers composition", () => {
  test("the program wires the environment fact and the real store into blockers", async () => {
    const root = makeTempRoot("gh230-blockers-config-edge");
    const identity = makeIdentity(root, { workspaceId: "gh230-blockers-config-edge" });
    const store = openStore(identity).store;
    let fenceCounter = 0;
    const environment = { [CALLER_AUDIENCE_VARIABLE]: "coordinator" };
    try {
      const program = createConfigProgram({
        workingName: "synthetic",
        environment,
        cwd: "/repo",
        homeDirectory: "/home/synthetic",
        platform: "linux",
        fs: {
          exists: () => false,
          readText: () => {
            throw new Error("no file config is expected");
          },
        },
        repositoryIo: { exists: () => false, isFile: () => false, readText: () => "" },
        resolveBrand: () => ({ ok: true, value: SYNTHETIC_BRAND }),
        blockers: {
          store,
          clock: { nowMs: () => NOW_MS, nowIso: () => NOW_ISO },
          newQuestionSuffix: () => "config-1",
          newFenceToken: () => `config-fence-${++fenceCounter}`,
        },
      });
      expect(program.ok).toBe(true);
      if (!program.ok) return;

      const definition = program.program.commands.blockers;
      expect(definition).toBeDefined();
      if (definition === undefined) return;

      const published = await runThrough(definition, program.secrets, [
        "publish",
        "spec-ambiguity",
        "--lane",
        "L2",
        "composed question",
      ]);
      expect(published.exitCode).toBe(0);
      const answered = await runThrough(definition, program.secrets, [
        "answer",
        "q-config-1",
        "--text",
        "composed answer",
      ]);
      expect(answered.exitCode).toBe(0);
      expect(answered.data).toMatchObject({ answered: "q-config-1", audience: "coordinator" });

      const read = readBlockerLedger(store);
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value.recordCount).toBe(2);
    } finally {
      removeRoot(root);
    }
  });
});

const readBytesOrEmpty = (path: string): Buffer => {
  try {
    return readFileSync(path);
  } catch {
    return Buffer.alloc(0);
  }
};

const readTextOrEmpty = (path: string): string => readBytesOrEmpty(path).toString("utf8");
