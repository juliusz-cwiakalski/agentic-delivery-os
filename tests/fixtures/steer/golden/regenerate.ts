/**
 * Regenerate the four committed `steer` golden forms from their canonical
 * fixtures. Run explicitly: `bun run tests/fixtures/steer/golden/regenerate.ts`.
 * The diff must show only the declared delta; no blanket rewrite exists.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { asksWith, ownerAsk } from "../ask-matrix";
import { CREATED, lifecycleMatrix, makeAppliedOutcome, makeMessage } from "../cases";
import { createSteerHarness } from "../harness";
import { NO_PHASE_RECORD } from "../phase-boundary";

type Harness = ReturnType<typeof createSteerHarness>;

const fixtureFor = (form: "send" | "list" | "read" | "complete"): Harness => {
  if (form === "send") return createSteerHarness({ phase: NO_PHASE_RECORD });
  if (form === "list") {
    const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
    const matrix = lifecycleMatrix();
    for (const message of matrix.messages) harness.seedMessage(message);
    for (const outcome of matrix.outcomes) harness.seedOutcome(outcome);
    for (const completion of matrix.completions) harness.seedCompletion(completion);
    return harness;
  }
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
  list: ["list"],
  read: ["read"],
  complete: ["complete", "msg-golden", "--ref", "doc/proof.md"],
} as const;

const run = async (): Promise<void> => {
  for (const form of ["send", "list", "read", "complete"] as const) {
    const humanHarness = fixtureFor(form);
    const human = await humanHarness.run(ARGV[form], { json: false });
    humanHarness.cleanup();
    const machineHarness = fixtureFor(form);
    const machine = await machineHarness.run(ARGV[form]);
    machineHarness.cleanup();
    writeFileSync(join(import.meta.dir, `${form}.txt`), human.stdout);
    writeFileSync(
      join(import.meta.dir, `${form}.json`),
      `${JSON.stringify(machine.data, null, 2)}\n`,
    );
  }
};

if (import.meta.main) await run();
