/**
 * TC-CAP-012 (structure/validation half) / TC-CAP-014 — capsule validation.
 *
 * Every non-candidate damage row is `closeout.capsule-invalid` (user,
 * non-retryable, not_landed, exit 1) with zero writes; plan mode renders the
 * capsule step `would-refuse` and writes nothing; lock contention is the
 * separate retryable `state.lock.busy`.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { closeoutData, errorOf, runCloseoutCli } from "../fixtures/closeout/cli";
import { WORK_ITEM_REF } from "../fixtures/closeout/harness";
import { eventsText, makeChangeTree, makeEvent, payloadFor } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";

const valid = () =>
  eventsText([
    makeEvent(1, "capsule.opened", "closeout", payloadFor("capsule.opened")),
    makeEvent(2, "commit.landed", "commit", payloadFor("commit.landed")),
  ]);

const makeTree = (text: string) =>
  makeChangeTree({
    ref: WORK_ITEM_REF,
    month: "2026-11",
    name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
    files: { "events.jsonl": text },
  });

const damageCases: readonly { readonly name: string; readonly text: () => string }[] = [
  { name: "torn tail", text: () => valid().slice(0, -1) },
  {
    name: "duplicate key",
    text: () =>
      eventsText([
        makeEvent(1, "capsule.opened", "closeout", payloadFor("capsule.opened")),
        makeEvent(2, "commit.landed", "commit", payloadFor("commit.landed"), {
          eventKey: "same-key",
        }),
        makeEvent(3, "commit.landed", "commit", payloadFor("commit.landed"), {
          eventKey: "same-key",
        }),
      ]),
  },
  {
    name: "sequence gap",
    text: () =>
      eventsText([
        makeEvent(1, "capsule.opened", "closeout", payloadFor("capsule.opened")),
        makeEvent(3, "commit.landed", "commit", payloadFor("commit.landed")),
      ]),
  },
  {
    name: "post-close line",
    text: () =>
      `${eventsText([
        makeEvent(1, "capsule.opened", "closeout", payloadFor("capsule.opened")),
        makeEvent(2, "capsule.closed", "closeout", payloadFor("capsule.closed")),
      ])}${eventsText([makeEvent(3, "commit.landed", "commit", payloadFor("commit.landed"))])}`,
  },
  { name: "malformed line", text: () => "not-json\n" },
];

describe("TC-CAP-012/014 capsule validation", () => {
  for (const damage of damageCases) {
    test(`${damage.name} refuses with capsule-invalid and zero writes`, async () => {
      const tree = makeTree(damage.text());
      try {
        const file = join(tree.folder, "events.jsonl");
        const before = readFileSync(file, "utf8");
        const runtime = makeCapsuleRuntime(tree.changes);
        const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
          capsule: runtime,
        });
        expect(run.exitCode).toBe(1);
        const error = errorOf(run.envelope);
        expect(error.code).toBe("closeout.capsule-invalid");
        expect(error.category).toBe("user");
        expect(error.retryable).toBe(false);
        expect(error.consequence).toBe("not_landed");
        expect(readFileSync(file, "utf8")).toBe(before);
        expect(existsSync(join(tree.folder, "candidates"))).toBe(false);
      } finally {
        tree.cleanup();
      }
    });
  }

  test("plan mode renders would-refuse on damage and writes nothing", async () => {
    const tree = makeTree(valid().slice(0, -1));
    try {
      const file = join(tree.folder, "events.jsonl");
      const before = readFileSync(file, "utf8");
      const runtime = makeCapsuleRuntime(tree.changes);
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF], { capsule: runtime });
      expect(run.exitCode).toBe(0);
      const data = closeoutData(run.envelope);
      const step = data.steps.find((entry) => entry.stepId === "capsule");
      expect(step?.outcome).toBe("would-refuse");
      expect(step?.reason).toBe("closeout.capsule-invalid");
      expect(data.capsule).toBeUndefined();
      expect(readFileSync(file, "utf8")).toBe(before);
    } finally {
      tree.cleanup();
    }
  });

  test("lock contention is the retryable state.lock.busy, never capsule-invalid", async () => {
    const tree = makeTree(valid());
    try {
      writeFileSync(join(tree.folder, "events.jsonl.lock"), "held\n");
      const runtime = makeCapsuleRuntime(tree.changes, {
        lock: { sleep: () => undefined, maxAttempts: 2, retryMs: 1 },
      });
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: runtime,
      });
      expect(run.exitCode).toBe(2);
      const error = errorOf(run.envelope);
      expect(error.code).toBe("state.lock.busy");
      expect(error.retryable).toBe(true);
    } finally {
      tree.cleanup();
    }
  });
});

describe("TC-CAP-012 candidate rows", () => {
  test("101 candidates and an oversized candidate are capsule-invalid", async () => {
    const { makeChangeTree } = await import("../fixtures/capsule/harness");
    const { makeCapsuleRuntime } = await import("../fixtures/capsule/producer");
    const { CAPSULE_MAX_CANDIDATES, CAPSULE_MAX_CANDIDATE_BYTES } = await import(
      "../../packages/core/src/contracts/index"
    );
    const files: Record<string, string> = {};
    for (let index = 0; index < CAPSULE_MAX_CANDIDATES + 1; index += 1) {
      files[`candidates/candidate-${index}.yaml`] = "statement: bounded\n";
    }
    const overCount = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
      files,
    });
    try {
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: makeCapsuleRuntime(overCount.changes),
      });
      expect(run.exitCode).toBe(1);
      expect(errorOf(run.envelope).code).toBe("closeout.capsule-invalid");
    } finally {
      overCount.cleanup();
    }
    const oversized = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
      files: { "candidates/big.yaml": "x".repeat(CAPSULE_MAX_CANDIDATE_BYTES + 1) },
    });
    try {
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: makeCapsuleRuntime(oversized.changes),
      });
      expect(run.exitCode).toBe(1);
      expect(errorOf(run.envelope).code).toBe("closeout.capsule-invalid");
    } finally {
      oversized.cleanup();
    }
  });
});

describe("TC-CAP-012 capsule validation completeness", () => {
  const candidateFile = (id: string): string =>
    `id: "${id}"\nclass: "lesson"\nscope: "repo"\nstatement: "Decision check."\nevidence: "test:case"\nbasis: "verified-outcome"\nsource: "test"\ntrust: "T3"\nstatus: "candidate"\ncreated_by: "coder"\ncreated: "2026-11-07"\n`;

  test("a first event other than capsule.opened is capsule-invalid", async () => {
    const tree = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
      files: {
        "events.jsonl": eventsText([
          makeEvent(1, "commit.landed", "commit", payloadFor("commit.landed")),
        ]),
      },
    });
    try {
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: makeCapsuleRuntime(tree.changes),
      });
      expect(run.exitCode).toBe(1);
      expect(errorOf(run.envelope).code).toBe("closeout.capsule-invalid");
    } finally {
      tree.cleanup();
    }
  });

  test("a candidate with zero promotion decisions is capsule-invalid with no promotion", async () => {
    const tree = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
      files: {
        "events.jsonl": eventsText([
          makeEvent(1, "capsule.opened", "closeout", payloadFor("capsule.opened")),
        ]),
        "candidates/candidate-one.yaml": candidateFile("candidate-one"),
      },
    });
    try {
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: makeCapsuleRuntime(tree.changes),
      });
      expect(run.exitCode).toBe(1);
      expect(errorOf(run.envelope).code).toBe("closeout.capsule-invalid");
      expect(run.envelope.data).toBeUndefined();
    } finally {
      tree.cleanup();
    }
  });

  test("a candidate with multiple promotion decisions is capsule-invalid before any write", async () => {
    const tree = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
      files: {
        "events.jsonl": eventsText([
          makeEvent(1, "capsule.opened", "closeout", payloadFor("capsule.opened")),
          makeEvent(2, "capsule.promotion", "closeout", {
            id: "candidate-one",
            class: "lesson",
            decision: "promoted",
            mode: "home-write",
            home: "lessons/lesson-2026-001-candidate-one.md",
          }),
          makeEvent(3, "capsule.promotion", "closeout", {
            id: "candidate-one",
            class: "lesson",
            decision: "promoted",
            mode: "home-write",
            home: "lessons/lesson-2026-002-candidate-one.md",
          }),
        ]),
        "candidates/candidate-one.yaml": candidateFile("candidate-one"),
      },
    });
    try {
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: makeCapsuleRuntime(tree.changes),
      });
      expect(run.exitCode).toBe(1);
      expect(errorOf(run.envelope).code).toBe("closeout.capsule-invalid");
    } finally {
      tree.cleanup();
    }
  });

  test("plan mode renders would-refuse for a candidate with zero decisions", async () => {
    const tree = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
      files: {
        "events.jsonl": eventsText([
          makeEvent(1, "capsule.opened", "closeout", payloadFor("capsule.opened")),
        ]),
        "candidates/candidate-one.yaml": candidateFile("candidate-one"),
      },
    });
    try {
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF], {
        capsule: makeCapsuleRuntime(tree.changes),
      });
      expect(run.exitCode).toBe(0);
      const step = closeoutData(run.envelope).steps.find((entry) => entry.stepId === "capsule");
      expect(step?.outcome).toBe("would-refuse");
      expect(step?.reason).toBe("closeout.capsule-invalid");
    } finally {
      tree.cleanup();
    }
  });
});

describe("TC-CAP-012/014 pre-flight has zero effects", () => {
  test("an invalid candidate aborts before any provider write, git mutation, or state append", async () => {
    const tree = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
      files: {
        "events.jsonl": eventsText([
          makeEvent(1, "capsule.opened", "closeout", payloadFor("capsule.opened")),
        ]),
        "candidates/bad-candidate.yaml":
          'id: "bad-candidate"\nclass: "lesson"\nscope: "galaxy"\nstatement: "x"\nevidence: "test:x"\nbasis: "review-catch"\nsource: "x"\ntrust: "T3"\nstatus: "candidate"\ncreated_by: "x"\ncreated: "2026-11-07"\n',
      },
    });
    try {
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: makeCapsuleRuntime(tree.changes),
      });
      expect(run.exitCode).toBe(1);
      expect(errorOf(run.envelope).code).toBe("closeout.capsule-invalid");
      const writes = run.provider.calls
        .map((call) => call.kind)
        .filter((kind) =>
          ["transitionWorkItem", "writeWorkItem", "resolveDeliveryThread"].includes(kind),
        );
      expect(writes).toEqual([]);
      expect(
        run.git.calls
          .map((call) => call.kind)
          .filter((kind) => ["restoreCheckout", "deleteBranch"].includes(kind)),
      ).toEqual([]);
      expect(run.state.fence.appends).toBe(0);
    } finally {
      tree.cleanup();
    }
  });
});
