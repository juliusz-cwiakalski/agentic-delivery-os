/**
 * GH-416 — the `push <ref>` command's grammar, answer, ordering, and bounds
 * (TC-LCMD-001, TC-LCMD-002, TC-LBND-001, TC-LBND-002).
 *
 * Every case drives the composed production program over injected seams: the
 * scripted push runner is the transport, the git runner answers the branch and
 * checkout reads, and the store is the delivered temporary state store. No real
 * child process starts for the act and no network is touched.
 */
import { describe, expect, test } from "bun:test";
import type { GitPushRunnerResult } from "../../packages/adapters/src/git/index";
import type { StateStorePort } from "../../packages/core/src/contracts/index";
import {
  createParityHarness,
  type ParityHarness,
  type ParityObservation,
  readableParityTransport,
} from "../fixtures/dispatch/parity/harness";
import { createGuardedRunner } from "../fixtures/dispatch/parity/process-runner";

const REF = "GH-347";
const BRANCH = "feat/GH-347/parity";
const HEAD = "0123456789abcdef0123456789abcdef01234567";

const accepted = (): GitPushRunnerResult => ({
  stdout: "",
  stderr: "",
  status: 0,
  timedOut: false,
});
const rejected = (stderr: string): GitPushRunnerResult => ({
  stdout: "",
  stderr,
  status: 1,
  timedOut: false,
});

type PushRun = {
  readonly exit: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly data: Record<string, unknown> | undefined;
  readonly errorCode: string | undefined;
  readonly observation: ParityObservation;
  readonly lanePushRecords: readonly unknown[];
  readonly pushInvocations: readonly (readonly string[])[];
  readonly gitVerbs: readonly string[];
};

const runPush = async (input: {
  readonly argv?: readonly string[];
  readonly push?: () => GitPushRunnerResult;
  readonly pmNotesBranch?: string;
  readonly storeWrap?: (store: StateStorePort) => StateStorePort;
  readonly order?: string[];
}): Promise<PushRun> => {
  const guarded = createGuardedRunner({
    head: HEAD,
    ...(input.push === undefined
      ? {}
      : {
          push: () => {
            input.order?.push("act");
            return (input.push as () => GitPushRunnerResult)();
          },
        }),
  });
  const harness: ParityHarness = createParityHarness({
    label: "lane-push-command",
    localHead: HEAD,
    guarded,
    transport: readableParityTransport(),
    ...(input.pmNotesBranch === undefined ? {} : { pmNotesBranch: input.pmNotesBranch }),
    ...(input.storeWrap === undefined ? {} : { storeWrap: input.storeWrap }),
  });
  try {
    const run = await harness.run(input.argv ?? ["push", REF, "--json"]);
    const records = harness.store.readRecords();
    const lanePushRecords =
      records.ok === true
        ? records.value.records.filter((record) => record.kind === "dispatch.lane-push")
        : [];
    return {
      exit: run.exit,
      stdout: run.stdout,
      stderr: run.stderr,
      data: run.envelope?.data as Record<string, unknown> | undefined,
      errorCode: (run.envelope?.error as { readonly code?: string } | undefined)?.code,
      observation: harness.observe(),
      lanePushRecords,
      pushInvocations: harness.guarded.records
        .filter((record) => record.seam === "push")
        .map((record) => record.args),
      gitVerbs: harness.guarded.records
        .filter((record) => record.seam === "git")
        .map((record) => record.args[0] ?? ""),
    };
  } finally {
    harness.dispose();
  }
};

const lanePushOf = (data: Record<string, unknown> | undefined): Record<string, unknown> => {
  const lanePush = data?.lanePush;
  if (typeof lanePush !== "object" || lanePush === null) return {};
  return lanePush as Record<string, unknown>;
};

describe("GH-416 TC-LCMD-001 the push answer and exits", () => {
  test("an accepted act answers pushed with the declared members and exit 0", async () => {
    const run = await runPush({ push: accepted });
    expect(run.exit).toBe(0);
    expect(run.data?.ref).toBe(REF);
    expect(typeof run.data?.repository).toBe("string");
    const lanePush = lanePushOf(run.data);
    expect(lanePush).toEqual({
      verdict: "pushed",
      branch: BRANCH,
      head: HEAD,
      recorded: true,
      recordedAt: expect.any(String),
    });
    expect(lanePush.cause).toBeUndefined();
  });

  test("exactly one push invocation carries the delivered argv shape", async () => {
    const run = await runPush({ push: accepted });
    expect(run.pushInvocations).toHaveLength(1);
    expect(run.pushInvocations[0]).toEqual(["push", "--ff-only", `HEAD:refs/heads/${BRANCH}`]);
    expect(run.observation.violations).toEqual([]);
  });

  test("a refused act is a data-bearing answer at exit 1 with no error identity", async () => {
    const run = await runPush({ push: () => rejected("! [rejected] (non-fast-forward)") });
    expect(run.exit).toBe(1);
    expect(run.errorCode).toBeUndefined();
    const lanePush = lanePushOf(run.data);
    expect(lanePush.verdict).toBe("failed");
    expect(lanePush.cause).toBe("non-fast-forward");
    expect(lanePush.recorded).toBe(true);
  });

  test("the human form is one bounded key=value block in the declared order", async () => {
    const run = await runPush({ push: accepted, argv: ["push", REF] });
    expect(run.exit).toBe(0);
    const lines = run.stdout.trimEnd().split("\n");
    expect(lines[0]).toBe(`ref=${REF}`);
    expect(lines[1]?.startsWith("repository=")).toBe(true);
    expect(lines[1]?.length).toBeGreaterThan("repository=".length);
    expect(lines.slice(2, 5)).toEqual(["lanePush=pushed", `branch=${BRANCH}`, `head=${HEAD}`]);
    expect(lines[5]).toBe("recorded=true");
    expect(lines).toHaveLength(7);
    expect(lines[6]?.startsWith("recordedAt=")).toBe(true);
    expect(lines.join("\n")).not.toContain("cause=");
  });

  test("grammar refusals are input refusals before any act or append", async () => {
    const missing = await runPush({ argv: ["push", "--json"] });
    expect(missing.exit).toBe(1);
    expect(missing.errorCode).toBe("input.value.rejected");
    expect(missing.pushInvocations).toHaveLength(0);
    expect(missing.lanePushRecords).toHaveLength(0);

    const malformed = await runPush({ argv: ["push", "gh-347", "--json"] });
    expect(malformed.exit).toBe(1);
    expect(malformed.errorCode).toBe("input.value.rejected");
    expect(malformed.pushInvocations).toHaveLength(0);

    const undeclared = await runPush({ argv: ["push", REF, "--nope", "--json"] });
    expect(undeclared.exit).toBe(1);
    expect(undeclared.errorCode).toBe("fallback.invocation");
    expect(undeclared.pushInvocations).toHaveLength(0);
  });
});

describe("GH-416 TC-LCMD-002 act first, append second", () => {
  const failingAppend = (store: StateStorePort): StateStorePort => ({
    ...store,
    append: (_handle, request) =>
      request.kind === "dispatch.lane-push"
        ? {
            ok: false as const,
            error: {
              kind: "state" as const,
              code: "state.write.failed" as const,
              consequence: "not_landed" as const,
              location: { path: "dispatch.lane-pushes" },
            },
          }
        : store.append(_handle, request),
  });

  test("a failed append discloses recorded: false with one act and no record", async () => {
    const run = await runPush({ push: accepted, storeWrap: failingAppend });
    expect(run.exit).toBe(0);
    const lanePush = lanePushOf(run.data);
    expect(lanePush.verdict).toBe("pushed");
    expect(lanePush.recorded).toBe(false);
    expect(lanePush.recordedAt).toBeUndefined();
    expect(lanePush.branch).toBe(BRANCH);
    expect(lanePush.head).toBe(HEAD);
    expect(run.pushInvocations).toHaveLength(1);
    expect(run.lanePushRecords).toHaveLength(0);
  });

  test("the append is observed after the act", async () => {
    const order: string[] = [];
    const recordingAppend = (store: StateStorePort): StateStorePort => ({
      ...store,
      append: (handle, request) => {
        if (request.kind === "dispatch.lane-push") order.push("append");
        return store.append(handle, request);
      },
    });
    const run = await runPush({ push: accepted, storeWrap: recordingAppend, order });
    expect(run.exit).toBe(0);
    expect(order).toEqual(["act", "append"]);
  });

  test("a re-invocation performs another act and appends another record", async () => {
    const guarded = createGuardedRunner({ head: HEAD, push: accepted });
    const harness = createParityHarness({
      label: "lane-push-reinvoke",
      localHead: HEAD,
      guarded,
      transport: readableParityTransport(),
    });
    try {
      const first = await harness.run(["push", REF, "--json"]);
      expect(first.exit).toBe(0);
      harness.clock.advanceMs(1000);
      const second = await harness.run(["push", REF, "--json"]);
      expect(second.exit).toBe(0);
      expect(second.envelope?.error).toBeUndefined();
      const records = harness.store.readRecords();
      const lanePush =
        records.ok === true
          ? records.value.records.filter((record) => record.kind === "dispatch.lane-push")
          : [];
      // Append-only, latest wins: two invocations, two records.
      expect(lanePush).toHaveLength(2);
      expect(guarded.pushes).toBe(2);
    } finally {
      harness.dispose();
    }
  });
});

describe("GH-416 TC-LBND-001 the act is bounded and non-shell", () => {
  test("one child per invocation, the fixed argv, the 60 000 ms default, no shell", async () => {
    const guarded = createGuardedRunner({ head: HEAD, push: accepted });
    const harness = createParityHarness({
      label: "lane-push-bounds",
      localHead: HEAD,
      guarded,
      transport: readableParityTransport(),
    });
    try {
      const run = await harness.run(["push", REF, "--json"]);
      expect(run.exit).toBe(0);
      const pushRecords = harness.guarded.records.filter((record) => record.seam === "push");
      expect(pushRecords).toHaveLength(1);
      expect(pushRecords[0]?.args).toEqual(["push", "--ff-only", `HEAD:refs/heads/${BRANCH}`]);
      expect(pushRecords[0]?.timeout).toBe(60_000);
      expect(harness.guarded.violations).toEqual([]);
      expect(harness.guarded.realChildStarts).toBe(0);
    } finally {
      harness.dispose();
    }
  });

  test("a pre-act refusal starts no child", async () => {
    const guarded = createGuardedRunner({
      head: HEAD,
      git: ({ args }) => {
        const [verb, sub] = args;
        if (verb === "for-each-ref") {
          return { stdout: "", stderr: "", status: 0, timedOut: false };
        }
        if (verb === "rev-parse" && sub === "--abbrev-ref") {
          return { stdout: `${BRANCH}\n`, stderr: "", status: 0, timedOut: false };
        }
        if (verb === "rev-parse") {
          return { stdout: `${HEAD}\n`, stderr: "", status: 0, timedOut: false };
        }
        return { stdout: "", stderr: "unexpected", status: 1, timedOut: false };
      },
      push: accepted,
    });
    const harness = createParityHarness({
      label: "lane-push-pre-act",
      localHead: HEAD,
      guarded,
      transport: readableParityTransport(),
    });
    try {
      const run = await harness.run(["push", REF, "--json"]);
      expect(run.exit).toBe(1);
      expect(harness.guarded.pushes).toBe(0);
    } finally {
      harness.dispose();
    }
  });
});

describe("GH-416 TC-LBND-002 the per-invocation cost bound", () => {
  test("one branch read, one checkout read, one push, one append per invocation", async () => {
    const run = await runPush({ push: accepted });
    expect(run.pushInvocations).toHaveLength(1);
    expect(run.gitVerbs.filter((verb) => verb === "for-each-ref")).toHaveLength(1);
    expect(run.gitVerbs.filter((verb) => verb === "rev-parse")).toHaveLength(2);
    expect(run.lanePushRecords).toHaveLength(1);
  });

  test("re-invocation repeats every part once more with no lane-push read on the write path", async () => {
    const guarded = createGuardedRunner({ head: HEAD, push: accepted });
    const harness = createParityHarness({
      label: "lane-push-cost",
      localHead: HEAD,
      guarded,
      transport: readableParityTransport(),
    });
    try {
      await harness.run(["push", REF, "--json"]);
      harness.clock.advanceMs(1000);
      await harness.run(["push", REF, "--json"]);
      const gitRecords = harness.guarded.records.filter((record) => record.seam === "git");
      expect(gitRecords.filter((record) => record.args[0] === "for-each-ref")).toHaveLength(2);
      expect(gitRecords.filter((record) => record.args[0] === "rev-parse")).toHaveLength(4);
      expect(guarded.pushes).toBe(2);
      const records = harness.store.readRecords();
      const lanePush =
        records.ok === true
          ? records.value.records.filter((record) => record.kind === "dispatch.lane-push")
          : [];
      expect(lanePush).toHaveLength(2);
    } finally {
      harness.dispose();
    }
  });
});
