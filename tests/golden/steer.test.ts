/**
 * TC-STEER-023 (golden half) — the `steer list` human form and machine `data`
 * against the committed golden pair created by this change.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { asksWith, ownerAsk } from "../fixtures/steer/ask-matrix";
import { CREATED, lifecycleMatrix, makeAppliedOutcome, makeMessage } from "../fixtures/steer/cases";
import { createSteerHarness } from "../fixtures/steer/harness";
import { NO_PHASE_RECORD } from "../fixtures/steer/phase-boundary";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/steer/golden");

const seed = (harness: ReturnType<typeof createSteerHarness>): void => {
  const matrix = lifecycleMatrix();
  for (const message of matrix.messages) harness.seedMessage(message);
  for (const outcome of matrix.outcomes) harness.seedOutcome(outcome);
  for (const completion of matrix.completions) harness.seedCompletion(completion);
};

describe("TC-STEER-023 the steer list golden pair", () => {
  test("the human form and the machine data are the committed bytes and are stable", async () => {
    expect(existsSync(join(GOLDEN, "list.txt"))).toBe(true);
    expect(existsSync(join(GOLDEN, "list.json"))).toBe(true);
    expect(existsSync(join(GOLDEN, "regenerate.ts"))).toBe(true);
    const harness = createSteerHarness();
    try {
      seed(harness);
      const first = await harness.run(["list"], { json: false });
      const second = await harness.run(["list"], { json: false });
      expect(first.stdout).toBe(second.stdout);
      expect(first.stdout).toBe(readFileSync(join(GOLDEN, "list.txt"), "utf8"));
      const machine = await harness.run(["list"]);
      const machineAgain = await harness.run(["list"]);
      expect(JSON.stringify(machineAgain.data)).toBe(JSON.stringify(machine.data));
      expect(`${JSON.stringify(machine.data, null, 2)}\n`).toBe(
        readFileSync(join(GOLDEN, "list.json"), "utf8"),
      );
    } finally {
      harness.cleanup();
    }
  });
});

type Form = "send" | "read" | "complete";

const fixtureFor = (form: Form): ReturnType<typeof createSteerHarness> => {
  if (form === "send") return createSteerHarness({ phase: NO_PHASE_RECORD });
  if (form === "read") {
    const harness = createSteerHarness({
      phase: NO_PHASE_RECORD,
      asks: asksWith({
        facts: [ownerAsk({ id: "q-golden" })],
        defaultableRefs: { "GH-298": "allow-after-window" },
      }),
    });
    harness.seedMessage(makeMessage({ id: "msg-golden", created: CREATED }));
    return harness;
  }
  const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
  const landed = makeMessage({ id: "msg-golden", created: CREATED });
  harness.seedMessage(landed);
  harness.seedOutcome(makeAppliedOutcome(landed));
  return harness;
};

const ARGV = {
  send: ["send", "golden note"],
  read: ["read"],
  complete: ["complete", "msg-golden", "--ref", "doc/proof.md"],
} as const;

describe("TC-STEER-081 the send, read, and complete golden forms", () => {
  for (const form of ["send", "read", "complete"] as const) {
    test(`${form} matches its committed golden pair`, async () => {
      expect(existsSync(join(GOLDEN, `${form}.txt`))).toBe(true);
      expect(existsSync(join(GOLDEN, `${form}.json`))).toBe(true);
      const humanHarness = fixtureFor(form);
      const human = await humanHarness.run(ARGV[form], { json: false });
      humanHarness.cleanup();
      expect(human.stdout).toBe(readFileSync(join(GOLDEN, `${form}.txt`), "utf8"));
      const machineHarness = fixtureFor(form);
      const machine = await machineHarness.run(ARGV[form]);
      machineHarness.cleanup();
      expect(`${JSON.stringify(machine.data, null, 2)}\n`).toBe(
        readFileSync(join(GOLDEN, `${form}.json`), "utf8"),
      );
    });
  }
});
