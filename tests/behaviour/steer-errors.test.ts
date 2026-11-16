/**
 * TC-STEER-070/071/072 — the classified error matrix: `steer.unknown-id` is
 * scoped to complete, any positional on read is `fallback.invocation`, and every
 * store failure withholds the command at exit 2 with no partial result.
 */
import { describe, expect, test } from "bun:test";
import { CREATED, makeAppliedOutcome, makeMessage } from "../fixtures/steer/cases";
import { createSteerHarness, type SteerStoreMode } from "../fixtures/steer/harness";
import { NO_PHASE_RECORD } from "../fixtures/steer/phase-boundary";

const errorOf = (run: { readonly envelope?: Record<string, unknown> }): Record<string, unknown> => {
  const error = run.envelope?.error;
  if (typeof error !== "object" || error === null) throw new Error("no error payload");
  return error as Record<string, unknown>;
};

const seeded = (): ReturnType<typeof createSteerHarness> => {
  const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
  const landed = makeMessage({ id: "msg-landed", created: CREATED });
  harness.seedMessage(landed);
  harness.seedOutcome(makeAppliedOutcome(landed));
  return harness;
};

describe("TC-STEER-070 an unknown completion id is steer.unknown-id", () => {
  test("unknown, foreign, and empty ids are classified refusals with zero writes", async () => {
    const harness = seeded();
    const foreign = createSteerHarness();
    try {
      foreign.seedMessage(makeMessage({ id: "msg-foreign", created: CREATED }));
      const before = harness.ledgerBytes();
      for (const id of ["msg-doesnotexist"]) {
        const run = await harness.run(["complete", id, "--ref", "doc/proof.md"]);
        expect(run.exitCode).toBe(1);
        expect(errorOf(run).code).toBe("steer.unknown-id");
        expect(errorOf(run).category).toBe("user");
        expect(errorOf(run).consequence).toBe("not_landed");
      }
      const foreignRun = await harness.run(["complete", "msg-foreign", "--ref", "doc/proof.md"]);
      expect(foreignRun.exitCode).toBe(1);
      expect(errorOf(foreignRun).code).toBe("steer.unknown-id");
      const empty = await harness.run(["complete", "", "--ref", "doc/proof.md"]);
      expect(empty.exitCode).toBe(1);
      expect(errorOf(empty).code).toBe("input.value.rejected");
      expect(harness.ledgerBytes().equals(before)).toBe(true);
      const control = await harness.run(["complete", "msg-landed", "--ref", "doc/proof.md"]);
      expect(control.exitCode).toBe(0);
    } finally {
      harness.cleanup();
      foreign.cleanup();
    }
  });
});

describe("TC-STEER-071 steer read <id> is the declared grammar refusal", () => {
  test("any positional on read is fallback.invocation, never a steer.* identity", async () => {
    const harness = seeded();
    try {
      for (const argv of [
        ["read", "msg-landed"],
        ["read", "msg-unknown"],
        ["read", "a", "b"],
        ["read", "--kind", "request"],
      ]) {
        const run = await harness.run(argv);
        expect(run.exitCode, argv.join(" ")).toBe(1);
        const error = errorOf(run);
        expect(error.code).toBe("fallback.invocation");
        expect([
          "steer.unknown-id",
          "steer.credential-value-rejected",
          "steer.queue-unavailable",
        ]).not.toContain(error.code);
      }
      const plain = await harness.run(["read"]);
      expect(plain.exitCode).toBe(0);
      expect(harness.recorder.calls.filter((call) => call === "append")).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-STEER-072 store failures withhold the family as steer.queue-unavailable", () => {
  const modes: readonly SteerStoreMode[] = ["unreadable", "corrupt"];
  for (const mode of modes) {
    test(`${mode} withholds every subcommand at exit 2 with no partial payload`, async () => {
      for (const argv of [
        ["send", "a note"],
        ["list"],
        ["read"],
        ["complete", "msg-1", "--ref", "doc/proof.md"],
      ]) {
        const harness = createSteerHarness({ storeMode: mode });
        try {
          const run = await harness.run(argv);
          expect(run.exitCode, `${mode}:${argv.join(" ")}`).toBe(2);
          expect(errorOf(run).code).toBe("steer.queue-unavailable");
          expect(errorOf(run).category).toBe("platform");
          expect(run.envelope?.data).toBeUndefined();
        } finally {
          harness.cleanup();
        }
      }
    });
  }

  for (const mode of ["unwritable", "unverified"] as const) {
    test(`${mode} withholds the writing subcommands while a readable list still answers`, async () => {
      for (const argv of [
        ["send", "a note"],
        ["read"],
        ["complete", "msg-landed", "--ref", "doc/proof.md"],
      ]) {
        const wrapped = createSteerHarness({ storeMode: mode, phase: NO_PHASE_RECORD });
        try {
          const landed = makeMessage({ id: "msg-landed", created: CREATED });
          wrapped.seedMessage(landed);
          wrapped.seedOutcome(makeAppliedOutcome(landed));
          wrapped.seedMessage(makeMessage({ id: "msg-due", created: CREATED }));
          const run = await wrapped.run(argv);
          expect(run.exitCode, `${mode}:${argv.join(" ")}`).toBe(2);
          expect(errorOf(run).code).toBe("steer.queue-unavailable");
          expect(run.envelope?.data).toBeUndefined();
        } finally {
          wrapped.cleanup();
        }
      }
      const readable = createSteerHarness({ storeMode: mode, phase: NO_PHASE_RECORD });
      try {
        readable.seedMessage(makeMessage({ id: "msg-read", created: CREATED }));
        const list = await readable.run(["list"]);
        expect(list.exitCode).toBe(0);
      } finally {
        readable.cleanup();
      }
    });
  }

  test("the unverified append is never reported as landed", async () => {
    const harness = createSteerHarness({ storeMode: "unverified", phase: NO_PHASE_RECORD });
    try {
      harness.seedMessage(makeMessage({ id: "msg-due", created: CREATED }));
      const run = await harness.run(["read"]);
      expect(run.exitCode).toBe(2);
      expect(errorOf(run).code).toBe("steer.queue-unavailable");
      expect(run.envelope?.data).toBeUndefined();
    } finally {
      harness.cleanup();
    }
  });

  test("the healthy twins answer at exit 0 in the same matrix", async () => {
    const harness = seeded();
    try {
      for (const argv of [["list"], ["read"]]) {
        expect((await harness.run(argv)).exitCode, argv.join(" ")).toBe(0);
      }
    } finally {
      harness.cleanup();
    }
  });
});
